import test from "node:test";
import assert from "node:assert/strict";
import {
  commandFromMqtt,
  decodeVolume,
  encodeVolume,
  parseAvrLine,
} from "../../src/marantz2mqtt/avr-protocol.mjs";

test("parses main zone state lines", () => {
  assert.deepEqual(parseAvrLine("PWON"), { key: "power", topic: "power", payload: "ON" });
  assert.deepEqual(parseAvrLine("PWSTANDBY"), { key: "power", topic: "power", payload: "STANDBY" });
  assert.deepEqual(parseAvrLine("SINET"), { key: "source", topic: "source", payload: "NET" });
  assert.deepEqual(parseAvrLine("MV555"), { key: "volume", topic: "volume", payload: "55.5" });
  assert.deepEqual(parseAvrLine("MUOFF"), { key: "mute", topic: "mute", payload: "OFF" });
  assert.deepEqual(parseAvrLine("MSDTS NEURAL:X"), {
    key: "soundMode",
    topic: "sound-mode",
    payload: "DTS NEURAL:X",
  });
});

test("parses zone2 state lines without treating non-source lines as sources", () => {
  assert.deepEqual(parseAvrLine("Z2ON"), { key: "zone2Power", topic: "zone2/power", payload: "ON" });
  assert.deepEqual(parseAvrLine("Z2OFF"), { key: "zone2Power", topic: "zone2/power", payload: "OFF" });
  assert.deepEqual(parseAvrLine("Z2NET"), { key: "zone2Source", topic: "zone2/source", payload: "NET" });
  assert.deepEqual(parseAvrLine("Z256"), { key: "zone2Volume", topic: "zone2/volume", payload: "56" });
  assert.deepEqual(parseAvrLine("Z2MUON"), { key: "zone2Mute", topic: "zone2/mute", payload: "ON" });
  assert.equal(parseAvrLine("Z2SLP120"), null);
});

test("decodes and encodes AVR volume values", () => {
  assert.equal(decodeVolume("60"), "60");
  assert.equal(decodeVolume("555"), "55.5");
  assert.equal(encodeVolume("0"), "00");
  assert.equal(encodeVolume("5"), "05");
  assert.equal(encodeVolume("55.5"), "555");
  assert.equal(encodeVolume("UP"), "UP");
  assert.throws(() => encodeVolume("55.3"), /Invalid volume/);
  assert.throws(() => encodeVolume("99"), /out of range/);
});

test("translates MQTT command topics to AVR commands", () => {
  assert.equal(commandFromMqtt("power", "ON"), "PWON");
  assert.equal(commandFromMqtt("power", "STANDBY"), "PWSTANDBY");
  assert.equal(commandFromMqtt("source", "phono"), "SIPHONO");
  assert.equal(commandFromMqtt("volume", "55.5"), "MV555");
  assert.equal(commandFromMqtt("volume", "down"), "MVDOWN");
  assert.equal(commandFromMqtt("mute", "toggle", { mute: "ON" }), "MUOFF");
  assert.equal(commandFromMqtt("zone2/power", "off"), "Z2OFF");
  assert.equal(commandFromMqtt("zone2/source", "net"), "Z2NET");
  assert.equal(commandFromMqtt("zone2/volume", "56"), "Z256");
  assert.equal(commandFromMqtt("zone2/mute", "toggle", { zone2Mute: "OFF" }), "Z2MUON");
});
