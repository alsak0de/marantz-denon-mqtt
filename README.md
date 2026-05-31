# Marantz / Denon AVR and HEOS API

Community reference and MQTT bridge workspace for Marantz/Denon AVR control.

The repository is split by protocol:

- AVR Telnet control on **TCP port 23** for hardware state and settings.
- HEOS CLI control on **TCP port 1255** for playback, browse/search, queues, groups, and HEOS events.

Spotify Connect is separate from both. HEOS CLI does not provide Spotify browse/search control.

## Tested on

| Model | Firmware | Contributor |
|---|---|---|
| Marantz Cinema 70s | — | @alsak0de |

> **Have a different model?** Open a PR adding your row — even a partial one helps.

## Quick start

Five lines to read the current power state:

```js
import { createConnection } from "net";

const socket = createConnection({ host: "192.168.1.X", port: 23 });
socket.on("connect", () => socket.write("PW?\r"));
socket.on("data", d => { console.log(d.toString()); socket.destroy(); });
```

```python
import socket
s = socket.create_connection(("192.168.1.X", 23))
s.send(b"PW?\r")
print(s.recv(64))
s.close()
```

## Contents

- **[docs/README.md](docs/README.md)** — documentation map and protocol boundary
- **[docs/telnet/MARANTZ_DENON_TELNET_PROTOCOL.md](docs/telnet/MARANTZ_DENON_TELNET_PROTOCOL.md)** — TCP port 23 reference: command format, response parsing, Zone 2, Audyssey, surround modes, activity sequences, error handling
- **[docs/telnet/MARANTZ2MQTT.md](docs/telnet/MARANTZ2MQTT.md)** — container-ready MQTT bridge for AVR state and commands
- **[docs/telnet/MARANTZ2MQTT_COMMAND_BACKLOG.md](docs/telnet/MARANTZ2MQTT_COMMAND_BACKLOG.md)** — tracked expansion plan for full Telnet command coverage
- **[docs/telnet/VISUAL_TEST_LOG.md](docs/telnet/VISUAL_TEST_LOG.md)** — live visual validation notes for the Cinema 70s
- **[docs/heos/HEOS_CLI_PROTOCOL.md](docs/heos/HEOS_CLI_PROTOCOL.md)** — HEOS CLI protocol notes with official/source links
- **[docs/heos/HEOS2MQTT.md](docs/heos/HEOS2MQTT.md)** — planned MQTT bridge contract for HEOS
- **[docs/heos/HEOS2MQTT_COMMAND_BACKLOG.md](docs/heos/HEOS2MQTT_COMMAND_BACKLOG.md)** — tracked execution plan for full documented HEOS CLI coverage
- **[docs/telnet/AUDYSSEY.md](docs/telnet/AUDYSSEY.md)** — Audyssey & speaker config API: HTTP AJAX interface, speaker distances/levels/crossovers, GraphicEQ, .ady file format, community tools
- **[docs/telnet/IR.md](docs/telnet/IR.md)** — IR blaster fallback: when TCP isn't enough, hardware options, example codes for Marantz Cinema 70s
- **[examples/node.js](examples/node.js)** — reusable `send` / `sendWait` helpers in Node.js
- **[examples/python.py](examples/python.py)** — equivalent helpers in Python

## marantz2mqtt

This repo includes a Node.js MQTT bridge that keeps a persistent TCP connection
to the AVR, publishes retained state topics, and accepts command topics without
pre-publishing guessed state.

```sh
cp .env.example .env
docker compose up -d --build marantz2mqtt
```

See **[docs/telnet/MARANTZ2MQTT.md](docs/telnet/MARANTZ2MQTT.md)** for
configuration and the full topic contract.

## heos2mqtt

`heos2mqtt` is planned as a separate bridge for the HEOS CLI on TCP port 1255.
The design is tracked in **[docs/heos/HEOS2MQTT.md](docs/heos/HEOS2MQTT.md)**,
with implementation tracking in
**[docs/heos/HEOS2MQTT_COMMAND_BACKLOG.md](docs/heos/HEOS2MQTT_COMMAND_BACKLOG.md)**.

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
