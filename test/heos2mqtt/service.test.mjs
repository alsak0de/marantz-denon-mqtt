import test from "node:test";
import assert from "node:assert/strict";
import { Heos2Mqtt } from "../../src/heos2mqtt/service.mjs";

function service() {
  const published = [];
  const instance = new Heos2Mqtt({
    mqttBaseTopic: "home/heos",
    heartbeatMs: 30000,
    requestTimeoutMs: 100,
    commandGapMs: 0,
    publishRaw: true,
    logLevel: "silent",
  }, { log() {}, error() {} });
  instance.mqttClient = {
    publish(topic, payload, options) {
      published.push({ topic, payload, retain: options.retain });
    },
  };
  return { instance, published };
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

function lastPayload(published, topic) {
  const matches = published.filter(item => item.topic === topic);
  return matches.at(-1)?.payload;
}
