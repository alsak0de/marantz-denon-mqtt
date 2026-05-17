# Marantz / Denon AVR — TCP Port 23 Control Guide

This guide covers the RS-232-over-IP (Telnet) control protocol exposed by modern Marantz and Denon AV receivers on **TCP port 23**. The protocol is shared across the entire product line and has been stable since roughly 2010. Tested on the Cinema 70s, Cinema 60s, and X-series (AVR-X2700H, AVR-X4800H). Minor command availability differences exist between models — the receiver replies `?` for unsupported commands.

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
MV?    → master volume
MU?    → mute state
SI?    → selected input
MS?    → surround / sound mode
SPPR?  → speaker preset
Z2?    → Zone 2 power state
```

Query everything at once (900 ms collect window):

```js
const lines = await send(host, ["PW?", "MV?", "MU?", "SI?", "MS?", "SPPR?", "Z2?"], 900);
```

### Response parsing

| Response prefix | Field | Examples |
|---|---|---|
| `PW` | power | `PWON`, `PWSTANDBY` |
| `MU` | mute | `MUON`, `MUOFF` |
| `SI` | input | `SIAUX1`, `SINET`, `SISAT/CBL` |
| `MS` | soundMode | `MSSTEREO`, `MSDTS NEURAL:X`, `MSAUTO` |
| `SPPR` | speakerPreset | `SPPR 1`, `SPPR 2` — space between prefix and digit |
| `MV` | volume | see encoding below |
| `MVMAX` | — | ignore — reports ceiling, not current level |
| `Z2ON` / `Z2OFF` | zone2 | exact strings — match literally, not as prefix |
| `Z2MU` | zone2Muted | `Z2MUON`, `Z2MUOFF` |
| `Z2{NN}` | zone2Volume | `Z250` → 50 |
| `Z2{source}` | zone2Source | `Z2NET`, `Z2AUX1` |

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

Display scale: **0–98**. Typical listening range: 40–70.

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

> **Stability warning — read before using.**  
> Switching between `MSSMART*` variants, or between any `MSSMART*` mode and a conventional mode (e.g. `MSSTEREO`, `MSAUTO`), has been observed to cause receiver instability on multiple models and firmware versions. Symptoms include:
> - The receiver stops responding to further commands on the same connection
> - The mode change is silently ignored or reverts to the previous mode
> - In severe cases: Audyssey MultEQ calibration data is corrupted, requiring a full re-calibration
>
> If you use these commands, always query state after applying to confirm the change took effect, build in a longer settle time (~500 ms) before sending any follow-up commands, and avoid switching directly from one `MSSMART*` variant to another without an intermediate `MSAUTO` or `MSSTEREO` step. Treat this family as experimental.

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

## Audyssey / EQ

```
PSDYNEQ ON\r     →  PSDYNEQ ON
PSDYNEQ OFF\r    →  PSDYNEQ OFF
```

Pure Direct mode disables Audyssey automatically on the hardware side — the receiver does **not** re-enable it when you switch to a different surround mode. If your application switches modes, explicitly send `PSDYNEQ ON\r` after any transition away from Pure Direct.

Other documented Audyssey/EQ parameters (availability varies by model):

| Command | Function |
|---|---|
| `PSDYNVOL {OFF/LIT/MED/HEV}\r` | Dynamic Volume |
| `PSREFLEV {0/5/10/15}\r` | Reference Level Offset |
| `PSMULTEQ:{MODE}\r` | MultEQ mode (AUDYSSEY / BYP.LR / FLAT / MANUAL / OFF) |
| `PSBAS {UP/DOWN/NN}\r` | Bass trim |
| `PSTREB {UP/DOWN/NN}\r` | Treble trim |

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
| `Z2?\r` | Query Zone 2 power — returns `Z2ON` or `Z2OFF` |

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

## Command quick reference

```
# State query
PW?     MV?     MU?     SI?     MS?     SPPR?   Z2?

# Power
PWON                    PWSTANDBY

# Volume
MV{0-98}                MVUP                    MVDOWN

# Mute
MUON                    MUOFF

# Input
SIAUX1                  SIAUX2                  SINET
SISAT/CBL               SIDVD                   SIBD
SIGAME                  SIPHONO                 SICD
SITUNER                 SIMPLAY

# Surround mode
MSAUTO                  MSSTEREO                MSPURE DIRECT
MSDTS NEURAL:X          MSMCH STEREO            MSDOLBY SURROUND

# Smart Surround (use with caution — see stability warning in section above)
MSSMART                 MSSMART2CH              MSSMART5CH              MSSMART7CH

# Speaker preset  (note the space)
SPPR 1                  SPPR 2

# Audyssey / EQ
PSDYNEQ ON              PSDYNEQ OFF
PSDYNVOL OFF            PSDYNVOL LIT            PSDYNVOL MED
PSBAS UP                PSBAS DOWN              PSBAS {NN}
PSTREB UP               PSTREB DOWN             PSTREB {NN}

# Zone 2
Z2ON                    Z2OFF
Z2{NN}                  Z2UP                    Z2DOWN
Z2MUON                  Z2MUOFF
Z2{source}              (e.g. Z2NET, Z2AUX1)
```
