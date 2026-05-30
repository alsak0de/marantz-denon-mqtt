# marantz2mqtt

`marantz2mqtt` bridges a Marantz / Denon AVR TCP control socket to MQTT.
It keeps one persistent TCP connection open to the AVR on port 23, publishes
state changes from AVR echoes or unsolicited events, and subscribes to command
topics that translate back into AVR commands.

The broker is treated as the state store: state topics are retained, and command
topics are fire-and-forget.

## Run

```sh
npm install
AVR_HOST=192.168.1.50 MQTT_URL=mqtt://192.168.1.10:1883 npm run start:marantz2mqtt
```

Or with Docker Compose:

```sh
cp .env.example .env
docker compose up -d --build marantz2mqtt
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
SI?
Z2?
PW?
MV?
MU?
MS?
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
| `home/marantz/zone2/power` | `ON` / `OFF` | `Z2ON` / `Z2OFF` |
| `home/marantz/zone2/source` | `PHONO`, `NET`, ... | `Z2{source}` |
| `home/marantz/zone2/volume` | `0`-`98`, half steps as `55.5` | `Z2nn` |
| `home/marantz/zone2/mute` | `ON` / `OFF` | `Z2MUON` / `Z2MUOFF` |

`home/marantz/event/raw` receives every AVR line as non-retained JSON:

```json
{"t":"2026-05-31T12:00:00.000Z","line":"SINET"}
```

Zone 2 source parsing filters out `Z2MU*`, `Z2SLP*`, `Z2\d+`, `Z2ON`, and
`Z2OFF` before treating `line.slice(2)` as a source name.

## Command topics

Subscribe path:

```text
home/marantz/cmd/#
```

Publish commands with `retain: false`. Retained command messages are ignored by
default to avoid replaying old actions when the bridge restarts.

| Topic | Payload | AVR command |
|---|---|---|
| `home/marantz/cmd/power` | `ON` / `STANDBY` | `PWON` / `PWSTANDBY` |
| `home/marantz/cmd/source` | `NET`, `PHONO`, ... | `SI{source}` |
| `home/marantz/cmd/volume` | `0`-`98`, `UP`, `DOWN` | `MV{nn}`, `MVUP`, `MVDOWN` |
| `home/marantz/cmd/mute` | `ON`, `OFF`, `TOGGLE` | `MUON`, `MUOFF`, toggle from known state |
| `home/marantz/cmd/zone2/power` | `ON` / `OFF` | `Z2ON` / `Z2OFF` |
| `home/marantz/cmd/zone2/source` | `NET`, `PHONO`, ... | `Z2{source}` |
| `home/marantz/cmd/zone2/volume` | `0`-`98`, `UP`, `DOWN` | `Z2{nn}`, `Z2UP`, `Z2DOWN` |
| `home/marantz/cmd/zone2/mute` | `ON`, `OFF`, `TOGGLE` | `Z2MUON`, `Z2MUOFF`, toggle from known state |

The bridge never pre-publishes state after sending a command. MQTT state changes
only after the AVR emits the corresponding line.

Examples:

```sh
mosquitto_pub -h 192.168.1.10 -t home/marantz/cmd/power -m ON
mosquitto_pub -h 192.168.1.10 -t home/marantz/cmd/source -m NET
mosquitto_pub -h 192.168.1.10 -t home/marantz/cmd/volume -m DOWN
mosquitto_pub -h 192.168.1.10 -t home/marantz/cmd/zone2/source -m PHONO
```
