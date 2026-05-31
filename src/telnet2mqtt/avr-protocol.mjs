export const STATE_TOPICS = {
  power: "power",
  source: "source",
  volume: "volume",
  mute: "mute",
  soundMode: "sound-mode",
  mainZonePower: "main-zone/power",
  volumeMax: "volume/max",
  speakerPreset: "speaker-preset",
  smartSelect: "smart-select",
  quickSelect: "quick-select",
  smartSurround: "smart-surround",
  signalInputMode: "signal-input-mode",
  digitalInputMode: "digital-input-mode",
  sleep: "sleep",
  zone2Power: "zone2/power",
  zone2Source: "zone2/source",
  zone2Volume: "zone2/volume",
  zone2Mute: "zone2/mute",
  zone2Sleep: "zone2/sleep",
  zone2HighPassFilter: "zone2/high-pass-filter",
  zone3Power: "zone3/power",
  zone3Source: "zone3/source",
  zone3Volume: "zone3/volume",
  zone3Mute: "zone3/mute",
  videoSource: "video/source",
  videoScaler: "video/scaler",
  videoProcessing: "video/processing",
  videoHdmiMonitor: "video/hdmi-monitor",
  videoHdmiAudio: "video/hdmi-audio",
  autoLevelSetEnabled: "auto-level-set/enabled",
  autoLevelSetDsp: "auto-level-set/dsp",
  autoLevelSetValue: "auto-level-set/value",
  systemModeDisplay: "system/mode-display",
  systemDisplayAudio: "system/display-audio",
  systemInputBitmask: "system/input-bitmask",
  systemAudioAspectBitmask: "system/audio-aspect-bitmask",
  systemAudioSamplingFrequency: "system/audio-sampling-frequency",
  systemSmartModeGroup: "system/smart-mode-group",
  smartModeListEnd: "smart-mode-list/end",
  bluetoothTransmitter: "bluetooth/transmitter",
  opticalTransmitter: "optical/transmitter",
  channelVolumeEnd: "channel-volume/end",
};

const RAW_COMMAND_MAX_LENGTH = 160;

const QUERY_COMMANDS = {
  power: "PW?",
  "main-zone": "ZM?",
  volume: "MV?",
  mute: "MU?",
  source: "SI?",
  "sound-mode": "MS?",
  "speaker-preset": "SPPR?",
  "channel-volume": "CV?",
  zone2: "Z2?",
  "zone2-mute": "Z2MU?",
  "zone2-sleep": "Z2SLP?",
  "signal-input-mode": "SD?",
  sleep: "SLP?",
  "video-source": "SV?",
  tuner: "TF?",
  "tone-control": "PSTONE CTRL?",
  "audyssey/dynamic-eq": "PSDYNEQ?",
  "audyssey/reference-level-offset": "PSREFLEV?",
  "audyssey/dynamic-volume": "PSDYNVOL?",
  "audyssey/dynamic-compression": "PSDRC?",
  "audyssey/lfe": "PSLFE?",
  "audyssey/effect-level": "PSEFF?",
  "audyssey/effect-delay": "PSDEL?",
  "audyssey/subwoofer": "PSSWR?",
  "audyssey/loudness-management": "PSLOM?",
  "audyssey/audio-delay": "PSDELAY?",
  "tone/bass": "PSBAS?",
  "tone/treble": "PSTRE?",
  "audio/multeq": "PSMULTEQ:?",
  "audio/cinema-eq": "PSCINEMA EQ.?",
  "audio/restorer": "PSRSTR?",
  "audio/room-size": "PSRSZ?",
};

const SIMPLE_VALUE_COMMANDS = {
  "audyssey/dynamic-eq": { prefix: "PSDYNEQ ", values: ["ON", "OFF"] },
  "audyssey/reference-level-offset": { prefix: "PSREFLEV ", values: ["0", "5", "10", "15"] },
  "audyssey/dynamic-volume": { prefix: "PSDYNVOL ", values: ["OFF", "LIT", "MED", "HEV"] },
  "audyssey/dynamic-compression": { prefix: "PSDRC ", values: ["OFF", "LOW", "MID", "HI", "AUTO"] },
  "audyssey/subwoofer": { prefix: "PSSWR ", values: ["ON", "OFF"] },
  "audyssey/loudness-management": { prefix: "PSLOM ", values: ["ON", "OFF"] },
  "tone/control": { prefix: "PSTONE CTRL ", values: ["ON", "OFF"] },
  "audio/cinema-eq": { prefix: "PSCINEMA EQ.", values: ["ON", "OFF"] },
  "audio/center-spread": { prefix: "PSCES ", values: ["ON", "OFF"] },
  "audio/mdax": { prefix: "PSMDAX ", values: ["ON", "OFF"] },
  "audio/headphone-eq": { prefix: "PSHEQ ", values: ["ON", "OFF"] },
  "audio/neural-x": { prefix: "PSNEURAL ", values: ["ON", "OFF"] },
  "audio/lfc": { prefix: "PSLFC ", values: ["ON", "OFF"] },
  "audio/bass-sync": { prefix: "PSBSC ", values: ["ON", "OFF"] },
  "audio/speaker-virtualizer": { prefix: "PSSPV ", values: ["ON", "OFF"] },
  "zone2/bass": { prefix: "Z2PSBAS " },
  "zone2/treble": { prefix: "Z2PSTRE " },
  "audio/dac-filter": { prefix: "PSDACFIL " },
  "audio/imax/mode": { prefix: "PSIMAX " },
  "audio/imax/audio": { prefix: "PSIMAXAUD " },
  "audio/imax/hpf": { prefix: "PSIMAXHPF " },
  "audio/imax/lpf": { prefix: "PSIMAXLPF " },
  "audio/imax/subwoofer-mode": { prefix: "PSIMAXSWM " },
  "audio/imax/subwoofer-output": { prefix: "PSIMAXSWO " },
  "audio/auro/mode": { prefix: "PSAUROMODE " },
  "audio/auro/preset": { prefix: "PSAUROPR " },
  "audio/auro/strength": { prefix: "PSAUROST " },
  "audio/dirac": { prefix: "PSDIRAC " },
  "audio/lfc-amount": { prefix: "PSCNTAMT " },
  "audio/dialog-enhancer": { prefix: "PSDEH " },
  "audio/dialog-control": { prefix: "PSDIC " },
  "audio/speaker-profile": { prefix: "PSSP:" },
  "audio/restorer": { prefix: "PSRSTR " },
  "audio/room-size": { prefix: "PSRSZ " },
  "audio/subwoofer-level": { prefix: "PSSWL " },
  "audio/subwoofer2-level": { prefix: "PSSWL2 " },
  "video/scaling": { prefix: "VSSCH" },
  "video/processing": { prefix: "VSVPM" },
  "video/hdmi-monitor": { prefix: "VSMONI" },
  "video/hdmi-audio": { prefix: "VSAUDIO " },
  "system/auto-standby": { prefix: "STBY" },
  "system/eco-mode": { prefix: "ECO" },
  "system/display-dimmer": { prefix: "DIM " },
  "system/illumination": { prefix: "ILB " },
  "system/remote-lock": { prefix: "SYREMOTE LOCK " },
  "system/panel-lock": { prefix: "SYPANEL LOCK " },
  "system/panel-volume-lock": { prefix: "SYPANEL+V LOCK ", values: ["ON", "OFF"] },
  "bluetooth/transmitter": { prefix: "BTTX " },
};

const MENU_COMMANDS = {
  "menu/up": "MNCUP",
  "menu/down": "MNCDN",
  "menu/left": "MNCLT",
  "menu/right": "MNCRT",
  "menu/enter": "MNENT",
  "menu/back": "MNRTN",
  "menu/options": "MNOPT",
  "menu/info": "MNINF",
  "menu/channel": "MNCHL",
};

const NETWORK_PLAYBACK = {
  PLAY: "NS9A",
  PAUSE: "NS9B",
  STOP: "NS9C",
  NEXT: "NS9D",
  PREVIOUS: "NS9E",
  PREV: "NS9E",
};

const CHANNELS = new Set([
  "FL", "FR", "C", "SW", "SL", "SR", "SBL", "SBR", "SW2", "FHL", "FHR",
  "TFL", "TFR", "TML", "TMR",
]);

const ZONE2_NON_SOURCE = [
  /^Z2MU/,
  /^Z2SLP/,
  /^Z2HPF/,
  /^Z2CV/,
  /^Z2PS/,
  /^Z2\d+$/,
  /^Z2ON$/,
  /^Z2OFF$/,
];

export function parseAvrLine(line) {
  if (line === "?") return dynamicState("event/error", "unsupported");

  if (line === "PWON") return state("power", "ON");
  if (line === "PWSTANDBY") return state("power", "STANDBY");
  if (line === "ZMON") return state("mainZonePower", "ON");
  if (line === "ZMOFF") return state("mainZonePower", "OFF");

  if (line === "MUON") return state("mute", "ON");
  if (line === "MUOFF") return state("mute", "OFF");

  if (line.startsWith("SI")) return state("source", line.slice(2));
  if (line === "SVOFF") return state("videoSource", "OFF");
  if (line.startsWith("SV")) return state("videoSource", line.slice(2));
  if (line.startsWith("VSSCH")) return state("videoScaler", line.slice(5));
  if (line.startsWith("VSVPM")) return state("videoProcessing", line.slice(5));
  if (line.startsWith("VSMONI")) return state("videoHdmiMonitor", line.slice(6));
  if (line.startsWith("VSAUDIO ")) return state("videoHdmiAudio", line.slice(8).trim());

  if (line.startsWith("MVMAX ")) return state("volumeMax", decodeVolume(line.slice(6).trim()));
  if (line.startsWith("MV") && /^MV\d+$/.test(line)) {
    return state("volume", decodeVolume(line.slice(2)));
  }

  if (/^MSSMART[1-5](?: MEMORY)?$/.test(line)) {
    return state("smartSelect", line.slice("MSSMART".length));
  }
  if (/^MSQUICK[1-5](?: MEMORY)?$/.test(line)) {
    return state("quickSelect", line.slice("MSQUICK".length));
  }
  if (/^MSSMART(?:2CH|5CH|7CH)?$/.test(line)) {
    return state("smartSurround", line.slice(2));
  }
  if (line.startsWith("MS")) return state("soundMode", line.slice(2));

  if (line.startsWith("SPPR ")) return state("speakerPreset", line.slice(5).trim());
  if (line.startsWith("SD")) return state("signalInputMode", line.slice(2));
  if (line.startsWith("DC")) return state("digitalInputMode", line.slice(2));
  if (line === "SLPOFF") return state("sleep", "OFF");
  if (/^SLP\d{3}$/.test(line)) return state("sleep", line.slice(3));

  if (line === "Z2ON") return state("zone2Power", "ON");
  if (line === "Z2OFF") return state("zone2Power", "OFF");
  if (line === "Z2MUON") return state("zone2Mute", "ON");
  if (line === "Z2MUOFF") return state("zone2Mute", "OFF");
  if (line === "Z2SLPOFF") return state("zone2Sleep", "OFF");
  if (/^Z2SLP\d{3}$/.test(line)) return state("zone2Sleep", line.slice(5));
  if (line === "Z2HPFON") return state("zone2HighPassFilter", "ON");
  if (line === "Z2HPFOFF") return state("zone2HighPassFilter", "OFF");
  if (/^Z2\d+$/.test(line)) return state("zone2Volume", decodeVolume(line.slice(2)));
  if (line.startsWith("Z2") && !ZONE2_NON_SOURCE.some(pattern => pattern.test(line))) {
    return state("zone2Source", line.slice(2));
  }

  if (line === "Z3ON") return state("zone3Power", "ON");
  if (line === "Z3OFF") return state("zone3Power", "OFF");
  if (line === "Z3MUON") return state("zone3Mute", "ON");
  if (line === "Z3MUOFF") return state("zone3Mute", "OFF");
  if (/^Z3\d+$/.test(line)) return state("zone3Volume", decodeVolume(line.slice(2)));
  if (line.startsWith("Z3")) return state("zone3Source", line.slice(2));

  if (line === "CVEND") return state("channelVolumeEnd", "END");
  {
    const match = line.match(/^CV([A-Z0-9]+) (.+)$/);
    if (match) return dynamicState(`channel-volume/${match[1].toLowerCase()}`, match[2].trim());
  }

  const psState = parsePsLine(line);
  if (psState) return psState;

  if (line.startsWith("OPALSSET ")) return state("autoLevelSetEnabled", line.slice(9).trim());
  if (line.startsWith("OPALSDSP ")) return state("autoLevelSetDsp", line.slice(9).trim());
  if (line.startsWith("OPALSVAL ")) return state("autoLevelSetValue", line.slice(9).trim());
  if (line.startsWith("SYSMI ")) return state("systemModeDisplay", line.slice(6).trim());
  if (line.startsWith("SYSDA ")) return state("systemDisplayAudio", line.slice(6).trim());
  if (line.startsWith("OPINFINS ")) return state("systemInputBitmask", line.slice(9).trim());
  if (line.startsWith("OPINFASP ")) return state("systemAudioAspectBitmask", line.slice(9).trim());
  if (line === "OPSMLALL END") return state("smartModeListEnd", "END");
  if (line.startsWith("OPSMLALL ")) return smartModeListLine(line.slice(9).trim());
  if (line.startsWith("SSINFAISFSV ")) return state("systemAudioSamplingFrequency", line.slice(12).trim());
  if (line.startsWith("SSSMG ")) return state("systemSmartModeGroup", line.slice(6).trim());
  if (line.startsWith("SSBEL ")) return dynamicState("speaker-setup/levels/end", "END");
  if (line.startsWith("SSBEL")) return speakerSetupLine("speaker-setup/levels", line.slice(5));
  if (line.startsWith("SSLEV ")) return dynamicState("speaker-setup/channel-level/end", "END");
  if (line.startsWith("SSLEV")) return speakerSetupLine("speaker-setup/channel-level", line.slice(5));
  if (line.startsWith("SSTTL ")) return dynamicState("speaker-setup/test-tone-level/end", "END");
  if (line.startsWith("SSTTL")) return speakerSetupLine("speaker-setup/test-tone-level", line.slice(5));
  if (line.startsWith("SSSPC")) return speakerSetupLine("speaker-setup/speaker-config", line.slice(5));
  if (line.startsWith("SSSDE ")) return dynamicState("speaker-setup/distance/end", "END");
  if (line.startsWith("SSSDE")) return speakerSetupLine("speaker-setup/distance", line.slice(5));
  if (line.startsWith("SSFUNGAR END")) return dynamicState("source/function-name/end", "END");
  if (line.startsWith("SSFUNGAR")) return sourceNameLine(line.slice(8));
  if (line.startsWith("BTTX ")) return state("bluetoothTransmitter", line.slice(5).trim());
  if (line.startsWith("OPTXM ")) return state("opticalTransmitter", line.slice(6).trim());

  return null;
}

export function decodeVolume(raw) {
  if (/^\d{3}$/.test(raw)) return `${raw.slice(0, 2)}.${raw[2]}`;
  return raw;
}

export function encodeVolume(value) {
  const payload = String(value).trim().toUpperCase();
  if (payload === "UP" || payload === "DOWN") return payload;

  if (!/^\d{1,2}(\.5|\.0)?$/.test(payload)) {
    throw new Error(`Invalid volume "${value}". Use 0-98, half steps, UP, or DOWN.`);
  }

  const numeric = Number(payload);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 98) {
    throw new Error(`Volume out of range "${value}". Use 0-98.`);
  }

  if (!Number.isInteger(numeric * 2)) {
    throw new Error(`Invalid volume step "${value}". Use whole or half steps.`);
  }

  if (payload.endsWith(".5")) {
    const whole = Math.floor(numeric).toString().padStart(2, "0");
    return `${whole}5`;
  }

  return Math.trunc(numeric).toString().padStart(2, "0");
}

export function commandFromMqtt(relativeTopic, payload, currentState = {}) {
  const topic = relativeTopic.replace(/^\/+|\/+$/g, "");
  const rawPayload = String(payload).trim();
  const value = rawPayload.toUpperCase();

  if (topic === "raw") return validateRawCommand(rawPayload);
  if (topic === "raw-batch") return parseRawBatch(rawPayload);
  if (topic === "query") return queryCommand(value || rawPayload);

  if (topic in MENU_COMMANDS) return MENU_COMMANDS[topic];
  if (topic in SIMPLE_VALUE_COMMANDS) return simpleValueCommand(topic, rawPayload);

  if (topic.startsWith("channel-volume/")) return channelVolumeCommand(topic, rawPayload);
  if (topic.startsWith("zone2/channel-volume/")) return zone2ChannelVolumeCommand(topic, rawPayload);
  if (topic.startsWith("system/trigger/")) return triggerCommand(topic, value);
  if (topic.startsWith("picture/")) return pictureCommand(topic, rawPayload);
  if (topic.startsWith("tuner/")) return tunerCommand(topic, value);

  switch (topic) {
    case "power":
      if (value === "ON") return "PWON";
      if (value === "STANDBY" || value === "OFF") return "PWSTANDBY";
      break;

    case "main-zone/power":
      if (value === "ON") return "ZMON";
      if (value === "OFF" || value === "STANDBY") return "ZMOFF";
      if (value === "TOGGLE") return currentState.mainZonePower === "ON" ? "ZMOFF" : "ZMON";
      break;

    case "source":
      if (value) return `SI${value}`;
      break;

    case "signal-input-mode":
      if (["AUTO", "HDMI", "DIGITAL", "ANALOG"].includes(value)) return `SD${value}`;
      break;

    case "video/source":
      if (value === "OFF") return "SVOFF";
      if (value) return `SV${value}`;
      break;

    case "volume":
      if (value === "UP") return "MVUP";
      if (value === "DOWN") return "MVDOWN";
      return `MV${encodeVolume(value)}`;

    case "mute":
      if (value === "ON") return "MUON";
      if (value === "OFF") return "MUOFF";
      if (value === "TOGGLE") return currentState.mute === "ON" ? "MUOFF" : "MUON";
      break;

    case "sound-mode":
      if (value) return `MS${normalizeSoundMode(value)}`;
      break;

    case "smart-surround":
      if (value === "SMART") return "MSSMART";
      if (["2CH", "5CH", "7CH"].includes(value)) return `MSSMART${value}`;
      break;

    case "smart-select":
      return numberedCommand("MSSMART", value, 1, 4);

    case "smart-select/save":
      return `${numberedCommand("MSSMART", value, 1, 4)} MEMORY`;

    case "quick-select":
      return numberedCommand("MSQUICK", value, 1, 5);

    case "quick-select/save":
      return `${numberedCommand("MSQUICK", value, 1, 5)} MEMORY`;

    case "speaker-preset":
      return `SPPR ${numberedPayload(value, 1, 2)}`;

    case "decoder":
      if (value) return `DC${value}`;
      break;

    case "sleep":
      return sleepCommand("SLP", value);

    case "zone2/power":
      if (value === "ON") return "Z2ON";
      if (value === "OFF" || value === "STANDBY") return "Z2OFF";
      break;

    case "zone2/source":
      if (value) return `Z2${value}`;
      break;

    case "zone2/volume":
      if (value === "UP") return "Z2UP";
      if (value === "DOWN") return "Z2DOWN";
      return `Z2${encodeVolume(value)}`;

    case "zone2/mute":
      if (value === "ON") return "Z2MUON";
      if (value === "OFF") return "Z2MUOFF";
      if (value === "TOGGLE") return currentState.zone2Mute === "ON" ? "Z2MUOFF" : "Z2MUON";
      break;

    case "zone2/sleep":
      return sleepCommand("Z2SLP", value);

    case "zone2/high-pass-filter":
      if (value === "ON") return "Z2HPFON";
      if (value === "OFF") return "Z2HPFOFF";
      break;

    case "zone3/power":
      if (value === "ON") return "Z3ON";
      if (value === "OFF" || value === "STANDBY") return "Z3OFF";
      break;

    case "zone3/source":
      if (value) return `Z3${value}`;
      break;

    case "zone3/volume":
      if (value === "UP") return "Z3UP";
      if (value === "DOWN") return "Z3DOWN";
      return `Z3${encodeVolume(value)}`;

    case "zone3/mute":
      if (value === "ON") return "Z3MUON";
      if (value === "OFF") return "Z3MUOFF";
      if (value === "TOGGLE") return currentState.zone3Mute === "ON" ? "Z3MUOFF" : "Z3MUON";
      break;

    case "audyssey/lfe":
      return `PSLFE ${twoDigit(value, 0, 10)}`;

    case "audyssey/effect-level":
      return `PSEFF ${twoDigit(value, 0, 99)}`;

    case "audyssey/effect-delay":
      return `PSDEL ${threeDigit(value, 0, 999)}`;

    case "audyssey/audio-delay":
      if (value === "UP" || value === "DOWN") return `PSDELAY ${value}`;
      return `PSDELAY ${threeDigit(value, 0, 200)}`;

    case "tone/bass":
      return `PSBAS ${trimValue(value, { min: 38, max: 62, allowSteps: true })}`;

    case "tone/treble":
      return `PSTRE ${trimValue(value, { min: 38, max: 62, allowSteps: true })}`;

    case "audio/multeq":
      if (value) return `PSMULTEQ:${value}`;
      break;

    case "network/playback":
      if (value in NETWORK_PLAYBACK) return NETWORK_PLAYBACK[value];
      break;

    case "network/reboot":
      if (value === "REBOOT") return "NSRBT";
      break;

    case "system/display-dimmer-cycle":
      return "DIM SEL";

    case "menu":
      if (value === "ON") return "MNMEN ON";
      if (value === "OFF") return "MNMEN OFF";
      if (value === "TOGGLE") return currentState.menu === "ON" ? "MNMEN OFF" : "MNMEN ON";
      break;

    case "cec":
      if (value === "ON") return "RCRC51608408";
      if (value === "OFF") return "RCRC51608409";
      break;

    case "cec/denon":
      if (value === "ON") return "RCKSK0410826";
      if (value === "OFF") return "RCKSK0410827";
      break;
  }

  throw new Error(`Unsupported command ${topic}=${value}`);
}

function parsePsLine(line) {
  const mappings = [
    ["PSDYNEQ ", "audyssey/dynamic-eq"],
    ["PSREFLEV ", "audyssey/reference-level-offset"],
    ["PSDYNVOL ", "audyssey/dynamic-volume"],
    ["PSDRC ", "audyssey/dynamic-compression"],
    ["PSLFE ", "audyssey/lfe"],
    ["PSEFF ", "audyssey/effect-level"],
    ["PSDEL ", "audyssey/effect-delay"],
    ["PSPAN ", "audio/panorama"],
    ["PSDIM ", "audio/dimension"],
    ["PSCEN ", "audio/center-width"],
    ["PSCEI ", "audio/center-image"],
    ["PSSWR ", "audyssey/subwoofer"],
    ["PSLOM ", "audyssey/loudness-management"],
    ["PSDELAY ", "audyssey/audio-delay"],
    ["PSBAS ", "tone/bass"],
    ["PSTRE ", "tone/treble"],
    ["PSTONE CTRL ", "tone/control"],
    ["PSMULTEQ:", "audio/multeq"],
    ["PSCINEMA EQ.", "audio/cinema-eq"],
    ["PSCES ", "audio/center-spread"],
    ["PSMDAX ", "audio/mdax"],
    ["PSDACFIL ", "audio/dac-filter"],
    ["PSHEQ ", "audio/headphone-eq"],
    ["PSNEURAL ", "audio/neural-x"],
    ["PSIMAXAUD ", "audio/imax/audio"],
    ["PSIMAXHPF ", "audio/imax/hpf"],
    ["PSIMAXLPF ", "audio/imax/lpf"],
    ["PSIMAXSWM ", "audio/imax/subwoofer-mode"],
    ["PSIMAXSWO ", "audio/imax/subwoofer-output"],
    ["PSIMAX ", "audio/imax/mode"],
    ["PSAUROMODE ", "audio/auro/mode"],
    ["PSAUROPR ", "audio/auro/preset"],
    ["PSAUROST ", "audio/auro/strength"],
    ["PSDIRAC ", "audio/dirac"],
    ["PSLFC ", "audio/lfc"],
    ["PSCNTAMT ", "audio/lfc-amount"],
    ["PSBSC ", "audio/bass-sync"],
    ["PSDEH ", "audio/dialog-enhancer"],
    ["PSDIC ", "audio/dialog-control"],
    ["PSSPV ", "audio/speaker-virtualizer"],
    ["PSSP:", "audio/speaker-profile"],
    ["PSRSTR ", "audio/restorer"],
    ["PSRSZ ", "audio/room-size"],
    ["PSSWL2 ", "audio/subwoofer2-level"],
    ["PSSWL ", "audio/subwoofer-level"],
  ];

  for (const [prefix, topic] of mappings) {
    if (line.startsWith(prefix)) return dynamicState(topic, line.slice(prefix.length).trim());
  }

  return null;
}

function state(key, payload) {
  return { key, topic: STATE_TOPICS[key], payload };
}

function dynamicState(topic, payload) {
  return { key: topic, topic, payload };
}

function speakerSetupLine(baseTopic, raw) {
  const trimmed = raw.trim();
  const [field, ...rest] = trimmed.split(/\s+/);
  return dynamicState(`${baseTopic}/${field.toLowerCase()}`, rest.join(" "));
}

function sourceNameLine(raw) {
  const trimmed = raw.trim();
  const [source, ...rest] = trimmed.split(/\s+/);
  return dynamicState(`source/name/${source.toLowerCase()}`, rest.join(" "));
}

function smartModeListLine(raw) {
  const match = raw.match(/^([A-Z]{3})(\d{3})(.+)$/);
  if (!match) return dynamicState("smart-mode-list/raw", raw);
  const [, group, code, name] = match;
  const active = code.endsWith("1");
  return dynamicState(`smart-mode-list/${group.toLowerCase()}/${code.slice(0, 2)}`, JSON.stringify({
    group,
    code,
    active,
    name,
  }));
}

function validateRawCommand(command) {
  if (!command) throw new Error("Raw command cannot be empty.");
  if (/[\r\n]/.test(command)) throw new Error("Raw command cannot contain CR or LF.");
  if (command.length > RAW_COMMAND_MAX_LENGTH) {
    throw new Error(`Raw command too long. Max ${RAW_COMMAND_MAX_LENGTH} characters.`);
  }
  return command;
}

function parseRawBatch(payload) {
  let commands;
  try {
    commands = JSON.parse(payload);
  } catch {
    throw new Error("raw-batch payload must be a JSON array of commands.");
  }
  if (!Array.isArray(commands) || commands.length === 0) {
    throw new Error("raw-batch payload must be a non-empty JSON array.");
  }
  return commands.map(command => validateRawCommand(String(command).trim()));
}

function queryCommand(value) {
  const normalized = String(value).trim().toLowerCase();
  if (normalized in QUERY_COMMANDS) return QUERY_COMMANDS[normalized];
  return validateRawCommand(value.endsWith("?") ? value : `${value}?`);
}

function simpleValueCommand(topic, payload) {
  const spec = SIMPLE_VALUE_COMMANDS[topic];
  const value = String(payload).trim().toUpperCase();
  if (!value) throw new Error(`Missing payload for ${topic}.`);
  if (spec.values && !spec.values.includes(value)) {
    throw new Error(`Invalid ${topic} value "${payload}". Use ${spec.values.join(", ")}.`);
  }
  return `${spec.prefix}${value}`;
}

function channelVolumeCommand(topic, payload) {
  const channel = topic.slice("channel-volume/".length).toUpperCase();
  if (channel === "RESET-REFERENCE") {
    const value = String(payload).trim().toUpperCase();
    if (!value || value === "RESET") return "CVZRL";
  }
  if (!CHANNELS.has(channel)) throw new Error(`Unsupported channel "${channel}".`);
  const value = trimValue(String(payload).trim().toUpperCase(), { min: 38, max: 62, allowSteps: true });
  return `CV${channel} ${value}`;
}

function zone2ChannelVolumeCommand(topic, payload) {
  const channel = topic.slice("zone2/channel-volume/".length).toUpperCase();
  if (!CHANNELS.has(channel)) throw new Error(`Unsupported Zone 2 channel "${channel}".`);
  const value = String(payload).trim().toUpperCase();
  if (!value) throw new Error(`Missing Zone 2 channel volume for ${channel}.`);
  return `Z2CV${channel} ${value}`;
}

function triggerCommand(topic, value) {
  const number = topic.slice("system/trigger/".length);
  if (!["1", "2", "3"].includes(number)) throw new Error(`Unsupported trigger "${number}".`);
  if (!["ON", "OFF"].includes(value)) throw new Error("Trigger payload must be ON or OFF.");
  return `TR${number} ${value}`;
}

function pictureCommand(topic, payload) {
  const suffix = {
    "picture/contrast": "PVCN ",
    "picture/brightness": "PVBR ",
    "picture/color": "PVCM ",
    "picture/hue": "PVHUE ",
    "picture/noise-reduction": "PVDNR ",
    "picture/enhancer": "PVENH ",
    "picture/mode": "PVPICT ",
  }[topic];
  if (!suffix) throw new Error(`Unsupported picture command "${topic}".`);
  const value = String(payload).trim().toUpperCase();
  if (!value) throw new Error(`Missing payload for ${topic}.`);
  return `${suffix}${value}`;
}

function tunerCommand(topic, value) {
  switch (topic) {
    case "tuner/frequency":
      if (!/^\d{5,6}$/.test(value)) throw new Error("Tuner frequency must be 5 or 6 digits.");
      return `TFAN${value}`;
    case "tuner/frequency-step":
      if (value === "UP") return "TFANUP";
      if (value === "DOWN") return "TFANDOWN";
      break;
    case "tuner/preset":
      if (/^\d+$/.test(value)) return `TPANA${value}`;
      break;
    case "tuner/preset-step":
      if (value === "UP") return "TPANUP";
      if (value === "DOWN") return "TPANDOWN";
      break;
    case "tuner/band":
      if (value === "AM") return "TMANAM";
      if (value === "FM") return "TMANFM";
      break;
    case "tuner/mode":
      if (value === "AUTO") return "TMANAUTO";
      break;
  }
  throw new Error(`Unsupported tuner command ${topic}=${value}`);
}

function sleepCommand(prefix, value) {
  if (value === "OFF") return `${prefix}OFF`;
  return `${prefix}${threeDigit(value, 1, 120)}`;
}

function normalizeSoundMode(value) {
  if (value === "MULTI CH STEREO") return "MCH STEREO";
  if (value === "ALL-CHANNEL STEREO" || value === "ALL CHANNEL STEREO") return "MCH STEREO";
  if (value === "DOLBY SURROUND" || value === "DOLBY AUDIO-DSUR") return "DOLBY AUDIO-DSUR";
  if (value === "DTS NEURAL:X" || value === "NEURAL:X") return "NEURAL:X";
  if (value === "DTS VIRTUAL:X" || value === "VIRTUAL:X") return "VIRTUAL:X";
  return value;
}

function trimValue(value, { min, max, allowSteps }) {
  if (allowSteps && (value === "UP" || value === "DOWN")) return value;
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < min || numeric > max) {
    throw new Error(`Value out of range "${value}". Use ${min}-${max}${allowSteps ? ", UP, or DOWN" : ""}.`);
  }
  return String(numeric).padStart(2, "0");
}

function numberedCommand(prefix, value, min, max) {
  return `${prefix}${numberedPayload(value, min, max)}`;
}

function numberedPayload(value, min, max) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < min || numeric > max) {
    throw new Error(`Value out of range "${value}". Use ${min}-${max}.`);
  }
  return String(numeric);
}

function twoDigit(value, min, max) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < min || numeric > max) {
    throw new Error(`Value out of range "${value}". Use ${min}-${max}.`);
  }
  return String(numeric).padStart(2, "0");
}

function threeDigit(value, min, max) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < min || numeric > max) {
    throw new Error(`Value out of range "${value}". Use ${min}-${max}.`);
  }
  return String(numeric).padStart(3, "0");
}
