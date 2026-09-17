## 1. Architecture and references

- [ ] 1.1 Add `docs/protocol-references.md` with the GP-50 Bluetooth, GP-50 USB, GP-5 Bluetooth, and GP-5 USB editor URLs, state they are behavioral/runtime references only, and verify the file names those four links and forbids copying their source or SysEx
- [ ] 1.2 Update `docs/architecture.md` so post-connect patch-identity sync (current index + names) is in scope on USB and Bluetooth, full preset/IR/NAM dumps stay later, third-party copies stay forbidden, and verify the out-of-scope list no longer forbids applying inbound patch identity
- [ ] 1.3 Mirror that in `openspec/config.yaml` context and rules (identity SysEx codec allowed; snapshot apply for patch index/names allowed; still no copied SysEx; USB not duplex for knobs) and verify the file still parses as YAML

## 2. Session snapshot and Controller loading

- [ ] 2.1 Add `sync: "syncing" | "ready"` and `patchNames` (100 optional names) to the connected snapshot, set `syncing` on connect without sending CC 0, drop them on disconnect, and verify `npx tsc -b --pretty false` still typechecks callers
- [ ] 2.2 Show an English loading state on Controller while `sync` is `syncing` (USB and Bluetooth), keep the chrome device label, and verify the patch bar is hidden until `ready` and the disconnected empty state is unchanged

## 3. Identity codec

- [ ] 3.1 Add a device-layer codec that encodes name-list and current-patch requests and decodes name-list fragments, current-patch identity, and later pedal-initiated patch reports from Patone captures (no third-party source drop), and verify USB vs Bluetooth only differ by the existing BLE-MIDI wrap
- [ ] 3.2 Extend the encoder so identity SysEx is sent as raw MIDI on USB and BLE-MIDI-wrapped on Bluetooth, and verify `encodePatch` still returns official CC 0 (wrapped on Bluetooth)

## 4. Sync pipeline

- [ ] 4.1 Parse inbound MIDI for patch identity even when Log capture is off, apply decoded index/names to the snapshot, keep Log append gated on capture, and verify opening Controller does not grow the Log buffer
- [ ] 4.2 After connect, run sequential name-list then current-patch requests with a generation token and per-step timeout (Bluetooth MAY wait longer), skip requests if USB SysEx was denied, and verify connect / timeout / missing index never send CC 0
- [ ] 4.3 On disconnect or a newer connect, abort the in-flight pipeline, and verify a late inbound dump cannot mutate the new snapshot

## 5. Selector

- [ ] 5.1 When `ready`, show the pedal’s current patch if known (else `00` without sending), include names in the 00–99 list when present, keep previous / select / next sending CC 0 through the session, and verify USB and Bluetooth use the same bar
- [ ] 5.2 After `ready`, apply pedal-initiated current-patch reports to the snapshot without sending CC 0, and verify a known name for that index is shown

## 6. Check

- [ ] 6.1 Run `npx tsc -b --pretty false` and fix type errors from this change
