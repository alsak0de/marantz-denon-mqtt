import { readFileSync } from "fs";
import { resolve } from "path";

export function loadDotEnv(path = resolve(process.cwd(), ".env")) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (key && !(key in process.env)) process.env[key] = unquote(rest.join("="));
    }
  } catch {
    // .env is optional.
  }
}

export function readConfig(env = process.env) {
  const heosHost = env.HEOS_HOST;
  if (!heosHost) throw new Error("Set HEOS_HOST to a HEOS device IP address or hostname.");

  return {
    heosHost,
    heosPort: numberEnv(env.HEOS_PORT, 1255),
    mqttUrl: env.MQTT_URL ?? mqttUrlFromParts(env),
    mqttUsername: env.MQTT_USERNAME || undefined,
    mqttPassword: env.MQTT_PASSWORD || undefined,
    mqttBaseTopic: normalizeBaseTopic(env.MQTT_HEOS_BASE_TOPIC ?? "home/heos"),
    mqttClientId: env.MQTT_CLIENT_ID ?? "heos2mqtt",
    reconnectInitialMs: numberEnv(env.HEOS_RECONNECT_INITIAL_MS, 2000),
    reconnectMaxMs: numberEnv(env.HEOS_RECONNECT_MAX_MS, 60000),
    commandGapMs: numberEnv(env.HEOS_COMMAND_GAP_MS, 100),
    requestTimeoutMs: numberEnv(env.HEOS_REQUEST_TIMEOUT_MS, 5000),
    heartbeatMs: numberEnv(env.HEOS_HEARTBEAT_MS, 30000),
    probeQueueOnStart: booleanEnv(env.HEOS_PROBE_QUEUE_ON_START, false),
    preserveMuteOnVolume: booleanEnv(env.HEOS_PRESERVE_MUTE_ON_VOLUME, false),
    publishRaw: booleanEnv(env.MQTT_PUBLISH_RAW, true),
    ignoreRetainedCommands: booleanEnv(env.MQTT_IGNORE_RETAINED_COMMANDS, true),
    autoFocusPlayerName: env.HEOS_AUTOFOCUS_PLAYER_NAME || undefined,
    logLevel: env.LOG_LEVEL ?? "info",
  };
}

function mqttUrlFromParts(env) {
  const host = env.MQTT_HOST ?? "localhost";
  const port = env.MQTT_PORT ?? "1883";
  return `mqtt://${host}:${port}`;
}

function numberEnv(value, fallback) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid numeric config value "${value}".`);
  return parsed;
}

function booleanEnv(value, fallback) {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function normalizeBaseTopic(topic) {
  return topic.replace(/^\/+|\/+$/g, "");
}

function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
