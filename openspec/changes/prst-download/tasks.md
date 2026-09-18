## 1. Architecture and context

- [ ] 1.1 Update `docs/architecture.md` so current-patch download is a Valeton `.prst` for the connected pedal (GP-50 → GP-50 file, GP-5 → GP-5 file), Library import of `.prst` stays later, and verify the out-of-scope list still forbids copied SysEx, IRs/NAM, USB duplex knobs, and cross-model conversion
- [ ] 1.2 Mirror that in `openspec/config.yaml` (current-patch `.prst` export allowed; still no Library import and no copied SysEx), and verify the file still parses as YAML
- [ ] 1.3 Note in `docs/protocol-references.md` the `.prst` layout locked from `_reference/gp50_60-TOB.prst` / `_reference/gp5_60-TOB.prst` (20-byte model header, CRC-8 ATM, `FFFFFFFF`, 10-byte NUL name, model descriptor, dump body), and verify the file still forbids copying `reference/` source

## 2. Encoder

- [ ] 2.1 Replace the Patone `.patch` wrapper in `src/device/patch-store.ts` with a Patone-owned `.prst` encoder (connected-model header + CRC-8 ATM + spacer + NUL name + descriptor + dump body) matching the TOB captures without pasting `reference/` JavaScript, and verify a fixture rebuild of `gp50_60-TOB.prst` / `gp5_60-TOB.prst` matches those files’ headers, checksums, and names
- [ ] 2.2 Filename is `gp50_60-TOB.prst` / `gp5_05-Flow.prst` (model underscore, two-digit slot, hyphen, sanitized name), and verify GP-5 vs GP-50 follow the connected model
- [ ] 2.3 Lock the dump-body slice against a Patone-assembled current-preset dump versus `_reference/gp50_60-TOB.prst`; if they do not overlap, stop and ask before guessing an offset
- [ ] 2.4 Take GP-50 descriptor structure from the capture (not the truncated HTML constant); fill dump-mapped fields when found, otherwise keep capture defaults, and verify the encoder does not emit a GP-5 `.prst` from a GP-50 model (no conversion)

## 3. Session and Controller

- [ ] 3.1 Point `downloadCurrentPatch` at the `.prst` encoder for `snapshot.model`, keep the existing dump re-request and `chainSync` gate, return `null` when the dump is missing or too short, and verify `npx tsc -b --pretty false` typechecks and no extra patch recall is sent solely to download
- [ ] 3.2 Keep Controller `Blob` + `<a download>` with the new filename, no new Tauri command, no conversion dropdown, and verify Controller still sends no raw MIDI

## 4. Check

- [ ] 4.1 Run `npx tsc -b --pretty false` and fix type errors from this change
