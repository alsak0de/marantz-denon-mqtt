import { createConnection } from "net";
import mqtt from "mqtt";
import { commandFromMqtt, parseAvrLine } from "./avr-protocol.mjs";

const STARTUP_QUERIES = ["SI?", "Z2?", "PW?", "MV?", "MU?", "MS?"];

export class Marantz2Mqtt {
  constructor(config, logger = console) {
    this.config = config;
    this.log = logger;
    this.socket = null;
    this.buf = "";
    this.reconnectMs = config.reconnectInitialMs;
    this.reconnectTimer = null;
    this.currentState = {};
    this.commandQueue = Promise.resolve();
    this.stopped = false;
  }

  start() {
    this.connectMqtt();
    this.connectAvr();
  }

  async stop() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.destroy();
    this.publish("availability", "offline", true);
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

  connectAvr() {
    if (this.stopped) return;

    const { avrHost, avrPort } = this.config;
    this.info(`Connecting to AVR at ${avrHost}:${avrPort}`);
    this.buf = "";
    this.socket = createConnection({ host: avrHost, port: avrPort });
    this.socket.setTimeout(0);

    this.socket.on("connect", () => {
      this.info("AVR connected");
      this.reconnectMs = this.config.reconnectInitialMs;
      this.enqueueSend(...STARTUP_QUERIES);
    });

    this.socket.on("data", chunk => {
      this.buf += chunk.toString();
      const parts = this.buf.split("\r");
      this.buf = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.trim();
        if (line) this.handleAvrLine(line);
      }
    });

    this.socket.on("close", () => {
      if (!this.stopped) {
        this.info(`AVR connection closed; reconnecting in ${Math.round(this.reconnectMs / 1000)}s`);
        this.scheduleReconnect();
      }
    });

    this.socket.on("error", err => {
      this.error("AVR socket error:", err.message);
      this.socket?.destroy();
    });
  }

  scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connectAvr(), this.reconnectMs);
    this.reconnectMs = Math.min(this.reconnectMs * 2, this.config.reconnectMaxMs);
  }

  handleAvrLine(line) {
    this.info(`AVR -> ${line}`);
    if (this.config.publishRaw) {
      this.publish("event/raw", JSON.stringify({ t: new Date().toISOString(), line }), false);
    }

    const event = parseAvrLine(line);
    if (!event) return;

    this.currentState[event.key] = event.payload;
    this.publish(event.topic, event.payload, true);
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
    const command = commandFromMqtt(relativeTopic, payload, this.currentState);
    this.enqueueSend(command);
  }

  enqueueSend(...commands) {
    this.commandQueue = this.commandQueue
      .then(() => this.send(...commands))
      .catch(err => this.error("AVR send error:", err.message));
    return this.commandQueue;
  }

  async send(...commands) {
    if (!this.socket || this.socket.destroyed) {
      throw new Error("AVR socket is not connected");
    }

    for (const command of commands) {
      this.info(`AVR <- ${command}`);
      this.socket.write(`${command}\r`);
      if (commands.length > 1) await sleep(this.config.commandGapMs);
    }
  }

  publish(relativeTopic, payload, retain) {
    const topic = `${this.config.mqttBaseTopic}/${relativeTopic}`;
    this.mqttClient?.publish(topic, payload, { retain });
    this.info(`MQTT <- ${topic} = ${payload}${retain ? " retained" : ""}`);
  }

  info(...args) {
    if (this.config.logLevel !== "silent") this.log.log(timestamp(), ...args);
  }

  error(...args) {
    this.log.error(timestamp(), ...args);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function timestamp() {
  return new Date().toISOString();
}
