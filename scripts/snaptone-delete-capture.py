#!/usr/bin/env python3
"""Capture Valeton Suite's SnapTone delete without guessing the payload.

Windows MIDI has no tap on another program's writes to the pedal. Suite's
MIDI out has to be the virtual port, and this process forwards that to the
GP-5. loopMIDI (https://www.tobias-erichsen.de/software/loopmidi.html)
provides that port. Bytes this process just wrote are dropped when they
loop back, so a "suite->pedal" line is Suite's output and a "pedal->suite"
line is the pedal.

Windows setup:

1. Close Valeton Suite and GP Studio so the pedal port is free.
2. In loopMIDI, create a port named "GP Capture" (the "+" button).
3. From this folder:

     powershell -ExecutionPolicy Bypass -File .\\snaptone-delete-capture.ps1 --list
     powershell -ExecutionPolicy Bypass -File .\\snaptone-delete-capture.ps1 --bridge

4. Open Suite. Set its MIDI in and out to "GP Capture", not the pedal.
5. Delete one user SnapTone (protocol slot 50-79) whose name is not blank.
   Write down the slot number and the name. The script prints DELETE when
   it sees command 0x26. Leave the window open and keep the log file.

The script only forwards bytes Suite already sends. It does not invent a
delete message.

  py -3 snaptone-delete-capture.py --self-test
  py -3 snaptone-delete-capture.py --decode capture.log
"""

from __future__ import annotations

import argparse
import queue
import sys
import time
from pathlib import Path

FRAME_CHUNK_MAX = 19
USER_SLOT_FIRST = 50
USER_SLOT_LAST = 79
FX_ID_BASE = 0x0F000000
LOG_NAME = "snaptone-delete-capture.log"


def crc8_atm(data: bytes) -> int:
    """CRC-8 ATM, poly 0x07, init 0. Same polynomial as the upload frames."""
    crc = 0
    for byte in data:
        crc ^= byte
        for _ in range(8):
            if crc & 0x80:
                crc = ((crc << 1) ^ 0x07) & 0xFF
            else:
                crc = (crc << 1) & 0xFF
    return crc


def nibble_expand(packed: bytes) -> bytes:
    body = bytearray()
    for byte in packed:
        body.append((byte >> 4) & 0x0F)
        body.append(byte & 0x0F)
    return bytes([0xF0, *body, 0xF7])


def collapse_nibbles(midi: bytes) -> bytes | None:
    """Undo nibble-expand. Returns None when the SysEx is not nibble pairs."""
    if len(midi) < 2 or midi[0] != 0xF0 or midi[-1] != 0xF7:
        return None
    body = midi[1:-1]
    if len(body) < 2 or len(body) % 2 != 0:
        return None
    if any(byte > 0x0F for byte in body):
        return None
    packed = bytearray()
    for index in range(0, len(body), 2):
        packed.append((body[index] << 4) | body[index + 1])
    return bytes(packed)


def frame_payload(payload: bytes) -> list[bytes]:
    """Split a logical payload the way the file upload does."""
    chunks = [
        payload[offset : offset + FRAME_CHUNK_MAX]
        for offset in range(0, len(payload), FRAME_CHUNK_MAX)
    ] or [b""]
    frames: list[bytes] = []
    total = len(chunks) & 0xFF
    for index, chunk in enumerate(chunks):
        body = bytes([total, index & 0xFF, len(chunk) & 0xFF]) + chunk
        frames.append(bytes([crc8_atm(body)]) + body)
    return frames


def parse_frame(packed: bytes) -> tuple[bool, int, int, bytes] | None:
    if len(packed) < 4:
        return None
    length = packed[3]
    chunk = packed[4 : 4 + length]
    if len(chunk) != length:
        return None
    covered = packed[1 : 4 + length]
    return crc8_atm(covered) == packed[0], packed[1], packed[2], chunk


def hex_bytes(data: bytes) -> str:
    return " ".join(f"{byte:02X}" for byte in data)


class EchoGate:
    """Drop a message that is the copy of bytes this process just sent."""

    def __init__(self, window_s: float = 0.5) -> None:
        self._window_s = window_s
        self._sent: list[tuple[float, bytes]] = []

    def remember(self, message: bytes, now: float | None = None) -> None:
        stamp = time.monotonic() if now is None else now
        self._sent.append((stamp, message))
        self._sent = [(sent_at, body) for sent_at, body in self._sent if stamp - sent_at < self._window_s]

    def take(self, message: bytes, now: float | None = None) -> bool:
        stamp = time.monotonic() if now is None else now
        for index, (sent_at, body) in enumerate(self._sent):
            if stamp - sent_at < self._window_s and body == message:
                del self._sent[index]
                return True
        return False


class Assembler:
    """Join frames that share one total count, in index order."""

    def __init__(self) -> None:
        self._total: int | None = None
        self._chunks: dict[int, bytes] = {}

    def push(self, total: int, index: int, chunk: bytes) -> bytes | None:
        if index == 0 or self._total != total or index != len(self._chunks):
            self._total = total
            self._chunks = {}
        self._chunks[index] = chunk
        if self._total is None or len(self._chunks) != self._total:
            return None
        if any(i not in self._chunks for i in range(self._total)):
            return None
        payload = b"".join(self._chunks[i] for i in range(self._total))
        self._total = None
        self._chunks = {}
        return payload


def describe_delete(payload: bytes) -> str:
    """Say what the 4-byte word and the following bytes look like."""
    lines = [f"DELETE command 0x26, logical length {len(payload)}"]
    lines.append(f"  payload {hex_bytes(payload)}")
    if len(payload) < 6:
        lines.append("  shorter than a 4-byte id; keep the raw log")
        return "\n".join(lines)
    word = int.from_bytes(payload[2:6], "little")
    low = word & 0xFF
    if (word & 0xFFFFFF00) == FX_ID_BASE and USER_SLOT_FIRST <= low <= USER_SLOT_LAST:
        ident = f"fxId for protocol slot {low} (0x{word:08X})"
    elif USER_SLOT_FIRST <= word <= USER_SLOT_LAST:
        ident = f"raw protocol slot {word} (0x{word:08X})"
    else:
        ident = f"u32 0x{word:08X}, not a user slot and not 0x0F000000+slot"
    lines.append(f"  id {ident}")
    rest = payload[6:]
    if not rest:
        lines.append("  no bytes after the id")
        return "\n".join(lines)
    if all(byte == 0 for byte in rest):
        shown = f"{len(rest)} zero bytes"
    else:
        text = rest.split(b"\x00", 1)[0].decode("latin-1", errors="replace")
        shown = f"{len(rest)} bytes, latin-1 {text!r}"
    lines.append(f"  tail {shown}")
    lines.append(f"  tail hex {hex_bytes(rest)}")
    return "\n".join(lines)


def describe_payload(payload: bytes) -> str | None:
    if len(payload) < 2:
        return None
    kind, command = payload[0], payload[1]
    if kind == 0x11 and command == 0x26:
        return describe_delete(payload)
    if kind == 0x11 and command == 0x25:
        return f"import SnapTone command 0x25, {len(payload)} bytes (bridge is forwarding)"
    if kind == 0x12 and command == 0x24:
        return f"SnapTone table read 0x24, {len(payload)} bytes"
    if kind == 0x11 and command == 0x27:
        return f"rename SnapTone command 0x27, {len(payload)} bytes\n  payload {hex_bytes(payload[:64])}"
    return None


def sysex_messages(blob: bytes) -> list[bytes]:
    messages: list[bytes] = []
    start: int | None = None
    for index, byte in enumerate(blob):
        if byte == 0xF0:
            start = index
        elif byte == 0xF7 and start is not None:
            messages.append(blob[start : index + 1])
            start = None
    return messages


def iter_logged_sysex(text: str) -> list[tuple[str, bytes]]:
    found: list[tuple[str, bytes]] = []
    for line in text.splitlines():
        marker = " F0 "
        pos = line.find(marker)
        if pos < 0:
            continue
        direction = "suite->pedal" if "suite->pedal" in line else "pedal->suite"
        raw = bytes(int(part, 16) for part in line[pos + 1 :].split())
        for message in sysex_messages(raw):
            found.append((direction, message))
    return found


def report_sysex(direction: str, message: bytes, assemblers: dict[str, Assembler]) -> str | None:
    if direction != "suite->pedal":
        return None
    packed = collapse_nibbles(message)
    if packed is None:
        return None
    parsed = parse_frame(packed)
    if parsed is None:
        return None
    ok, total, index, chunk = parsed
    if not ok:
        return f"frame CRC mismatch, collapsed {hex_bytes(packed)}"
    payload = assemblers.setdefault(direction, Assembler()).push(total, index, chunk)
    if payload is None:
        return f"frame {index + 1}/{total}, {len(chunk)} bytes"
    return describe_payload(payload)


def load_rtmidi():
    try:
        import rtmidi
    except ImportError:
        print("Install the MIDI backend, then run this again:", file=sys.stderr)
        print("  py -3 -m pip install python-rtmidi", file=sys.stderr)
        raise SystemExit(1) from None
    return rtmidi


def port_index(ports: list[str], name: str) -> int:
    needle = name.casefold()
    matches = [index for index, port in enumerate(ports) if needle in port.casefold()]
    if len(matches) == 1:
        return matches[0]
    print(f"Port {name!r} matched {len(matches)} names:", file=sys.stderr)
    for port in ports:
        print(f"  {port}", file=sys.stderr)
    raise SystemExit(1)


def list_ports() -> None:
    rtmidi = load_rtmidi()
    midi_in = rtmidi.MidiIn()
    midi_out = rtmidi.MidiOut()
    print("Inputs:")
    for name in midi_in.get_ports():
        print(f"  {name}")
    print("Outputs:")
    for name in midi_out.get_ports():
        print(f"  {name}")
    del midi_in, midi_out


def bridge(virtual: str, pedal: str | None, log_path: Path) -> None:
    rtmidi = load_rtmidi()
    probe_in = rtmidi.MidiIn()
    probe_out = rtmidi.MidiOut()
    inputs = list(probe_in.get_ports())
    outputs = list(probe_out.get_ports())
    del probe_in, probe_out

    virtual_in = port_index(inputs, virtual)
    virtual_out = port_index(outputs, virtual)
    virtual_name = inputs[virtual_in].casefold()

    def leftover(ports: list[str], skip: int) -> list[int]:
        return [index for index in range(len(ports)) if virtual_name not in ports[index].casefold() and index != skip]

    if pedal:
        pedal_in = port_index(inputs, pedal)
        pedal_out = port_index(outputs, pedal)
    else:
        in_left = leftover(inputs, virtual_in)
        out_left = leftover(outputs, virtual_out)
        if len(in_left) != 1 or len(out_left) != 1:
            print("More than one pedal port is open. Pass --pedal with part of its name.", file=sys.stderr)
            print("Inputs:", file=sys.stderr)
            for name in inputs:
                print(f"  {name}", file=sys.stderr)
            print("Outputs:", file=sys.stderr)
            for name in outputs:
                print(f"  {name}", file=sys.stderr)
            raise SystemExit(1)
        pedal_in = in_left[0]
        pedal_out = out_left[0]

    suite_in = rtmidi.MidiIn()
    suite_out = rtmidi.MidiOut()
    pedal_midi_in = rtmidi.MidiIn()
    pedal_midi_out = rtmidi.MidiOut()
    try:
        pedal_midi_in.open_port(pedal_in)
        pedal_midi_out.open_port(pedal_out)
    except (RuntimeError, SystemError) as error:
        print(f"Could not open the pedal ({error}). Close Suite and GP Studio, then retry.", file=sys.stderr)
        raise SystemExit(1) from None
    suite_in.open_port(virtual_in)
    suite_out.open_port(virtual_out)
    for midi_in in (suite_in, pedal_midi_in):
        midi_in.ignore_types(sysex=False, timing=False, active_sense=False)

    events: queue.Queue[tuple[str, bytes]] = queue.Queue()

    def on_suite(event, _data) -> None:
        message, _delta = event
        events.put(("suite->pedal", bytes(message)))

    def on_pedal(event, _data) -> None:
        message, _delta = event
        events.put(("pedal->suite", bytes(message)))

    suite_in.set_callback(on_suite)
    pedal_midi_in.set_callback(on_pedal)

    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_file = log_path.open("a", encoding="utf-8")
    assemblers: dict[str, Assembler] = {}
    to_suite = EchoGate()
    to_pedal = EchoGate()
    print(f"Pedal in:  {inputs[pedal_in]}")
    print(f"Pedal out: {outputs[pedal_out]}")
    print(f"Suite port: {inputs[virtual_in]}")
    print(f"Log: {log_path}")
    print("Suite MIDI out must be this virtual port, not the GP-5.")
    print("Bytes written straight to the pedal are invisible here.")
    print("suite->pedal is Suite. pedal->suite is the pedal.")
    print("Ctrl+C stops the bridge.")
    try:
        while True:
            try:
                direction, message = events.get(timeout=0.5)
            except queue.Empty:
                continue
            if direction == "pedal->suite" and to_pedal.take(message):
                continue
            if direction == "suite->pedal" and to_suite.take(message):
                continue
            stamp = time.strftime("%H:%M:%S")
            text = f"{stamp} {direction} {hex_bytes(message)}"
            print(text)
            log_file.write(text + "\n")
            note = report_sysex(direction, message, assemblers)
            if note:
                print(note)
                log_file.write(note + "\n")
            log_file.flush()
            if direction == "suite->pedal":
                pedal_midi_out.send_message(message)
                to_pedal.remember(message)
            else:
                suite_out.send_message(message)
                to_suite.remember(message)
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        log_file.close()
        for midi in (suite_in, suite_out, pedal_midi_in, pedal_midi_out):
            midi.close_port()


def decode_log(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    assemblers: dict[str, Assembler] = {}
    saw_delete = False
    for direction, message in iter_logged_sysex(text):
        note = report_sysex(direction, message, assemblers)
        if note:
            print(note)
        if note and note.startswith("DELETE"):
            saw_delete = True
    if not saw_delete:
        print("No command 0x26 in that log.")


def self_test() -> None:
    name = b"ABC" + bytes(13)
    fx_payload = bytes([0x11, 0x26]) + (FX_ID_BASE + 50).to_bytes(4, "little") + name
    raw_payload = bytes([0x11, 0x26]) + (50).to_bytes(4, "little") + bytes(16)
    for payload in (fx_payload, raw_payload):
        wire = b"".join(nibble_expand(frame) for frame in frame_payload(payload))
        assemblers: dict[str, Assembler] = {}
        notes: list[str] = []
        for message in sysex_messages(wire):
            note = report_sysex("suite->pedal", message, assemblers)
            if note:
                notes.append(note)
        joined = "\n".join(notes)
        if "DELETE command 0x26" not in joined or f"logical length {len(payload)}" not in joined:
            raise SystemExit(f"self-test did not reassemble {hex_bytes(payload)}")
        if payload is fx_payload and "fxId for protocol slot 50" not in joined:
            raise SystemExit(joined)
        if payload is raw_payload and "raw protocol slot 50" not in joined:
            raise SystemExit(joined)
        if payload is raw_payload and "16 zero bytes" not in joined:
            raise SystemExit(joined)
        if payload is fx_payload and "'ABC'" not in joined:
            raise SystemExit(joined)
    logged = "12:00:00 suite->pedal " + hex_bytes(nibble_expand(frame_payload(fx_payload)[0]))
    again = iter_logged_sysex(logged + "\n")
    if len(again) != 1 or again[0][0] != "suite->pedal":
        raise SystemExit("log parser failed")
    gate = EchoGate(window_s=0.5)
    gate.remember(b"\xf0\x00\xf7", now=10.0)
    if not gate.take(b"\xf0\x00\xf7", now=10.2):
        raise SystemExit("echo gate missed its own write")
    if gate.take(b"\xf0\x00\xf7", now=10.3):
        raise SystemExit("echo gate dropped a second copy")
    gate.remember(b"\xf0\x01\xf7", now=10.0)
    if gate.take(b"\xf0\x01\xf7", now=10.6):
        raise SystemExit("echo gate kept a stale write")
    print("self-test ok")


def main() -> None:
    parser = argparse.ArgumentParser(description="Forward Suite MIDI and log a SnapTone delete.")
    parser.add_argument("--list", action="store_true", help="print MIDI port names and exit")
    parser.add_argument("--bridge", action="store_true", help="forward the virtual port to the pedal")
    parser.add_argument("--virtual", default="GP Capture", help="loopMIDI port Suite will use")
    parser.add_argument("--pedal", help="part of the pedal port name; default is the only other port")
    parser.add_argument("--log", type=Path, default=Path(LOG_NAME), help="append hex lines here")
    parser.add_argument("--decode", type=Path, help="read a log this script already wrote")
    parser.add_argument("--self-test", action="store_true", help="round-trip a sample delete frame")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    if args.decode:
        decode_log(args.decode)
        return
    if args.list:
        list_ports()
        return
    if args.bridge:
        bridge(args.virtual, args.pedal, args.log)
        return
    parser.print_help()


if __name__ == "__main__":
    main()
