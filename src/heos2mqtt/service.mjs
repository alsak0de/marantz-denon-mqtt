import { createConnection } from "net";
import mqtt from "mqtt";
import {
  commandFromMqtt,
  formatHeosCommand,
  isHeosSuccess,
  normalizeNowPlayingPayload,
  parseHeosLine,
} from "./protocol.mjs";

const STARTUP_COMMANDS = [
  { command: "player/get_players" },
  { command: "group/get_groups" },
  { command: "browse/get_music_sources" },
  { command: "system/check_account" },
];

export class Heos2Mqtt {
  constructor(config, logger = console) {
    this.config = config;
    this.log = logger;
    this.socket = null;
    this.buf = "";
    this.reconnectMs = config.reconnectInitialMs;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.commandQueue = Promise.resolve();
    this.pending = new Map();
    this.players = new Map();
    this.playStateByPid = new Map();
    this.autoFocusPid = null;
    this.stopped = false;
  }

  start() {
    this.connectMqtt();
    this.connectHeos();
  }

  async stop() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.socket?.destroy();
    await this.mqttClient?.endAsync?.();
  }

  connectMqtt() {
    const {
      mqttUrl,
      mqttUsername,
      mqttPassword,
      mqttClientId,
      mqttBaseTopic,
    } = this.config;

    this.mqttClient = mqtt.connect(mqttUrl, {
      clientId: mqttClientId,
      username: mqttUsername,
      password: mqttPassword,
      clean: true,
      reconnectPeriod: 5000,
      will: {
        topic: `${mqttBaseTopic}/availability`,
        payload: "offline",
        retain: true,
        qos: 0,
      },
    });

    this.mqttClient.on("connect", () => {
      this.info(`MQTT connected: ${mqttUrl}`);
      this.publish("availability", "online", true);
      this.mqttClient.subscribe(`${mqttBaseTopic}/cmd/#`, err => {
        if (err) this.error("MQTT subscribe error:", err.message);
        else this.info(`Subscribed to ${mqttBaseTopic}/cmd/#`);
      });
    });

    this.mqttClient.on("message", (topic, payload, packet) => {
      this.handleMqttMessage(topic, payload, packet).catch(err => {
        this.error("MQTT command error:", err.message);
      });
    });

    this.mqttClient.on("error", err => this.error("MQTT error:", err.message));
  }

  connectHeos() {
    if (this.stopped) return;

    const { heosHost, heosPort } = this.config;
    this.info(`Connecting to HEOS at ${heosHost}:${heosPort}`);
    this.buf = "";
    this.socket = createConnection({ host: heosHost, port: heosPort });
    this.socket.setTimeout(0);

    this.socket.on("connect", () => {
      this.info("HEOS connected");
      this.reconnectMs = this.config.reconnectInitialMs;
      this.pending.clear();
      this.startHeartbeat();
      this.bootstrap().catch(err => {
        this.error("HEOS bootstrap error:", err.message);
        this.socket?.destroy();
      });
    });

    this.socket.on("data", chunk => {
      this.buf += chunk.toString();
      const parts = this.buf.split(/\r?\n/);
      this.buf = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.trim();
        if (line) this.handleHeosLine(line);
      }
    });

    this.socket.on("close", () => {
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      this.rejectPending(new Error("HEOS socket closed"));
      if (!this.stopped) {
        this.info(`HEOS connection closed; reconnecting in ${Math.round(this.reconnectMs / 1000)}s`);
        this.scheduleReconnect();
      }
    });

    this.socket.on("error", err => {
      this.error("HEOS socket error:", err.message);
      this.socket?.destroy();
    });
  }

  async bootstrap() {
    await this.request("system/register_for_change_events", { enable: "on" });
    const [playersResponse] = await this.requestMany(...STARTUP_COMMANDS);
    const players = Array.isArray(playersResponse?.payload) ? playersResponse.payload : [];

    for (const player of players) {
      const pid = player.pid;
      if (pid == null) continue;
      await this.refreshPlayer(pid);
    }
  }

  startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.request("system/heart_beat", {}, { heartbeat: true }).catch(err => {
        this.error("HEOS heartbeat error:", err.message);
        this.socket?.destroy();
      });
    }, this.config.heartbeatMs);
  }

  scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connectHeos(), this.reconnectMs);
    this.reconnectMs = Math.min(this.reconnectMs * 2, this.config.reconnectMaxMs);
  }

  handleHeosLine(line) {
    this.debug(`HEOS -> ${line}`);
    if (this.config.publishRaw) {
      this.publish("event/raw", JSON.stringify({ t: new Date().toISOString(), line }), false);
    }

    let response;
    try {
      response = parseHeosLine(line);
    } catch (err) {
      this.publishError({ line, error: err.message });
      return;
    }

    if (!response.isEvent && !isHeosSuccess(response)) this.publishHeosFailure(response);

    if (response.isEvent) {
      this.handleEvent(response).catch(err => this.publishError({
        command: response.command,
        params: response.params,
        error: err.message,
      }));
      return;
    }

    this.resolvePending(response);
    this.applyResponse(response).catch(err => this.publishError({
      command: response.command,
      params: response.params,
      error: err.message,
    }));
  }

  async handleEvent(event) {
    switch (event.command) {
      case "event/player_state_changed": {
        const pid = event.params.pid;
        const state = event.params.state ?? "unknown";
        this.publishPlayerState(pid, state);
        if (state === "play") await this.refreshNowPlaying(pid);
        else this.publishNowPlaying(pid, {});
        break;
      }
      case "event/player_now_playing_media_changed":
        await this.refreshNowPlaying(event.params.pid);
        break;
      case "event/player_now_playing_progress":
        this.publishPidPayload(event.params.pid, "progress", event.params);
        break;
      case "event/player_volume_changed":
        this.publishPidScalar(event.params.pid, "volume", event.params.level);
        break;
      case "event/player_mute_changed":
        this.publishPidScalar(event.params.pid, "mute", event.params.state);
        break;
      case "event/player_queue_changed":
        await this.refreshQueue(event.params.pid);
        break;
      case "event/player_play_mode_changed":
        this.publishPidPayload(event.params.pid, "play-mode", {
          repeat: event.params.repeat,
          shuffle: event.params.shuffle,
        });
        break;
      case "event/groups_changed":
        await this.request("group/get_groups");
        break;
      case "event/group_volume_changed":
        this.publishGroupScalar(event.params.gid, "volume", event.params.level);
        break;
      case "event/group_mute_changed":
        this.publishGroupScalar(event.params.gid, "mute", event.params.state);
        break;
      case "event/sources_changed":
        await this.request("browse/get_music_sources");
        break;
      case "event/user_changed":
        await this.request("system/check_account");
        break;
      default:
        break;
    }
  }

  async applyResponse(response) {
    if (!isHeosSuccess(response)) return;

    switch (response.command) {
      case "player/get_players":
        this.publish("players", JSON.stringify(response.payload ?? []), true);
        this.updatePlayers(response.payload ?? []);
        break;
      case "player/get_player_info":
        this.publishPidPayload(response.params.pid, "info", response.payload ?? response.params);
        break;
      case "player/get_play_state":
        this.publishPlayerState(response.params.pid, response.params.state);
        break;
      case "player/get_now_playing_media":
        this.publishGatedNowPlaying(response.params.pid, response.payload);
        break;
      case "player/get_volume":
        this.publishPidScalar(response.params.pid, "volume", response.params.level);
        break;
      case "player/get_mute":
        this.publishPidScalar(response.params.pid, "mute", response.params.state);
        break;
      case "player/get_play_mode":
        this.publishPidPayload(response.params.pid, "play-mode", {
          repeat: response.params.repeat,
          shuffle: response.params.shuffle,
        });
        break;
      case "player/get_queue":
        this.publishPidPayload(response.params.pid, "queue", response.payload ?? []);
        break;
      case "group/get_groups":
        this.publish("groups", JSON.stringify(response.payload ?? []), true);
        break;
      case "group/get_group_info":
        this.publishGroupPayload(response.params.gid, "info", response.payload ?? response.params);
        break;
      case "group/get_group_volume":
        this.publishGroupScalar(response.params.gid, "volume", response.params.level);
        break;
      case "group/get_group_mute":
        this.publishGroupScalar(response.params.gid, "mute", response.params.state);
        break;
      case "browse/get_music_sources":
        this.publish("sources", JSON.stringify(response.payload ?? []), true);
        break;
      case "system/check_account":
        this.publish("account", JSON.stringify({ ...response.params, payload: response.payload }), true);
        break;
      default:
        break;
    }
  }

  async refreshPlayer(pid) {
    await this.request("player/get_player_info", { pid });
    await this.request("player/get_play_state", { pid });
    await this.request("player/get_now_playing_media", { pid });
    await this.request("player/get_volume", { pid });
    await this.request("player/get_mute", { pid });
    await this.request("player/get_play_mode", { pid });
    await this.refreshQueue(pid);
  }

  async refreshNowPlaying(pid) {
    await this.request("player/get_now_playing_media", { pid });
  }

  async refreshQueue(pid) {
    await this.request("player/get_queue", { pid, range: "0,9" });
  }

  async handleMqttMessage(topic, payloadBuffer, packet) {
    const prefix = `${this.config.mqttBaseTopic}/cmd/`;
    if (!topic.startsWith(prefix)) return;
    if (packet?.retain && this.config.ignoreRetainedCommands) {
      this.info(`Ignoring retained command on ${topic}`);
      return;
    }

    const relativeTopic = topic.slice(prefix.length);
    const payload = payloadBuffer.toString();
    try {
      const commands = commandFromMqtt(relativeTopic, payload);
      const results = await this.enqueueSend(...(Array.isArray(commands) ? commands : [commands]));
      for (const result of results.flat()) {
        if (result?.request_id) this.publish(`response/${result.request_id}`, JSON.stringify(result.response), false);
      }
    } catch (err) {
      this.publishError({ topic, error: err.message });
      throw err;
    }
  }

  enqueueSend(...commands) {
    const run = this.commandQueue.then(() => this.sendCommands(...commands));
    this.commandQueue = run.catch(err => {
      this.error("HEOS send error:", err.message);
    });
    return run;
  }

  async sendCommands(...commands) {
    const responses = [];
    for (const item of commands) {
      if (typeof item === "string") {
        responses.push(await this.requestRaw(item));
      } else {
        const response = await this.request(item.command, item.params, item);
        responses.push(item.request_id ? { request_id: item.request_id, response } : response);
      }
      if (commands.length > 1) await sleep(this.config.commandGapMs);
    }
    return responses;
  }

  async requestMany(...requests) {
    const responses = [];
    for (const request of requests) {
      responses.push(await this.request(request.command, request.params));
      if (requests.length > 1) await sleep(this.config.commandGapMs);
    }
    return responses;
  }

  async request(command, params = {}, options = {}) {
    return this.requestRaw(formatHeosCommand(command, params), { command, options });
  }

  requestRaw(rawCommand, context = {}) {
    if (!this.socket || this.socket.destroyed) {
      return Promise.reject(new Error("HEOS socket is not connected"));
    }

    const command = context.command ?? commandNameFromRaw(rawCommand);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        removePending(this.pending, command, entry);
        reject(new Error(`HEOS request timed out: ${command}`));
      }, this.config.requestTimeoutMs);

      const entry = { resolve, reject, timeout, command };
      const queue = this.pending.get(command) ?? [];
      queue.push(entry);
      this.pending.set(command, queue);

      this.debug(`HEOS <- ${redactHeosCommand(rawCommand)}`);
      this.socket.write(`${rawCommand}\r\n`, err => {
        if (!err) return;
        clearTimeout(timeout);
        removePending(this.pending, command, entry);
        reject(err);
      });
    });
  }

  resolvePending(response) {
    const queue = this.pending.get(response.command);
    if (!queue?.length) return;
    const entry = queue.shift();
    clearTimeout(entry.timeout);
    if (!queue.length) this.pending.delete(response.command);
    entry.resolve(response);
  }

  rejectPending(err) {
    for (const queue of this.pending.values()) {
      for (const entry of queue) {
        clearTimeout(entry.timeout);
        entry.reject(err);
      }
    }
    this.pending.clear();
  }

  updatePlayers(players) {
    const targetName = this.config.autoFocusPlayerName?.trim().toLowerCase();
    for (const player of players) {
      if (player.pid == null) continue;
      this.players.set(String(player.pid), player);
      this.publishPidPayload(player.pid, "info", player);
      if (targetName && String(player.name ?? "").trim().toLowerCase() === targetName) {
        this.autoFocusPid = String(player.pid);
      }
    }
  }

  publishPlayerState(pid, state = "unknown") {
    if (pid == null) return;
    const normalized = String(state || "unknown").toLowerCase();
    this.playStateByPid.set(String(pid), normalized);
    this.publishPidScalar(pid, "state", normalized);
    if (normalized !== "play") this.publishNowPlaying(pid, {});
  }

  publishGatedNowPlaying(pid, payload) {
    if (this.playStateByPid.get(String(pid)) !== "play") {
      this.publishNowPlaying(pid, {});
      return;
    }
    this.publishNowPlaying(pid, normalizeNowPlayingPayload(payload));
  }

  publishNowPlaying(pid, payload) {
    this.publishPidPayload(pid, "now-playing", payload);
  }

  publishPidPayload(pid, suffix, payload) {
    if (pid == null) return;
    const body = JSON.stringify(payload ?? {});
    this.publish(`player/${pid}/${suffix}`, body, true);
    if (this.autoFocusPid === String(pid)) this.publish(`main/${suffix}`, body, true);
  }

  publishPidScalar(pid, suffix, payload) {
    if (pid == null || payload == null) return;
    const body = String(payload);
    this.publish(`player/${pid}/${suffix}`, body, true);
    if (this.autoFocusPid === String(pid)) this.publish(`main/${suffix}`, body, true);
  }

  publishGroupPayload(gid, suffix, payload) {
    if (gid == null) return;
    this.publish(`group/${gid}/${suffix}`, JSON.stringify(payload ?? {}), true);
  }

  publishGroupScalar(gid, suffix, payload) {
    if (gid == null || payload == null) return;
    this.publish(`group/${gid}/${suffix}`, String(payload), true);
  }

  publishHeosFailure(response) {
    this.publishError({
      command: response.command,
      result: response.result,
      message: response.message,
      params: response.params,
      payload: response.payload,
    });
  }

  publishError(error) {
    this.publish("event/error", JSON.stringify({ t: new Date().toISOString(), ...error }), false);
  }

  publish(relativeTopic, payload, retain) {
    const topic = `${this.config.mqttBaseTopic}/${relativeTopic}`;
    this.mqttClient?.publish(topic, payload, { retain });
    this.info(`MQTT <- ${topic} = ${payload}${retain ? " retained" : ""}`);
  }

  info(...args) {
    if (this.config.logLevel !== "silent") this.log.log(timestamp(), ...args);
  }

  debug(...args) {
    if (this.config.logLevel === "debug") this.log.log(timestamp(), ...args);
  }

  error(...args) {
    this.log.error(timestamp(), ...args);
  }
}

function commandNameFromRaw(rawCommand) {
  const withoutScheme = rawCommand.replace(/^heos:\/\//, "");
  return withoutScheme.split("?")[0];
}

function redactHeosCommand(rawCommand) {
  if (!rawCommand.startsWith("heos://system/sign_in?")) return rawCommand;
  return rawCommand.replace(/([?&]pw=)[^&]*/g, "$1<redacted>");
}

function removePending(pending, command, entry) {
  const queue = pending.get(command);
  if (!queue) return;
  const index = queue.indexOf(entry);
  if (index >= 0) queue.splice(index, 1);
  if (!queue.length) pending.delete(command);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function timestamp() {
  return new Date().toISOString();
}
