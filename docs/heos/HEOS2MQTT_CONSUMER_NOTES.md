# heos2mqtt — production-use notes

Companion notes to [`HEOS2MQTT.md`](HEOS2MQTT.md) and [`HEOS_CLI_PROTOCOL.md`](HEOS_CLI_PROTOCOL.md). The protocol doc tells you what HEOS *says*; this document tells you what HEOS *does* in practice — the behaviours that bit real consumers and need to be handled in the bridge or made impossible to misuse.

**Audience:**
- Anyone implementing `heos2mqtt` (the items below are non-negotiable behavioural contracts the bridge has to honour).
- Anyone writing a downstream consumer of the bridge (the items also describe what consumers can assume vs. must verify).

Every item below comes from a real bug fixed in a production deployment of a hand-rolled HEOS poller, not from theory. The bridge will save its users hours each by handling them up front.

Items are ordered roughly by when in the bridge's lifecycle they bite.

---

## 1. State-gate the now-playing publish

**The single biggest landmine in the HEOS CLI.**

`heos://player/get_now_playing_media` returns the *last-played track* even when the player's `play_state` is `pause`, `stop`, or `unknown`. There is no "no current track" sentinel response. A consumer that naively republishes whatever the query returns ends up serving hours-stale "currently playing" data to its own downstream — the broker happily retains a track that hasn't actually been playing since this morning.

**Required behaviour for `heos2mqtt`:**

- Maintain `playState` per pid in process state, populated from:
  - the `get_play_state` query issued during startup, and
  - every subsequent `event/player_state_changed`.
- Only publish `home/heos/player/{pid}/now-playing` with track content when `playState === "play"`.
- When `playState` transitions to `pause`, `stop`, or `unknown`, publish `{}` to `home/heos/player/{pid}/now-playing` so the retained state correctly reads "no track currently playing".
- On startup, query `get_play_state` *before* (or in parallel with) `get_now_playing_media`, and gate the very first publish on the resulting state. This handles the cold-start case where the bridge was restarted while the player was paused.

If the bridge chooses *not* to gate (i.e. publishes whatever HEOS returns), the topic semantics must be documented as "last known track, regardless of play state" — but that is significantly more error-prone for consumers and is not recommended.

---

## 2. Re-register for change events on every reconnect

`heos://system/register_for_change_events?enable=on` is **scoped to the TCP connection**, not to the HEOS device. If the bridge reconnects after a network drop, an AVR reboot, or any other socket event, no events will fire on the new connection until `register_for_change_events` is re-issued.

The trap is that the reconnect *looks* fine: `get_players` works, queries succeed, but `event/player_now_playing_changed` etc. silently never arrive. The bridge appears alive while drifting out of sync with reality.

**Required behaviour:**
- Issue `register_for_change_events?enable=on` as the very first command on every successful socket connect, not just at process startup.

---

## 3. Heartbeat the socket every 30 seconds

HEOS closes idle TCP connections. In our measurements, sockets held open without a heartbeat would be silently closed by the HEOS device after a few minutes of no traffic — manifesting as the same "no events arriving" symptom as forgetting to re-register.

**Required behaviour:**
- Send `heos://system/heart_beat` every 30 seconds while the connection is up.
- Treat any heart-beat error as a reason to tear down and reconnect.

Longer intervals (60s+) have been observed to occasionally drop the connection. 30s is safe.

---

## 4. `sid` is firmware- and region-dependent — do not enrich

The numeric service-ID field (`sid`) returned in now-playing payloads does **not** have a stable mapping across firmware revisions or regional builds. In a single concrete example: on a Marantz Cinema 70s with Spanish-region firmware, `sid=4` is Spotify; the same `sid=4` is reported elsewhere as Pandora. Hardcoding a service-ID → service-name table in the bridge will silently mislabel content for users on different firmware.

The reliable signal for service detection is the `mid` (media ID) string. For Spotify it always starts with `"spotify:track:"`; other streaming services have their own stable prefixes. This holds across firmware because `mid` is the streaming service's own identifier passed through, not a HEOS-internal mapping.

**Required behaviour:**
- Pass `sid` through to MQTT verbatim. Do **not** translate it to a service name in the bridge.
- Pass `mid` through verbatim and document it as the reliable service-detection field.
- If a sid→service table is needed at all (for browse/source enumeration), put it in a separately maintained `SERVICE-IDS.md` reference with explicit firmware/region attribution, and treat it as best-effort only.

This pushes the interpretation responsibility onto consumers, which is correct: consumers know their own deployment and can adjust; the bridge does not.

---

## 5. `type: "station"` does not mean "actual radio"

Spotify Radio (shuffle from a seed track) and similar discovery modes return `type: "station"` in `get_now_playing_media` even though the player is playing individual songs with full track metadata in the `song`, `artist`, and `album` fields. The `station` field will often duplicate the `song` field in this mode.

A bridge that tries to be helpful by emitting "this is a radio station" semantics will mislead consumers who would have shown a track title given the raw payload.

**Required behaviour:**
- Pass `type`, `song`, `station`, `artist`, `album`, `image_url`, `mid`, `sid`, `qid`, `album_id` through verbatim.
- Do not attempt to coalesce `song` vs `station` into a single "title" field in the bridge. Let consumers decide.

---

## 6. MQTT Last-Will-and-Testament for availability

Publishing `home/heos/availability = online` on connect is correct. But publishing `offline` from a `process.on("exit")` or `signal` handler does not catch the cases that matter most — process crash, host power loss, network partition. In those cases the retained `online` stays in the broker as a lie, sometimes indefinitely.

**Required behaviour:**
- Set the `offline` value as the **MQTT Last-Will-and-Testament** when constructing the broker connection. The broker emits it on the consumer's behalf when it detects the bridge's connection has dropped.
- Publish `online` retained on successful broker connect.
- Do not also publish `offline` from a Node `exit` handler — it races with LWT and adds no value.

This is the same pattern documented for `telnet2mqtt`; consumers will assume both bridges behave identically here.

---

## 7. Do not enrich with Spotify Web API (or any other streaming API)

It is tempting to take the `mid` field, recognise it as Spotify, and fetch a 640×640 album cover from the Spotify Web API in canonical size variants. **Don't.**

That enrichment belongs in downstream consumers, not in the bridge. Adding it pulls a heavyweight concern into the bridge:
- Different authentication (OAuth Client Credentials)
- Different rate limits
- Different failure modes (Spotify API outage now affects HEOS bridge availability)
- Different secrets management (Spotify keys are not HEOS keys)
- Different upgrade cadence

The bridge's job is to be a faithful, low-latency MQTT representation of HEOS. The `image_url` HEOS provides is good enough for many consumers and is the right primitive to expose. Consumers that want canonical Spotify cover variants can do the lookup themselves; consumers that don't, don't pay the cost.

**Required behaviour:**
- Pass `image_url` from `get_now_playing_media` through to `home/heos/player/{pid}/now-playing` unchanged.
- Do not call any external streaming-service API from the bridge.

---

## 8. Player identification by friendly name

Most real setups have two kinds of HEOS player:
- A built-in HEOS engine inside an AVR/receiver (usually one of these per household)
- Zero or more standalone HEOS speakers (Marantz HEOS series, Denon Home, etc.)

Each has a user-assigned name set during HEOS app setup — "Living Room", "Basement", "Kitchen", and so on. Consumers typically want to address a specific player without parsing the players list themselves.

**Recommended behaviour:**

Provide an optional env var `HEOS_AUTOFOCUS_PLAYER_NAME`. If set, the bridge looks up the matching player at startup, remembers its pid for the process lifetime, and additionally publishes the player's data under a friendly alias subtree:

```
home/heos/player/{pid}/now-playing         (always — primary, source of truth)
home/heos/main/now-playing                 (alias — only if HEOS_AUTOFOCUS_PLAYER_NAME matched)
```

The alias copies the same payloads on the same events. Consumers that want to write `home/heos/main/now-playing` rather than `home/heos/player/1559043858/now-playing` get a cleaner subscription path that survives pid changes (which can happen on factory resets, network rejoins, etc.).

This is optional — the `home/heos/players` JSON list is enough for consumers that prefer to look up the pid themselves. But the friendly-name convention is well-precedented (zigbee2mqtt does the same for device friendly names) and reduces the failure modes substantially.

---

## 9. Title truncation is an upstream limitation

HEOS itself truncates long track titles at the AVR firmware layer — observed in production with classical-music titles like *"Saint-Saëns / Transcr. Vidal: Le carnaval des animaux: XIII. L"* arriving cut mid-word. The bridge sees what HEOS sees; there is nothing the bridge can do to recover the missing bytes.

**Required behaviour:**
- Pass titles through verbatim, including the truncation.
- Document the upstream truncation behaviour in the bridge's README so consumers know not to expect recovery.

Do not attempt any heuristic "complete the truncated title" logic. There is no good algorithm and silent misattribution is worse than a visible cut.

---

## 10. Mirror `telnet2mqtt`'s conventions exactly

A consumer subscribing to both bridges should feel like they're using one tool, not two. For ergonomics:

| Convention | Match |
|---|---|
| Env var names | `MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `MQTT_BASE_TOPIC` (`MQTT_HEOS_BASE_TOPIC` for heos), `MQTT_IGNORE_RETAINED_COMMANDS`, `LOG_LEVEL` |
| Retain semantics | State retained, commands non-retained, events non-retained, raw firehose non-retained |
| Availability LWT | `home/heos/availability` = `online` / `offline` via LWT |
| Raw firehose | `home/heos/event/raw` carries every HEOS message as JSON for debugging |
| Raw escape hatch | `home/heos/cmd/raw` and `home/heos/cmd/raw-batch` for power users |
| Startup behaviour | Query a known-good initial state batch, publish, then idle waiting for events |
| Logging | Same verbosity options and structure |

The two bridges should be drop-in installable in the same compose file and operate visibly the same way.

---

## 11. Per-connection event scope — document the trap

Item 2 above is a behavioural requirement for the bridge. It is also a trap for anyone running a second HEOS CLI connection alongside `heos2mqtt` — for example, the official Denon HEOS mobile app, or another homebrew tool.

**Recommendation:** add a note to `HEOS_CLI_PROTOCOL.md` (the protocol reference, not just the bridge doc) clarifying that `register_for_change_events` is per-connection and that two simultaneous consumers each need to register independently. Otherwise the next person reverse-engineering HEOS spends an evening debugging missing events from their second client.

---

## 12. Success result spelling varies

The protocol examples commonly show `heos.result` as `ok`, but a Marantz Cinema
70s on firmware `3.88.614` returned `success` for
`system/register_for_change_events` and `player/get_players` during live
testing. A strict `result === "ok"` implementation silently treats valid
responses as non-success and never publishes startup state.

**Required behaviour:**
- Treat both `success` and `ok` as successful HEOS responses.
- Treat `fail` and any unknown result as an error path and publish
  `home/heos/event/error`.

**Verification:**
- Run `heos://player/get_players` against a real device and confirm the bridge
  publishes `home/heos/players` whether the device returns `success` or `ok`.

---

## What the bridge should NOT do

Restating the negative side of several items above, for clarity:

- **No service-ID-to-name translation.** Pass `sid` through.
- **No external API calls.** No Spotify Web API, no TMDB, no anything. Bridge is HEOS-only.
- **No title coalescing.** Pass `type`, `song`, `station` through. Consumers decide.
- **No title heuristic completion.** Truncation is upstream-final.
- **No retained command messages on startup.** Honour `MQTT_IGNORE_RETAINED_COMMANDS` (matches `telnet2mqtt`).
- **No silent reconnect.** Always re-register events on reconnect.

---

## Verification checklist for the bridge implementer

A bridge that handles the items above should pass all the following acceptance tests:

1. Start the bridge while the AVR is in `pause` state with a track loaded → `home/heos/player/{pid}/now-playing` reads `{}` retained, not the stale paused track.
2. Pause a playing track via the HEOS app → the now-playing topic transitions to `{}` within one HEOS event round-trip.
3. Resume → the now-playing topic populates with current track.
4. Disconnect the bridge's network for 30 seconds, then reconnect → events resume working without process restart. `home/heos/availability` does not transiently flap.
5. Kill the bridge process with `SIGKILL` (no graceful shutdown) → `home/heos/availability` becomes `offline` via LWT within the broker's keepalive timeout.
6. Issue an `event/player_now_playing_changed` while the player is paused → bridge re-queries `get_now_playing_media`, sees `playState === "pause"`, does NOT publish stale track content.
7. Spin up two instances of the bridge against the same HEOS device → both receive events independently.
8. Subscribe to `home/heos/event/raw` → every raw HEOS message arrives as JSON. Useful for debugging consumers and protocol exploration.
9. Bridge runs continuously for 24+ hours → no socket drops, no event loss, heartbeat traffic is logged at debug level.
10. Bridge restarts → all previously retained state is re-asserted within the startup sequence, no stale state from a previous deployment.

If all ten pass, the bridge meets the production bar that the predecessor `heos-poller` reached only after each of these bugs was filed and fixed one at a time. Anyone deploying this bridge into a new household gets the corrected behaviour from day one.
