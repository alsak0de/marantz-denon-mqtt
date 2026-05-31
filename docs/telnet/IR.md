# Marantz / Denon AVR — IR Blaster Control

Companion to [MARANTZ_DENON_TELNET_PROTOCOL.md](MARANTZ_DENON_TELNET_PROTOCOL.md). This document covers controlling a Marantz or Denon AVR via infrared when TCP port 23 is insufficient or unavailable.

---

## When you need IR

Some receiver functions have **no TCP equivalent**: Quick Select preset recall, certain OSD navigation actions, and a handful of mode buttons only exist as physical remote commands. For these, an IR blaster pointed at the receiver's front-panel sensor is the only programmatic path.

- **Quick Select / Smart Select presets** — one-button recall of a full saved configuration (input + volume + surround mode + EQ). No TCP command exists for recalling these; you can only set the individual parameters separately via TCP.
- **OSD navigation** — menu traversal (Up / Down / Left / Right / Enter / Back) is not exposed over TCP on most models.
- **Buttons without TCP mappings** — ECO mode toggle, Info overlay, Setup menu entry, and some source-direct shortcuts vary by model.
- **Receiver unresponsive on TCP** — the network stack can become unreachable while the IR sensor still works (e.g., after certain crash states). IR can be used to force a clean power cycle.

---

## Hardware options

Any IR blaster with a learning or code-library mode will work. Common choices:

| Device | Interface | Notes |
|---|---|---|
| Broadlink RM4 Pro | Wi-Fi / REST | Widely supported in Home Assistant, openHAB |
| SwitchBot Hub 2 | BLE / Cloud API | Compact; cloud-dependent by default |
| Global Caché iTach / GC-100 | TCP | LAN-native, no cloud, popular in pro installs |
| USB IR Blaster (FLIRC, etc.) | USB HID | Good for always-on servers |

Position the blaster within line-of-sight of the receiver's front IR window (usually bottom-centre of the fascia).

---

## IR code format and portability

IR codes for Marantz/Denon receivers are **not universal**. The same button can produce different raw signals across model families, firmware revisions, and occasionally individual units of the same SKU. Always verify codes against your specific unit before deploying.

The codes below were captured from a Marantz Cinema 70s using a learning blaster. They are provided as a working reference and starting point. The encoding is a **vendor-specific base64 container** wrapping raw IR timing data (pulse/space sequences with 0xFFFF used as a long-gap sentinel). The format is not Pronto and not standard Broadlink — import it as raw learned data into your blaster's interface.

> **Do not treat these as a drop-in for other models.** Re-learn from your own remote if the codes below do not work.

---

## Example codes — Marantz Cinema 70s

```json
{
  "power":        "A60DZQPAAwMGB2UDwAFAE4ABAQYHQAsJBgdlA60D//+tA0AHgANAE0ABQA/AAQ+tAwYHrQNlAwYHZQNlA///QAtAAUAHgBPgBwEBBgfgARsB//9AC0ABQAcDBgdlA0ABQAvgAQEBBgdADwcGB2UDZQP//0ALwANAE0AL4AUBCwYHZQNlAwYHZQNlAw==",
  "mute":         "BXYDdgP3BkABAXYD4AkBgBUN9wb3BnYD//92A3YD9wZAAQF2A+AJAYAVDfcG9wZ2A///dgN2A/cGQAEBdgPgCQEL9wZ2A3YD9wb3BnYD",
  "volume_up":    "Ba4DbgMAB0ABAW4D4AUBBQAHAAduA0AfgAEH//9uA24DAAdAAQFuA+AFAQUABwAHbgPgAQEB//9ANwEAB0ABAW4DwAFAEwduAwAHAAduA+ABAQH//0AXAQAHQAEBbgPgBQEFAAcAB24D4AEBAf//4AcrQA+AAQ8ABwAHbgNuA24DbgNuA24D",
  "volume_down":  "BXIDcgPyBkABAXID4AUBBfIG8gZyA4ABQAkH//+uA3ID8gZAAQFyA+AFAQXyBvIGcgOAAUAJAf//4AcrQA+AAQXyBvIGcgOAAUAJAf//QBsB8gZAAQFyA+AFAQ/yBvIGcgNyA3IDcgPyBnID",
  "setup":        "B/cG9wZ1A3UDgAXAAQ1IEXUD9wb3BnUDdQP3BkABAXUD4AEBgA0J///3BvcGdQN1A4AFwAHgVDsCA3UD",
  "option":       "C/UGdQN1A/UG9QZ1A+ABARFUEXUD9Qb1BnUDdQP1BvUGdQOAAQH1BkABAXUDQAEB//+ACQX1BvUGdQPgAQHgVDsCA3UD",
  "info":         "BW4DbgO4A4ADA/kGbgPgAQEMRBFuA24DuAP5BrgDbuAAAQv5Bm4DbgP5BvkGbgOAAQH//+AJH8ABgEMDbgP5BuAJIwX5BvkGbgOAAQH//8AfQAfgARdAAeAJQ+ABIwX5BvkGbgOAAQX//24DbgNAG0AB4AEXQAHgAUMDbgNuA0AjQAOADQv5BvkGbgNuA24DbgM=",
  "eco":          "BXUDdQP6BkABAXUD4AEBA74UdQOAAQH6BkABAXUDgAEB+gaAAQf//3UDdQP6BkABAXUD4AEB4IQ3Agb6Bg==",
  "up":           "C/sG+wbLA3UD+wZ1A+AFAQX7BvsGdQPgAQEJ///7BvsGdQN1A4AF4AMBBfsG+wZ1A+ABAQn///sG+wZ1A3UDgAXgAwEP+wb7BnUDdQN1A3UDdQN1Aw==",
  "down":         "C/4GdAN0A/4G/gZ0A+AFAQX+Bv4GdAOAAUAJAf//QAUHdAP+Bv4GdAPgBQEF/gb+BnQDgAFACQH//0AFB3QD/gb+BnQD4AUBBf4G/gZ0A4ABQAkB//9AB0A/4G/gZ0A+AFAQ/+Bv4GdAN0A3QDdAP+BnQD",
  "left":         "C/MG8wa0A24D8wZuA+AFAQHzBsABB24D///zBvMG4AMnQAuAAQHzBsABB24D///zBvMGQBsD8wZuA+AFAQvzBvMG8wbzBvMGbgM=",
  "right":        "C/0GdAN0A/0G/QZ0A+AFAQH9BkABE3QDdAP9Bv///QZ0A3QD/Qb9BnQD4AUBAf0GQAETdAN0A/0G///9BnQDdAP9Bv0GdAPgBQEL/Qb9Bv0GdAN0A/0G",
  "enter":        "C+4G7gbWA3YD7gZ2A+AFAQHuBkABAXYDwAEJ///uBu4GdgN2A4AF4AMBAe4GQAEBdgPAAQn//+4G7gZ2A3YDgAXgAwEB7gZAAQF2A8ABCf//7gbuBnYDdgOABeADAQHuBkABCXYDdgN2A3YDdgM=",
  "back":         "C/kGdAN0A/kG+QZ0A+ABAQVREXQD+QZAAQF0A4AB4AMJB/kGdAN0A///gAcF+Qb5BnQD4AEB4JA7AgN0Aw==",
  "channel_up":   "BXIDcgPOA4ADQAEF+Ab4BnIDQAEBQxHACeAFAQH4BoABCXIDcgP//3IDcgNAP8ABBfgG+AZyA0AB4CE/4AMBBfgG+AZyA0AB4Bg/AgNyAw==",
  "channel_down": "CXEDcQP0BvQG3AOABwBxIAcDcQNGEcAJgAEB9AbgAQEXcQNxA///cQNxA/QG9AZxA3ED9Ab0BnEDQAHgGTfgA2cF9Ab0BnEDQAHgFDcCA3ED",
  "play":         "A84DcwNAAUAHQAMD8QbxBkAHCXMDUhFzA3MD8QbAAQFzA+AFAUARA///cwPgBQEF8QbxBnMDQAHgWD8CBnMD",
  "prev":         "B7cDbgP0BvQG4AMHB24DShH0Bm4D4AEBBfQG9AZuA+AFAUARCf//bgNuA/QG9AbAPwFuA0AB4AU/B7cD9Ab0Bm4D4AUBQBEJ//+3A24D9Ab0BuADBwFuA+AFPwduA/QG9AZuA+AFAQP0Bm4D",
  "next":         "BXYDdgPKA+ABAwXvBu8GdgNAAQFHEcAJ4BUBQCUD//92A+AFAQXvBu8GdgNAAeBoRwIGdgM=",
  "movie":        "BXYDdgP0BkABAXYD4AEBAa8UgA8B9AbAAQF2A4ABDfQG9AZ2A///dgN2A/QGQAEBdgPgAQHgTDcCBnYD",
  "music":        "BnIDcgPoA3JgAQP3BnID4AEBAZ8UgA8B9wZAAQFyA4ABAfcGgAEFcgP//3ID4AEBQBHgAQHgUDsCBnID",
  "game_mode":    "C/wGdQN1A/wG/AZ1A+ABAQNVEXUD4A8BGfwG/AZ1A3UD/Ab8Bv///AZ1A3UD/Ab8BnUD4AEB4Fw/Agb8Bg==",
  "pure_direct":  "BWgDaAO+A4ADA/wGaAPgAQEF/Ab8BmgDgAEF/Ab8Bv//wCdABwP8BmgD4AEBBfwG/AZoA4ABBfwG/Ab//0AjwAMD/AZoA+ABAQ/8BvwGaANoA2gDaAP8BvwG",
  "heos":         "BVADUAOnA+ABAwP1BvUGgA8FSBGnA1AD4AcDB/UGUANQA/UGgAEB///gCR8B9QZAEwFQA+BRPwOnA/UGgAED//+nA0AP4AEDA/UG9QZADwFQA+AYfwIG9QY=",
  "aux1":         "Ba0DcgP8BkABAXIDwAEFrQNQEXID4BcBA/wGrQNABQH//4AHQAEAciARAXIDQA8BcgPgJUMFcgNyA/wGQAEBcgPgAQHgJUNAdwH8BkABAXID4AEB4DVDQFMBcgPgIEMCA/wG",
  "phono":        "A7QDYwPAAwP3BmMD4AEBA0kRYwOAEeAJHwH3BsATgAEB//9AD0ABQAcD9wZjA+ABAYBHQBdAA0ABA/cGYwOAAQH3BkATwAMHYwP//2MDYwPADwP3BmMD4AEB4AFHQAFAI+ABHwH3BkAPwAMDYwP//+ABCwVjA/cGYwPgAQHgAUfAI+ABHwH3BsATBbQDYwO0Aw==",
  "smart_select_1": "DgwC3QAQAWkFDALzArQDZSADCBABPQG0A/MCDCABB2UCDAIQAQwCQAcI8wJlAmkFUAQMIAUMZQK0AyYHjAC0A7QDPSAfH60MUARsGfMCbBkQAWkF8wJpBWUCrQxpBbQDJgdiCN0AFUsj8wIMAt0AhQGMAK0MEAFQBIwAJgdAEwexAD0BZwDzAkAvH4wAZQJnAMc2EAGCEN0AbBmFAQoSaQVQBGUCUAStDGIIGAwCghAMAmkFPQHzAj0BPQHdAMc2sQCCEN0gAxUMAoUBsQC0AwwCtANnAN0A8wJpBWUCQA0fghDdAGIIEAGtDBABYghnAGwZDAI9AWcAJgeMAGLEjAAHWX+MAEsj3QA=",
  "smart_select_2": "BbgDcgP2BkABAXID4AEBA1MRcgPgAwEJ9gb2BnIDcgP2BkABgDMH//9yA3ID9gZAAQFyA+ABAeABO0AnC3ID9gb2BnIDcgP2BkABB3IDcgP2Bv//QBsB9gZAAQFyA+ABAeABO4ABCfYG9gZyA3ID9gZAAYAzB///cgNyA/YGQAEBcgPgAQHgFTsHcgNyA/YG//+AQ0ABAXID4AEB4BU7BbgDcgP2Bg==",
  "smart_select_3": "D7sDbQO7A7YCuwNtA/kGbQNAAQm7A7YCbQNKEW0D4AMBCfkG+QZtA20D+QZAAQK7A22gAQH//8ALQAcD+QZtA+ABAeAZQ0AzA20D//9AB8AD4CNDA20DbQNANwdtA///bQNtA0ALQAOAGcAB4BWHA20DbQNAMwNtA///QAdAA0ABgBkBbQOAD+AVQwm7A20DbQNtA20D",
  "smart_select_4": "BXEDcQP6BkABAXED4AEBA0cRcQPgAwEH+gb6BnEDcQPgAwVAAQf//6MDcQP6BkABAXEDQAuAAQFHEeABC0ABCfoG+gZxA3ED+gZAFwP6BnEDgAEB//+AD0ABAXED4AEB4A0/C6MD+gajA3ED+gZxA0AHA3ED//9ABwH6BkABAXEDQAuAAQNHEXED4AMBB/oG+gZxA3ED+gZAFwP6BnEDgAEB//+AD0ABAXED4AEB4ET8DcQNxA4AFQAEH//9xA3ED+gZAAQFxA+ABAeARP0BjA/oGcQOAAQH//4APQAEBcQPgAQHgET8DcQNxA4AFQAEH//9xA3ED+gZAAQFxA+ABAeARP4BvAXEDgAEB//+AD0ABAXED4AEB4BE/DXEDcQP6BnEDcQNxA3ED"
}
```

---

## Key mapping

| Key | Remote button | TCP equivalent |
|---|---|---|
| `power` | Power toggle | `PWON` / `PWSTANDBY` |
| `mute` | Mute toggle | `MUON` / `MUOFF` |
| `volume_up` / `volume_down` | Volume +/− | `MVUP` / `MVDOWN` |
| `movie` | Movie mode shortcut | `SIAUX1` + `MSAUTO` + `SPPR 1` |
| `music` | Music mode shortcut | `SINET` + `MSSTEREO` |
| `game_mode` | Game mode shortcut | `SIGAME` + `MSAUTO` |
| `pure_direct` | Pure Direct shortcut | `MSPURE DIRECT` |
| `heos` | HEOS input shortcut | `SINET` |
| `aux1` | AUX 1 input | `SIAUX1` |
| `phono` | Phono input | `SIPHONO` |
| `smart_select_1`–`4` | Quick Select 1–4 | `MSQUICK1\r` – `MSQUICK4\r` (see note below) |
| `up` / `down` / `left` / `right` / `enter` / `back` | OSD navigation | **No TCP equivalent** |
| `setup` / `option` / `info` / `eco` | Menu / overlay buttons | **No TCP equivalent** |
| `play` / `prev` / `next` | Transport | Partial — HEOS CLI covers these for HEOS sources |
| `channel_up` / `channel_down` | Tuner / channel step | Model-dependent TCP alternative may exist |

> **Quick Select** saves and recalls a complete receiver state: input, volume level, surround mode, and EQ settings together. It is documented in the official Denon protocol as TCP-accessible via the `MS` command family:
>
> | Command | Function |
> |---|---|
> | `MSQUICK1\r` – `MSQUICK5\r` | Recall Quick Select preset 1–5 |
> | `MSQUICK1 MEMORY\r` – `MSQUICK5 MEMORY\r` | Save current state to preset 1–5 |
> | `MSQUICK ?\r` | Query current Quick Select status |
>
> These commands come from the official 2012 protocol PDF and have not yet been verified on modern hardware. Community reports welcome.
>
> **Personal note:** triggering Quick Select via the physical remote while the receiver was under TCP control caused instability in my setup — the unit became temporarily unresponsive to further TCP commands. This may be specific to my unit or configuration; I'm not suggesting it's a general bug. Worth being aware of if you're mixing remote and programmatic control.
