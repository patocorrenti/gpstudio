## Why

`DeviceSession` in `src/device/session.ts` is now one ~2,100-line module: link lifecycle, identity/chain/IR sync, Bluetooth live apply, throttled command-out writes, `.prst` download/upload, working-patch baseline, inbound Log, and import-time fixture asserts. Codecs already live next door (`identity.ts`, `chain-codec.ts`, `encode.ts`, `patch-store.ts`); the remaining class still mixes those jobs. Editor, Library, and later SysEx families will keep landing in the same file unless the session seams are agreed first.

This is Change-lane because it is architecture (where session responsibilities live), not a silent tidy-up. Observable Connect / Controller / Log / MIDI behavior does not change (`docs/architecture.md`). `.openspec.yaml` sets `skip_specs: true`.

## What Changes

- Keep `DeviceSession` as the single public façade. UI still talks only to that class through existing hooks; React never imports session internals or raw MIDI.
- Split the oversized session file along existing private seams (working-patch helpers, live inbound apply, throttled writes, current-patch file I/O, import-time checks). Public names and `@/device/session` stay.
- Write the placement rule: new session families become siblings under `src/device/session/`; do not grow the orchestrator with another inbound/write/file-I/O cluster.
- Document that rule in `docs/architecture.md`, the `context` field of `openspec/config.yaml`, and a Cursor rule so later work follows it without another change.

## Non-goals

- No change to connect, disconnect, USB vs Bluetooth capabilities, patch bar, chain, knobs, Log, Save / rename / duplicate, `.prst` download/upload, or any MIDI/SysEx path (`docs/architecture.md`).
- No second `DeviceSession` per link, no USB vs Bluetooth UI fork, no React calling the new modules.
- No new codecs, no copied JavaScript from `reference/`, no test-runner migration.
- No Editor or Library implementation; those stay stubs until their own changes.
- No work on the paused `stomp-assignment` lab.

## Capabilities

### New Capabilities

- None. Session file layout is not a user-facing capability. Specs stay in `midi-transport`, `device-connection`, `live-controller`, `bluetooth-link`, and `inbound-log`.

### Modified Capabilities

- None. The snapshot, command-out methods, and inbound apply stay the same contract. Implementation moves; requirements do not. `skip_specs: true` in this change's `.openspec.yaml`.

## Impact

- `src/device/session.ts` becomes `src/device/session/` with `DeviceSession` as the orchestrator. Feature imports of `@/device/session` keep working.
- `docs/architecture.md` repo tree and `openspec/config.yaml` context gain the session-folder rule.
- New Cursor rule under `.cursor/rules/` (always-on, like `feature-ui.mdc`).
- No new dependencies, transports, or routes.
