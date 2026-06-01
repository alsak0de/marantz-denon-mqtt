import test from "node:test";
import assert from "node:assert/strict";
import {
  commandFromMqtt,
  formatHeosCommand,
  isHeosSuccess,
  normalizeNowPlayingPayload,
  parseHeosLine,
} from "../../src/heos2mqtt/protocol.mjs";

test("formats HEOS commands with encoded query parameters", () => {
  assert.equal(formatHeosCommand("player/get_players"), "heos://player/get_players");
  assert.equal(
    formatHeosCommand("browse/search", { sid: 4, search: "Miles & Coltrane", scid: "artist" }),
    "heos://browse/search?sid=4&search=Miles%20%26%20Coltrane&scid=artist",
  );
});

test("parses HEOS responses and message parameters", () => {
  const parsed = parseHeosLine(JSON.stringify({
    heos: {
      command: "player/get_play_state",
      result: "ok",
      message: "pid=123&state=play",
    },
  }));

  assert.equal(parsed.command, "player/get_play_state");
  assert.equal(parsed.result, "ok");
  assert.deepEqual(parsed.params, { pid: "123", state: "play" });
  assert.equal(parsed.isEvent, false);
});

test("accepts both documented ok and observed success result values", () => {
  assert.equal(isHeosSuccess({ result: "ok" }), true);
  assert.equal(isHeosSuccess({ result: "success" }), true);
  assert.equal(isHeosSuccess({ result: "fail" }), false);
});

test("translates MQTT command topics to HEOS commands", () => {
  assert.deepEqual(commandFromMqtt("system/register-events", "on"), {
    command: "system/register_for_change_events",
    params: { enable: "on" },
  });
  assert.deepEqual(commandFromMqtt("player/123/play-state", "pause"), {
    command: "player/set_play_state",
    params: { pid: "123", state: "pause" },
  });
  assert.deepEqual(commandFromMqtt("player/123/volume", "47"), {
    command: "player/set_volume",
    params: { pid: "123", level: 47 },
  });
  assert.deepEqual(commandFromMqtt("player/123/mute", "toggle"), {
    command: "player/toggle_mute",
    params: { pid: "123" },
  });
  assert.deepEqual(commandFromMqtt("group/9/volume-step", "{\"direction\":\"down\",\"step\":3}"), {
    command: "group/volume_down",
    params: { gid: "9", step: 3 },
  });
});

test("keeps browse commands request/response with generated request ids", () => {
  const translated = commandFromMqtt("browse/search", "{\"sid\":4,\"search\":\"abc\",\"request_id\":\"r1\"}");
  assert.deepEqual(translated, {
    command: "browse/search",
    params: { sid: 4, search: "abc" },
    request_id: "r1",
    requestResponse: true,
  });

  const generated = commandFromMqtt("browse/get-sources", "");
  assert.equal(generated.command, "browse/get_music_sources");
  assert.equal(generated.requestResponse, true);
  assert.equal(typeof generated.request_id, "string");
});

test("queue get omits range unless the consumer explicitly requests one", () => {
  assert.deepEqual(commandFromMqtt("player/123/queue/get", ""), {
    command: "player/get_queue",
    params: { pid: "123" },
    requestResponse: true,
  });

  const ranged = commandFromMqtt("player/123/queue/get", "{\"range\":\"0,9\"}");
  assert.deepEqual(ranged, {
    command: "player/get_queue",
    params: { pid: "123", range: "0,9" },
    requestResponse: true,
  });
  assert.equal(
    formatHeosCommand(ranged.command, ranged.params),
    "heos://player/get_queue?pid=123&range=0%2C9",
  );
});

test("set mute responses update retained mute state", () => {
  const parsed = parseHeosLine(JSON.stringify({
    heos: { command: "player/set_mute", result: "ok", message: "pid=123&state=on" },
  }));

  assert.equal(parsed.command, "player/set_mute");
  assert.deepEqual(parsed.params, { pid: "123", state: "on" });
});

test("validates raw commands and unsafe payloads", () => {
  assert.equal(commandFromMqtt("raw", "heos://system/heart_beat"), "heos://system/heart_beat");
  assert.deepEqual(commandFromMqtt("raw-batch", "[\"heos://system/heart_beat\"]"), ["heos://system/heart_beat"]);
  assert.throws(() => commandFromMqtt("raw", "player/get_players"), /heos:\/\//);
  assert.throws(() => commandFromMqtt("raw", "heos://system/heart_beat\nheos://player/get_players"), /CR or LF/);
  assert.throws(() => commandFromMqtt("player/123/volume", "101"), /0-100/);
});

test("passes now-playing metadata through without enrichment or coalescing", () => {
  assert.deepEqual(normalizeNowPlayingPayload({
    type: "station",
    song: "Track",
    station: "Track",
    artist: "Artist",
    album: "Album",
    image_url: "http://example/cover.jpg",
    mid: "spotify:track:abc",
    sid: 4,
    qid: 7,
    album_id: "album",
    ignored: "value",
  }), {
    type: "station",
    song: "Track",
    station: "Track",
    artist: "Artist",
    album: "Album",
    image_url: "http://example/cover.jpg",
    mid: "spotify:track:abc",
    sid: 4,
    qid: 7,
    album_id: "album",
  });
});
