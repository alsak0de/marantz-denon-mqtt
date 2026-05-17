/**
 * probe.mjs — Query every known command prefix and log what the receiver reports.
 *
 * Usage:
 *   AVR_HOST=192.168.1.X node test/probe.mjs
 *   AVR_HOST=192.168.1.X node test/probe.mjs --output results.json
 *
 * For each command the script sends CMD?\r, waits for all responses within
 * a collect window, and records every line the receiver emits — not just the
 * expected prefix. This surfaces unsolicited companion responses (e.g. querying
 * CV? returns volume for ALL channels simultaneously) and reveals which commands
 * the unit supports vs which return "?".
 *
 * Results are written to stdout as JSON and optionally to a file.
 */

import { createConnection } from "net";
import { writeFileSync } from "fs";

const HOST = process.env.AVR_HOST;
if (!HOST) { console.error("Set AVR_HOST=<ip>"); process.exit(1); }

const PORT = 23;
const COLLECT_MS = 600;   // window to capture all companion responses per query
const INTER_MS   = 400;   // pause between queries to avoid flooding

// All query-able command prefixes from the official protocol doc + known modern additions.
// Grouped by subsystem for readability in the output.
const QUERIES = [
  // ── Core ──────────────────────────────────────────────────────────────────
  { cmd: "PW",       group: "power",        desc: "Power state" },
  { cmd: "MV",       group: "volume",       desc: "Master volume" },
  { cmd: "MU",       group: "volume",       desc: "Mute state" },
  { cmd: "SI",       group: "input",        desc: "Selected input" },
  { cmd: "ZM",       group: "zone_main",    desc: "Main zone power" },
  { cmd: "MS",       group: "surround",     desc: "Surround / sound mode" },
  { cmd: "MSQUICK ", group: "surround",     desc: "Quick Select current preset" },  // note trailing space per spec
  { cmd: "SPPR",     group: "speakers",     desc: "Speaker preset" },

  // ── Channel volume ─────────────────────────────────────────────────────────
  { cmd: "CV",       group: "channel_vol",  desc: "Channel volume (all channels)" },

  // ── Signal routing ─────────────────────────────────────────────────────────
  { cmd: "SD",       group: "signal",       desc: "Signal input mode (HDMI/DIGITAL/ANALOG/AUTO)" },
  { cmd: "DC",       group: "signal",       desc: "Digital input mode (AUTO/PCM/DTS)" },
  { cmd: "SV",       group: "signal",       desc: "Video select mode" },
  { cmd: "SLP",      group: "timer",        desc: "Main zone sleep timer" },

  // ── Audyssey / EQ (PS family) ─────────────────────────────────────────────
  { cmd: "PSTONE CTRL ",  group: "eq",  desc: "Tone control on/off" },
  { cmd: "PSCINEMA EQ.",  group: "eq",  desc: "Cinema EQ on/off" },
  { cmd: "PSMODE:",       group: "eq",  desc: "Dolby PL mode" },
  { cmd: "PSLOM ",        group: "eq",  desc: "Loudness management" },
  { cmd: "PSMULTEQ:",     group: "eq",  desc: "MultEQ mode" },
  { cmd: "PSDYNEQ ",      group: "eq",  desc: "Dynamic EQ" },
  { cmd: "PSREFLEV ",     group: "eq",  desc: "Reference level offset" },
  { cmd: "PSDYNVOL ",     group: "eq",  desc: "Dynamic Volume" },
  { cmd: "PSBAS ",        group: "eq",  desc: "Bass trim" },
  { cmd: "PSTRE ",        group: "eq",  desc: "Treble trim" },
  { cmd: "PSDRC ",        group: "eq",  desc: "Dynamic compression" },
  { cmd: "PSLFE ",        group: "eq",  desc: "LFE level" },
  { cmd: "PSEFF ",        group: "eq",  desc: "Effect level" },
  { cmd: "PSDEL ",        group: "eq",  desc: "Effect delay" },
  { cmd: "PSPAN ",        group: "eq",  desc: "Panorama" },
  { cmd: "PSDIM ",        group: "eq",  desc: "Dimension" },
  { cmd: "PSCEN ",        group: "eq",  desc: "Centre width" },
  { cmd: "PSCEI ",        group: "eq",  desc: "Centre image" },
  { cmd: "PSSWR ",        group: "eq",  desc: "Subwoofer on/off" },
  { cmd: "PSRSZ ",        group: "eq",  desc: "Room size" },
  { cmd: "PSDELAY ",      group: "eq",  desc: "Audio delay" },
  { cmd: "PSRSTR ",       group: "eq",  desc: "Audio restorer" },

  // ── Zone 2 ────────────────────────────────────────────────────────────────
  { cmd: "Z2",       group: "zone2",       desc: "Zone 2 power / source" },
  { cmd: "Z2MU",     group: "zone2",       desc: "Zone 2 mute" },
  { cmd: "Z2SLP",    group: "zone2",       desc: "Zone 2 sleep timer" },
];

// Send CMD?\r and collect all response lines within COLLECT_MS.
function query(cmd) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: HOST, port: PORT });
    const lines = [];
    let buf = "";
    socket.setTimeout(3000);

    socket.on("connect", () => {
      socket.write(cmd + "?\r");
      setTimeout(() => { socket.destroy(); resolve(lines); }, COLLECT_MS);
    });
    socket.on("data", chunk => {
      buf += chunk.toString();
      const parts = buf.split("\r");
      buf = parts.pop() ?? "";
      for (const p of parts) { const l = p.trim(); if (l) lines.push(l); }
    });
    socket.on("timeout", () => { socket.destroy(); resolve(lines); });
    socket.on("error",   () => { resolve(["ERROR: connection failed"]); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Main ──────────────────────────────────────────────────────────────────────

console.error(`Probing ${HOST}:${PORT} — ${QUERIES.length} queries…\n`);

const results = [];

for (const { cmd, group, desc } of QUERIES) {
  process.stderr.write(`  ${(cmd + "?").padEnd(20)} `);
  const lines = await query(cmd);

  const supported = lines.length > 0 && !lines.every(l => l === "?");
  process.stderr.write(supported ? `✓  ${lines.join(" | ")}\n` : `–  (no response / ?)\n`);

  results.push({ command: cmd.trim() + "?", group, desc, supported, responses: lines });
  await sleep(INTER_MS);
}

// ── Output ────────────────────────────────────────────────────────────────────

const output = JSON.stringify({ host: HOST, probed_at: new Date().toISOString(), results }, null, 2);

const outFile = process.argv.includes("--output")
  ? process.argv[process.argv.indexOf("--output") + 1]
  : null;

if (outFile) {
  writeFileSync(outFile, output);
  console.error(`\nResults written to ${outFile}`);
} else {
  console.log(output);
}

const supported = results.filter(r => r.supported).length;
console.error(`\n${supported}/${results.length} commands supported on this unit.`);
