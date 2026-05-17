# Marantz / Denon AVR — TCP Port 23 Control

Community reference for the RS-232-over-IP (Telnet) protocol exposed by Marantz and Denon AV receivers on **TCP port 23**. Covers connection patterns, commands verified on current hardware, known gotchas, and working code examples in Node.js and Python.

Denon publishes official protocol PDFs for specific older models (most are dated 2010–2014) but these predate HEOS, Atmos, DTS:X, and Neural:X. This guide focuses on **modern receivers (2016+)** and is maintained by the community with real test results.

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

- **[PROTOCOL.md](PROTOCOL.md)** — TCP port 23 reference: every command, response format, Zone 2, Audyssey, surround modes, activity sequences, error handling
- **[IR.md](IR.md)** — IR blaster fallback: when TCP isn't enough, hardware options, example codes for Marantz Cinema 70s
- **[examples/node.js](examples/node.js)** — reusable `send` / `sendWait` helpers in Node.js
- **[examples/python.py](examples/python.py)** — equivalent helpers in Python

## Contributing

Contributions welcome — especially:

- **Model compatibility notes** — does a command work or return `?` on your unit?
- **Missing commands** — `CV*` channel trim, `PSSWL` subwoofer level, `ECO`, `HDMI`, `VSMONI`, etc.
- **Examples in other languages** — Go, Rust, Home Assistant REST, etc.
- **Corrections** — timing values, encoding edge cases, Zone 2 behaviour differences

Please open an issue before a large PR so we can align on scope. For small additions (a command row, a model row, a language example) just send the PR directly.

## License

MIT
