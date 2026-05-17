/**
 * listen.mjs — Passive listener. Holds the TCP connection open and logs every
 * line the receiver emits, timestamped.
 *
 * Usage:
 *   AVR_HOST=192.168.1.X node test/listen.mjs
 *   AVR_HOST=192.168.1.X node test/listen.mjs --output session.jsonl
 *
 * Run this while operating the receiver via remote control, the HEOS app,
 * or by sending test commands from another terminal. Everything the receiver
 * broadcasts is logged — this is how you discover:
 *   - Which events a given action triggers
 *   - What companion events accompany a command (e.g. changing surround mode
 *     also emits channel volume updates for all channels)
 *   - Exact response format and encoding for unfamiliar commands
 *
 * Output is one JSON object per line (JSONL) for easy post-processing.
 * Ctrl+C to stop.
 */

import { createConnection } from "net";
import { createWriteStream } from "fs";

const HOST = process.env.AVR_HOST;
if (!HOST) { console.error("Set AVR_HOST=<ip>"); process.exit(1); }

const PORT = 23;

const outFile = process.argv.includes("--output")
  ? process.argv[process.argv.indexOf("--output") + 1]
  : null;

const fileStream = outFile ? createWriteStream(outFile, { flags: "a" }) : null;

function emit(line) {
  const entry = { t: new Date().toISOString(), line };
  const formatted = JSON.stringify(entry);
  console.log(formatted);
  fileStream?.write(formatted + "\n");
}

function connect() {
  const socket = createConnection({ host: HOST, port: PORT });
  let buf = "";

  socket.on("connect", () => {
    console.error(`Connected to ${HOST}:${PORT} — listening. Ctrl+C to stop.`);
    if (outFile) console.error(`Logging to ${outFile}`);
  });

  socket.on("data", chunk => {
    buf += chunk.toString();
    const parts = buf.split("\r");
    buf = parts.pop() ?? "";
    for (const p of parts) {
      const line = p.trim();
      if (line) emit(line);
    }
  });

  socket.on("close", () => {
    console.error("Connection closed — reconnecting in 3s…");
    setTimeout(connect, 3000);
  });

  socket.on("error", err => {
    console.error(`Connection error: ${err.message} — retrying in 3s…`);
    setTimeout(connect, 3000);
  });
}

connect();
