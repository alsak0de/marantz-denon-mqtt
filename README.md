# Marantz / Denon MQTT Bridges

Container-ready MQTT bridges for Marantz and Denon receivers.

This repository provides two independent bridges that can run side-by-side:

| Bridge | Protocol | Use it for |
|---|---|---|
| `telnet2mqtt` | AVR Telnet, TCP port 23 | Power, input, volume, mute, zones, surround modes, Audyssey, hardware state, and AVR settings |
| `heos2mqtt` | HEOS CLI, TCP port 1255 | HEOS players, playback, now-playing, groups, queues, browse/search, sources, account state, and HEOS events |

Use either bridge on its own, or run both together to expose AVR hardware
control and HEOS playback state through MQTT.

## Quick start

```sh
cp .env.example .env
docker compose up -d telnet2mqtt heos2mqtt
```

Common retained state topics:

```text
home/marantz/power
home/marantz/main/input
home/marantz/main/volume
home/marantz/main/mute
home/heos/players
home/heos/main/now-playing
home/heos/main/mute
```

See the bridge docs for the full topic contracts:

- **[telnet2mqtt](docs/telnet/TELNET2MQTT.md)** — AVR hardware state and commands
- **[heos2mqtt](docs/heos/HEOS2MQTT.md)** — HEOS playback, browse/search, groups, queues, and events

## Protocol boundary

The bridges are separate because Marantz/Denon receivers expose separate
control surfaces:

- AVR Telnet on **TCP port 23** controls hardware state and settings.
- HEOS CLI on **TCP port 1255** controls HEOS playback, browse/search, queues,
  groups, and HEOS events.
- Spotify Connect is separate from both. HEOS CLI does not provide Spotify
  browse/search control.

The protocol references in `docs/` are included so the bridges can be audited,
extended, and tested against more models.

## Tested on

| Model | Firmware | Contributor |
|---|---|---|
| Marantz Cinema 70s | HEOS 3.88.614 | @alsak0de |

> **Have a different model?** Open a PR adding your row — even a partial one helps.

## Contents

- **[docs/README.md](docs/README.md)** — documentation map and protocol boundary
- **[docs/telnet/MARANTZ_DENON_TELNET_PROTOCOL.md](docs/telnet/MARANTZ_DENON_TELNET_PROTOCOL.md)** — TCP port 23 reference: command format, response parsing, Zone 2, Audyssey, surround modes, activity sequences, error handling
- **[docs/telnet/TELNET2MQTT.md](docs/telnet/TELNET2MQTT.md)** — container-ready MQTT bridge for AVR Telnet state and commands
- **[docs/telnet/TELNET2MQTT_COMMAND_BACKLOG.md](docs/telnet/TELNET2MQTT_COMMAND_BACKLOG.md)** — tracked expansion plan for full Telnet command coverage
- **[docs/telnet/VISUAL_TEST_LOG.md](docs/telnet/VISUAL_TEST_LOG.md)** — live visual validation notes for the Cinema 70s
- **[docs/heos/HEOS_CLI_PROTOCOL.md](docs/heos/HEOS_CLI_PROTOCOL.md)** — HEOS CLI protocol notes with official/source links
- **[docs/heos/HEOS2MQTT.md](docs/heos/HEOS2MQTT.md)** — MQTT bridge contract for HEOS playback, groups, browse, queues, and events
- **[docs/heos/HEOS2MQTT_COMMAND_BACKLOG.md](docs/heos/HEOS2MQTT_COMMAND_BACKLOG.md)** — tracked execution plan for full documented HEOS CLI coverage
- **[docs/telnet/AUDYSSEY.md](docs/telnet/AUDYSSEY.md)** — Audyssey & speaker config API: HTTP AJAX interface, speaker distances/levels/crossovers, GraphicEQ, .ady file format, community tools
- **[docs/telnet/IR.md](docs/telnet/IR.md)** — IR blaster fallback: when TCP isn't enough, hardware options, example codes for Marantz Cinema 70s
- **[examples/node.js](examples/node.js)** — reusable `send` / `sendWait` helpers in Node.js
- **[examples/python.py](examples/python.py)** — equivalent helpers in Python

## telnet2mqtt

`telnet2mqtt` keeps a persistent TCP connection to the AVR Telnet port,
publishes retained hardware state topics, and accepts command topics without
pre-publishing guessed state.

```sh
cp .env.example .env
docker compose up -d telnet2mqtt
```

See **[docs/telnet/TELNET2MQTT.md](docs/telnet/TELNET2MQTT.md)** for
configuration and the full topic contract.

## heos2mqtt

`heos2mqtt` keeps a persistent TCP connection to the HEOS CLI port. It runs
beside `telnet2mqtt` and covers HEOS playback, players, groups, queues,
browse/search request responses, sources, account state, and HEOS events.

```sh
cp .env.example .env
docker compose up -d heos2mqtt
```

See **[docs/heos/HEOS2MQTT.md](docs/heos/HEOS2MQTT.md)** for configuration,
topics, and production-use caveats.

## Container images

Published images are available from GHCR:

```yaml
services:
  telnet2mqtt:
    image: ghcr.io/alsak0de/marantz-denon-mqtt:latest
    command: ["node", "bin/telnet2mqtt.mjs"]
    restart: unless-stopped

  heos2mqtt:
    image: ghcr.io/alsak0de/marantz-denon-mqtt:latest
    command: ["node", "bin/heos2mqtt.mjs"]
    restart: unless-stopped
```

Tags:

- `latest` tracks the current `main` build.
- `main-<short-sha>` pins a specific commit from `main`.
- `vX.Y.Z`, `X.Y`, and `X` are published from version tags such as `v1.2.3`.

The image is multi-arch for `linux/amd64` and `linux/arm64`. After the first
publish, set the GHCR package visibility to public in the GitHub package
settings.

For local development, build from source:

```sh
docker build -t marantz-denon-mqtt:dev .
docker run --rm --env-file .env marantz-denon-mqtt:dev node bin/telnet2mqtt.mjs
docker run --rm --env-file .env marantz-denon-mqtt:dev node bin/heos2mqtt.mjs
```

## Contributing

Contributions welcome — especially:

- **Model compatibility notes** — does a command work or return `?` on your unit?
- **Missing Telnet commands** — `CV*` channel trim, `PSSWL` subwoofer level, `ECO`, `HDMI`, `VSMONI`, etc.
- **HEOS command coverage** — source-specific behavior, event payloads, account requirements, browse/search quirks
- **Examples in other languages** — Go, Rust, Home Assistant REST, etc.
- **Corrections** — timing values, encoding edge cases, Zone 2 behaviour differences

Please open an issue before a large PR so we can align on scope. For small additions (a command row, a model row, a language example) just send the PR directly.

## License

MIT
