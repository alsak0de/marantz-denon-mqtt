# heos2mqtt

`heos2mqtt` is the planned MQTT bridge for the HEOS CLI on TCP port 1255.

It should run beside `marantz2mqtt`, not inside it. `marantz2mqtt` owns AVR
hardware control over TCP port 23. `heos2mqtt` owns HEOS players, playback,
queues, browsing, favourites, playlists, groups, account state, and HEOS events.

## Goals

- Keep one persistent HEOS CLI connection open.
- Register for HEOS change events on startup.
- Publish stable retained state for players, groups, and now-playing data.
- Support request/response commands for browse, search, queue, and metadata APIs.
- Keep Spotify Connect out of the HEOS bridge except as a documented limitation.

## Configuration

Planned environment variables:

| Variable | Default | Description |
|---|---:|---|
| `HEOS_HOST` | required | IP or hostname of any HEOS device on the LAN |
| `HEOS_PORT` | `1255` | HEOS CLI TCP port |
| `MQTT_URL` | `mqtt://localhost:1883` | MQTT broker URL |
| `MQTT_USERNAME` | empty | MQTT username |
| `MQTT_PASSWORD` | empty | MQTT password |
| `MQTT_HEOS_BASE_TOPIC` | `home/heos` | Root HEOS MQTT topic |
| `MQTT_IGNORE_RETAINED_COMMANDS` | `true` | Ignore retained command messages on startup |
| `HEOS_COMMAND_GAP_MS` | `100` | Delay between queued HEOS commands |
| `HEOS_REQUEST_TIMEOUT_MS` | `5000` | Request timeout |
| `LOG_LEVEL` | `info` | Set to `silent` to reduce logs |

## State topics

All durable state topics should be retained.

| Topic | Payload |
|---|---|
| `home/heos/availability` | `online`, `offline` |
| `home/heos/players` | JSON array of players |
| `home/heos/groups` | JSON array of groups |
| `home/heos/player/{pid}/info` | JSON player info |
| `home/heos/player/{pid}/state` | `play`, `pause`, `stop` |
| `home/heos/player/{pid}/now-playing` | JSON media metadata |
| `home/heos/player/{pid}/progress` | JSON progress payload |
| `home/heos/player/{pid}/volume` | `0`-`100` |
| `home/heos/player/{pid}/mute` | `on`, `off` |
| `home/heos/player/{pid}/play-mode` | JSON repeat/shuffle payload |
| `home/heos/player/{pid}/queue` | JSON queue snapshot |
| `home/heos/group/{gid}/info` | JSON group info |
| `home/heos/group/{gid}/volume` | `0`-`100` |
| `home/heos/group/{gid}/mute` | `on`, `off` |
| `home/heos/sources` | JSON source list |
| `home/heos/account` | JSON account/check-account state |
| `home/heos/event/raw` | non-retained raw HEOS event JSON |
| `home/heos/event/error` | non-retained command/error JSON |

## Command topics

Command messages must not be retained.

### System

| Topic | Payload |
|---|---|
| `home/heos/cmd/system/register-events` | `on`, `off` |
| `home/heos/cmd/system/check-account` | empty or request JSON |
| `home/heos/cmd/system/sign-in` | JSON with username/password reference |
| `home/heos/cmd/system/sign-out` | empty |
| `home/heos/cmd/system/heartbeat` | empty |
| `home/heos/cmd/system/reboot` | player id or JSON |
| `home/heos/cmd/system/prettify-json` | `on`, `off` |

Secrets should not be committed or logged. Prefer a config reference for
account credentials rather than sending passwords through retained broker logs.

### Player

| Topic | Payload |
|---|---|
| `home/heos/cmd/player/get-players` | optional request JSON |
| `home/heos/cmd/player/{pid}/get-info` | optional request JSON |
| `home/heos/cmd/player/{pid}/get-state` | optional request JSON |
| `home/heos/cmd/player/{pid}/play-state` | `play`, `pause`, `stop` |
| `home/heos/cmd/player/{pid}/get-now-playing` | optional request JSON |
| `home/heos/cmd/player/{pid}/get-volume` | optional request JSON |
| `home/heos/cmd/player/{pid}/volume` | `0`-`100` |
| `home/heos/cmd/player/{pid}/volume-step` | JSON with `direction` and optional `step` |
| `home/heos/cmd/player/{pid}/get-mute` | optional request JSON |
| `home/heos/cmd/player/{pid}/mute` | `on`, `off`, `toggle` |
| `home/heos/cmd/player/{pid}/get-play-mode` | optional request JSON |
| `home/heos/cmd/player/{pid}/play-mode` | JSON with `repeat` and `shuffle` |
| `home/heos/cmd/player/{pid}/queue/get` | JSON with range |
| `home/heos/cmd/player/{pid}/queue/play` | queue id |
| `home/heos/cmd/player/{pid}/queue/remove` | queue id or JSON range |
| `home/heos/cmd/player/{pid}/queue/save` | playlist name |
| `home/heos/cmd/player/{pid}/queue/clear` | empty |
| `home/heos/cmd/player/{pid}/queue/move` | JSON move request |
| `home/heos/cmd/player/{pid}/next` | empty |
| `home/heos/cmd/player/{pid}/previous` | empty |
| `home/heos/cmd/player/{pid}/quickselect/set` | number |
| `home/heos/cmd/player/{pid}/quickselect/play` | number |
| `home/heos/cmd/player/{pid}/quickselect/get` | optional request JSON |
| `home/heos/cmd/player/{pid}/check-update` | empty |

### Group

| Topic | Payload |
|---|---|
| `home/heos/cmd/group/get-groups` | optional request JSON |
| `home/heos/cmd/group/{gid}/get-info` | optional request JSON |
| `home/heos/cmd/group/set` | JSON leader/member pid list |
| `home/heos/cmd/group/{gid}/get-volume` | optional request JSON |
| `home/heos/cmd/group/{gid}/volume` | `0`-`100` |
| `home/heos/cmd/group/{gid}/volume-step` | JSON with `direction` and optional `step` |
| `home/heos/cmd/group/{gid}/get-mute` | optional request JSON |
| `home/heos/cmd/group/{gid}/mute` | `on`, `off`, `toggle` |

### Browse

Browse/search calls are request/response, not durable state. Every command
payload should include a `request_id`; if omitted, the bridge generates one.
Responses are published to `home/heos/response/{request_id}`.

| Topic | Payload |
|---|---|
| `home/heos/cmd/browse/get-sources` | request JSON |
| `home/heos/cmd/browse/get-source-info` | JSON with `sid` |
| `home/heos/cmd/browse/browse` | JSON with `sid`, optional `cid`, optional range |
| `home/heos/cmd/browse/browse-containers` | JSON source/container request |
| `home/heos/cmd/browse/get-search-criteria` | JSON with `sid` |
| `home/heos/cmd/browse/search` | JSON with `sid`, search text, criteria |
| `home/heos/cmd/browse/play-station` | JSON station request |
| `home/heos/cmd/browse/play-preset` | JSON preset request |
| `home/heos/cmd/browse/play-input` | JSON input request |
| `home/heos/cmd/browse/play-url` | JSON URL request |
| `home/heos/cmd/browse/add-to-queue` | JSON add request |
| `home/heos/cmd/browse/get-playlists` | request JSON |
| `home/heos/cmd/browse/rename-playlist` | JSON rename request |
| `home/heos/cmd/browse/delete-playlist` | JSON delete request |
| `home/heos/cmd/browse/get-history` | request JSON |
| `home/heos/cmd/browse/retrieve-metadata` | JSON metadata request |
| `home/heos/cmd/browse/get-service-options` | request JSON |
| `home/heos/cmd/browse/set-service-option` | JSON option request |

## Startup sequence

1. Connect to MQTT.
2. Connect to HEOS CLI on `HEOS_HOST:HEOS_PORT`.
3. Send `system/register_for_change_events?enable=on`.
4. Query players, groups, sources, and account state.
5. For each player, query play state, now playing, volume, mute, play mode, and queue summary.
6. Publish `availability=online`.

## Safety rules

- Do not publish passwords in logs, retained topics, or error payloads.
- Do not conflate HEOS volume with AVR master volume.
- Do not try to control Spotify content through HEOS browse/search.
- For Home Station playback, avoid routing the living-room AVR's own HEOS
  engine back into a Zone 2 NET capture loop.
- Use request/response topics for large, paginated, or transient results.
