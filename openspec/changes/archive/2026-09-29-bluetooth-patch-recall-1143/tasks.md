## 1. Encode Bluetooth recall as SET 1143

- [x] 1.1 Add a Patone-owned packed SET encoder for family `1143` (`01 00 06 11 43` + patch 0–99 + `00 00 00`, CRC-8 ATM + nibble-expand + `F0`…`F7`) beside the other parameter-write helpers, and verify a self-check or unit assertion matches expected bytes for a known patch (e.g. 5 / 42)
- [x] 1.2 Change `encodePatch` so Bluetooth returns that SET wrapped with `encodeLinkMidi`, USB still returns official CC 0 (`B0 00 patch`), and verify encode self-checks distinguish the two frames

## 2. Session checks and docs

- [x] 2.1 Update session/encode checks that treat Bluetooth patch recall as CC 0 (e.g. `isPatchRecall` / fixtures for `setPatch`) so Bluetooth expect `1143` and USB still expect CC 0; verify the relevant check harness passes
- [x] 2.2 Note in `docs/protocol-references.md` (and architecture / OpenSpec context only if those still claim Bluetooth recall is CC 0) that Bluetooth app→pedal recall is SET `1143`, USB stays CC 0; verify the note is present and does not paste reference JavaScript

## 3. Validation

- [x] 3.1 Run typecheck / existing device encode-session checks and verify they pass without requiring in-browser UI testing
