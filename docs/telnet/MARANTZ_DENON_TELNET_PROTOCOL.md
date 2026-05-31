# Marantz / Denon AVR — TCP Port 23 Control Guide

This guide covers the RS-232-over-IP (Telnet) control protocol exposed by modern Marantz and Denon AV receivers on **TCP port 23**. It focuses on **receivers from approximately 2016 onward** and documents commands verified on current hardware.

Denon publishes official protocol PDFs tied to specific older models (the most widely circulated is for the AVR-1713/1613, dated 2012). Those documents are useful as a historical command dictionary but predate HEOS, Audyssey MultEQ XT32, Dolby Atmos, DTS:X, and Neural:X — and do not reflect the command set of modern units. This guide exists to fill that gap with tested, community-maintained documentation.

Minor command availability differences exist between models — the receiver replies `?` for unsupported commands. See the tested-on table in the README.

## Sources

Primary local sources:

- Live captures and probes from a Marantz Cinema 70s.
- `test/results-cinema70s.json` in this repository.
- `/home/albert/marantz/marantz_commands.json`, a broader local command dictionary assembled from captures and community references.

Official/historical Denon protocol PDFs:

- Denon AVR-1713/AVR-1613 control protocol v8.6.0: <https://assets.denon.com/DocumentMaster/UK/AVR1713_AVR1613_PROTOCOL_V860.pdf>
- Denon AVR-2113CI/AVR-1913 control protocol: <https://downloads.denon.com/documentmaster/us/avr2113ci_avr1913_protocol_v04.pdf>
- Denon AVR-2112CI/AVR-1912 control protocol v7.4.0: <https://assets.denon.com/documentmaster/master/avr2112ci_avr1912_protocol_v740.pdf>

Community references:

- Denon AVR protocol implementation data from the `ol-iver/denonavr` ecosystem.
- RemoteCentral's manufacturer-supplied Denon RS-232/IP protocol sheet index: <https://files.remotecentral.com/library/22-1/denon/receiver/date.html>

Use the official PDFs as historical references, not as complete modern command
coverage. Modern HEOS/Atmos/DTS:X/Audyssey behavior requires live validation.

---

## Protocol basics

| Property | Value |
|---|---|
| Transport | Raw TCP (Telnet-compatible) |
| Port | **23** |
| Encoding | Plain ASCII |
| Command terminator | **`\r`** (CR, 0x0D) — no LF |
| Response terminator | **`\r`** (CR) |
| Response format | One line per CR |
| Connection model | Open → send → collect → close (no persistent keep-alive needed) |

The receiver does **not** require a login handshake. Connect, write `COMMAND\r`, read responses, close. The receiver also sends **unsolicited state-change events** whenever settings change (via remote, panel, or other clients) — subscribe to these by holding the connection open if you need real-time updates.

---

## Connection patterns

Two patterns cover all use cases.

### Pattern 1 — batch send + timed collect

Send one or more commands, wait a fixed window for all responses to arrive, then close. Use for state queries, multi-step sequences (mode application, volume ramping), and any case where you do not know in advance which prefix the reply will carry.

```
open TCP to host:23
  for each command:
    write command + \r
    sleep 80–100 ms          ← gives the AVR time to process each command before the next
  wait collectMs             ← collect all async responses
close TCP
return all CR-delimited response lines
```

Practical `collectMs` values:
- Single status query: **400 ms**
- Full state poll (6–7 queries): **900 ms**
- Mode apply (5–6 commands): **`numCommands × 150 + 700` ms**

### Pattern 2 — single command, wait for prefix

Send one command and resolve as soon as a line starting with the expected prefix arrives. Use for power, mute, absolute volume set, input switch — any command with a deterministic, prefix-identifiable reply.

```
open TCP to host:23
write command + \r
read lines until one starts with expectedPrefix → done
timeout (3 s default) → error
close TCP
```

### Node.js reference implementation

```js
import { createConnection } from "net";

function send(host, commands, collectMs = 600) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port: 23 });
    const lines = [];
    let buf = "";
    socket.setTimeout(3000);
    socket.on("connect", async () => {
      for (const cmd of commands) {
        socket.write(cmd + "\r");
        await new Promise(r => setTimeout(r, 100));
      }
      setTimeout(() => { socket.destroy(); resolve(lines); }, collectMs);
    });
    socket.on("data", chunk => {
      buf += chunk.toString();
      const parts = buf.split("\r");
      buf = parts.pop() ?? "";
      for (const p of parts) { const l = p.trim(); if (l) lines.push(l); }
    });
    socket.on("timeout", () => { socket.destroy(); resolve(lines); });
    socket.on("error", reject);
  });
}

function sendWait(host, command, prefix, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port: 23 });
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
        const l = p.trim();
        if (l.startsWith(prefix)) { clearTimeout(timer); socket.destroy(); resolve(l); }
      }
    });
    socket.on("error", err => { clearTimeout(timer); reject(err); });
  });
}
```

---

## State query

Append `?` to any command prefix to query that parameter:

```
PW?    → power state
MV?    → master volume + MVMAX ceiling
MU?    → mute state
SI?    → selected input (+ companion video/OSD state lines)
ZM?    → main zone power
MS?    → surround / sound mode (+ companion EQ state lines)
SPPR?  → speaker preset  ⚠ unresponsive on some models in standby
CV?    → all channel volume trims + CVEND sentinel
Z2?    → Zone 2 power + source + volume (+ companion video/OSD state lines)
```

Query core state at once (900 ms collect window):

```js
const lines = await send(host, ["PW?", "MV?", "MU?", "SI?", "ZM?", "MS?", "SPPR?", "Z2?"], 900);
```

### Response parsing

| Response prefix | Field | Examples |
|---|---|---|
| `PW` | power | `PWON`, `PWSTANDBY` |
| `MU` | mute | `MUON`, `MUOFF` |
| `SI` | input | `SIAUX1`, `SINET`, `SISAT/CBL` |
| `ZM` | mainZone | `ZMON`, `ZMOFF` |
| `MS` | soundMode | `MSSTEREO`, `MSDTS NEURAL:X`, `MSAUTO` |
| `SPPR` | speakerPreset | `SPPR 1`, `SPPR 2` — space between prefix and digit |
| `MV` | volume | see encoding below |
| `MVMAX` | — | reports volume ceiling — same 3-digit encoding as `MV` |
| `CV{ch}` | channelTrim | `CVFL 50`, `CVC 50` — 50 = 0 dB; see channel volume section |
| `CVEND` | — | sentinel marking end of a `CV?` response burst |
| `Z2ON` / `Z2OFF` | zone2 | exact strings — match literally, not as prefix |
| `Z2MU` | zone2Muted | `Z2MUON`, `Z2MUOFF` |
| `Z2{NN}` | zone2Volume | `Z256` → 56 |
| `Z2{source}` | zone2Source | `Z2NET`, `Z2AUX1` |

#### Companion responses

Several queries return unsolicited companion lines alongside the primary response. Parse them all — do not discard lines that do not match the queried prefix:

| Query | Companion lines also returned |
|---|---|
| `SI?` | `SV*` (video select), `VSS*` (video processing), `OPAL*` (OSD settings) |
| `MS?` | `PSDRC`, `PSLFE`, `PSBAS`, `PSTRE`, `PSTONE CTRL` |
| `CV?` | `CVEND` (end sentinel), `DCAUTO` (digital input mode) |
| `Z2?` | `Z2{source}`, `Z2{volume}`, `SV*`, `VSS*`, `OPAL*` |

#### Volume encoding

Volume is transmitted as an integer with no decimal separator. Three-digit values encode a half-dB step:

| Raw | Decoded |
|---|---|
| `MV60` | 60.0 |
| `MV555` | 55.5 |
| `MV505` | 50.5 |
| `MV38` | 38.0 |

```js
const raw = line.slice(2);  // strip "MV"
const volume = raw.length === 3
  ? `${raw.slice(0, 2)}.${raw[2]}`  // "555" → "55.5"
  : raw;
```

The `MVMAX` response uses the same encoding and reports the hardware ceiling, which varies by model — a Cinema 70s probe returned `MVMAX 695` (69.5 dB max), not the 98 stated in the 2012 Denon protocol PDF.

Per the official spec, **MV80 = 0 dB** reference level. Levels above 80 are positive gain (+0.5 dB per step); levels below are attenuation. MV00 is the minimum (below −79.5 dB). Typical listening: MV40–MV70.

---

## Power

| Command | Reply | Notes |
|---|---|---|
| `PWON\r` | `PWON` | Boot takes **3–5 s** — do not send further commands until complete |
| `PWSTANDBY\r` | `PWSTANDBY` | Soft standby — network stack stays active |

Always wait for the receiver to fully boot before sending additional commands:

```js
await sendWait(host, "PWON", "PW", 5000);
await new Promise(r => setTimeout(r, 4000));  // boot window
// safe to proceed
```

**Zone 2 before standby (critical):**  
Zone 2 has an independent power amplifier. If Zone 2 is active when `PWSTANDBY` is sent, the unit will remain physically on. Always shut Zone 2 down first:

```js
await send(host, ["Z2OFF"], 400);
await sendWait(host, "PWSTANDBY", "PW", 3000);
```

---

## Volume

### Absolute set

```
MV{level}\r    →  MV{level}   MVMAX 98
```

- Valid range: **0–98**
- Half-dB steps work: `MV555\r` sets 55.5; integer `MV55\r` also works
- The receiver echoes the new level followed by `MVMAX 98` on the same connection

### Relative steps

```
MVUP\r    →  MV{new_level}    (+0.5 dB)
MVDOWN\r  →  MV{new_level}    (−0.5 dB)
```

For multiple steps, repeat the command with ~100 ms between sends:

```js
const cmds = Array(steps).fill("MVUP");  // or "MVDOWN"
const lines = await send(host, cmds, steps * 100 + 500);
// final volume: last MV-prefixed line that is not MVMAX
const finalVol = [...lines].reverse().find(l => l.startsWith("MV") && !l.startsWith("MVMAX"));
```

---

## Mute

```
MUON\r    →  MUON
MUOFF\r   →  MUOFF
```

---

## Input selection

```
SI{input}\r    →  SI{input}
```

| Command | Standard label |
|---|---|
| `SIAUX1\r` | AUX 1 |
| `SIAUX2\r` | AUX 2 |
| `SINET\r` | Network / HEOS |
| `SISAT/CBL\r` | SAT / Cable |
| `SIDVD\r` | DVD |
| `SIBD\r` | Blu-ray |
| `SIGAME\r` | Game |
| `SIPHONO\r` | Phono |
| `SICD\r` | CD |
| `SITUNER\r` | Tuner |
| `SIMPLAY\r` | Media Player |

**NET input — Zone 2 auto-activation:**  
On many models, switching to `NET` can silently power on Zone 2. Send `Z2OFF` before any `SINET` switch if Zone 2 auto-activation is undesirable:

```js
await send(host, ["Z2OFF"], 400);
await sendWait(host, "SINET", "SI");
```

---

## Surround / sound mode

```
MS{mode}\r    →  MS{mode}
```

| Command | Display name | Notes |
|---|---|---|
| `MSAUTO\r` | Auto | Detects incoming signal format, selects appropriate decoder |
| `MSSTEREO\r` | Stereo | 2-channel processing; Audyssey and tone controls active |
| `MSPURE DIRECT\r` | Pure Direct | Bypasses **all** DSP, Audyssey, and tone controls; lowest noise floor |
| `MSDTS NEURAL:X\r` | DTS Neural:X | Neural upmix to full speaker layout |
| `MSMCH STEREO\r` | Multi-Ch Stereo | Stereo source spread across all speakers |
| `MSDOLBY SURROUND\r` | Dolby Surround | Dolby upmix for stereo / non-Atmos sources |

### Smart Surround modes

The `MSSMART` family lets the receiver automatically select a surround mode based on the incoming signal:

| Command | Display name | Behaviour |
|---|---|---|
| `MSSMART\r` | Smart Surround | Auto-selects between 2-ch and multi-ch based on source |
| `MSSMART2CH\r` | Smart Stereo | Forces Smart selection within 2-channel modes |
| `MSSMART5CH\r` | Smart 5-channel | Forces Smart selection within 5-channel modes |
| `MSSMART7CH\r` | Smart 7-channel | Forces Smart selection within 7-channel modes |

> **Community data needed.** These commands are part of the documented protocol but are not widely tested via TCP. If you use them, query state after applying to confirm the change took effect and allow a longer settle time (~500 ms) before sending follow-up commands. Report your results — model, firmware version, and whether the command was accepted or returned `?`.

---

## Speaker preset

```
SPPR {N}\r    →  SPPR {N}
```

Note the **space** between `SPPR` and the digit. The query response also contains a space.

| Command | Use |
|---|---|
| `SPPR 1\r` | Preset A — typically full surround layout |
| `SPPR 2\r` | Preset B — typically a reduced or alternative layout |

Presets are configured in the receiver's setup menu. The protocol just switches between them.

---

## Channel volume trim

Individual speaker level offsets. Each channel has its own `CV{ch}` prefix.

```
CV{ch} UP\r       → CV{ch} {new_level}    (+1 step)
CV{ch} DOWN\r     → CV{ch} {new_level}    (−1 step)
CV{ch} {NN}\r     → CV{ch} {NN}           (absolute, 38–62, 50 = 0 dB)
CV?\r             → all channels + CVEND sentinel
```

| Prefix | Channel |
|---|---|
| `CVFL` | Front Left |
| `CVFR` | Front Right |
| `CVC` | Centre |
| `CVSW` | Subwoofer |
| `CVSL` | Surround Left |
| `CVSR` | Surround Right |

Scale: **38–62**, where **50 = 0 dB**. A `CV?` query returns all channels simultaneously terminated by `CVEND`.

---

## Main zone

```
ZMON\r     → ZMON     (main zone on)
ZMOFF\r    → ZMOFF    (main zone off — not the same as standby)
ZM?\r      → ZMON | ZMOFF
```

`ZM` controls the main zone amplifier independently of overall power. On most units `ZMOFF` mutes the main zone outputs while keeping the network stack and Zone 2 alive.

---

## Signal input mode

```
SD{mode}\r    →  SD{mode}
SD?\r         →  SDAUTO | SDHDMI | SDDIGITAL | SDANALOG
```

| Command | Effect |
|---|---|
| `SDAUTO\r` | Auto (priority: HDMI → Digital → Analog) |
| `SDHDMI\r` | Force HDMI input |
| `SDDIGITAL\r` | Force digital input (optical / coaxial) |
| `SDANALOG\r` | Force analog input |

---

## Sleep timer

```
SLP{NNN}\r    →  SLP{NNN}    (001–120 minutes, e.g. SLP030 = 30 min)
SLPOFF\r      →  SLPOFF      (cancel)
SLP?\r        →  SLP{NNN} | SLPOFF
```

Zone 2 has its own independent sleep timer:
```
Z2SLP{NNN}\r    →  Z2SLP{NNN}
Z2SLPOFF\r      →  Z2SLPOFF
Z2SLP?\r        →  Z2SLP{NNN} | Z2SLPOFF
```

---

## Audyssey / EQ

```
PSDYNEQ ON\r     →  PSDYNEQ ON
PSDYNEQ OFF\r    →  PSDYNEQ OFF
```

Pure Direct mode disables Audyssey automatically on the hardware side — the receiver does **not** re-enable it when you switch to a different surround mode. If your application switches modes, explicitly send `PSDYNEQ ON\r` after any transition away from Pure Direct.

Additional `PS` parameters — **✓ = confirmed on Cinema 70s**, blank = from official spec, unverified on modern hardware:

| Command | Function | Cinema 70s |
|---|---|---|
| `PSDYNEQ ON/OFF\r` | Dynamic EQ | ✓ |
| `PSREFLEV {0/5/10/15}\r` | Reference Level Offset | ✓ |
| `PSDYNVOL {OFF/LIT/MED/HEV}\r` | Dynamic Volume | ✓ |
| `PSBAS {UP/DOWN/NN}\r` | Bass trim (38–62, 50 = 0 dB) | ✓ |
| `PSTRE {UP/DOWN/NN}\r` | Treble trim (38–62, 50 = 0 dB) | ✓ |
| `PSTONE CTRL {ON/OFF}\r` | Tone control on/off | ✓ |
| `PSDRC {OFF/LOW/MID/HI/AUTO}\r` | Dynamic compression | ✓ |
| `PSLFE {NN}\r` | LFE level (00–10, 00 = 0 dB) | ✓ |
| `PSEFF {NN}\r` | Effect level | ✓ |
| `PSDEL {NNN}\r` | Effect delay (000–999 ms) | ✓ |
| `PSSWR {ON/OFF}\r` | Subwoofer on/off | ✓ |
| `PSLOM {ON/OFF}\r` | Loudness management | ✓ |
| `PSDELAY {NNN}\r` | Audio delay (000–200 ms) | ✓ |
| `PSMULTEQ:{MODE}\r` | MultEQ mode (AUDYSSEY/BYP.LR/FLAT/MANUAL/OFF) | — |
| `PSCINEMA EQ.{ON/OFF}\r` | Cinema EQ | — |
| `PSPAN {ON/OFF}\r` | Panorama (Dolby PL II) | — |
| `PSDIM {NN}\r` | Dimension | — |
| `PSCEN {NN}\r` | Centre width | — |
| `PSCEI {NN}\r` | Centre image | — |
| `PSRSZ {S/MS/M/ML/L}\r` | Room size | — |
| `PSRSTR {OFF/MODE1/MODE2/MODE3}\r` | Audio restorer | — |

---

## Zone 2

Zone 2 has an **independent amplifier, source selector, and volume control**. All commands use the `Z2` prefix.

| Command | Effect |
|---|---|
| `Z2ON\r` | Power on Zone 2 |
| `Z2OFF\r` | Power off Zone 2 |
| `Z2{NN}\r` | Set Zone 2 absolute volume (e.g. `Z250\r`) |
| `Z2UP\r` | Zone 2 volume +1 step |
| `Z2DOWN\r` | Zone 2 volume −1 step |
| `Z2MUON\r` | Mute Zone 2 |
| `Z2MUOFF\r` | Unmute Zone 2 |
| `Z2{source}\r` | Set Zone 2 source (e.g. `Z2NET\r`, `Z2AUX1\r`) |
| `Z2?\r` | Query Zone 2 — returns power, source, volume + companion video state lines |

**Ordering rules:**
1. Send `Z2OFF` before `PWSTANDBY` — Zone 2 will prevent true standby otherwise
2. Send `Z2OFF` before switching main zone to `NET` — prevents unintended Zone 2 wake-up
3. Never assume Zone 2 is off — always send `Z2OFF` defensively before standby

---

## Activity preset sequence

Controlling an AVR for a specific activity (watching a film, listening to music in stereo, etc.) typically requires setting multiple parameters atomically. The recommended sequence:

```
[Z2OFF if switching to NET input]
SI{input}\r           wait → SI{input}
MS{surround}\r        wait → MS{surround}
SPPR {preset}\r       wait → SPPR {preset}
MV{volume}\r          wait → MV{volume}
[PSDYNEQ ON\r]        omit for Pure Direct
```

Allow ~150 ms per command for the receiver to apply each change before the next, plus a trailing 500–700 ms collect window.

Example — cinema preset (HDMI source, auto surround, full layout):
```
SIAUX1\r  →  MSAUTO\r  →  SPPR 1\r  →  MV60\r  →  PSDYNEQ ON\r
```

Example — stereo music preset (network source, stereo, sub + mains only):
```
Z2OFF\r  →  SINET\r  →  MSSTEREO\r  →  SPPR 2\r  →  MV50\r  →  PSDYNEQ ON\r
```

---

## Error handling

| Situation | Receiver response | Action |
|---|---|---|
| Unsupported command | `?` | Report unsupported; do not retry |
| No reply within 3 s | Socket timeout / silence | Report unresponsive; check power and network |
| TCP connection refused | OS-level `ECONNREFUSED` | Receiver is off or IP / port is wrong |
| Empty response to query | — | Receiver may be mid-boot; wait 4 s and retry once |

Do not retry failed commands automatically without surfacing the error — the receiver may be in an inconsistent state.

---

## Implementation notes

### Inter-command delay

**80–100 ms** between commands in a batch is the safe minimum. Sending commands faster risks silent drops — the receiver's command queue is shallow.

### Response framing

Split incoming data on `\r` (CR). There is no LF. Some responses have trailing whitespace — always trim. Buffer incomplete fragments across `data` events:

```js
let buf = "";
socket.on("data", chunk => {
  buf += chunk.toString();
  const parts = buf.split("\r");
  buf = parts.pop() ?? "";          // hold incomplete tail
  for (const p of parts) {
    const line = p.trim();
    if (line) handle(line);
  }
});
```

### Single concurrent connection

Port 23 accepts **only one TCP connection at a time**. A second connect attempt while a connection is already open will either be refused or silently ignored. If your application opens and closes connections per command (the pattern used in this guide), this is rarely an issue. If you hold a persistent connection, ensure no other client (Home Assistant, openHAB, another script) is also connected — the second client will fail without any error visible to the first.

### Do not cache state across sessions

Volume, input, Zone 2 state, and mute can change at any time via the physical remote, the front panel, or the HEOS app. Always query fresh state before acting on stale assumptions.

### Network streaming vs Spotify Connect vs HEOS

| Layer | Protocol | Port | Purpose |
|---|---|---|---|
| AVR control | ASCII/TCP | **23** | Power, volume, input, surround mode |
| HEOS playback | JSON/TCP | **1255** | Queue, browse, play, group — non-Spotify |
| Spotify Connect | Spotify Web API | HTTPS | Playback control when AVR is a Spotify target |

Set the input to `NET` over TCP 23, then control playback via the appropriate upper layer. Do not attempt to control Spotify playback through TCP 23 or HEOS CLI — they are separate systems.

---

## Observed but undocumented responses

The following response prefixes have been observed on a Marantz Cinema 70s but are not in any published protocol document. Their exact semantics are inferred, not confirmed. Community contributions welcome.

| Prefix | Observed example | Inferred meaning |
|---|---|---|
| `SYSMI` | `SYSMI Multi Ch Stereo` | Current surround mode in human-readable form |
| `SYSDA` | `SYSDA FLAC` | Current audio stream format (FLAC, PCM, DTS, etc.) |
| `OPINFINS` | `OPINFINS 11111111111111000000` | Input availability bitmask |
| `OPINFASP` | `OPINFASP 11111100000000000000000000000000` | Audio stream property bitmask |
| `SV` | `SVOFF`, `SVAUX1` | Video select state (companion to `SI?` and `Z2?`) |
| `VSS` | `VSSCHOFF`, `VSVPMAUTO` | Video processing / scaling settings |
| `OPAL` | `OPALSSET ON`, `OPALSDSP OFF`, `OPALSVAL 000` | OSD overlay settings |
| `CVEND` | `CVEND` | End-of-list sentinel terminating a `CV?` response burst |
| `DCAUTO` | `DCAUTO` | Digital input mode — returned as companion to `CV?` |
| `BTTX` | `BTTX OFF`, `BTTX SP` | Bluetooth transmitter state — broadcast unsolicited on power-on |
| `OPTXM` | `OPTXM AVL`, `OPTXM END` | Optical transmitter state — `END` terminates burst; broadcast on power-on |
| `SSINFAISFSV` | `SSINFAISFSV NON` | Speaker setup info flag — responds to `?` query; meaning of values unknown |
| `SSSMG` | `SSSMG MUS` | Sound mode group — responds to `?` query; full command family unmapped |

---

## Model compatibility

Results from running `test/probe.mjs` against specific units. Add your own by submitting a PR with your `results-{model}.json` file.

| Command | Cinema 70s | Notes |
|---|---|---|
| `PW?` | ✓ | |
| `MV?` | ✓ | Also returns `MVMAX 695` (max = 69.5 dB) |
| `MU?` | ✓ | |
| `SI?` | ✓ | Returns 8 lines including video/OSD companion state |
| `ZM?` | ✓ | |
| `MS?` | ✓ | Returns surround mode + EQ companion state |
| `MSQUICK?` | ✓ | Returns `SYSMI`, `SYSDA`, `OPINFINS`, `OPINFASP` |
| `SPPR?` | — | No response (standby); may work when powered on |
| `CV?` | ✓ | Returns all 6 channels + `CVEND` + `DCAUTO` |
| `SD?` | ✓ | |
| `DC?` | — | Not supported |
| `SV?` | ✓ | Returns 7 lines including video/OSD state |
| `SLP?` | ✓ | |
| `PSTONE CTRL?` | ✓ | |
| `PSCINEMA EQ.?` | — | Not supported |
| `PSMODE:?` | — | Not supported (legacy Dolby PL mode) |
| `PSLOM?` | ✓ | |
| `PSMULTEQ:?` | — | Not supported |
| `PSDYNEQ?` | ✓ | |
| `PSREFLEV?` | ✓ | |
| `PSDYNVOL?` | ✓ | |
| `PSBAS?` | ✓ | |
| `PSTRE?` | ✓ | |
| `PSDRC?` | ✓ | |
| `PSLFE?` | ✓ | |
| `PSEFF?` | ✓ | |
| `PSDEL?` | ✓ | |
| `PSPAN?` | — | Not supported (legacy Dolby PL II) |
| `PSDIM?` | — | Not supported |
| `PSCEN?` | — | Not supported |
| `PSCEI?` | — | Not supported |
| `PSSWR?` | ✓ | |
| `PSRSZ?` | — | Not supported |
| `PSDELAY?` | ✓ | |
| `PSRSTR?` | — | Not supported |
| `Z2?` | ✓ | Returns 10 lines including source, volume, video/OSD state |
| `Z2MU?` | ✓ | |
| `Z2SLP?` | ✓ | |

---

## Command quick reference

```
# State query
PW?     MV?     MU?     SI?     ZM?     MS?     CV?     SPPR?   Z2?     Z2MU?
SD?     SLP?    Z2SLP?

# Power
PWON                    PWSTANDBY

# Main zone
ZMON                    ZMOFF

# Volume
MV{0-98}                MVUP                    MVDOWN

# Mute
MUON                    MUOFF

# Input
SIAUX1                  SIAUX2                  SINET
SISAT/CBL               SIDVD                   SIBD
SIGAME                  SIPHONO                 SICD
SITUNER                 SIMPLAY

# Signal input mode
SDAUTO                  SDHDMI                  SDDIGITAL               SDANALOG

# Surround mode
MSAUTO                  MSSTEREO                MSPURE DIRECT
MSDTS NEURAL:X          MSMCH STEREO            MSDOLBY SURROUND

# Smart Surround (community data needed — see section above)
MSSMART                 MSSMART2CH              MSSMART5CH              MSSMART7CH

# Quick Select (from official spec, unverified on modern hardware)
MSQUICK1                MSQUICK2                MSQUICK3                MSQUICK4                MSQUICK5
MSQUICK1 MEMORY         MSQUICK2 MEMORY         MSQUICK3 MEMORY         MSQUICK4 MEMORY         MSQUICK5 MEMORY

# Speaker preset  (note the space)
SPPR 1                  SPPR 2

# Channel volume  (50 = 0 dB, range 38–62)
CVFL {NN}               CVFR {NN}               CVC {NN}
CVSW {NN}               CVSL {NN}               CVSR {NN}

# Audyssey / EQ  (✓ = confirmed Cinema 70s)
PSDYNEQ ON              PSDYNEQ OFF                                     ✓
PSREFLEV {0/5/10/15}                                                    ✓
PSDYNVOL OFF            PSDYNVOL LIT            PSDYNVOL MED            ✓
PSBAS UP                PSBAS DOWN              PSBAS {NN}              ✓
PSTRE UP                PSTRE DOWN              PSTRE {NN}              ✓
PSTONE CTRL ON          PSTONE CTRL OFF                                 ✓
PSDRC OFF               PSDRC LOW               PSDRC MID               ✓
PSLFE {NN}              PSEFF {NN}              PSDEL {NNN}             ✓
PSSWR ON                PSSWR OFF                                       ✓
PSLOM ON                PSLOM OFF                                       ✓
PSDELAY {NNN}                                                           ✓

# Sleep timer
SLP{NNN}                SLPOFF

# Zone 2
Z2ON                    Z2OFF
Z2{NN}                  Z2UP                    Z2DOWN
Z2MUON                  Z2MUOFF
Z2{source}              (e.g. Z2NET, Z2AUX1)
```
