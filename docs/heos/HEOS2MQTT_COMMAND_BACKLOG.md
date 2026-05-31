# heos2mqtt command backlog

This is the execution tracker for adding full documented HEOS CLI coverage.

Status values:

- `todo`: not implemented
- `planned`: design accepted, implementation not started
- `blocked`: needs current PDF details, device probing, or credential decision
- `done`: implemented with tests and docs

## Repository setup

| Status | Item | Notes |
|---|---|---|
| done | Create HEOS documentation folder | `docs/heos/` |
| done | Document protocol boundaries | HEOS vs Telnet vs Spotify Connect |
| done | Add `src/heos2mqtt` bridge folder | Runtime, config, protocol translator |
| done | Add `test/heos2mqtt` test folder | Protocol and service behaviour tests |
| done | Add `bin/heos2mqtt.mjs` | CLI entry point |
| done | Add package script `start:heos2mqtt` | Runs the HEOS bridge |
| done | Add Docker Compose service | `heos2mqtt` service added beside `telnet2mqtt` |

## Protocol core

| Status | Item | Notes |
|---|---|---|
| done | HEOS line parser | One JSON object per CRLF line |
| done | HEOS command formatter | URL-encode query params correctly |
| done | Request correlation | Match command response by command path and optional generated request id |
| done | Command queue | Preserve command order and gap |
| done | Timeout handling | Publish error event on timeout |
| done | Error parser | Parse `heos.result=fail` and message/error code |
| done | Event registration | `system/register_for_change_events?enable=on` on every reconnect |
| done | Raw event publishing | `event/raw`, non-retained |

## System API

| Status | Command | MQTT coverage |
|---|---|---|
| done | `system/register_for_change_events` | `cmd/system/register-events`; also automatic on socket connect |
| done | `system/check_account` | `cmd/system/check-account`, `account` state |
| done | `system/sign_in` | `cmd/system/sign-in`; debug logs redact `pw` |
| done | `system/sign_out` | `cmd/system/sign-out` |
| done | `system/heart_beat` | `cmd/system/heartbeat`; automatic 30s heartbeat |
| done | `system/reboot` | `cmd/system/reboot`; exposed only by explicit command publish |
| done | `system/prettify_json_response` | `cmd/system/prettify-json` |

## Player API

| Status | Command | MQTT coverage |
|---|---|---|
| done | `player/get_players` | `players` state |
| done | `player/get_player_info` | `player/{pid}/info` |
| done | `player/get_play_state` | `player/{pid}/state` |
| done | `player/set_play_state` | `cmd/player/{pid}/play-state` |
| done | `player/get_now_playing_media` | `player/{pid}/now-playing`, gated by play state |
| done | `player/get_volume` | `player/{pid}/volume` |
| done | `player/set_volume` | `cmd/player/{pid}/volume` |
| done | `player/volume_up` | `cmd/player/{pid}/volume-step` |
| done | `player/volume_down` | `cmd/player/{pid}/volume-step` |
| done | `player/get_mute` | `player/{pid}/mute` |
| done | `player/set_mute` | `cmd/player/{pid}/mute` |
| done | `player/toggle_mute` | `cmd/player/{pid}/mute` |
| done | `player/get_play_mode` | `player/{pid}/play-mode` |
| done | `player/set_play_mode` | `cmd/player/{pid}/play-mode` |
| done | `player/get_queue` | `player/{pid}/queue` and request responses |
| done | `player/play_queue` | `cmd/player/{pid}/queue/play` |
| done | `player/remove_from_queue` | `cmd/player/{pid}/queue/remove` |
| done | `player/save_queue` | `cmd/player/{pid}/queue/save` |
| done | `player/clear_queue` | `cmd/player/{pid}/queue/clear` |
| done | `player/move_queue` | `cmd/player/{pid}/queue/move` |
| done | `player/play_next` | `cmd/player/{pid}/next` |
| done | `player/play_previous` | `cmd/player/{pid}/previous` |
| done | `player/set_quickselect` | `cmd/player/{pid}/quickselect/set` |
| done | `player/play_quickselect` | `cmd/player/{pid}/quickselect/play` |
| done | `player/get_quickselects` | `cmd/player/{pid}/quickselect/get` |
| done | `player/check_update` | `cmd/player/{pid}/check-update` |

## Group API

| Status | Command | MQTT coverage |
|---|---|---|
| done | `group/get_groups` | `groups` state |
| done | `group/get_group_info` | `group/{gid}/info` |
| done | `group/set_group` | `cmd/group/set` |
| done | `group/get_group_volume` | `group/{gid}/volume` |
| done | `group/set_group_volume` | `cmd/group/{gid}/volume` |
| done | `group/volume_up` | `cmd/group/{gid}/volume-step` |
| done | `group/volume_down` | `cmd/group/{gid}/volume-step` |
| done | `group/get_group_mute` | `group/{gid}/mute` |
| done | `group/set_group_mute` | `cmd/group/{gid}/mute` |
| done | `group/toggle_group_mute` | `cmd/group/{gid}/mute` |

## Browse API

| Status | Command | MQTT coverage |
|---|---|---|
| done | `browse/get_music_sources` | `sources` state and response topic |
| done | `browse/get_source_info` | `cmd/browse/get-source-info` |
| done | `browse/browse` | `cmd/browse/browse` |
| done | `browse/browse_source_containers` | `cmd/browse/browse-containers` |
| done | `browse/get_search_criteria` | `cmd/browse/get-search-criteria` |
| done | `browse/search` | `cmd/browse/search` |
| done | `browse/play_stream` | `cmd/browse/play-station` |
| done | `browse/play_preset` | `cmd/browse/play-preset` |
| done | `browse/play_input` | `cmd/browse/play-input` |
| done | `browse/play_url` | `cmd/browse/play-url` |
| done | `browse/add_to_queue` | `cmd/browse/add-to-queue` |
| done | `browse/get_heos_playlists` | `cmd/browse/get-playlists` |
| done | `browse/rename_heos_playlist` | `cmd/browse/rename-playlist` |
| done | `browse/delete_heos_playlist` | `cmd/browse/delete-playlist` |
| done | `browse/get_heos_history` | `cmd/browse/get-history` |
| done | `browse/retrieve_metadata` | `cmd/browse/retrieve-metadata` |
| done | `browse/get_service_options` | `cmd/browse/get-service-options` |
| done | `browse/set_service_option` | `cmd/browse/set-service-option` |

## Events

| Status | Event | MQTT effect |
|---|---|---|
| done | `event/player_state_changed` | update `player/{pid}/state` and clear now-playing unless playing |
| done | `event/player_now_playing_media_changed` | refresh now-playing through play-state gate |
| done | `event/player_now_playing_progress` | update progress |
| done | `event/player_volume_changed` | update volume |
| done | `event/player_mute_changed` | update mute |
| done | `event/player_queue_changed` | refresh queue summary |
| done | `event/player_play_mode_changed` | update play mode |
| done | `event/groups_changed` | refresh groups |
| done | `event/group_volume_changed` | update group volume |
| done | `event/group_mute_changed` | update group mute |
| done | `event/sources_changed` | refresh sources |
| done | `event/user_changed` | refresh account state |

## Verification requirements

Each implemented command family needs:

- Unit tests for command formatting.
- Unit tests for response parsing.
- Unit tests for MQTT topic translation.
- Fixture tests for representative `ok`, `fail`, and event payloads.
- Documentation updates in `HEOS2MQTT.md`.
- Device probe notes for behavior that depends on model, source, account, or service.
