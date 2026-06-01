import test from "node:test";
import assert from "node:assert/strict";
import { Heos2Mqtt } from "../../src/heos2mqtt/service.mjs";

function service() {
  const published = [];
  const logs = [];
  const instance = new Heos2Mqtt({
    mqttBaseTopic: "home/heos",
    heartbeatMs: 30000,
    requestTimeoutMs: 100,
    commandGapMs: 0,
    publishRaw: true,
    probeQueueOnStart: false,
    preserveMuteOnVolume: false,
    logLevel: "silent",
  }, {
    log(...args) {
      logs.push(args.join(" "));
    },
    error(...args) {
      logs.push(args.join(" "));
    },
  });
  instance.mqttClient = {
    publish(topic, payload, options, callback) {
      published.push({ topic, payload, retain: options.retain, qos: options.qos });
      if (callback) setImmediate(() => callback());
    },
    async endAsync() {},
  };
  return { instance, published, logs };
}

test("gates now-playing on play state", () => {
  const { instance, published } = service();

  instance.handleHeosLine(JSON.stringify({
    heos: { command: "player/get_play_state", result: "success", message: "pid=1&state=pause" },
  }));
  instance.handleHeosLine(JSON.stringify({
    heos: { command: "player/get_now_playing_media", result: "ok", message: "pid=1" },
    payload: { song: "Stale", mid: "spotify:track:stale", sid: 4 },
  }));

  assert.equal(lastPayload(published, "home/heos/player/1/now-playing"), "{}");

  instance.handleHeosLine(JSON.stringify({
    heos: { command: "player/get_play_state", result: "ok", message: "pid=1&state=play" },
  }));
  instance.handleHeosLine(JSON.stringify({
    heos: { command: "player/get_now_playing_media", result: "ok", message: "pid=1" },
    payload: { song: "Current", mid: "spotify:track:current", sid: 4 },
  }));

  assert.equal(
    lastPayload(published, "home/heos/player/1/now-playing"),
    JSON.stringify({ song: "Current", mid: "spotify:track:current", sid: 4 }),
  );
});

test("pause event clears retained now-playing immediately", () => {
  const { instance, published } = service();
  instance.playStateByPid.set("1", "play");
  instance.publishNowPlaying("1", { song: "Current" });

  instance.handleHeosLine(JSON.stringify({
    heos: { command: "event/player_state_changed", result: "ok", message: "pid=1&state=pause" },
  }));

  assert.equal(lastPayload(published, "home/heos/player/1/state"), "pause");
  assert.equal(lastPayload(published, "home/heos/player/1/now-playing"), "{}");
});

test("now-playing changed event re-queries but still respects paused gate", async () => {
  const { instance, published } = service();
  instance.playStateByPid.set("1", "pause");
  instance.request = async (command, params) => {
    assert.equal(command, "player/get_now_playing_media");
    instance.publishGatedNowPlaying(params.pid, { song: "Stale" });
  };

  instance.handleHeosLine(JSON.stringify({
    heos: { command: "event/player_now_playing_media_changed", result: "ok", message: "pid=1" },
  }));
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(lastPayload(published, "home/heos/player/1/now-playing"), "{}");
});

test("autofocus alias mirrors player state topics", () => {
  const { instance, published } = service();
  instance.config.autoFocusPlayerName = "Living Room";
  instance.updatePlayers([{ pid: "42", name: "Living Room" }]);
  instance.publishPlayerState("42", "play");

  assert.equal(lastPayload(published, "home/heos/main/state"), "play");
});

test("raw firehose publishes every HEOS line as non-retained JSON", () => {
  const { instance, published } = service();

  instance.handleHeosLine(JSON.stringify({
    heos: { command: "system/heart_beat", result: "ok", message: "" },
  }));

  const raw = published.find(item => item.topic === "home/heos/event/raw");
  assert.equal(raw.retain, false);
  assert.match(JSON.parse(raw.payload).line, /system\/heart_beat/);
});

test("graceful stop publishes retained offline availability with qos 1 before MQTT end", async () => {
  const { instance, published, logs } = service();
  let ended = false;
  instance.config.logLevel = "info";
  instance.mqttClient.endAsync = async () => {
    ended = true;
  };
  instance.socket = { destroy() {} };

  await instance.stop();

  assert.equal(ended, true);
  const offline = published.find(item => item.topic === "home/heos/availability");
  assert.deepEqual(offline, {
    topic: "home/heos/availability",
    payload: "offline",
    retain: true,
    qos: 1,
  });
  assert.equal(logs.some(line => line.includes("shutdown: published availability=offline")), true);
});

test("startup refresh skips queue probe by default", async () => {
  const { instance } = service();
  const commands = [];
  instance.request = async (command, params) => {
    commands.push({ command, params });
    return {};
  };

  await instance.refreshPlayer("1");

  assert.equal(commands.some(item => item.command === "player/get_queue"), false);
});

test("startup refresh can probe queue without range when explicitly enabled", async () => {
  const { instance } = service();
  const commands = [];
  instance.config.probeQueueOnStart = true;
  instance.request = async (command, params) => {
    commands.push({ command, params });
    return {};
  };

  await instance.refreshPlayer("1");

  assert.deepEqual(commands.at(-1), { command: "player/get_queue", params: { pid: "1" } });
});

test("optional mute preservation reasserts mute after volume event unmutes firmware", async () => {
  const { instance, published } = service();
  const sent = [];
  instance.config.preserveMuteOnVolume = true;
  instance.request = async (command, params) => {
    sent.push({ command, params });
    if (command === "player/get_mute") return { params: { pid: params.pid, state: "on" } };
    return { params };
  };

  await instance.sendCommands({ command: "player/set_volume", params: { pid: "1", level: 1 } });
  await instance.handleEvent({
    command: "event/player_volume_changed",
    params: { pid: "1", level: "1", mute: "off" },
  });
  instance.handleHeosLine(JSON.stringify({
    heos: { command: "player/set_mute", result: "ok", message: "pid=1&state=on" },
  }));

  assert.deepEqual(sent, [
    { command: "player/get_mute", params: { pid: "1" } },
    { command: "player/set_volume", params: { pid: "1", level: 1 } },
    { command: "player/set_mute", params: { pid: "1", state: "on" } },
  ]);
  assert.equal(lastPayload(published, "home/heos/player/1/mute"), "on");
});

function lastPayload(published, topic) {
  const matches = published.filter(item => item.topic === topic);
  return matches.at(-1)?.payload;
}
