# heos2mqtt tests

Tests for the HEOS CLI to MQTT bridge.

Covered behaviour:

- HEOS command formatting.
- HEOS response parsing.
- HEOS event parsing.
- MQTT topic to HEOS command translation.
- Request/response topic correlation.
- Now-playing gating on player play state.
- Raw firehose publishing.
- Friendly-name autofocus alias publishing.
