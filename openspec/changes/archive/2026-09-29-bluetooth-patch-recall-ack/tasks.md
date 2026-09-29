## 1. Decode and wait for recall ACK

- [ ] 1.1 Add a Patone-owned detector for the Bluetooth command-received ACK after a parameter write (unwrapped MIDI equivalent of the reference length-18 BLE “Command received” frame) and verify a fixture/self-check accepts that shape and rejects unrelated notifies
- [ ] 1.2 On Bluetooth `setPatch`, after sending `1143`, defer the first chain-dump request until that ACK arrives or a short timeout elapses; cancel/replace the wait on a newer app recall; verify session checks cover ACK-then-dump and timeout-then-dump without removing confirmation

## 2. Docs and validation

- [ ] 2.1 Note in `docs/protocol-references.md` that Bluetooth app recall waits for the command-received ACK (or timeout) before the preset dump, and that confirmation still follows; verify the note does not paste reference JavaScript
- [ ] 2.2 Run typecheck / device session self-checks and verify they pass without in-browser UI testing
