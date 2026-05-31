# telnet2mqtt

`telnet2mqtt` bridges a Marantz / Denon AVR Telnet control socket to MQTT.
It keeps one persistent TCP connection open to the AVR on port 23, publishes
state changes from AVR echoes or unsolicited events, and subscribes to command
topics that translate back into AVR commands.

The broker is treated as the state store: state topics are retained, and command
topics are fire-and-forget.

## Run

```sh
npm install
AVR_HOST=192.168.1.50 MQTT_URL=mqtt://192.168.1.10:1883 npm run start:telnet2mqtt
```

Or with Docker Compose:

```sh
cp .env.example .env
docker compose up -d --build telnet2mqtt
```

## Configuration

| Variable | Default | Description |
|---|---:|---|
| `AVR_HOST` | required | AVR IP address or hostname |
| `AVR_PORT` | `23` | AVR TCP control port |
| `MQTT_URL` | `mqtt://localhost:1883` | MQTT broker URL |
| `MQTT_USERNAME` | empty | MQTT username |
| `MQTT_PASSWORD` | empty | MQTT password |
| `MQTT_BASE_TOPIC` | `home/marantz` | Root topic |
| `MQTT_PUBLISH_RAW` | `true` | Publish every AVR line to `event/raw` |
| `MQTT_IGNORE_RETAINED_COMMANDS` | `true` | Ignore retained command messages on startup |
| `LOG_LEVEL` | `info` | Set to `silent` to reduce logs |

On AVR connect, the service immediately sends:

```text
PW?
ZM?
MV?
MU?
SI?
MS?
SPPR?
Z2?
Z2MU?
SD?
SLP?
PSDYNEQ?
PSDYNVOL?
PSREFLEV?
PSBAS?
PSTRE?
PSTONE CTRL?
```

Commands are written with `\r` terminators and a 100 ms gap when several are
queued.

## State topics

All state topics are published with `retain: true`.

| Topic | Payload | AVR event |
|---|---|---|
| `home/marantz/availability` | `online` / `offline` | MQTT LWT |
| `home/marantz/power` | `ON` / `STANDBY` | `PWON` / `PWSTANDBY` |
| `home/marantz/source` | `PHONO`, `NET`, `AUX1`, ... | `SI*` |
| `home/marantz/volume` | `0`-`98`, half steps as `55.5` | `MV*` |
| `home/marantz/mute` | `ON` / `OFF` | `MUON` / `MUOFF` |
| `home/marantz/sound-mode` | `STEREO`, `AUTO`, ... | `MS*` |
| `home/marantz/main-zone/power` | `ON` / `OFF` | `ZMON` / `ZMOFF` |
| `home/marantz/volume/max` | max volume, half steps as `69.5` | `MVMAX *` |
| `home/marantz/speaker-preset` | `1`, `2` | `SPPR *` |
| `home/marantz/smart-select` | `1`-`5`, optional ` MEMORY` | `MSSMART*` |
| `home/marantz/quick-select` | `1`-`5`, optional ` MEMORY` | `MSQUICK*` |
| `home/marantz/smart-surround` | `SMART`, `SMART2CH`, ... | `MSSMART*` |
| `home/marantz/signal-input-mode` | `AUTO`, `HDMI`, `DIGITAL`, `ANALOG` | `SD*` |
| `home/marantz/digital-input-mode` | mode | `DC*` |
| `home/marantz/sleep` | `OFF`, `001`-`120` | `SLP*` |
| `home/marantz/zone2/power` | `ON` / `OFF` | `Z2ON` / `Z2OFF` |
| `home/marantz/zone2/source` | `PHONO`, `NET`, ... | `Z2{source}` |
| `home/marantz/zone2/volume` | `0`-`98`, half steps as `55.5` | `Z2nn` |
| `home/marantz/zone2/mute` | `ON` / `OFF` | `Z2MUON` / `Z2MUOFF` |
| `home/marantz/zone2/sleep` | `OFF`, `001`-`120` | `Z2SLP*` |
| `home/marantz/zone2/high-pass-filter` | `ON` / `OFF` | `Z2HPFON` / `Z2HPFOFF` |
| `home/marantz/zone3/*` | power/source/volume/mute where supported | `Z3*` |
| `home/marantz/video/*` | source, scaler, processing, monitor, audio | `SV*`, `VSSCH*`, `VSVPM*`, `VSMONI*`, `VSAUDIO *` |
| `home/marantz/channel-volume/{channel}` | trim value | `CV{channel} *` |
| `home/marantz/audyssey/*` | Dynamic EQ, Dynamic Volume, DRC, LFE, etc. | confirmed `PS*` families |
| `home/marantz/tone/*` | bass, treble, tone control | `PSBAS`, `PSTRE`, `PSTONE CTRL` |
| `home/marantz/audio/*` | broader PS audio-processing families | `PSMULTEQ`, `PSIMAX*`, `PSAURO*`, etc. |
| `home/marantz/system/*` | mode display, audio display, bitmasks, sampling frequency | `SYS*`, `OPINF*`, `SS*` |
| `home/marantz/smart-mode-list/*` | available Movie/Music/Game/Pure mode slots | `OPSMLALL *` |
| `home/marantz/speaker-setup/*` | speaker levels, channel levels, test tones, config, distances | `SSBEL*`, `SSLEV*`, `SSTTL*`, `SSSPC*`, `SSSDE*` |
| `home/marantz/source/name/*` | configured input names | `SSFUNGAR*` |
| `home/marantz/auto-level-set/*` | Smart Select OSD/Audyssey profile lines | `OPALS*` |
| `home/marantz/bluetooth/transmitter` | transmitter state | `BTTX *` |
| `home/marantz/optical/transmitter` | transmitter state | `OPTXM *` |
| `home/marantz/last/raw` | last raw AVR line | any AVR line |

`home/marantz/event/raw` receives every AVR line as non-retained JSON:

```json
{"t":"2026-05-31T12:00:00.000Z","line":"SINET"}
```

`home/marantz/event/error` receives command validation failures and
unsupported-command replies.

## Command topics

Subscribe path:

```text
home/marantz/cmd/#
```

Publish commands with `retain: false`. Retained command messages are ignored by
default to avoid replaying old actions when the bridge restarts.

| Topic | Payload | AVR command |
|---|---|---|
| `home/marantz/cmd/raw` | raw AVR command | validated raw passthrough |
| `home/marantz/cmd/raw-batch` | JSON array of raw commands | validated batch passthrough |
| `home/marantz/cmd/query` | friendly query name or raw prefix | mapped query or `{prefix}?` |
| `home/marantz/cmd/power` | `ON` / `STANDBY` | `PWON` / `PWSTANDBY` |
| `home/marantz/cmd/main-zone/power` | `ON`, `OFF`, `TOGGLE` | `ZMON`, `ZMOFF` |
| `home/marantz/cmd/source` | `NET`, `PHONO`, ... | `SI{source}` |
| `home/marantz/cmd/signal-input-mode` | `AUTO`, `HDMI`, `DIGITAL`, `ANALOG` | `SD{mode}` |
| `home/marantz/cmd/video/source` | input, `OFF` | `SV{input}`, `SVOFF` |
| `home/marantz/cmd/volume` | `0`-`98`, `UP`, `DOWN` | `MV{nn}`, `MVUP`, `MVDOWN` |
| `home/marantz/cmd/mute` | `ON`, `OFF`, `TOGGLE` | `MUON`, `MUOFF`, toggle from known state |
| `home/marantz/cmd/sound-mode` | mode name | `MS{mode}` |
| `home/marantz/cmd/smart-surround` | `SMART`, `2CH`, `5CH`, `7CH` | `MSSMART*` |
| `home/marantz/cmd/smart-select` | `1`-`4` | `MSSMART{n}` |
| `home/marantz/cmd/smart-select/save` | `1`-`4` | `MSSMART{n} MEMORY` |
| `home/marantz/cmd/quick-select` | `1`-`5` | `MSQUICK{n}` |
| `home/marantz/cmd/quick-select/save` | `1`-`5` | `MSQUICK{n} MEMORY` |
| `home/marantz/cmd/speaker-preset` | `1`, `2` | `SPPR {n}` |
| `home/marantz/cmd/decoder` | mode name | `DC{mode}` |
| `home/marantz/cmd/sleep` | `OFF`, `1`-`120` | `SLPOFF`, `SLP{nnn}` |
| `home/marantz/cmd/zone2/power` | `ON` / `OFF` | `Z2ON` / `Z2OFF` |
| `home/marantz/cmd/zone2/source` | `NET`, `PHONO`, ... | `Z2{source}` |
| `home/marantz/cmd/zone2/volume` | `0`-`98`, `UP`, `DOWN` | `Z2{nn}`, `Z2UP`, `Z2DOWN` |
| `home/marantz/cmd/zone2/mute` | `ON`, `OFF`, `TOGGLE` | `Z2MUON`, `Z2MUOFF`, toggle from known state |
| `home/marantz/cmd/zone2/sleep` | `OFF`, `1`-`120` | `Z2SLPOFF`, `Z2SLP{nnn}` |
| `home/marantz/cmd/zone2/high-pass-filter` | `ON`, `OFF` | `Z2HPFON`, `Z2HPFOFF` |
| `home/marantz/cmd/zone2/bass` | value | `Z2PSBAS {value}` |
| `home/marantz/cmd/zone2/treble` | value | `Z2PSTRE {value}` |
| `home/marantz/cmd/zone3/*` | power/source/volume/mute | `Z3*` |
| `home/marantz/cmd/channel-volume/{channel}` | `38`-`62`, `UP`, `DOWN` | `CV{channel} {value}` |
| `home/marantz/cmd/channel-volume/reset-reference` | empty, `RESET` | `CVZRL` |
| `home/marantz/cmd/audyssey/*` | verified Audyssey payloads | `PSDYNEQ`, `PSDYNVOL`, `PSDRC`, etc. |
| `home/marantz/cmd/tone/*` | bass, treble, tone control | `PSBAS`, `PSTRE`, `PSTONE CTRL` |
| `home/marantz/cmd/audio/*` | broader audio processing payloads | `PSMULTEQ`, `PSIMAX*`, `PSAURO*`, etc. |
| `home/marantz/cmd/network/playback` | `PLAY`, `PAUSE`, `STOP`, `NEXT`, `PREV` | `NS9*` |
| `home/marantz/cmd/menu/*` | navigation action | `MN*` |
| `home/marantz/cmd/tuner/*` | frequency, preset, band, mode | `TF*`, `TP*`, `TM*` |
| `home/marantz/cmd/picture/*` | picture payload | `PV*` |
| `home/marantz/cmd/system/*` | eco, dimmer, locks, triggers, etc. | `ECO`, `DIM`, `SY*`, `TR*` |
| `home/marantz/cmd/bluetooth/transmitter` | value | `BTTX {value}` |
| `home/marantz/cmd/cec` | `ON`, `OFF` | Marantz CEC remote-code commands |
| `home/marantz/cmd/cec/denon` | `ON`, `OFF` | Denon CEC remote-code commands |

The bridge never pre-publishes state after sending a command. MQTT state changes
only after the AVR emits the corresponding line.

See [TELNET2MQTT_COMMAND_BACKLOG.md](TELNET2MQTT_COMMAND_BACKLOG.md) for the
complete expanded topic list and model-support caveats.

Examples:

```sh
mosquitto_pub -h 192.168.1.10 -t home/marantz/cmd/power -m ON
mosquitto_pub -h 192.168.1.10 -t home/marantz/cmd/source -m NET
mosquitto_pub -h 192.168.1.10 -t home/marantz/cmd/volume -m DOWN
mosquitto_pub -h 192.168.1.10 -t home/marantz/cmd/zone2/source -m PHONO
```
