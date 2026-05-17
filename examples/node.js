/**
 * Marantz / Denon AVR — TCP port 23 helpers (Node.js)
 *
 * Usage:
 *   const avr = new AVR("192.168.1.X");
 *   const state = await avr.query();
 *   await avr.send(["PWON"]);
 *   const reply = await avr.sendWait("MV60", "MV");
 */

import { createConnection } from "net";

const DEFAULT_PORT = 23;
const DEFAULT_TIMEOUT_MS = 3000;
const INTER_COMMAND_DELAY_MS = 100;

export class AVR {
  constructor(host, port = DEFAULT_PORT) {
    this.host = host;
    this.port = port;
  }

  /**
   * Send one or more commands and collect all responses within collectMs.
   * Use for queries, multi-step sequences, and volume ramping.
   *
   * @param {string[]} commands - Commands without terminator (e.g. ["PW?", "MV?"])
   * @param {number} collectMs - How long to wait for responses after last command
   * @returns {Promise<string[]>} - Trimmed, non-empty response lines
   */
  send(commands, collectMs = 600) {
    return new Promise((resolve, reject) => {
      const socket = createConnection({ host: this.host, port: this.port });
      const lines = [];
      let buf = "";

      socket.setTimeout(DEFAULT_TIMEOUT_MS);

      socket.on("connect", async () => {
        for (const cmd of commands) {
          socket.write(cmd + "\r");
          await delay(INTER_COMMAND_DELAY_MS);
        }
        setTimeout(() => { socket.destroy(); resolve(lines); }, collectMs);
      });

      socket.on("data", chunk => {
        buf += chunk.toString();
        const parts = buf.split("\r");
        buf = parts.pop() ?? "";
        for (const p of parts) {
          const line = p.trim();
          if (line) lines.push(line);
        }
      });

      socket.on("timeout", () => { socket.destroy(); resolve(lines); });
      socket.on("error", reject);
    });
  }

  /**
   * Send one command and resolve as soon as a line starting with prefix arrives.
   * Use for single commands with a deterministic, prefix-identifiable reply.
   *
   * @param {string} command - Command without terminator (e.g. "PWON")
   * @param {string} prefix - Expected response prefix (e.g. "PW")
   * @param {number} timeoutMs - Reject after this many ms with no matching reply
   * @returns {Promise<string>} - The full matching response line
   */
  sendWait(command, prefix, timeoutMs = DEFAULT_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      const socket = createConnection({ host: this.host, port: this.port });
      let buf = "";

      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error(`No reply with prefix "${prefix}" within ${timeoutMs}ms`));
      }, timeoutMs);

      socket.on("connect", () => socket.write(command + "\r"));

      socket.on("data", chunk => {
        buf += chunk.toString();
        const parts = buf.split("\r");
        buf = parts.pop() ?? "";
        for (const p of parts) {
          const line = p.trim();
          if (line.startsWith(prefix)) {
            clearTimeout(timer);
            socket.destroy();
            resolve(line);
          }
        }
      });

      socket.on("error", err => { clearTimeout(timer); reject(err); });
    });
  }

  /**
   * Query all primary state fields in one round-trip.
   *
   * @returns {Promise<{power, volume, mute, input, soundMode, speakerPreset, zone2}>}
   */
  async query() {
    const lines = await this.send(
      ["PW?", "MV?", "MU?", "SI?", "MS?", "SPPR?", "Z2?"],
      900
    );
    return parseState(lines);
  }
}

/**
 * Parse an array of raw response lines into a state object.
 *
 * @param {string[]} lines
 * @returns {object}
 */
export function parseState(lines) {
  const state = {};
  for (const line of lines) {
    if (line.startsWith("PW"))       state.power         = line.slice(2).toLowerCase();
    else if (line === "Z2ON")        state.zone2         = "on";
    else if (line === "Z2OFF")       state.zone2         = "off";
    else if (line.startsWith("Z2MU")) state.zone2Muted   = line === "Z2MUON";
    else if (/^Z2\d+$/.test(line))  state.zone2Volume   = parseInt(line.slice(2), 10);
    else if (line.startsWith("Z2")) state.zone2Source   = line.slice(2);
    else if (line.startsWith("MU")) state.mute          = line.slice(2).toLowerCase();
    else if (line.startsWith("SI")) state.input         = line.slice(2);
    else if (line.startsWith("MS")) state.soundMode     = line.slice(2);
    else if (line.startsWith("SPPR")) state.speakerPreset = line.slice(4).trim();
    else if (line.startsWith("MVMAX")) { /* ignore ceiling report */ }
    else if (line.startsWith("MV")) {
      const raw = line.slice(2);
      // 3-digit values encode half-dB steps: "555" → "55.5"
      state.volume = raw.length === 3 ? `${raw.slice(0, 2)}.${raw[2]}` : raw;
    }
  }
  return state;
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Example usage ─────────────────────────────────────────────────────────────

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const avr = new AVR(process.env.AVR_HOST ?? "192.168.1.X");

  console.log("Querying state...");
  const state = await avr.query();
  console.log(state);

  // Power on and set stereo mode
  // if (state.power !== "on") {
  //   await avr.sendWait("PWON", "PW", 5000);
  //   await delay(4000);
  // }
  // await avr.send(["Z2OFF", "SINET", "MSSTEREO", "SPPR 2", "MV50", "PSDYNEQ ON"], 1500);
}
