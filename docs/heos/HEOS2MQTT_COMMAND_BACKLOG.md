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
| planned | Add `src/heos2mqtt` bridge folder | Placeholder exists; implementation pending |
| planned | Add `test/heos2mqtt` test folder | Placeholder exists; tests pending |
| todo | Add `bin/heos2mqtt.mjs` | CLI entry point |
| todo | Add package script `start:heos2mqtt` | After entry point exists |
| todo | Add Docker Compose service | After config is implemented |

## Protocol core

| Status | Item | Notes |
|---|---|---|
| todo | HEOS line parser | One JSON object per CRLF line |
| todo | HEOS command formatter | URL-encode query params correctly |
| todo | Request correlation | Match command response by command path and optional generated request id |
| todo | Command queue | Preserve command order and gap |
| todo | Timeout handling | Publish error event on timeout |
| todo | Error parser | Parse `heos.result=fail` and message/error code |
| todo | Event registration | `system/register_for_change_events?enable=on` |
| todo | Raw event publishing | `event/raw`, non-retained |

## System API

| Status | Command | MQTT coverage |
|---|---|---|
| todo | `system/register_for_change_events` | `cmd/system/register-events` |
| todo | `system/check_account` | `cmd/system/check-account`, `account` state |
| blocked | `system/sign_in` | Credential handling decision needed |
| todo | `system/sign_out` | `cmd/system/sign-out` |
| todo | `system/heart_beat` | `cmd/system/heartbeat` |
| blocked | `system/reboot` | Potentially disruptive; require explicit opt-in |
| todo | `system/prettify_json_response` | `cmd/system/prettify-json` |

## Player API

| Status | Command | MQTT coverage |
|---|---|---|
| todo | `player/get_players` | `players` state |
| todo | `player/get_player_info` | `player/{pid}/info` |
| todo | `player/get_play_state` | `player/{pid}/state` |
| todo | `player/set_play_state` | `cmd/player/{pid}/play-state` |
| todo | `player/get_now_playing_media` | `player/{pid}/now-playing` |
| todo | `player/get_volume` | `player/{pid}/volume` |
| todo | `player/set_volume` | `cmd/player/{pid}/volume` |
| todo | `player/volume_up` | `cmd/player/{pid}/volume-step` |
| todo | `player/volume_down` | `cmd/player/{pid}/volume-step` |
| todo | `player/get_mute` | `player/{pid}/mute` |
| todo | `player/set_mute` | `cmd/player/{pid}/mute` |
| todo | `player/toggle_mute` | `cmd/player/{pid}/mute` |
| todo | `player/get_play_mode` | `player/{pid}/play-mode` |
| todo | `player/set_play_mode` | `cmd/player/{pid}/play-mode` |
| todo | `player/get_queue` | `player/{pid}/queue` and request responses |
| todo | `player/play_queue` | `cmd/player/{pid}/queue/play` |
| todo | `player/remove_from_queue` | `cmd/player/{pid}/queue/remove` |
| todo | `player/save_queue` | `cmd/player/{pid}/queue/save` |
| todo | `player/clear_queue` | `cmd/player/{pid}/queue/clear` |
| todo | `player/move_queue` | `cmd/player/{pid}/queue/move` |
| todo | `player/play_next` | `cmd/player/{pid}/next` |
| todo | `player/play_previous` | `cmd/player/{pid}/previous` |
| todo | `player/set_quickselect` | `cmd/player/{pid}/quickselect/set` |
| todo | `player/play_quickselect` | `cmd/player/{pid}/quickselect/play` |
| todo | `player/get_quickselects` | `cmd/player/{pid}/quickselect/get` |
| todo | `player/check_update` | `cmd/player/{pid}/check-update` |

## Group API

| Status | Command | MQTT coverage |
|---|---|---|
| todo | `group/get_groups` | `groups` state |
| todo | `group/get_group_info` | `group/{gid}/info` |
| todo | `group/set_group` | `cmd/group/set` |
| todo | `group/get_group_volume` | `group/{gid}/volume` |
| todo | `group/set_group_volume` | `cmd/group/{gid}/volume` |
| todo | `group/volume_up` | `cmd/group/{gid}/volume-step` |
| todo | `group/volume_down` | `cmd/group/{gid}/volume-step` |
| todo | `group/get_group_mute` | `group/{gid}/mute` |
| todo | `group/set_group_mute` | `cmd/group/{gid}/mute` |
| todo | `group/toggle_group_mute` | `cmd/group/{gid}/mute` |

## Browse API

| Status | Command | MQTT coverage |
|---|---|---|
| todo | `browse/get_music_sources` | `sources` state and response topic |
| todo | `browse/get_source_info` | `cmd/browse/get-source-info` |
| todo | `browse/browse` | `cmd/browse/browse` |
| todo | `browse/browse_source_containers` | `cmd/browse/browse-containers` |
| todo | `browse/get_search_criteria` | `cmd/browse/get-search-criteria` |
| todo | `browse/search` | `cmd/browse/search` |
| todo | `browse/play_stream` | `cmd/browse/play-station` |
| todo | `browse/play_preset` | `cmd/browse/play-preset` |
| todo | `browse/play_input` | `cmd/browse/play-input` |
| todo | `browse/play_url` | `cmd/browse/play-url` |
| todo | `browse/add_to_queue` | `cmd/browse/add-to-queue` |
| todo | `browse/get_heos_playlists` | `cmd/browse/get-playlists` |
| todo | `browse/rename_heos_playlist` | `cmd/browse/rename-playlist` |
| todo | `browse/delete_heos_playlist` | `cmd/browse/delete-playlist` |
| todo | `browse/get_heos_history` | `cmd/browse/get-history` |
| todo | `browse/retrieve_metadata` | `cmd/browse/retrieve-metadata` |
| todo | `browse/get_service_options` | `cmd/browse/get-service-options` |
| todo | `browse/set_service_option` | `cmd/browse/set-service-option` |

## Events

| Status | Event | MQTT effect |
|---|---|---|
| todo | `event/player_state_changed` | update `player/{pid}/state` |
| todo | `event/player_now_playing_media_changed` | refresh now-playing |
| todo | `event/player_now_playing_progress` | update progress |
| todo | `event/player_volume_changed` | update volume |
| todo | `event/player_mute_changed` | update mute |
| todo | `event/player_queue_changed` | refresh queue summary |
| todo | `event/player_play_mode_changed` | update play mode |
| todo | `event/groups_changed` | refresh groups |
| todo | `event/group_volume_changed` | update group volume |
| todo | `event/group_mute_changed` | update group mute |
| todo | `event/sources_changed` | refresh sources |
| todo | `event/user_changed` | refresh account state |

## Verification requirements

Each implemented command family needs:

- Unit tests for command formatting.
- Unit tests for response parsing.
- Unit tests for MQTT topic translation.
- Fixture tests for representative `ok`, `fail`, and event payloads.
- Documentation updates in `HEOS2MQTT.md`.
- Device probe notes for behavior that depends on model, source, account, or service.
