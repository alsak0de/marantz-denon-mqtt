# Telnet visual test log

Device: Marantz Cinema 70s at `192.168.86.252`.

Date: 2026-05-31.

## Confirmed working

| Command | Result |
|---|---|
| `MUON` | Mute indicator/audio mute confirmed. |
| `MUOFF` | Mute restored. |
| `DIM SEL` | Cycles display dimmer. Observed `DIM DAR`, `DIM OFF`, `DIM BRI`. |
| `MNMEN ON` | Setup menu opened on both TV and AVR UI. |
| `MNMEN OFF` | Setup menu closed. |
| `MVDOWN` | Volume stepped down visibly. |
| `MVUP` | Volume restored visibly. |
| `SPPR 2` | Switched to Speaker Preset 2 and emitted speaker setup dump. |
| `MSSMART1` | Recalled Smart Select 1. AVR reported `SPPR 1`, `MV58`, `MSDOLBY AUDIO-DSUR`, `SSSMG MOV`. |
| `MSSMART2` | Recalled Smart Select 2. AVR reported `SINET`, `MV445`, `MSALL ZONE STEREO`. |
| `MSSMART3` | Recalled Smart Select 3. AVR reported `MSPURE DIRECT`; user confirmed SS3. |
| `MSSMART4` | Recalled Smart Select 4; user confirmed. |
| `MSSTEREO` | Switched to Stereo; user confirmed. |
| `MSMCH STEREO` | Switched to Multi Ch Stereo/all-channel stereo; user confirmed. |
| Remote Music button | Cycles the `SSSMG MUS` mode set on the current source. |
| Remote-selected Dolby Surround | Emitted `MSDOLBY AUDIO-DSUR` and `SYSMI Dolby Surround`; appears source/group-dependent. |
| Remote-selected DTS Neural:X | Emitted `MSNEURAL:X` and `SYSMI DTS Neural:X`; direct alias should use `MSNEURAL:X`. |
| Remote-selected DTS Virtual:X | Emitted `MSVIRTUAL:X`; direct alias should use `MSVIRTUAL:X`. |
| Movie button full cycle | Observed `SSSMG MOV`; available modes: Stereo, Dolby Surround, DTS Neural:X, DTS Virtual:X, Multi Ch Stereo. |
| Music button full cycle | Observed `SSSMG MUS`; available modes: Stereo, Dolby Surround, DTS Neural:X, DTS Virtual:X, Multi Ch Stereo. |
| Game button | Observed `SSSMG GAM`; available modes: Stereo, Dolby Surround, DTS Neural:X, DTS Virtual:X, Multi Ch Stereo. |
| Pure button cycle | Observed `SSSMG PUR`; available modes: Direct, Pure Direct, Stereo. Captured `MSPURE DIRECT` then `MSSTEREO`; `Direct` is advertised as `OPSMLALL PUR160Direct`. |

## Confirmed not useful

| Command | Result |
|---|---|
| `DIM DIM` | No visible change and no reply. |
| `DIM?` | No reply. |
| `MSMULTI CH STEREO` | Did not switch modes; AVR remained in Stereo. Use `MSMCH STEREO` instead. |
| `MSDOLBY SURROUND` | Did not switch modes from the tested context. Use remote-observed `MSDOLBY AUDIO-DSUR`, with group/source caveats. |

## Unsafe or unstable observations

| Command sequence | Observation |
|---|---|
| `MSSMART5` | AVR showed Smart Select 5 briefly even though the remote has no SS5, then switched back to SS4. Treat as unsupported/unstable on Cinema 70s. |
| `MSSMART5` followed by `MSSTEREO` | User reported AVR became temporarily unresponsive, kept changing to SS4, and the TV OSD showed non-standard alphabet characters. Stop further visual testing after this incident until the AVR is confirmed stable. |

Recovery: user power-cycled the AVR off/on and reported it stable again. A
read-only baseline query afterward succeeded and showed `PWON`, `ZMON`, `MUOFF`,
`SIAUX1`, `MSDOLBY AUDIO-DSUR`, and `Z2OFF`.

## Follow-up

- Do not include Smart Select 5 in normal automation for this unit. The MQTT
  bridge rejects structured `smart-select=5`; raw passthrough can still send it
  for manual diagnostics but should not be used here.
- Do not run direct sound-mode tests immediately after the unstable `MSSMART5` behavior.
- Before resuming live tests, wait for user confirmation that the AVR and OSD are stable.
- Prefer read-only queries for the next step, then test one reversible command at a time.
