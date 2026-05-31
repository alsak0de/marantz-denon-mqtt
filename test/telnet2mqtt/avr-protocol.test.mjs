import test from "node:test";
import assert from "node:assert/strict";
import {
  commandFromMqtt,
  decodeVolume,
  encodeVolume,
  parseAvrLine,
} from "../../src/telnet2mqtt/avr-protocol.mjs";

test("parses main zone state lines", () => {
  assert.deepEqual(parseAvrLine("PWON"), { key: "power", topic: "power", payload: "ON" });
  assert.deepEqual(parseAvrLine("PWSTANDBY"), { key: "power", topic: "power", payload: "STANDBY" });
  assert.deepEqual(parseAvrLine("ZMON"), { key: "mainZonePower", topic: "main-zone/power", payload: "ON" });
  assert.deepEqual(parseAvrLine("SINET"), { key: "source", topic: "source", payload: "NET" });
  assert.deepEqual(parseAvrLine("MV555"), { key: "volume", topic: "volume", payload: "55.5" });
  assert.deepEqual(parseAvrLine("MVMAX 695"), { key: "volumeMax", topic: "volume/max", payload: "69.5" });
  assert.deepEqual(parseAvrLine("MUOFF"), { key: "mute", topic: "mute", payload: "OFF" });
  assert.deepEqual(parseAvrLine("MSDTS NEURAL:X"), {
    key: "soundMode",
    topic: "sound-mode",
    payload: "DTS NEURAL:X",
  });
  assert.deepEqual(parseAvrLine("SPPR 2"), { key: "speakerPreset", topic: "speaker-preset", payload: "2" });
  assert.deepEqual(parseAvrLine("SDHDMI"), { key: "signalInputMode", topic: "signal-input-mode", payload: "HDMI" });
  assert.deepEqual(parseAvrLine("SLP030"), { key: "sleep", topic: "sleep", payload: "030" });
});

test("parses zone2 state lines without treating non-source lines as sources", () => {
  assert.deepEqual(parseAvrLine("Z2ON"), { key: "zone2Power", topic: "zone2/power", payload: "ON" });
  assert.deepEqual(parseAvrLine("Z2OFF"), { key: "zone2Power", topic: "zone2/power", payload: "OFF" });
  assert.deepEqual(parseAvrLine("Z2NET"), { key: "zone2Source", topic: "zone2/source", payload: "NET" });
  assert.deepEqual(parseAvrLine("Z256"), { key: "zone2Volume", topic: "zone2/volume", payload: "56" });
  assert.deepEqual(parseAvrLine("Z2MUON"), { key: "zone2Mute", topic: "zone2/mute", payload: "ON" });
  assert.deepEqual(parseAvrLine("Z2SLP120"), { key: "zone2Sleep", topic: "zone2/sleep", payload: "120" });
  assert.deepEqual(parseAvrLine("Z2HPFOFF"), { key: "zone2HighPassFilter", topic: "zone2/high-pass-filter", payload: "OFF" });
});

test("parses companion, channel, and audio processing lines", () => {
  assert.deepEqual(parseAvrLine("SVOFF"), { key: "videoSource", topic: "video/source", payload: "OFF" });
  assert.deepEqual(parseAvrLine("VSSCHOFF"), { key: "videoScaler", topic: "video/scaler", payload: "OFF" });
  assert.deepEqual(parseAvrLine("OPALSSET ON"), { key: "autoLevelSetEnabled", topic: "auto-level-set/enabled", payload: "ON" });
  assert.deepEqual(parseAvrLine("SYSMI Multi Ch Stereo"), { key: "systemModeDisplay", topic: "system/mode-display", payload: "Multi Ch Stereo" });
  assert.deepEqual(parseAvrLine("CVFL 50"), { key: "channel-volume/fl", topic: "channel-volume/fl", payload: "50" });
  assert.deepEqual(parseAvrLine("CVEND"), { key: "channelVolumeEnd", topic: "channel-volume/end", payload: "END" });
  assert.deepEqual(parseAvrLine("PSDYNEQ ON"), { key: "audyssey/dynamic-eq", topic: "audyssey/dynamic-eq", payload: "ON" });
  assert.deepEqual(parseAvrLine("PSTONE CTRL OFF"), { key: "tone/control", topic: "tone/control", payload: "OFF" });
  assert.deepEqual(parseAvrLine("PSCEN 03"), { key: "audio/center-width", topic: "audio/center-width", payload: "03" });
  assert.deepEqual(parseAvrLine("OPSMLALL MUS081DTS Neural:X"), {
    key: "smart-mode-list/mus/08",
    topic: "smart-mode-list/mus/08",
    payload: JSON.stringify({ group: "MUS", code: "081", active: true, name: "DTS Neural:X" }),
  });
  assert.deepEqual(parseAvrLine("OPSMLALL END"), { key: "smartModeListEnd", topic: "smart-mode-list/end", payload: "END" });
  assert.deepEqual(parseAvrLine("SSLEVSR 51"), { key: "speaker-setup/channel-level/sr", topic: "speaker-setup/channel-level/sr", payload: "51" });
  assert.deepEqual(parseAvrLine("SSSDEFL 0360"), { key: "speaker-setup/distance/fl", topic: "speaker-setup/distance/fl", payload: "0360" });
  assert.deepEqual(parseAvrLine("SSSDE END"), { key: "speaker-setup/distance/end", topic: "speaker-setup/distance/end", payload: "END" });
  assert.deepEqual(parseAvrLine("SSFUNGARAUX1 Fire TV Stick"), { key: "source/name/aux1", topic: "source/name/aux1", payload: "Fire TV Stick" });
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
  assert.equal(commandFromMqtt("main-zone/power", "toggle", { mainZonePower: "ON" }), "ZMOFF");
  assert.equal(commandFromMqtt("sound-mode", "dts neural:x"), "MSNEURAL:X");
  assert.equal(commandFromMqtt("sound-mode", "dts virtual:x"), "MSVIRTUAL:X");
  assert.equal(commandFromMqtt("sound-mode", "dolby surround"), "MSDOLBY AUDIO-DSUR");
  assert.equal(commandFromMqtt("sound-mode", "multi ch stereo"), "MSMCH STEREO");
  assert.equal(commandFromMqtt("smart-select", "1"), "MSSMART1");
  assert.equal(commandFromMqtt("smart-select/save", "2"), "MSSMART2 MEMORY");
  assert.throws(() => commandFromMqtt("smart-select", "5"), /Use 1-4/);
  assert.equal(commandFromMqtt("speaker-preset", "2"), "SPPR 2");
  assert.equal(commandFromMqtt("signal-input-mode", "hdmi"), "SDHDMI");
  assert.equal(commandFromMqtt("sleep", "30"), "SLP030");
});

test("translates expanded command topics to AVR commands", () => {
  assert.equal(commandFromMqtt("query", "audyssey/dynamic-eq"), "PSDYNEQ?");
  assert.equal(commandFromMqtt("query", "MS"), "MS?");
  assert.equal(commandFromMqtt("raw", "PSDYNEQ ON"), "PSDYNEQ ON");
  assert.deepEqual(commandFromMqtt("raw-batch", "[\"SINET\",\"MSSTEREO\"]"), ["SINET", "MSSTEREO"]);
  assert.equal(commandFromMqtt("channel-volume/fl", "down"), "CVFL DOWN");
  assert.equal(commandFromMqtt("channel-volume/reset-reference", "reset"), "CVZRL");
  assert.equal(commandFromMqtt("audyssey/dynamic-eq", "on"), "PSDYNEQ ON");
  assert.equal(commandFromMqtt("audyssey/audio-delay", "25"), "PSDELAY 025");
  assert.equal(commandFromMqtt("tone/bass", "49"), "PSBAS 49");
  assert.equal(commandFromMqtt("network/playback", "next"), "NS9D");
  assert.equal(commandFromMqtt("menu/up", ""), "MNCUP");
  assert.equal(commandFromMqtt("tuner/frequency", "09570"), "TFAN09570");
  assert.equal(commandFromMqtt("picture/mode", "movie"), "PVPICT MOVIE");
  assert.equal(commandFromMqtt("system/trigger/1", "on"), "TR1 ON");
  assert.equal(commandFromMqtt("cec", "off"), "RCRC51608409");
  assert.throws(() => commandFromMqtt("raw", "MV?\rPW?"), /CR or LF/);
  assert.throws(() => commandFromMqtt("audyssey/dynamic-volume", "loud"), /Invalid/);
});
