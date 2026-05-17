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

## When TCP isn't enough — IR blaster fallback

Some receiver functions have **no TCP equivalent**: Quick Select preset recall, certain OSD navigation actions, and a handful of mode buttons only exist as physical remote commands. For these, an IR blaster pointed at the receiver's front-panel sensor is the only programmatic path.

### When you need IR

- **Quick Select / Smart Select presets** — one-button recall of a full saved configuration (input + volume + surround mode + EQ). No TCP command exists for recalling these; you can only set the individual parameters separately via TCP.
- **OSD navigation** — menu traversal (Up / Down / Left / Right / Enter / Back) is not exposed over TCP on most models.
- **Buttons without TCP mappings** — ECO mode toggle, Info overlay, Setup menu entry, and some source-direct shortcuts vary by model.
- **Receiver unresponsive on TCP** — the network stack can become unreachable while the IR sensor still works (e.g., after certain crash states). IR can be used to force a clean power cycle.

### Hardware options

Any IR blaster with a learning or code-library mode will work. Common choices:

| Device | Interface | Notes |
|---|---|---|
| Broadlink RM4 Pro | Wi-Fi / REST | Widely supported in Home Assistant, openHAB |
| SwitchBot Hub 2 | BLE / Cloud API | Compact; cloud-dependent by default |
| Global Caché iTach / GC-100 | TCP | LAN-native, no cloud, popular in pro installs |
| USB IR Blaster (FLIRC, etc.) | USB HID | Good for always-on servers |

Position the blaster within line-of-sight of the receiver's front IR window (usually bottom-centre of the fascia).

### IR code format and portability

IR codes for Marantz/Denon receivers are **not universal**. The same button can produce different raw signals across model families, firmware revisions, and occasionally individual units of the same SKU. Always verify codes against your specific unit before deploying.

The codes below were captured from a Marantz Cinema 70s using a learning blaster. They are provided as a working reference and starting point. The encoding is a **vendor-specific base64 container** wrapping raw IR timing data (pulse/space sequences with 0xFFFF used as a long-gap sentinel). The format is not Pronto and not standard Broadlink — import it as raw learned data into your blaster's interface.

> **Do not treat these as a drop-in for other models.** Re-learn from your own remote if the codes below do not work.

```json
{
  "power":        "A60DZQPAAwMGB2UDwAFAE4ABAQYHQAsJBgdlA60D//+tA0AHgANAE0ABQA/AAQ+tAwYHrQNlAwYHZQNlA///QAtAAUAHgBPgBwEBBgfgARsB//9AC0ABQAcDBgdlA0ABQAvgAQEBBgdADwcGB2UDZQP//0ALwANAE0AL4AUBCwYHZQNlAwYHZQNlAw==",
  "mute":         "BXYDdgP3BkABAXYD4AkBgBUN9wb3BnYD//92A3YD9wZAAQF2A+AJAYAVDfcG9wZ2A///dgN2A/cGQAEBdgPgCQEL9wZ2A3YD9wb3BnYD",
  "volume_up":    "Ba4DbgMAB0ABAW4D4AUBBQAHAAduA0AfgAEH//9uA24DAAdAAQFuA+AFAQUABwAHbgPgAQEB//9ANwEAB0ABAW4DwAFAEwduAwAHAAduA+ABAQH//0AXAQAHQAEBbgPgBQEFAAcAB24D4AEBAf//4AcrQA+AAQ8ABwAHbgNuA24DbgNuA24D",
  "volume_down":  "BXIDcgPyBkABAXID4AUBBfIG8gZyA4ABQAkH//+uA3ID8gZAAQFyA+AFAQXyBvIGcgOAAUAJAf//4AcrQA+AAQXyBvIGcgOAAUAJAf//QBsB8gZAAQFyA+AFAQ/yBvIGcgNyA3IDcgPyBnID",
  "setup":        "B/cG9wZ1A3UDgAXAAQ1IEXUD9wb3BnUDdQP3BkABAXUD4AEBgA0J///3BvcGdQN1A4AFwAHgVDsCA3UD",
  "option":       "C/UGdQN1A/UG9QZ1A+ABARFUEXUD9Qb1BnUDdQP1BvUGdQOAAQH1BkABAXUDQAEB//+ACQX1BvUGdQPgAQHgVDsCA3UD",
  "info":         "BW4DbgO4A4ADA/kGbgPgAQEMRBFuA24DuAP5BrgDbuAAAQv5Bm4DbgP5BvkGbgOAAQH//+AJH8ABgEMDbgP5BuAJIwX5BvkGbgOAAQH//8AfQAfgARdAAeAJQ+ABIwX5BvkGbgOAAQX//24DbgNAG0AB4AEXQAHgAUMDbgNuA0AjQAOADQv5BvkGbgNuA24DbgM=",
  "eco":          "BXUDdQP6BkABAXUD4AEBA74UdQOAAQH6BkABAXUDgAEB+gaAAQf//3UDdQP6BkABAXUD4AEB4IQ3Agb6Bg==",
  "up":           "C/sG+wbLA3UD+wZ1A+AFAQX7BvsGdQPgAQEJ///7BvsGdQN1A4AF4AMBBfsG+wZ1A+ABAQn///sG+wZ1A3UDgAXgAwEP+wb7BnUDdQN1A3UDdQN1Aw==",
  "down":         "C/4GdAN0A/4G/gZ0A+AFAQX+Bv4GdAOAAUAJAf//QAUHdAP+Bv4GdAPgBQEF/gb+BnQDgAFACQH//0AFB3QD/gb+BnQD4AUBBf4G/gZ0A4ABQAkB//9AB0A/4G/gZ0A+AFAQ/+Bv4GdAN0A3QDdAP+BnQD",
  "left":         "C/MG8wa0A24D8wZuA+AFAQHzBsABB24D///zBvMG4AMnQAuAAQHzBsABB24D///zBvMGQBsD8wZuA+AFAQvzBvMG8wbzBvMGbgM=",
  "right":        "C/0GdAN0A/0G/QZ0A+AFAQH9BkABE3QDdAP9Bv///QZ0A3QD/Qb9BnQD4AUBAf0GQAETdAN0A/0G///9BnQDdAP9Bv0GdAPgBQEL/Qb9Bv0GdAN0A/0G",
  "enter":        "C+4G7gbWA3YD7gZ2A+AFAQHuBkABAXYDwAEJ///uBu4GdgN2A4AF4AMBAe4GQAEBdgPAAQn//+4G7gZ2A3YDgAXgAwEB7gZAAQF2A8ABCf//7gbuBnYDdgOABeADAQHuBkABCXYDdgN2A3YDdgM=",
  "back":         "C/kGdAN0A/kG+QZ0A+ABAQVREXQD+QZAAQF0A4AB4AMJB/kGdAN0A///gAcF+Qb5BnQD4AEB4JA7AgN0Aw==",
  "channel_up":   "BXIDcgPOA4ADQAEF+Ab4BnIDQAEBQxHACeAFAQH4BoABCXIDcgP//3IDcgNAP8ABBfgG+AZyA0AB4CE/4AMBBfgG+AZyA0AB4Bg/AgNyAw==",
  "channel_down": "CXEDcQP0BvQG3AOABwBxIAcDcQNGEcAJgAEB9AbgAQEXcQNxA///cQNxA/QG9AZxA3ED9Ab0BnEDQAHgGTfgA2cF9Ab0BnEDQAHgFDcCA3ED",
  "play":         "A84DcwNAAUAHQAMD8QbxBkAHCXMDUhFzA3MD8QbAAQFzA+AFAUARA///cwPgBQEF8QbxBnMDQAHgWD8CBnMD",
  "prev":         "B7cDbgP0BvQG4AMHB24DShH0Bm4D4AEBBfQG9AZuA+AFAUARCf//bgNuA/QG9AbAPwFuA0AB4AU/B7cD9Ab0Bm4D4AUBQBEJ//+3A24D9Ab0BuADBwFuA+AFPwduA/QG9AZuA+AFAQP0Bm4D",
  "next":         "BXYDdgPKA+ABAwXvBu8GdgNAAQFHEcAJ4BUBQCUD//92A+AFAQXvBu8GdgNAAeBoRwIGdgM=",
  "movie":        "BXYDdgP0BkABAXYD4AEBAa8UgA8B9AbAAQF2A4ABDfQG9AZ2A///dgN2A/QGQAEBdgPgAQHgTDcCBnYD",
  "music":        "BnIDcgPoA3JgAQP3BnID4AEBAZ8UgA8B9wZAAQFyA4ABAfcGgAEFcgP//3ID4AEBQBHgAQHgUDsCBnID",
  "game_mode":    "C/wGdQN1A/wG/AZ1A+ABAQNVEXUD4A8BGfwG/AZ1A3UD/Ab8Bv///AZ1A3UD/Ab8BnUD4AEB4Fw/Agb8Bg==",
  "pure_direct":  "BWgDaAO+A4ADA/wGaAPgAQEF/Ab8BmgDgAEF/Ab8Bv//wCdABwP8BmgD4AEBBfwG/AZoA4ABBfwG/Ab//0AjwAMD/AZoA+ABAQ/8BvwGaANoA2gDaAP8BvwG",
  "heos":         "BVADUAOnA+ABAwP1BvUGgA8FSBGnA1AD4AcDB/UGUANQA/UGgAEB///gCR8B9QZAEwFQA+BRPwOnA/UGgAED//+nA0AP4AEDA/UG9QZADwFQA+AYfwIG9QY=",
  "aux1":         "Ba0DcgP8BkABAXIDwAEFrQNQEXID4BcBA/wGrQNABQH//4AHQAEAciARAXIDQA8BcgPgJUMFcgNyA/wGQAEBcgPgAQHgJUNAdwH8BkABAXID4AEB4DVDQFMBcgPgIEMCA/wG",
  "phono":        "A7QDYwPAAwP3BmMD4AEBA0kRYwOAEeAJHwH3BsATgAEB//9AD0ABQAcD9wZjA+ABAYBHQBdAA0ABA/cGYwOAAQH3BkATwAMHYwP//2MDYwPADwP3BmMD4AEB4AFHQAFAI+ABHwH3BkAPwAMDYwP//+ABCwVjA/cGYwPgAQHgAUfAI+ABHwH3BsATBbQDYwO0Aw==",
  "smart_select_1": "DgwC3QAQAWkFDALzArQDZSADCBABPQG0A/MCDCABB2UCDAIQAQwCQAcI8wJlAmkFUAQMIAUMZQK0AyYHjAC0A7QDPSAfH60MUARsGfMCbBkQAWkF8wJpBWUCrQxpBbQDJgdiCN0AFUsj8wIMAt0AhQGMAK0MEAFQBIwAJgdAEwexAD0BZwDzAkAvH4wAZQJnAMc2EAGCEN0AbBmFAQoSaQVQBGUCUAStDGIIGAwCghAMAmkFPQHzAj0BPQHdAMc2sQCCEN0gAxUMAoUBsQC0AwwCtANnAN0A8wJpBWUCQA0fghDdAGIIEAGtDBABYghnAGwZDAI9AWcAJgeMAGLEjAAHWX+MAEsj3QA=",
  "smart_select_2": "BbgDcgP2BkABAXID4AEBA1MRcgPgAwEJ9gb2BnIDcgP2BkABgDMH//9yA3ID9gZAAQFyA+ABAeABO0AnC3ID9gb2BnIDcgP2BkABB3IDcgP2Bv//QBsB9gZAAQFyA+ABAeABO4ABCfYG9gZyA3ID9gZAAYAzB///cgNyA/YGQAEBcgPgAQHgFTsHcgNyA/YG//+AQ0ABAXID4AEB4BU7BbgDcgP2Bg==",
  "smart_select_3": "D7sDbQO7A7YCuwNtA/kGbQNAAQm7A7YCbQNKEW0D4AMBCfkG+QZtA20D+QZAAQK7A22gAQH//8ALQAcD+QZtA+ABAeAZQ0AzA20D//9AB8AD4CNDA20DbQNANwdtA///bQNtA0ALQAOAGcAB4BWHA20DbQNAMwNtA///QAdAA0ABgBkBbQOAD+AVQwm7A20DbQNtA20D",
  "smart_select_4": "BXEDcQP6BkABAXED4AEBA0cRcQPgAwEH+gb6BnEDcQPgAwVAAQf//6MDcQP6BkABAXEDQAuAAQFHEeABC0ABCfoG+gZxA3ED+gZAFwP6BnEDgAEB//+AD0ABAXED4AEB4A0/C6MD+gajA3ED+gZxA0AHA3ED//9ABwH6BkABAXEDQAuAAQNHEXED4AMBB/oG+gZxA3ED+gZAFwP6BnEDgAEB//+AD0ABAXED4AEB4ET8DcQNxA4AFQAEH//9xA3ED+gZAAQFxA+ABAeARP0BjA/oGcQOAAQH//4APQAEBcQPgAQHgET8DcQNxA4AFQAEH//9xA3ED+gZAAQFxA+ABAeARP4BvAXEDgAEB//+AD0ABAXED4AEB4BE/DXEDcQP6BnEDcQNxA3ED"
}
```

#### Key mapping notes

| Key | Remote button | TCP equivalent |
|---|---|---|
| `power` | Power toggle | `PWON` / `PWSTANDBY` |
| `mute` | Mute toggle | `MUON` / `MUOFF` |
| `volume_up` / `volume_down` | Volume +/− | `MVUP` / `MVDOWN` |
| `movie` | Movie mode shortcut | `SIAUX1` + `MSAUTO` + `SPPR 1` |
| `music` | Music mode shortcut | `SINET` + `MSSTEREO` |
| `game_mode` | Game mode shortcut | `SIGAME` + `MSAUTO` |
| `pure_direct` | Pure Direct shortcut | `MSPURE DIRECT` |
| `heos` | HEOS input shortcut | `SINET` |
| `aux1` | AUX 1 input | `SIAUX1` |
| `phono` | Phono input | `SIPHONO` |
| `smart_select_1`–`4` | Quick Select 1–4 | **No TCP equivalent** — recalls a full saved preset |
| `up` / `down` / `left` / `right` / `enter` / `back` | OSD navigation | **No TCP equivalent** |
| `setup` / `option` / `info` / `eco` | Menu / overlay buttons | **No TCP equivalent** |
| `play` / `prev` / `next` | Transport | Partial — HEOS CLI covers these for HEOS sources |
| `channel_up` / `channel_down` | Tuner / channel step | Model-dependent TCP alternative may exist |

> **Quick Select (smart_select_1–4)** saves and recalls a complete receiver state: input, volume level, surround mode, and EQ settings together. It is the only way to atomically recall a user-defined preset. There is no TCP command that triggers a Quick Select recall — IR is the only programmatic path.
>
> **Personal note:** triggering Quick Select via the physical remote while the receiver was under TCP control caused instability in my setup — the unit became temporarily unresponsive to further TCP commands. This may be specific to my unit or configuration; I'm not suggesting it's a general bug. Worth being aware of if you're mixing remote and programmatic control.

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
