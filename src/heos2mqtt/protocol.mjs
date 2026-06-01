import { randomUUID } from "crypto";

const RAW_COMMAND_MAX_LENGTH = 2048;
const VALID_PLAY_STATES = new Set(["play", "pause", "stop"]);
const VALID_MUTE = new Set(["on", "off"]);
const VALID_REGISTER = new Set(["on", "off"]);
const VALID_REPEAT = new Set(["on_all", "on_one", "off"]);
const VALID_SHUFFLE = new Set(["on", "off"]);

export function parseHeosLine(line) {
  const raw = JSON.parse(line);
  if (!raw.heos || typeof raw.heos.command !== "string") {
    throw new Error("HEOS line does not contain heos.command");
  }

  const command = raw.heos.command;
  const params = parseMessage(raw.heos.message ?? "");
  return {
    raw,
    command,
    result: raw.heos.result,
    message: raw.heos.message ?? "",
    params,
    payload: raw.payload,
    isEvent: command.startsWith("event/"),
  };
}

export function formatHeosCommand(command, params = {}) {
  const cleanCommand = String(command).replace(/^heos:\/\//, "").replace(/^\/+|\/+$/g, "");
  if (!/^[a-z]+\/[a-z0-9_]+$/.test(cleanCommand)) {
    throw new Error(`Invalid HEOS command "${command}".`);
  }

  const query = encodeParams(params);
  return `heos://${cleanCommand}${query ? `?${query}` : ""}`;
}

export function parseMessage(message) {
  const parsed = {};
  if (!message) return parsed;

  for (const part of String(message).split("&")) {
    if (!part) continue;
    const [rawKey, ...rawValue] = part.split("=");
    const key = decodeURIComponent(rawKey.replace(/\+/g, " "));
    const value = decodeURIComponent(rawValue.join("=").replace(/\+/g, " "));
    parsed[key] = value;
  }
  return parsed;
}

export function commandFromMqtt(relativeTopic, payload) {
  const topic = relativeTopic.replace(/^\/+|\/+$/g, "");
  const rawPayload = String(payload).trim();

  if (topic === "raw") return validateRawCommand(rawPayload);
  if (topic === "raw-batch") return parseRawBatch(rawPayload);

  const json = parseOptionalJson(rawPayload);

  if (topic === "system/register-events") {
    const enable = normalized(rawPayload || json?.enable || "on");
    if (!VALID_REGISTER.has(enable)) throw new Error("register-events payload must be on or off.");
    return command("system/register_for_change_events", { enable });
  }
  if (topic === "system/check-account") return command("system/check_account", json ?? {});
  if (topic === "system/sign-in") {
    if (!json?.un || !json?.pw) throw new Error("system/sign-in requires JSON with un and pw.");
    return command("system/sign_in", { un: json.un, pw: json.pw });
  }
  if (topic === "system/sign-out") return command("system/sign_out");
  if (topic === "system/heartbeat") return command("system/heart_beat");
  if (topic === "system/reboot") return command("system/reboot", json ?? { pid: rawPayload });
  if (topic === "system/prettify-json") {
    const enable = normalized(rawPayload || json?.enable);
    if (!VALID_REGISTER.has(enable)) throw new Error("prettify-json payload must be on or off.");
    return command("system/prettify_json_response", { enable });
  }

  if (topic === "player/get-players") return command("player/get_players", json ?? {});
  if (topic.startsWith("player/")) return playerCommand(topic, rawPayload, json);

  if (topic === "group/get-groups") return command("group/get_groups", json ?? {});
  if (topic === "group/set") return command("group/set_group", requireJson(json, topic));
  if (topic.startsWith("group/")) return groupCommand(topic, rawPayload, json);

  if (topic.startsWith("browse/")) return browseCommand(topic, json);

  throw new Error(`Unsupported HEOS MQTT command topic "${topic}".`);
}

export function requestIdFromPayload(payload) {
  const json = parseOptionalJson(String(payload).trim());
  return json?.request_id;
}

export function normalizeNowPlayingPayload(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const out = {};
  for (const key of [
    "type",
    "song",
    "station",
    "artist",
    "album",
    "image_url",
    "mid",
    "sid",
    "qid",
    "album_id",
  ]) {
    if (source[key] != null) out[key] = source[key];
  }
  return out;
}

export function isHeosSuccess(response) {
  return response?.result === "success" || response?.result === "ok";
}

function playerCommand(topic, rawPayload, json) {
  const [, pid, ...rest] = topic.split("/");
  if (!pid) throw new Error(`Missing player id in "${topic}".`);
  const action = rest.join("/");

  switch (action) {
    case "get-info":
      return command("player/get_player_info", { pid });
    case "get-state":
      return command("player/get_play_state", { pid });
    case "play-state": {
      const state = normalized(rawPayload || json?.state);
      if (!VALID_PLAY_STATES.has(state)) throw new Error("play-state payload must be play, pause, or stop.");
      return command("player/set_play_state", { pid, state });
    }
    case "get-now-playing":
      return command("player/get_now_playing_media", { pid });
    case "get-volume":
      return command("player/get_volume", { pid });
    case "volume":
      return command("player/set_volume", { pid, level: volume(rawPayload || json?.level) });
    case "volume-step": {
      const direction = normalized(json?.direction ?? rawPayload);
      const step = json?.step ?? 5;
      if (direction === "up") return command("player/volume_up", { pid, step });
      if (direction === "down") return command("player/volume_down", { pid, step });
      throw new Error("volume-step direction must be up or down.");
    }
    case "get-mute":
      return command("player/get_mute", { pid });
    case "mute": {
      const state = normalized(rawPayload || json?.state);
      if (state === "toggle") return command("player/toggle_mute", { pid });
      if (!VALID_MUTE.has(state)) throw new Error("mute payload must be on, off, or toggle.");
      return command("player/set_mute", { pid, state });
    }
    case "get-play-mode":
      return command("player/get_play_mode", { pid });
    case "play-mode": {
      const data = requireJson(json, topic);
      if (!VALID_REPEAT.has(data.repeat) || !VALID_SHUFFLE.has(data.shuffle)) {
        throw new Error("play-mode requires repeat on_all/on_one/off and shuffle on/off.");
      }
      return command("player/set_play_mode", { pid, repeat: data.repeat, shuffle: data.shuffle });
    }
    case "queue/get":
      return command("player/get_queue", { pid, ...rangeParams(json) }, { requestResponse: true });
    case "queue/play":
      return command("player/play_queue", { pid, qid: rawPayload || json?.qid });
    case "queue/remove":
      return command("player/remove_from_queue", { pid, ...(json ?? { qid: rawPayload }) });
    case "queue/save":
      return command("player/save_queue", { pid, name: rawPayload || json?.name });
    case "queue/clear":
      return command("player/clear_queue", { pid });
    case "queue/move":
      return command("player/move_queue", { pid, ...requireJson(json, topic) });
    case "next":
      return command("player/play_next", { pid });
    case "previous":
      return command("player/play_previous", { pid });
    case "quickselect/set":
      return command("player/set_quickselect", { pid, qs: rawPayload || json?.qs });
    case "quickselect/play":
      return command("player/play_quickselect", { pid, qs: rawPayload || json?.qs });
    case "quickselect/get":
      return command("player/get_quickselects", { pid });
    case "check-update":
      return command("player/check_update", { pid });
    default:
      throw new Error(`Unsupported player command "${topic}".`);
  }
}

function groupCommand(topic, rawPayload, json) {
  const [, gid, ...rest] = topic.split("/");
  if (!gid) throw new Error(`Missing group id in "${topic}".`);
  const action = rest.join("/");

  switch (action) {
    case "get-info":
      return command("group/get_group_info", { gid });
    case "get-volume":
      return command("group/get_group_volume", { gid });
    case "volume":
      return command("group/set_group_volume", { gid, level: volume(rawPayload || json?.level) });
    case "volume-step": {
      const direction = normalized(json?.direction ?? rawPayload);
      const step = json?.step ?? 5;
      if (direction === "up") return command("group/volume_up", { gid, step });
      if (direction === "down") return command("group/volume_down", { gid, step });
      throw new Error("group volume-step direction must be up or down.");
    }
    case "get-mute":
      return command("group/get_group_mute", { gid });
    case "mute": {
      const state = normalized(rawPayload || json?.state);
      if (state === "toggle") return command("group/toggle_group_mute", { gid });
      if (!VALID_MUTE.has(state)) throw new Error("group mute payload must be on, off, or toggle.");
      return command("group/set_group_mute", { gid, state });
    }
    default:
      throw new Error(`Unsupported group command "${topic}".`);
  }
}

function browseCommand(topic, json) {
  const payload = json ?? {};
  const request_id = payload.request_id ?? randomUUID();
  const params = { ...payload };
  delete params.request_id;

  const map = {
    "browse/get-sources": "browse/get_music_sources",
    "browse/get-source-info": "browse/get_source_info",
    "browse/browse": "browse/browse",
    "browse/browse-containers": "browse/browse_source_containers",
    "browse/get-search-criteria": "browse/get_search_criteria",
    "browse/search": "browse/search",
    "browse/play-station": "browse/play_stream",
    "browse/play-preset": "browse/play_preset",
    "browse/play-input": "browse/play_input",
    "browse/play-url": "browse/play_url",
    "browse/add-to-queue": "browse/add_to_queue",
    "browse/get-playlists": "browse/get_heos_playlists",
    "browse/rename-playlist": "browse/rename_heos_playlist",
    "browse/delete-playlist": "browse/delete_heos_playlist",
    "browse/get-history": "browse/get_heos_history",
    "browse/retrieve-metadata": "browse/retrieve_metadata",
    "browse/get-service-options": "browse/get_service_options",
    "browse/set-service-option": "browse/set_service_option",
  };

  if (!map[topic]) throw new Error(`Unsupported browse command "${topic}".`);
  return command(map[topic], params, { request_id, requestResponse: true });
}

function command(commandName, params = {}, options = {}) {
  return {
    command: commandName,
    params: compactParams(params),
    ...options,
  };
}

function compactParams(params) {
  const out = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value == null || value === "") continue;
    out[key] = value;
  }
  return out;
}

function encodeParams(params) {
  return Object.entries(compactParams(params))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
}

function parseOptionalJson(payload) {
  if (!payload) return null;
  if (!payload.startsWith("{")) return null;
  try {
    return JSON.parse(payload);
  } catch (err) {
    throw new Error(`Invalid JSON payload: ${err.message}`);
  }
}

function requireJson(json, topic) {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new Error(`${topic} requires a JSON object payload.`);
  }
  return json;
}

function rangeParams(json) {
  if (!json) return {};
  const params = {};
  if (json.range != null) params.range = json.range;
  if (json.start != null) params.start = json.start;
  if (json.end != null) params.end = json.end;
  return params;
}

function normalized(value) {
  return String(value ?? "").trim().toLowerCase();
}

function volume(value) {
  const text = String(value ?? "").trim();
  const numeric = Number(text);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 100) {
    throw new Error(`Invalid HEOS volume "${value}". Use 0-100.`);
  }
  return numeric;
}

function validateRawCommand(payload) {
  if (!payload.startsWith("heos://")) throw new Error("Raw HEOS commands must start with heos://.");
  if (payload.includes("\r") || payload.includes("\n")) {
    throw new Error("Raw HEOS commands must not contain CR or LF.");
  }
  if (payload.length > RAW_COMMAND_MAX_LENGTH) {
    throw new Error(`Raw HEOS command is too long. Max ${RAW_COMMAND_MAX_LENGTH} characters.`);
  }
  return payload;
}

function parseRawBatch(payload) {
  let commands;
  try {
    commands = JSON.parse(payload);
  } catch (err) {
    throw new Error(`raw-batch payload must be a JSON array: ${err.message}`);
  }
  if (!Array.isArray(commands)) throw new Error("raw-batch payload must be a JSON array.");
  return commands.map(command => validateRawCommand(String(command).trim()));
}
