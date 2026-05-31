# Marantz / Denon AVR — Audyssey & Speaker Config API

Companion to [MARANTZ_DENON_TELNET_PROTOCOL.md](MARANTZ_DENON_TELNET_PROTOCOL.md). This document covers programmatic access to Audyssey settings, speaker geometry, and the GraphicEQ — going beyond the runtime toggles available on TCP port 23.

Three distinct layers are involved, each with different capabilities:

| Layer | Port | What you get |
|---|---|---|
| TCP port 23 | 23 | Audyssey on/off switches only |
| HTTP AJAX API | **11080** (older firmware: 10443) | Audyssey config, speaker distances, levels, crossovers, GraphicEQ |
| Audyssey app protocol | unknown (proprietary) | FIR filter coefficients, raw impulse responses |

---

## Layer 1 — TCP port 23

The Audyssey-related `PS` commands on TCP port 23 are documented in [MARANTZ_DENON_TELNET_PROTOCOL.md](MARANTZ_DENON_TELNET_PROTOCOL.md). These cover runtime toggles only — no filter data, no speaker geometry.

Quick reference:

```
PSDYNEQ ON/OFF              Dynamic EQ on/off
PSREFLEV {0/5/10/15}        Reference level offset (dB)
PSDYNVOL {OFF/LIT/MED/HEV}  Dynamic Volume
PSTONE CTRL ON/OFF          Tone control
PSDRC {OFF/LOW/MID/HI/AUTO} Dynamic compression
PSLFE {00-10}               LFE level trim
PSLOM ON/OFF                Loudness management
PSSWL?                      Subwoofer level trim (read)
PSSWL {NNN}                 Subwoofer level trim (set)
```

**`PSSWL` encoding** — 3-digit value, **500 = 0 dB**, 0.1 dB per unit. Range approximately 380–620:

```
PSSWL 500  →  0.0 dB
PSSWL 475  → -2.5 dB
PSSWL 530  → +3.0 dB
```

This uses the same 3-digit convention as `MV` but centred at 500, not 800. Verified against the HTTP AJAX `SubwooferLevel1` field (raw `-25` = `-2.5 dB`) which matched `PSSWL 475` on the same unit.

`PSMULTEQ` (MultEQ mode) is listed in the official spec but returns no response on the Cinema 70s — use the HTTP AJAX API instead.

---

## Layer 2 — HTTP AJAX API

### Port discovery

The documented port for the AJAX configuration API is **10443** (HTTPS). On Cinema 70s units running the modern firmware (Boost.Beast HTTP server), **port 10443 is closed** and the API is served on **port 11080** (plain HTTP, no TLS). Both expose the same URL structure.

To determine which port your unit uses:

```bash
# Check which port responds
curl -s --max-time 3 http://<ip>:11080/ | grep -o '<title>[^<]*'
curl -sk --max-time 3 https://<ip>:10443/ | grep -o '<title>[^<]*'
```

Port 11080 returns a React app titled `Web Control`. Port 10443 (if active) returns a similar interface.

No authentication is required. Port 11080 uses plain HTTP; port 10443 uses TLS with a self-signed certificate (skip verification or pin the cert).

### Endpoint structure

```
GET http://<ip>:11080/ajax/<section>/get_config?type=<N>&_=<epoch_ms>
POST http://<ip>:11080/ajax/<section>/set_config?type=<N>&data=<urlencoded_xml>&_=<epoch_ms>
```

The `_` timestamp parameter prevents client-side caching. The `type` parameter selects a subsection. Type 1 of each section returns a menu listing which subsections are available and their accessibility state (`3` = accessible, `2` = limited, `1` = not available on this model).

Available sections: `audio`, `speakers`, `video`, `inputs`, `network`, `general`, `globals`, `control`, `advanced`, `account`.

### Reading current receiver state

The `control` section returns live zone state without querying TCP port 23:

```
GET /ajax/control/get_config?type=1    Main zone
GET /ajax/control/get_config?type=2    Zone 2
```

Example response (main zone):
```xml
<MainZone>
  <Source>13</Source>          <!-- input index; 13 = NET -->
  <Power>3</Power>             <!-- 3 = standby -->
  <VolumeScale>1</VolumeScale>
  <Volume>300</Volume>         <!-- volume × 10; 300 = 30.0 -->
  <VolumeLimit>1</VolumeLimit>
  <Mute>2</Mute>               <!-- 2 = off -->
  <SoundMode>Multi Ch Stereo</SoundMode>
</MainZone>
```

Volume encoding: divide by 10 to get the displayed value (300 → 30.0). This matches the TCP MV encoding.

---

### Audyssey configuration

```
GET /ajax/audio/get_config?type=9
```

Example response (Marantz Cinema 70s):
```xml
<Audyssey>
  <Setup>1</Setup>
  <SpeakerPreset display="3"/>
  <MultEQ group="1" display="3">1</MultEQ>
  <LRBypass>2</LRBypass>
  <DynamicEQ display="3">1</DynamicEQ>
  <ReferenceLevelOffset display="3">0</ReferenceLevelOffset>
  <DynamicVolume display="3">4</DynamicVolume>
  <AudysseyLFC display="1">0</AudysseyLFC>
</Audyssey>
```

#### Value decoding

**MultEQ** (`group="1"` = MultEQ XT32):

| Value | Mode |
|---|---|
| `0` | Off |
| `1` | Audyssey (reference curve) |
| `2` | Flat |
| `3` | L/R Bypass |
| `4` | Manual |

**DynamicEQ**: `1` = on, `0` = off.

**ReferenceLevelOffset**: direct dB value — `0`, `5`, `10`, or `15`.

**DynamicVolume**: different encoding from TCP port 23:

| HTTP value | TCP equivalent |
|---|---|
| `1` | LIT (light) |
| `2` | MED (medium) |
| `3` | HEV (heavy) |
| `4` | OFF |

**AudysseyLFC**: `display="1"` means this feature is not present on the unit. Value `0` = off regardless.

#### Naming mismatch — TCP vs HTTP

| Parameter | TCP command | HTTP field | TCP value → HTTP value |
|---|---|---|---|
| MultEQ mode | `PSMULTEQ:AUDYSSEY` | `MultEQ` = `1` | `AUDYSSEY` → `1` |
| Dynamic EQ | `PSDYNEQ ON` | `DynamicEQ` = `1` | `ON` → `1` |
| Dynamic Volume | `PSDYNVOL OFF` | `DynamicVolume` = `4` | `OFF` → `4` |
| Ref level offset | `PSREFLEV 0` | `ReferenceLevelOffset` = `0` | direct |

`PSMULTEQ` does not respond on the Cinema 70s over TCP — the HTTP API is the only way to read or set MultEQ mode on this unit.

---

### Graphic EQ

```
GET /ajax/audio/get_config?type=10
```

Example response (Cinema 70s):
```xml
<GraphicEQ>
  <Enable>1</Enable>                    <!-- 1 = off -->
  <SpeakerPreset display="3"/>
  <SpeakerSelection display="3">1</SpeakerSelection>
  <AdjustEQ display="3">
    <Channel display="2">0</Channel>    <!-- 0 = Front Left -->
    <Eq63Hz>60</Eq63Hz>
    <Eq125Hz>0</Eq125Hz>
    <Eq250Hz>0</Eq250Hz>
    <Eq500Hz>0</Eq500Hz>
    <Eq1kHz>0</Eq1kHz>
    <Eq2kHz>0</Eq2kHz>
    <Eq4kHz>0</Eq4kHz>
    <Eq8kHz>0</Eq8kHz>
    <Eq16kHz>0</Eq16kHz>
  </AdjustEQ>
</GraphicEQ>
```

9 bands: 63 Hz, 125 Hz, 250 Hz, 500 Hz, 1 kHz, 2 kHz, 4 kHz, 8 kHz, 16 kHz. The per-band values appear to be in 0.1 dB units centered at 0 (0 = flat). Band selection and encoding are unverified — community contributions welcome.

---

### Speaker distances

```
GET /ajax/speakers/get_config?type=4
```

Example response (Cinema 70s):
```xml
<Distances mode="normal">
  <Unit>1</Unit>           <!-- 1 = feet -->
  <Step>1</Step>
  <M2FConvertRatio>3048</M2FConvertRatio>
  <List>
    <Speaker index="0" display="3">420</Speaker>   <!-- Front Left  4.20 ft -->
    <Speaker index="1" display="3">491</Speaker>   <!-- Front Right 4.91 ft -->
    <Speaker index="2" display="3">356</Speaker>   <!-- Center      3.56 ft -->
    <Speaker index="3" display="3">420</Speaker>   <!-- Sub         4.20 ft -->
    <Speaker index="7" display="3">274</Speaker>   <!--             2.74 ft -->
    <Speaker index="8" display="3">381</Speaker>   <!--             3.81 ft -->
  </List>
</Distances>
```

Values are divided by 100 to get feet (or meters when `Unit=2`). `M2FConvertRatio` is `3048` = 30.48 × 100, reflecting the 1 ft = 30.48 cm conversion factor.

#### Speaker index map

| Index | Channel |
|---|---|
| 0 | Front Left |
| 1 | Front Right |
| 2 | Center |
| 3 | Subwoofer |
| 4 | Surround Left |
| 5 | Surround Right |
| 6 | Surround Back Left |
| 7 | Surround Back Right |
| 8 | Front Height Left |
| 9 | Front Height Right |
| 30 | Subwoofer level (levels section only) |

Only channels present in the speaker layout appear in the response. Absent channels are omitted, not zeroed.

---

### Speaker levels

```
GET /ajax/speakers/get_config?type=5
```

Example response (Cinema 70s):
```xml
<Levels mode="normal">
  <List>
    <Speaker index="0" display="3">-20</Speaker>   <!-- Front Left  -2.0 dB -->
    <Speaker index="1" display="3">-35</Speaker>   <!-- Front Right -3.5 dB -->
    <Speaker index="2" display="3">-10</Speaker>   <!-- Center      -1.0 dB -->
    <Speaker index="4" display="3">-10</Speaker>   <!-- Surr Left   -1.0 dB -->
    <Speaker index="8" display="3">-20</Speaker>   <!-- Fr Height L -2.0 dB -->
    <Speaker index="30" display="3">-25</Speaker>  <!-- Subwoofer   -2.5 dB -->
  </List>
</Levels>
```

Values are in **0.1 dB units** (confirmed against the Print endpoint which returned `Subwoofer: -2.5 dB` for raw value `-25`). Divide by 10 to get dB. Typical range: −12.0 to +12.0 dB.

The `CV?` command on TCP port 23 returns the same offsets but using the 38–62 scale (50 = 0 dB). These two encodings report the same physical adjustment through different scales.

---

### Speaker crossovers

```
GET /ajax/speakers/get_config?type=6
```

Example response (Cinema 70s):
```xml
<Crossovers mode="normal">
  <List>
    <Speaker index="0" display="3">60</Speaker>    <!-- Front Left  60 Hz  -->
    <Speaker index="1" display="3">90</Speaker>    <!-- Front Right 90 Hz  -->
    <Speaker index="2" display="3">40</Speaker>    <!-- Center      40 Hz  -->
  </List>
  <SelectableValue>
    <List>
      <Item>0</Item><Item>40</Item><Item>60</Item><Item>70</Item>
      <Item>80</Item><Item>90</Item><Item>100</Item><Item>110</Item>
      <Item>120</Item><Item>150</Item><Item>180</Item><Item>200</Item>
      <Item>250</Item>
    </List>
  </SelectableValue>
</Crossovers>
```

Values are direct Hz. `Item>0<` in the selectable list represents "Full range" (no highpass filter applied to that speaker). The selectable values list is also returned — useful for building a UI that constrains to valid steps.

#### Inferring speaker size from crossovers

Speaker size (Small / Large) is stored in the `SpeakerConfig` subsection which is only accessible when the receiver is in setup mode and is not readable via any discovered AJAX type number or TCP command. It can be **inferred** from the crossover data:

- **Crossover > 0 Hz** → speaker is set to **Small** (highpass filter applied; bass redirected to subwoofer)
- **Speaker absent from crossover response** → speaker is set to **Large** (full range; no highpass)

Cinema 70s example: FL = Small (60 Hz), FR = Small (90 Hz), Center = Small (40 Hz). Speakers not listed are Large. Note: FL and FR having different crossover points is unusual — verify in the receiver's speaker setup menu if this is unexpected.

---

### Speaker layout

```
GET /ajax/speakers/get_config?type=15
```

Returns which speaker groups are present and how they are connected. Each `Item` index represents a speaker group; only groups with `display="3"` are active in the current layout.

#### Item index map

| Index | Speaker group |
|---|---|
| 1 | Front L+R |
| 2 | Center |
| 3 | Surround L+R |
| 4 | Surround Back L+R |
| 5 | Front Height L+R |
| 6 | Top Front L+R |
| 7 | Subwoofer |
| 14 | Zone 2 |

Each item carries a `Config` (speaker type / amp routing) and `Conn` (connection state) child element. The `List` inside `Config` shows the selectable options for that group. Items with `display="1"` are not applicable to the current amp assignment.

Cinema 70s layout (active groups): Front L+R (1), Center (2), Surround (3), Surround Back (4), Front Height (5), Subwoofer (7), Zone 2 (14).

---

### Subwoofer and LFE filters

Subwoofer LPF:
```
GET /ajax/speakers/get_config?type=10    → <Subwoofer><LPF>60</LPF>...</Subwoofer>
```

LPF for LFE channel:
```
GET /ajax/speakers/get_config?type=17   → <LPFforLFE><Value>120</Value>...</LPFforLFE>
```

Both values are direct Hz.

---

### Subwoofer level

Available separately from both the audio section and the speaker levels section:

```
GET /ajax/audio/get_config?type=3
```
```xml
<SubwooferLevelAdjust>
  <SubwooferLevel1 display="3">-25</SubwooferLevel1>   <!-- -2.5 dB -->
</SubwooferLevelAdjust>
```

Same 0.1 dB encoding as speaker levels.

---

### Writing via the AJAX API

All `get_config` endpoints have a `set_config` counterpart. Write operations POST URL-encoded XML as the `data` query parameter:

```bash
curl -s -G "http://<ip>:11080/ajax/audio/set_config" \
  --data-urlencode "data=<Audyssey><DynamicEQ>1</DynamicEQ></Audyssey>" \
  --data "_=$(date +%s%3N)" \
  --data "type=9"
```

> **Caution:** Write support is confirmed by the API structure and the presence of `set_config` endpoints, but has not been tested on live hardware. The receiver does not provide checksums or transaction confirmation. Test reads first and keep a copy of current values before writing.

---

## Layer 3 — Audyssey app protocol (proprietary)

The MultEQ Editor app (iOS / Android) and MultEQ-X (Windows, subscription) communicate with the receiver over a separate undocumented protocol to exchange:

- **Raw impulse responses** — captured per mic position during the measurement sweep
- **FIR filter coefficients** (COEFDT) — the actual room correction taps written to the DSP
- **Display filter data** (DISFIL / DISPDATA) — the curve shown in the app and on the receiver OSD

This protocol has been partially captured via port-mirrored packet sniffing (the LaserGuruGuy fork of ratbuddyssey), but the exact port and binary framing are not publicly documented. The AJAX API and TCP port 23 cannot reach this data.

### What the proprietary protocol exposes (but you cannot access without the app)

- Reading back the current FIR coefficients from the receiver
- The per-channel target curve customizations
- Triggering a new measurement (hardware-gated — requires mic plugged in and receiver in calibration mode; no remote trigger exists)

### What you CAN do without the app

The `.ady` export file from the MultEQ Editor app is **JSON** and well understood by the community. The workflow for offline curve editing:

1. Run Audyssey normally and export the `.ady` from the app
2. Edit the JSON offline (target curve points, channel levels, distances, LFC)
3. Re-import via the app

Tools for step 2:

| Tool | Language | What it does |
|---|---|---|
| [ratbuddyssey](https://github.com/ratbuddy/ratbuddyssey) | C# | Offline `.ady` editor — target curves, channel trims, distance correction |
| [ratbuddyssey (VioletGiraffe fork)](https://github.com/VioletGiraffe/ratbuddyssey) | C# | Maintained fork |
| [Audyssey-Web-Editor](https://github.com/Vladi-ed/Audyssey-Web-Editor) | Angular | Browser-based `.ady` editor with frequency response visualisation |
| [AudysseyOne](https://github.com/ObsessiveCompulsiveAudiophile/AudysseyOne) | HTML/JS | Automated curve optimisation using REW (Room EQ Wizard) via its local API |
| [audyssey_one (BRNKR fork)](https://github.com/BRNKR/audyssey_one) | HTML/JS | A1 Evo — extended REW integration workflow |
| [AudysseyProcessor](https://github.com/SelfBiasedCode/AudysseyProcessor) | Python | `.ady` JSON manipulation for custom EQ curves |
| [MQX-Decoder](https://github.com/ObsessiveCompulsiveAudiophile/MQX-Decoder) | HTML | Extract MultEQ-X measurements, export to REW |
| [denonavr](https://github.com/ol-iver/denonavr) | Python | Full async AVR library; Audyssey runtime params via AppCommand |

### .ady file structure (key fields)

```json
{
  "Title": "My calibration",
  "TargetModelName": "Marantz Cinema 70s",
  "DynamicEQ": true,
  "DynamicVolume": false,
  "LFC": false,
  "MultEQType": "MultEQ XT32",
  "DetectedChannels": [
    {
      "CommandID": "FL",
      "ResponseData": [ [ ...impulse_response_mic_pos_1... ], ... ],
      "MidrangeCompensation": false,
      "FrequencyRangeRolloff": 80,
      "CustomDistance": 2.5,
      "CustomLevel": null,
      "CustomCrossover": null,
      "CustomTargetCurvePoints": [
        "{20.3, -0.1}", "{200, 0.5}"
      ]
    }
  ]
}
```

`CustomTargetCurvePoints` is the field that tools like ratbuddyssey and AudysseyOne modify. `ResponseData` contains the raw impulse response arrays per mic position. `CommandID` matches the TCP channel prefix (`FL`, `FR`, `C`, `SW`, `SL`, `SR`, etc.).

---

## Summary — what is and is not accessible

| Capability | TCP 23 | HTTP AJAX | Audyssey app |
|---|---|---|---|
| Dynamic EQ on/off | ✓ | ✓ | — |
| MultEQ mode (Flat/Audyssey/Off) | ✗ Cinema 70s | ✓ | — |
| Reference level offset | ✓ | ✓ | — |
| Dynamic Volume | ✓ | ✓ | — |
| Tone control / bass / treble | ✓ | — | — |
| Subwoofer level trim (PSSWL) | ✓ | ✓ | — |
| Speaker distances | ✗ | ✓ | ✓ |
| Speaker levels (trim) | ✓ (CV) | ✓ | ✓ |
| Crossover frequencies | ✗ | ✓ | ✓ |
| Speaker size (Small/Large) | ✗ | ✗ direct | infer from crossovers |
| Subwoofer / LFE LPF | ✗ | ✓ | ✓ |
| Graphic EQ bands | ✗ | ✓ | — |
| Active speaker layout | ✗ | ✓ | — |
| FIR filter coefficients | ✗ | ✗ | ✓ |
| Measurement impulse responses | ✗ | ✗ | ✓ |
| Trigger new measurement | ✗ | ✗ | ✗ (hardware-gated) |

---

## Observed but undocumented TCP responses

The following response prefixes were observed on a Cinema 70s during speaker setup probing. They are not in any published protocol document.

| Response | Example | Inferred meaning |
|---|---|---|
| `SSINFAISFSV` | `SSINFAISFSV NON` | Speaker setup info flag — `NON` = no atypical speaker configuration detected |
| `SSSMG` | `SSSMG MUS` | Sound mode / surround mode group setting |
| `BTTX` | `BTTX OFF` / `BTTX SP` | Bluetooth transmitter state |
| `OPTXM` | `OPTXM AVL` / `OPTXM END` | Optical transmitter state; `END` terminates a burst |

`BTTX` and `OPTXM` are broadcast unsolicited on power-on alongside the standard `PW`, `MV`, `SI` events. `SSINFAISFSV` and `SSSMG` respond to direct `?` queries; their full command families have not been mapped.

---

## Model notes

| Model | AJAX port | Notes |
|---|---|---|
| Marantz Cinema 70s | **11080** | Boost.Beast server; port 10443 closed |
| Pre-2022 Denon/Marantz 2016+ | **10443** | HTTPS, self-signed cert; skip TLS verification |
| Pre-2016 models | — | No AJAX API; AppCommand.xml on 8080 only |

The AppCommand XML API on port 8080 (`POST /goform/AppCommand0300.xml`) is an older parallel interface documented by the denonavr library. It exposes the same Audyssey runtime parameters as TCP port 23 but returns `CMD ERR` on the Cinema 70s — the AJAX API on port 11080 supersedes it on this model.
