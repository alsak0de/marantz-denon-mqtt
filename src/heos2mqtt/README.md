# heos2mqtt source

Runtime implementation for the HEOS CLI to MQTT bridge.

Modules:

- `config.mjs` reads environment and `.env` configuration.
- `protocol.mjs` parses HEOS JSON lines and translates MQTT command topics to
  HEOS CLI commands.
- `service.mjs` owns MQTT, HEOS TCP lifecycle, startup state queries,
  heartbeat, event handling, and retained state publishing.

Bridge documentation and tracking live in:

- `docs/heos/HEOS_CLI_PROTOCOL.md`
- `docs/heos/HEOS2MQTT.md`
- `docs/heos/HEOS2MQTT_COMMAND_BACKLOG.md`
