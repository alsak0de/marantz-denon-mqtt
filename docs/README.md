# Documentation map

This repository covers two related but separate Marantz/Denon control surfaces.

## Telnet AVR control

TCP port 23 controls AVR hardware state: power, input, volume, mute, surround
modes, speaker presets, Audyssey/tone settings, zones, HDMI/video controls,
menu navigation, tuner, and model-specific setup commands.

- [Marantz/Denon Telnet protocol](telnet/MARANTZ_DENON_TELNET_PROTOCOL.md)
- [marantz2mqtt bridge](telnet/MARANTZ2MQTT.md)
- [marantz2mqtt command backlog](telnet/MARANTZ2MQTT_COMMAND_BACKLOG.md)
- [Telnet visual test log](telnet/VISUAL_TEST_LOG.md)
- [Audyssey notes](telnet/AUDYSSEY.md)
- [IR fallback notes](telnet/IR.md)

## HEOS CLI control

TCP port 1255 controls HEOS playback and multi-room state: HEOS players,
groups, queues, browse/search, favourites, playlists, inputs, presets, account
status, and HEOS change events.

- [HEOS CLI protocol](heos/HEOS_CLI_PROTOCOL.md)
- [heos2mqtt bridge design](heos/HEOS2MQTT.md)
- [heos2mqtt command backlog](heos/HEOS2MQTT_COMMAND_BACKLOG.md)

## Boundary

Do not merge these protocols into one parser:

- Telnet port 23 is AVR hardware control.
- HEOS CLI port 1255 is HEOS playback ecosystem control.
- Spotify Connect is separate again and is not browse/search controllable through
  HEOS CLI.
