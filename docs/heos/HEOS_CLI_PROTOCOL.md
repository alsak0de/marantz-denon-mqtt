# HEOS CLI protocol

This document tracks the documented HEOS Command Line Interface used by Denon
and Marantz HEOS-capable products.

## Sources

Primary source:

- Denon Support, "HEOS Control Protocol (CLI)": <https://support-eu.denon.com/app/answers/detail/a_id/20406/~/heos-control-protocol-%28cli%29>

Protocol PDF mirrors used for command enumeration:

- Sound United / HEOS CLI Protocol Specification v1.16 PDF: <https://rn.dmglobal.com/euheos/HEOS_CLI_ProtocolSpecification_2021.pdf>
- Latest-spec pointer mentioned by the v1.16 PDF: <http://rn.dmglobal.com/euheos/HEOS_CLI_ProtocolSpecification.pdf>
- Community mirror with searchable table of contents: <https://docslib.org/doc/287196/heos-cli-protocol-specification-version-1-16>

Implementation should prefer the latest official Denon/Sound United PDF when it
is available. This repository documents the public CLI API, not private HEOS app
internals.

## Transport

| Property | Value |
|---|---|
| Discovery | UPnP SSDP |
| Control transport | Telnet-style TCP |
| Port | `1255` |
| Command format | `heos://{group}/{command}?key=value&key=value` |
| Command terminator | CRLF, `\r\n` |
| Response format | one JSON object per line |
| Scope | one connection to one HEOS device can control the HEOS system |

Example:

```text
heos://player/get_players\r\n
```

Response shape:

```json
{
  "heos": {
    "command": "player/get_players",
    "result": "success",
    "message": ""
  },
  "payload": []
}
```

## Service support caveat

The CLI does not expose every music service equally. The HEOS CLI spec lists
Spotify as not browseable and not searchable through CLI. Spotify Connect must
be controlled through Spotify's APIs and device model, not through HEOS browse
or queue commands.

## Command families

### System

| HEOS command | Purpose |
|---|---|
| `system/register_for_change_events` | Enable or disable unsolicited events. |
| `system/check_account` | Check HEOS account sign-in state. |
| `system/sign_in` | Sign in to a HEOS account. |
| `system/sign_out` | Sign out of the HEOS account. |
| `system/heart_beat` | Keepalive / health probe. |
| `system/reboot` | Reboot a HEOS speaker. |
| `system/prettify_json_response` | Toggle pretty JSON responses. |

`system/register_for_change_events` is scoped to one TCP connection. Every
consumer that wants events must register on its own socket, and a reconnect
requires registering again before events resume on the new connection.

### Player

| HEOS command | Purpose |
|---|---|
| `player/get_players` | Discover HEOS players. |
| `player/get_player_info` | Read player metadata for one player. |
| `player/get_play_state` | Read play/pause/stop state. |
| `player/set_play_state` | Set play/pause/stop state. |
| `player/get_now_playing_media` | Read current media metadata. |
| `player/get_volume` | Read player volume. |
| `player/set_volume` | Set player volume. |
| `player/volume_up` | Raise player volume. |
| `player/volume_down` | Lower player volume. |
| `player/get_mute` | Read player mute state. |
| `player/set_mute` | Set player mute state. |
| `player/toggle_mute` | Toggle player mute. |
| `player/get_play_mode` | Read repeat/shuffle mode. |
| `player/set_play_mode` | Set repeat/shuffle mode. |
| `player/get_queue` | Read queue items. |
| `player/play_queue` | Play an item from the queue. |
| `player/remove_from_queue` | Remove queue item(s). |
| `player/save_queue` | Save queue as a HEOS playlist. |
| `player/clear_queue` | Clear the queue. |
| `player/move_queue` | Move queue item(s). |
| `player/play_next` | Skip to next track. |
| `player/play_previous` | Skip to previous track. |
| `player/set_quickselect` | Save AVR Quick Select. |
| `player/play_quickselect` | Recall AVR Quick Select. |
| `player/get_quickselects` | Read AVR Quick Select metadata. |
| `player/check_update` | Check for firmware update. |

### Group

| HEOS command | Purpose |
|---|---|
| `group/get_groups` | List active groups. |
| `group/get_group_info` | Read one group. |
| `group/set_group` | Create, update, or dissolve a group. |
| `group/get_group_volume` | Read group volume. |
| `group/set_group_volume` | Set group volume. |
| `group/volume_up` | Raise group volume. |
| `group/volume_down` | Lower group volume. |
| `group/get_group_mute` | Read group mute. |
| `group/set_group_mute` | Set group mute. |
| `group/toggle_group_mute` | Toggle group mute. |

### Browse

| HEOS command | Purpose |
|---|---|
| `browse/get_music_sources` | List music sources. |
| `browse/get_source_info` | Read source metadata. |
| `browse/browse` | Browse a source or container. |
| `browse/browse_source_containers` | Browse source containers. |
| `browse/get_search_criteria` | Read searchable scopes for a source. |
| `browse/search` | Search within a source. |
| `browse/play_stream` | Play a station/stream result. |
| `browse/play_preset` | Play a preset station. |
| `browse/play_input` | Play an input source. |
| `browse/play_url` | Play a URL where supported. |
| `browse/add_to_queue` | Add container or track to queue with options. |
| `browse/get_heos_playlists` | List HEOS playlists. |
| `browse/rename_heos_playlist` | Rename a HEOS playlist. |
| `browse/delete_heos_playlist` | Delete a HEOS playlist. |
| `browse/get_heos_history` | List HEOS history. |
| `browse/retrieve_metadata` | Retrieve album metadata. |
| `browse/get_service_options` | Read service options for now-playing screen. |
| `browse/set_service_option` | Set service option. |

Exact parameter names and source-specific behavior must be taken from the
current HEOS CLI PDF before implementation.

## Events

The bridge should register for change events at startup and parse at least:

| Event command | Meaning |
|---|---|
| `event/player_state_changed` | Player play state changed. |
| `event/player_now_playing_media_changed` | Now-playing media changed. |
| `event/player_now_playing_progress` | Progress update. |
| `event/player_volume_changed` | Player volume changed. |
| `event/player_mute_changed` | Player mute changed. |
| `event/player_queue_changed` | Queue changed. |
| `event/player_play_mode_changed` | Repeat/shuffle changed. |
| `event/groups_changed` | HEOS group topology changed. |
| `event/group_volume_changed` | Group volume changed. |
| `event/group_mute_changed` | Group mute changed. |
| `event/sources_changed` | Music source availability changed. |
| `event/user_changed` | Account/user state changed. |

## Error handling

The HEOS response `heos.result` is commonly `success` or `fail`; some protocol
references and implementations use `ok` for success. Bridges should treat both
`success` and `ok` as success. On `fail`, parse and publish the HEOS message
string and any error code. Do not retry state-changing commands blindly. Some
failures are source-specific, account-specific, or model-specific.

## Relationship to AVR Telnet

For Marantz/Denon AVRs, HEOS playback normally requires the AVR input to be
`NET`. That input is controlled through TCP port 23 (`SI NET`) and should remain
the responsibility of `telnet2mqtt`.

HEOS volume is not the same contract as AVR master volume:

- HEOS player/group volume: `0`-`100`
- AVR master volume: `MV0`-`MV98`, model-dependent dB interpretation
