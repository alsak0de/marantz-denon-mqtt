/**
 * send.mjs — Send one or more AVR Telnet commands and collect responses.
 *
 * Usage:
 *   AVR_HOST=192.168.1.X node test/send.mjs PW?
 *   AVR_HOST=192.168.1.X node test/send.mjs Z2OFF PW?
 *   AVR_HOST=192.168.1.X node test/send.mjs --collect-ms 1200 --gap-ms 150 SINET MSSTEREO
 *
 * Commands are sent exactly as provided, with a trailing CR added.
 */

import { createConnection } from "net";

const HOST = process.env.AVR_HOST;
if (!HOST) {
  console.error("Set AVR_HOST=<ip>");
  process.exit(1);
}

const PORT = Number(process.env.AVR_PORT || 23);

let collectMs = 800;
let gapMs = 120;
const commands = [];

for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (arg === "--collect-ms") {
    collectMs = Number(process.argv[++i]);
  } else if (arg === "--gap-ms") {
    gapMs = Number(process.argv[++i]);
  } else {
    commands.push(arg);
  }
}

if (commands.length === 0) {
  console.error("Provide at least one command.");
  process.exit(1);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function send(commandsToSend) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: HOST, port: PORT });
    const lines = [];
    let buf = "";

    socket.setTimeout(4000);

    socket.on("connect", async () => {
      for (const command of commandsToSend) {
        console.error(`AVR <- ${command}`);
        socket.write(`${command}\r`);
        await sleep(gapMs);
      }
      setTimeout(() => {
        socket.destroy();
        resolve(lines);
      }, collectMs);
    });

    socket.on("data", chunk => {
      buf += chunk.toString();
      const parts = buf.split("\r");
      buf = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.trim();
        if (line) lines.push(line);
      }
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve(lines);
    });

    socket.on("error", reject);
  });
}

try {
  const lines = await send(commands);
  for (const line of lines) console.log(line);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
