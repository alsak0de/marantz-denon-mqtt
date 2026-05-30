export const STATE_TOPICS = {
  power: "power",
  source: "source",
  volume: "volume",
  mute: "mute",
  soundMode: "sound-mode",
  zone2Power: "zone2/power",
  zone2Source: "zone2/source",
  zone2Volume: "zone2/volume",
  zone2Mute: "zone2/mute",
};

const ZONE2_NON_SOURCE = [
  /^Z2MU/,
  /^Z2SLP/,
  /^Z2\d+$/,
  /^Z2ON$/,
  /^Z2OFF$/,
];

export function parseAvrLine(line) {
  if (line === "PWON") return state("power", "ON");
  if (line === "PWSTANDBY") return state("power", "STANDBY");

  if (line === "MUON") return state("mute", "ON");
  if (line === "MUOFF") return state("mute", "OFF");

  if (line.startsWith("SI")) return state("source", line.slice(2));

  if (line.startsWith("MV") && !line.startsWith("MVMAX")) {
    return state("volume", decodeVolume(line.slice(2)));
  }

  if (line.startsWith("MS")) return state("soundMode", line.slice(2));

  if (line === "Z2ON") return state("zone2Power", "ON");
  if (line === "Z2OFF") return state("zone2Power", "OFF");

  if (line === "Z2MUON") return state("zone2Mute", "ON");
  if (line === "Z2MUOFF") return state("zone2Mute", "OFF");

  if (/^Z2\d+$/.test(line)) return state("zone2Volume", decodeVolume(line.slice(2)));

  if (line.startsWith("Z2") && !ZONE2_NON_SOURCE.some(pattern => pattern.test(line))) {
    return state("zone2Source", line.slice(2));
  }

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
  const value = String(payload).trim().toUpperCase();

  switch (topic) {
    case "power":
      if (value === "ON") return "PWON";
      if (value === "STANDBY" || value === "OFF") return "PWSTANDBY";
      break;

    case "source":
      if (value) return `SI${value}`;
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
  }

  throw new Error(`Unsupported command ${topic}=${value}`);
}

function state(key, payload) {
  return { key, topic: STATE_TOPICS[key], payload };
}
