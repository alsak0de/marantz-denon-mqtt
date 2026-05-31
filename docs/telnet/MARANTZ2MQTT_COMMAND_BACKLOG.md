# marantz2mqtt command backlog

This is the implementation backlog for expanding `marantz2mqtt` from the
current narrow HomeStation bridge into full coverage of the documented Telnet
space.

Sources reviewed:

- `MARANTZ_DENON_TELNET_PROTOCOL.md`: verified modern TCP port 23 guide, strongest source for first-class MQTT support.
- `/home/albert/marantz/marantz_commands.json`: broader local command dictionary, including live captures, community data, read-only companion responses, and model-specific families.
- Current `src/telnet2mqtt/avr-protocol.mjs`: implemented allowlist.

## Already implemented

These command topics already exist and should remain stable:

| MQTT topic | Payload | AVR command |
|---|---|---|
| `cmd/power` | `ON`, `STANDBY`, `OFF` | `PWON`, `PWSTANDBY` |
| `cmd/source` | input name | `SI{INPUT}` |
| `cmd/volume` | `0`-`98`, half steps, `UP`, `DOWN` | `MV{NN}`, `MVUP`, `MVDOWN` |
| `cmd/mute` | `ON`, `OFF`, `TOGGLE` | `MUON`, `MUOFF` |
| `cmd/zone2/power` | `ON`, `OFF`, `STANDBY` | `Z2ON`, `Z2OFF` |
| `cmd/zone2/source` | input name | `Z2{INPUT}` |
| `cmd/zone2/volume` | `0`-`98`, half steps, `UP`, `DOWN` | `Z2{NN}`, `Z2UP`, `Z2DOWN` |
| `cmd/zone2/mute` | `ON`, `OFF`, `TOGGLE` | `Z2MUON`, `Z2MUOFF` |

These retained state topics already exist:

- `power`
- `source`
- `volume`
- `mute`
- `sound-mode`
- `zone2/power`
- `zone2/source`
- `zone2/volume`
- `zone2/mute`

## Cross-cutting additions

| Feature | MQTT topic | Notes |
|---|---|---|
| Raw passthrough | `cmd/raw` | Send one raw Telnet command after validation and CR stripping. Publish AVR response through `event/raw` as today. |
| Raw batch passthrough | `cmd/raw-batch` | Optional JSON array of commands, preserving the configured inter-command gap. Useful for activity presets and diagnostics. |
| Explicit query | `cmd/query` | Payload is a query name or raw query prefix. Sends `?` query without pretending it is a setting. |
| Unsupported reply state | `event/error` | Publish `?`, validation failures, and unsupported command errors. |
| Last raw line | `last/raw` | Optional retained last AVR line for dashboards/debugging. |

Raw command validation should reject empty payloads, embedded `\r`/`\n`, and
commands longer than a conservative maximum. Destructive commands such as
factory reset should not be allowed through normal structured topics.

## State parser additions

Add parsers before adding command topics so MQTT state reflects remote/front
panel changes too.

| State topic | AVR response | Notes |
|---|---|---|
| `main-zone/power` | `ZMON`, `ZMOFF` | Distinct from full `PW*` power. |
| `volume/max` | `MVMAX {val}` | Decode like `MV`; observed as `MVMAX 695`. |
| `speaker-preset` | `SPPR {1|2}` | Space is significant. |
| `smart-select` | `MSSMART{n}` | Do not parse `MS` sound modes as Smart Select. |
| `quick-select` | `MSQUICK{n}` | Denon-style Quick Select. |
| `signal-input-mode` | `SDAUTO`, `SDHDMI`, `SDDIGITAL`, `SDANALOG` | `SD?` query support. |
| `digital-input-mode` | `DCAUTO`, `DCHDMI`, etc. | Companion to `CV?`; `DC?` may be unsupported. |
| `sleep` | `SLP{NNN}`, `SLPOFF` | Decode minutes or `OFF`. |
| `zone2/sleep` | `Z2SLP{NNN}`, `Z2SLPOFF` | Zone 2 independent sleep timer. |
| `zone2/high-pass-filter` | `Z2HPFON`, `Z2HPFOFF` | From broader dictionary. |
| `zone3/power` | `Z3ON`, `Z3OFF` | May be unsupported on Cinema 70s. |
| `zone3/source` | `Z3{INPUT}` | Only if command is accepted by model. |
| `zone3/volume` | `Z3{NN}` | Avoid colliding with `Z3ON`/`Z3OFF`. |
| `zone3/mute` | `Z3MUON`, `Z3MUOFF` | Only if model supports Zone 3. |
| `video/source` | `SV{INPUT}`, `SVOFF` | Companion to `SI?`, `SV?`, `Z2?`. |
| `video/scaler` | `VSSCH{MODE}` | Example `VSSCHOFF`. |
| `video/processing` | `VSVPM{MODE}` | Example `VSVPMAUTO`. |
| `video/hdmi-monitor` | `VSMONI{val}` | From broader dictionary. |
| `video/hdmi-audio` | `VSAUDIO {MODE}` | From broader dictionary. |
| `auto-level-set/enabled` | `OPALSSET {ON|OFF}` | Companion OSD/Audyssey profile line. |
| `auto-level-set/dsp` | `OPALSDSP {ON|OFF}` | Companion OSD/Audyssey profile line. |
| `auto-level-set/value` | `OPALSVAL {val}` | Companion OSD/Audyssey profile line. |
| `system/mode-display` | `SYSMI {text}` | Human-readable sound mode. |
| `system/display-audio` | `SYSDA {text}` | Often codec/stream info on NET. |
| `system/input-bitmask` | `OPINFINS {bits}` | Observed, inferred. |
| `system/audio-aspect-bitmask` | `OPINFASP {bits}` | Observed, inferred. |
| `system/audio-sampling-frequency` | `SSINFAISFSV {val}` | 441 means 44.1 kHz. |
| `system/smart-mode-group` | `SSSMG {val}` | Observed as `MUS`; meaning inferred. |
| `speaker-setup/*` | `SSBEL*`, `SSLEV*`, `SSTTL*`, `SSSPC*`, `SSSDE*` | Observed after `SPPR 2`; speaker setup dump. |
| `source/name/*` | `SSFUNGAR*` | Observed in live baseline; input friendly names. |
| `bluetooth/transmitter` | `BTTX {OFF|SP|ON}` | Broadcast on power-on. |
| `optical/transmitter` | `OPTXM {val}` | `END` terminates burst. |
| `channel-volume/{channel}` | `CVFL`, `CVFR`, `CVC`, `CVSW`, `CVSL`, `CVSR`, plus extended channels | Decode trim scale. |
| `channel-volume/end` | `CVEND` | Optional event/sentinel, probably not retained. |
| `audyssey/dynamic-eq` | `PSDYNEQ {ON|OFF}` | Confirmed on Cinema 70s. |
| `audyssey/reference-level-offset` | `PSREFLEV {0|5|10|15}` | Confirmed. |
| `audyssey/dynamic-volume` | `PSDYNVOL {OFF|LIT|MED|HEV}` | Confirmed. |
| `audyssey/dynamic-compression` | `PSDRC {OFF|LOW|MID|HI|AUTO}` | Confirmed. |
| `audyssey/lfe` | `PSLFE {NN}` | Confirmed. |
| `audyssey/effect-level` | `PSEFF {NN}` | Confirmed. |
| `audyssey/effect-delay` | `PSDEL {NNN}` | Confirmed. |
| `audyssey/subwoofer` | `PSSWR {ON|OFF}` | Confirmed. |
| `audyssey/loudness-management` | `PSLOM {ON|OFF}` | Confirmed. |
| `audyssey/audio-delay` | `PSDELAY {NNN}` | Confirmed. |
| `tone/bass` | `PSBAS {UP|DOWN|NN}` | Confirmed. |
| `tone/treble` | `PSTRE {UP|DOWN|NN}` | Confirmed. |
| `tone/control` | `PSTONE CTRL {ON|OFF}` | Confirmed. |
| `audio/multeq` | `PSMULTEQ:{MODE}` | In dictionary, unsupported in Cinema 70s probe. |
| `audio/cinema-eq` | `PSCINEMA EQ.{ON|OFF}` | In dictionary, unsupported in Cinema 70s probe. |
| `audio/center-spread` | `PSCES {ON|OFF}` | Broader dictionary. |
| `audio/mdax` | `PSMDAX {ON|OFF}` | Marantz Dynamic Audio Expander. |
| `audio/dac-filter` | `PSDACFIL {MODE}` | Marantz only. |
| `audio/headphone-eq` | `PSHEQ {ON|OFF}` | Broader dictionary. |
| `audio/neural-x` | `PSNEURAL {ON|OFF}` | Broader dictionary. |
| `audio/imax/*` | `PSIMAX*` | IMAX Enhanced family. |
| `audio/auro/*` | `PSAURO*` | Auro-3D family. |
| `audio/dirac` | `PSDIRAC {filter}` | Dirac filter selection. |
| `audio/lfc` | `PSLFC {ON|OFF}` | Low Frequency Containment. |
| `audio/lfc-amount` | `PSCNTAMT {val}` | LFC amount. |
| `audio/bass-sync` | `PSBSC {ON|OFF}` | Broader dictionary. |
| `audio/dialog-enhancer` | `PSDEH {level}` | Broader dictionary. |
| `audio/dialog-control` | `PSDIC {val}` | Broader dictionary. |
| `audio/speaker-virtualizer` | `PSSPV {ON|OFF}` | Broader dictionary. |
| `audio/speaker-profile` | `PSSP:{MODE}` | Broader dictionary. |
| `audio/restorer` | `PSRSTR {MODE}` | Probe says unsupported on Cinema 70s. |
| `audio/room-size` | `PSRSZ {size}` | Probe says unsupported on Cinema 70s. |

## Command topic additions

### Power and zones

| MQTT topic | Payload | AVR command |
|---|---|---|
| `cmd/main-zone/power` | `ON`, `OFF`, `TOGGLE` | `ZMON`, `ZMOFF` |
| `cmd/zone3/power` | `ON`, `OFF` | `Z3ON`, `Z3OFF` |
| `cmd/zone3/source` | input name | `Z3{INPUT}` |
| `cmd/zone3/volume` | `0`-`98`, half steps, `UP`, `DOWN` | `Z3{NN}`, `Z3UP`, `Z3DOWN` |
| `cmd/zone3/mute` | `ON`, `OFF`, `TOGGLE` | `Z3MUON`, `Z3MUOFF` |

### Inputs and signal mode

`cmd/source` already covers all `SI{INPUT}` values. Extend validation/help to
include the full known input list:

- `CD`, `PHONO`, `TUNER`, `DVD`, `BD`, `TV`, `SAT/CBL`, `MPLAY`, `GAME`
- `HDRADIO`, `NET`, `PANDORA`, `SIRIUSXM`, `SOURCE`, `LASTFM`, `IRADIO`, `IRP`
- `SERVER`, `FAVORITES`, `AUX1` through `AUX7`
- `BT`, `USB/IPOD`, `USB DIRECT`, `IPOD DIRECT`

| MQTT topic | Payload | AVR command |
|---|---|---|
| `cmd/signal-input-mode` | `AUTO`, `HDMI`, `DIGITAL`, `ANALOG` | `SD{MODE}` |
| `cmd/video/source` | input name, `OFF` | `SV{INPUT}`, `SVOFF` |

### Volume, mute, and channel trims

| MQTT topic | Payload | AVR command |
|---|---|---|
| `cmd/channel-volume/{channel}` | `38`-`62`, `UP`, `DOWN` | `CV{CH} {NN}`, `CV{CH} UP`, `CV{CH} DOWN` |
| `cmd/channel-volume/reset-reference` | empty, `RESET` | `CVZRL` |
| `cmd/zone2/channel-volume/{channel}` | value | `Z2CV{CH} {val}` |

Initial channels from `MARANTZ_DENON_TELNET_PROTOCOL.md`:

- `FL`, `FR`, `C`, `SW`, `SL`, `SR`

Additional channels from the dictionary:

- `SBL`, `SBR`, `SW2`, `FHL`, `FHR`, `TFL`, `TFR`, `TML`, `TMR`

### Surround, Smart Select, and speaker presets

| MQTT topic | Payload | AVR command |
|---|---|---|
| `cmd/sound-mode` | mode name | `MS{MODE}` |
| `cmd/smart-surround` | `SMART`, `2CH`, `5CH`, `7CH` | `MSSMART`, `MSSMART2CH`, `MSSMART5CH`, `MSSMART7CH` |
| `cmd/smart-select` | `1`-`4` | `MSSMART{N}` |
| `cmd/smart-select/save` | `1`-`4` | `MSSMART{N} MEMORY` |
| `cmd/quick-select` | `1`-`5` | `MSQUICK{N}` |
| `cmd/quick-select/save` | `1`-`5` | `MSQUICK{N} MEMORY` |
| `cmd/speaker-preset` | `1`, `2` | `SPPR {N}` |
| `cmd/decoder` | mode name | `DC{MODE}` |

Sound mode values should include, at minimum, the values in `MARANTZ_DENON_TELNET_PROTOCOL.md`:

- `AUTO`
- `STEREO`
- `PURE DIRECT`
- `DTS NEURAL:X`
- `MCH STEREO`
- `DOLBY SURROUND`

The broader dictionary also lists many Dolby, DTS, Auro, and DSP labels. Those
can be accepted as pass-through mode strings once `MS` parsing is robust.

Cinema 70s live visual testing showed `MSSMART5` is unstable on this unit: it
briefly displayed Smart Select 5, then fell back to Smart Select 4. Do not use
Smart Select 5 in normal automation for this AVR.

Cinema 70s live visual testing also showed sound-mode aliases need to match the
AVR's emitted command forms: Multi Ch Stereo is `MSMCH STEREO`, DTS Neural:X is
`MSNEURAL:X`, and DTS Virtual:X is `MSVIRTUAL:X`. Dolby Surround emits
`MSDOLBY AUDIO-DSUR`, but direct switching appears to depend on source/group
context.

The Movie, Music, and Game remote buttons select smart mode groups `MOV`, `MUS`,
and `GAM`; each group advertises Stereo, Dolby Surround, DTS Neural:X, DTS
Virtual:X, and Multi Ch Stereo through `OPSMLALL`. The Pure button selects group
`PUR`, advertising Direct, Pure Direct, and Stereo. `OPSMLALL` entries are now
parsed into `smart-mode-list/{group}/{slot}` state topics.

### Sleep timers

| MQTT topic | Payload | AVR command |
|---|---|---|
| `cmd/sleep` | `OFF`, `1`-`120`, `001`-`120` | `SLPOFF`, `SLP{NNN}` |
| `cmd/zone2/sleep` | `OFF`, `1`-`120`, `001`-`120` | `Z2SLPOFF`, `Z2SLP{NNN}` |

### Audyssey, EQ, tone, and audio processing

First-class because `MARANTZ_DENON_TELNET_PROTOCOL.md` verifies them on Cinema 70s:

| MQTT topic | Payload | AVR command |
|---|---|---|
| `cmd/audyssey/dynamic-eq` | `ON`, `OFF` | `PSDYNEQ {value}` |
| `cmd/audyssey/reference-level-offset` | `0`, `5`, `10`, `15` | `PSREFLEV {value}` |
| `cmd/audyssey/dynamic-volume` | `OFF`, `LIT`, `MED`, `HEV` | `PSDYNVOL {value}` |
| `cmd/audyssey/dynamic-compression` | `OFF`, `LOW`, `MID`, `HI`, `AUTO` | `PSDRC {value}` |
| `cmd/audyssey/lfe` | `00`-`10` | `PSLFE {NN}` |
| `cmd/audyssey/effect-level` | numeric | `PSEFF {NN}` |
| `cmd/audyssey/effect-delay` | `000`-`999` | `PSDEL {NNN}` |
| `cmd/audyssey/subwoofer` | `ON`, `OFF` | `PSSWR {value}` |
| `cmd/audyssey/loudness-management` | `ON`, `OFF` | `PSLOM {value}` |
| `cmd/audyssey/audio-delay` | `000`-`200`, `UP`, `DOWN` | `PSDELAY {value}` |
| `cmd/tone/bass` | `38`-`62`, `UP`, `DOWN` | `PSBAS {value}` |
| `cmd/tone/treble` | `38`-`62`, `UP`, `DOWN` | `PSTRE {value}` |
| `cmd/tone/control` | `ON`, `OFF` | `PSTONE CTRL {value}` |

Broader dictionary additions. Prefer structured support after probing on the
actual AVR, or expose through raw until confirmed:

| MQTT topic | Payload | AVR command |
|---|---|---|
| `cmd/audio/multeq` | `AUDYSSEY`, `BYP.LR`, `FLAT`, `MANUAL`, `OFF` | `PSMULTEQ:{MODE}` |
| `cmd/audio/cinema-eq` | `ON`, `OFF` | `PSCINEMA EQ.{value}` |
| `cmd/audio/center-spread` | `ON`, `OFF` | `PSCES {value}` |
| `cmd/audio/mdax` | `ON`, `OFF` | `PSMDAX {value}` |
| `cmd/audio/dac-filter` | mode | `PSDACFIL {MODE}` |
| `cmd/audio/headphone-eq` | `ON`, `OFF` | `PSHEQ {value}` |
| `cmd/audio/neural-x` | `ON`, `OFF` | `PSNEURAL {value}` |
| `cmd/audio/imax/mode` | mode | `PSIMAX {MODE}` |
| `cmd/audio/imax/audio` | mode | `PSIMAXAUD {MODE}` |
| `cmd/audio/imax/hpf` | frequency | `PSIMAXHPF {freq}` |
| `cmd/audio/imax/lpf` | frequency | `PSIMAXLPF {freq}` |
| `cmd/audio/imax/subwoofer-mode` | mode | `PSIMAXSWM {MODE}` |
| `cmd/audio/imax/subwoofer-output` | mode | `PSIMAXSWO {MODE}` |
| `cmd/audio/auro/mode` | mode | `PSAUROMODE {MODE}` |
| `cmd/audio/auro/preset` | preset | `PSAUROPR {preset}` |
| `cmd/audio/auro/strength` | `0`-`15` | `PSAUROST {value}` |
| `cmd/audio/dirac` | filter | `PSDIRAC {filter}` |
| `cmd/audio/lfc` | `ON`, `OFF` | `PSLFC {value}` |
| `cmd/audio/lfc-amount` | value | `PSCNTAMT {value}` |
| `cmd/audio/bass-sync` | `ON`, `OFF` | `PSBSC {value}` |
| `cmd/audio/dialog-enhancer` | level | `PSDEH {level}` |
| `cmd/audio/dialog-control` | value | `PSDIC {value}` |
| `cmd/audio/speaker-virtualizer` | `ON`, `OFF` | `PSSPV {value}` |
| `cmd/audio/speaker-profile` | mode | `PSSP:{MODE}` |
| `cmd/audio/restorer` | `OFF`, `MODE1`, `MODE2`, `MODE3` | `PSRSTR {MODE}` |
| `cmd/audio/room-size` | `S`, `MS`, `M`, `ML`, `L` | `PSRSZ {size}` |
| `cmd/audio/subwoofer-level` | value | `PSSWL {value}` |
| `cmd/audio/subwoofer2-level` | value | `PSSWL2 {value}` |

### Network playback

These are TCP port 23 network-control commands, distinct from HEOS playback.

| MQTT topic | Payload | AVR command |
|---|---|---|
| `cmd/network/playback` | `PLAY` | `NS9A` |
| `cmd/network/playback` | `PAUSE` | `NS9B` |
| `cmd/network/playback` | `STOP` | `NS9C` |
| `cmd/network/playback` | `NEXT` | `NS9D` |
| `cmd/network/playback` | `PREVIOUS`, `PREV` | `NS9E` |
| `cmd/network/reboot` | `REBOOT` | `NSRBT` |

### Video and HDMI

| MQTT topic | Payload | AVR command |
|---|---|---|
| `cmd/video/scaling` | mode | `VSSCH{MODE}` |
| `cmd/video/processing` | mode | `VSVPM{MODE}` |
| `cmd/video/hdmi-monitor` | value | `VSMONI{value}` |
| `cmd/video/hdmi-audio` | mode | `VSAUDIO {MODE}` |

### System controls

| MQTT topic | Payload | AVR command |
|---|---|---|
| `cmd/system/auto-standby` | value | `STBY{value}` |
| `cmd/system/eco-mode` | value | `ECO{value}` |
| `cmd/system/display-dimmer` | value | `DIM {value}` |
| `cmd/system/display-dimmer-cycle` | empty, `CYCLE` | `DIM SEL` |
| `cmd/system/illumination` | value | `ILB {value}` |
| `cmd/system/remote-lock` | value | `SYREMOTE LOCK {value}` |
| `cmd/system/panel-lock` | value | `SYPANEL LOCK {value}` |
| `cmd/system/panel-volume-lock` | `ON`, `OFF` | `SYPANEL+V LOCK {value}` |
| `cmd/system/trigger/1` | `ON`, `OFF` | `TR1 {value}` |
| `cmd/system/trigger/2` | `ON`, `OFF` | `TR2 {value}` |
| `cmd/system/trigger/3` | `ON`, `OFF` | `TR3 {value}` |
| `cmd/bluetooth/transmitter` | value | `BTTX {value}` |

Do not expose `SYRST` as a normal structured command. If needed, make it
raw-only and require explicit operator confirmation outside `marantz2mqtt`.

### Menu navigation

These are useful for remote-control style UIs. They should be command-only,
not retained state.

| MQTT topic | Payload | AVR command |
|---|---|---|
| `cmd/menu` | `ON`, `OFF`, `TOGGLE` | `MNMEN ON`, `MNMEN OFF` |
| `cmd/menu/up` | any | `MNCUP` |
| `cmd/menu/down` | any | `MNCDN` |
| `cmd/menu/left` | any | `MNCLT` |
| `cmd/menu/right` | any | `MNCRT` |
| `cmd/menu/enter` | any | `MNENT` |
| `cmd/menu/back` | any | `MNRTN` |
| `cmd/menu/options` | any | `MNOPT` |
| `cmd/menu/info` | any | `MNINF` |
| `cmd/menu/channel` | any | `MNCHL` |

### Tuner

| MQTT topic | Payload | AVR command |
|---|---|---|
| `cmd/tuner/frequency` | six-digit FM or five-digit AM value | `TFAN{value}` |
| `cmd/tuner/frequency-step` | `UP`, `DOWN` | `TFANUP`, `TFANDOWN` |
| `cmd/tuner/preset` | preset number | `TPANA{N}` |
| `cmd/tuner/preset-step` | `UP`, `DOWN` | `TPANUP`, `TPANDOWN` |
| `cmd/tuner/band` | `AM`, `FM` | `TMANAM`, `TMANFM` |
| `cmd/tuner/mode` | `AUTO` | `TMANAUTO` |

### Picture controls

| MQTT topic | Payload | AVR command |
|---|---|---|
| `cmd/picture/contrast` | value | `PVCN {value}` |
| `cmd/picture/brightness` | value | `PVBR {value}` |
| `cmd/picture/color` | value | `PVCM {value}` |
| `cmd/picture/hue` | value | `PVHUE {value}` |
| `cmd/picture/noise-reduction` | value | `PVDNR {value}` |
| `cmd/picture/enhancer` | value | `PVENH {value}` |
| `cmd/picture/mode` | mode | `PVPICT {MODE}` |

### Zone 2 extended

| MQTT topic | Payload | AVR command |
|---|---|---|
| `cmd/zone2/high-pass-filter` | `ON`, `OFF` | `Z2HPFON`, `Z2HPFOFF` |
| `cmd/zone2/bass` | value | `Z2PSBAS {value}` |
| `cmd/zone2/treble` | value | `Z2PSTRE {value}` |

### HDMI CEC / remote-code commands

These look like remote-control code injections and should be considered
model/vendor-specific.

| MQTT topic | Payload | AVR command |
|---|---|---|
| `cmd/cec` | `ON`, `OFF` on Marantz | `RCRC51608408`, `RCRC51608409` |
| `cmd/cec/denon` | `ON`, `OFF` on Denon | `RCKSK0410826`, `RCKSK0410827` |

## Query topics to support

`cmd/query` should accept friendly names and map them to these protocol queries:

| Payload | AVR query |
|---|---|
| `power` | `PW?` |
| `main-zone` | `ZM?` |
| `volume` | `MV?` |
| `mute` | `MU?` |
| `source` | `SI?` |
| `sound-mode` | `MS?` |
| `speaker-preset` | `SPPR?` |
| `channel-volume` | `CV?` |
| `zone2` | `Z2?` |
| `zone2-mute` | `Z2MU?` |
| `zone2-sleep` | `Z2SLP?` |
| `signal-input-mode` | `SD?` |
| `sleep` | `SLP?` |
| `video-source` | `SV?` |
| `tuner` | `TF?` |
| `tone-control` | `PSTONE CTRL?` |
| `audyssey/dynamic-eq` | `PSDYNEQ?` |
| `audyssey/reference-level-offset` | `PSREFLEV?` |
| `audyssey/dynamic-volume` | `PSDYNVOL?` |
| `audyssey/dynamic-compression` | `PSDRC?` |
| `audyssey/lfe` | `PSLFE?` |
| `audyssey/effect-level` | `PSEFF?` |
| `audyssey/effect-delay` | `PSDEL?` |
| `audyssey/subwoofer` | `PSSWR?` |
| `audyssey/loudness-management` | `PSLOM?` |
| `audyssey/audio-delay` | `PSDELAY?` |
| `tone/bass` | `PSBAS?` |
| `tone/treble` | `PSTRE?` |
| `audio/multeq` | `PSMULTEQ:?` |
| `audio/cinema-eq` | `PSCINEMA EQ.?` |
| `audio/restorer` | `PSRSTR?` |
| `audio/room-size` | `PSRSZ?` |

## Implementation priority

1. Done: Add `cmd/raw`, `cmd/raw-batch`, `cmd/query`, `last/raw`, parser error events, and tests.
2. Done: Add parsers for observed/verified response families: `ZM`, `MVMAX`, `SPPR`, `MSSMART`, `MSQUICK`, `SD`, `SLP`, `Z2SLP`, `SV`, `VSS`, `OPALS`, `SYS*`, `OPINF*`, `CV*`, confirmed `PS*`.
3. Done: Add structured command topics from `MARANTZ_DENON_TELNET_PROTOCOL.md`: main zone, sound mode, smart/quick select, speaker preset, channel trims, signal mode, sleep, confirmed Audyssey/tone, menu navigation.
4. Done: Add broader dictionary command mappings behind validation and model-support caveats.
5. Still true: Keep destructive and ambiguous commands raw-only or disabled by default: `SYRST`, locks, remote-code CEC injections, network reboot, and any unsupported-in-probe command until manually verified.

## Current implementation notes

- `cmd/raw` and `cmd/raw-batch` reject empty commands, CR/LF injection, and overly long commands.
- `cmd/query` accepts the friendly names listed above, or a raw query prefix that is converted to `{prefix}?`.
- `last/raw` is retained and stores the most recent AVR line.
- `event/error` is non-retained and is used for MQTT command validation failures and AVR `?` replies.
- `SYRST` is intentionally not exposed as a structured MQTT topic.
- Lock commands, CEC remote-code commands, and network reboot are available only through explicit structured topics or raw commands and should be used with care.
