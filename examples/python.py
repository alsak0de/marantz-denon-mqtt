"""
Marantz / Denon AVR — TCP port 23 helpers (Python)

Usage:
    avr = AVR("192.168.1.X")
    state = avr.query()
    avr.send(["PWON"])
    reply = avr.send_wait("MV60", "MV")
"""

import socket
import time
import re
from typing import Optional


DEFAULT_PORT = 23
DEFAULT_TIMEOUT = 3.0       # seconds
INTER_COMMAND_DELAY = 0.1   # seconds between commands in a batch
COLLECT_WINDOW = 0.6        # default seconds to wait for all responses


class AVR:
    def __init__(self, host: str, port: int = DEFAULT_PORT):
        self.host = host
        self.port = port

    def send(self, commands: list[str], collect_s: float = COLLECT_WINDOW) -> list[str]:
        """
        Send one or more commands and collect all responses within collect_s seconds.
        Use for queries, multi-step sequences, and volume ramping.

        Returns a list of trimmed, non-empty response lines.
        """
        lines = []
        buf = b""

        with socket.create_connection((self.host, self.port), timeout=DEFAULT_TIMEOUT) as s:
            for cmd in commands:
                s.sendall((cmd + "\r").encode("ascii"))
                time.sleep(INTER_COMMAND_DELAY)

            s.settimeout(collect_s)
            deadline = time.monotonic() + collect_s
            try:
                while time.monotonic() < deadline:
                    chunk = s.recv(256)
                    if not chunk:
                        break
                    buf += chunk
            except (socket.timeout, TimeoutError):
                pass

        for part in buf.split(b"\r"):
            line = part.decode("ascii", errors="replace").strip()
            if line:
                lines.append(line)

        return lines

    def send_wait(
        self,
        command: str,
        prefix: str,
        timeout: float = DEFAULT_TIMEOUT,
    ) -> str:
        """
        Send one command and return the first response line starting with prefix.
        Use for single commands with a deterministic, prefix-identifiable reply.

        Raises TimeoutError if no matching line arrives within timeout seconds.
        """
        buf = b""

        with socket.create_connection((self.host, self.port), timeout=timeout) as s:
            s.sendall((command + "\r").encode("ascii"))
            s.settimeout(timeout)
            deadline = time.monotonic() + timeout
            try:
                while time.monotonic() < deadline:
                    chunk = s.recv(256)
                    if not chunk:
                        break
                    buf += chunk
                    for part in buf.split(b"\r"):
                        line = part.decode("ascii", errors="replace").strip()
                        if line.startswith(prefix):
                            return line
            except (socket.timeout, TimeoutError):
                pass

        raise TimeoutError(f'No reply with prefix "{prefix}" within {timeout}s')

    def query(self) -> dict:
        """
        Query all primary state fields in one round-trip.

        Returns a dict with keys: power, volume, mute, input, sound_mode,
        speaker_preset, zone2, zone2_volume, zone2_source, zone2_muted.
        """
        lines = self.send(["PW?", "MV?", "MU?", "SI?", "MS?", "SPPR?", "Z2?"], collect_s=0.9)
        return parse_state(lines)


def parse_state(lines: list[str]) -> dict:
    """Parse raw response lines into a state dict."""
    state = {}
    for line in lines:
        if line.startswith("PW"):
            state["power"] = line[2:].lower()
        elif line == "Z2ON":
            state["zone2"] = "on"
        elif line == "Z2OFF":
            state["zone2"] = "off"
        elif line.startswith("Z2MU"):
            state["zone2_muted"] = line == "Z2MUON"
        elif re.match(r"^Z2\d+$", line):
            state["zone2_volume"] = int(line[2:])
        elif line.startswith("Z2"):
            state["zone2_source"] = line[2:]
        elif line.startswith("MU"):
            state["mute"] = line[2:].lower()
        elif line.startswith("SI"):
            state["input"] = line[2:]
        elif line.startswith("MS"):
            state["sound_mode"] = line[2:]
        elif line.startswith("SPPR"):
            state["speaker_preset"] = line[4:].strip()
        elif line.startswith("MVMAX"):
            pass  # ignore ceiling report
        elif line.startswith("MV"):
            raw = line[2:]
            # 3-digit values encode half-dB steps: "555" → "55.5"
            state["volume"] = f"{raw[:2]}.{raw[2]}" if len(raw) == 3 else raw
    return state


# ── Example usage ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import os

    avr = AVR(os.environ.get("AVR_HOST", "192.168.1.X"))

    print("Querying state...")
    state = avr.query()
    for k, v in state.items():
        print(f"  {k}: {v}")

    # Power on and set stereo mode:
    # if state.get("power") != "on":
    #     avr.send_wait("PWON", "PW", timeout=5.0)
    #     time.sleep(4.0)
    # avr.send(["Z2OFF", "SINET", "MSSTEREO", "SPPR 2", "MV50", "PSDYNEQ ON"], collect_s=1.5)
