## Context

See `proposal.md` for why. `docs/architecture.md` already keeps one `DeviceSession` for USB and Bluetooth; UI never calls raw MIDI. Codecs already sit beside the session (`identity.ts`, `chain-codec.ts`, `encode.ts`, `patch-store.ts`, `ir-names.ts`). What remains in `src/device/session.ts` (~2,100 lines) is the orchestrator plus four private clusters and ~350 lines of import-time asserts. Public callers import `@/device/session` (`DeviceSessionProvider`, Controller). Specs are skipped; observable behavior does not change.

## Goals / Non-Goals

**Goals:**

- Keep one `DeviceSession` façade and the `@/device/session` import path.
- Cut the file along clusters that already exist as private methods.
- Encode the placement rule in architecture docs, agent `context`, and a Cursor rule so later SysEx families do not grow the class.

**Non-Goals:**

- Rewriting inbound routing, sync generation, or patch-confirm into a second state machine.
- A USB session class and a Bluetooth session class.
- Moving codecs, adding a test runner, or changing public method signatures.
- Letting React import session internals.

## Decisions

### 1. Folder `src/device/session/`, not six `session-*.ts` siblings

**Choice:** Replace `src/device/session.ts` with a folder. `@/device/session` keeps resolving (Vite/TS folder index). Public barrel is `index.ts`.

```
src/device/session/
  index.ts            # DeviceSession + today's re-exports; side-effect import of checks
  device-session.ts   # orchestrator class (connect, sync, snapshot, public commands)
  working-patch.ts    # clone / equal / preserve EXP / clamp / baseline compare
  inbound.ts          # Bluetooth live follow (volume, module, order, slot model/control)
  writes.ts           # throttled slot-control and patch volume/BPM queue
  patch-io.ts         # .prst download overlay + upload step encode + pacing gaps
  checks.ts           # existing import-time asserts
```

Do not add `types.ts` unless a cycle appears; snapshot types stay next to `DeviceSession` and are re-exported from `index.ts`.

**Why:** Matches `src/device/catalog/`. A flat `session-writes.ts` next to `session.ts` still invites dumping into the class file. The folder is the seam later features extend.

**Alternative:** Keep `session.ts` and only move tests. Rejected; the class stays ~1,700 lines. **Alternative:** Several collaborating classes that each hold a snapshot copy. Rejected; connect/sync/inbound already share generation, dump, and baseline.

### 2. `DeviceSession` stays the orchestrator

**Choice:** The class keeps:

- discover / connect / disconnect / `linkMode`
- snapshot + log subscribe, inbound capture
- identity / chain / IR request pipeline (`runIdentitySync`, waiters, generation, dump apply, quiet patch confirm)
- public commands (`setPatch`, toggle/reorder/model/control, Save / rename / duplicate, download/upload, volume/BPM)

It delegates to the modules above. It does not become a pass-through wrapper with no logic.

**Why:** Specs and architecture name `DeviceSession` as the only UI-facing device object. Identity dump apply, `pendingPatchLoad`, and patch confirm are one pipeline; splitting them is a behavior rewrite.

**Alternative:** Extract `SessionSync` as its own class. Rejected for this pass; it would still call back into snapshot, dump, and inbound.

### 3. Working-patch helpers are pure

**Choice:** Move `clampPatch`, `wrapPatch`, `preserveExpEnabled`, `chainSlotsEqual`, `cloneChain`, and baseline/modified comparison (`workingDiffersFromBaseline` / `isWorkingModified` math) to `working-patch.ts`. No MIDI.

**Why:** These are already side-effect free and used by dump apply, live follow, and command-out. They are the cheapest split.

### 4. Throttled writes are a queue object, not more methods

**Choice:** `writes.ts` owns the pending maps, timers, last-sent values, and the ~80 ms coalesce. `DeviceSession` constructs one queue and passes `sendBytes`. Slot-control keys and patch volume/BPM keys stay in that module (`CONTROL_WRITE_THROTTLE_MS`, `PATCH_VOLUME_WRITE_KEY`, `PATCH_BPM_WRITE_KEY`). USB vs Bluetooth still only differs by which pipe `sendBytes` uses (`docs/architecture.md`).

**Why:** The queue is stateful and independent of dump decode. Echo-cancel from Bluetooth live volume (`dropPatchWrite`) is a method on this queue, called from inbound apply.

**Alternative:** Leave timers on `DeviceSession`. Rejected; the next knob family would add another map on the class.

### 5. Live inbound apply leaves dump/identity on the class

**Choice:** Move `applyLivePatchVolume`, `applyLiveModule`, `applyLiveChainOrder`, `applyLiveSlot` (and the slot model/control helpers plus CC on/off decode) to `inbound.ts`. Functions take the connected snapshot fields they need and return whether the frame was consumed plus the next chain/volume when `liveFromPedal` applies. USB still consumes-and-ignores those reports. `handleInbound`, `applyIdentity`, `applyChain`, `applyIrNames`, and patch confirm stay on `DeviceSession`.

**Why:** Live follow is already a named cluster (`liveFromPedal`). Dump apply is wired to waiters and generation; moving it would be a protocol change in disguise.

**Alternative:** One `handleInbound` router module that owns all decoders. Rejected; it would drag identity, IR, chain dump, and Log into the same file we are trying to shrink.

### 6. Current-patch file I/O is encode + pace, not a store SET

**Choice:** `patch-io.ts` holds `UPLOAD_*_GAP_MS`, `encodeUploadedPatchWrites` (model / control / order / module / global `1142` or CC 73/74 for BPM 256–260), and dump-word overlay used by download (`writeDumpPatchVolume` / `writeDumpPatchBpm` on the held dump). `uploadCurrentPatch` / `downloadCurrentPatch` / `storePatch` (`114a`) stay methods on `DeviceSession` because they sequence `chainSync`, `sendBytes`, and refresh.

**Why:** The byte plan is pure given chain + volume + BPM + `linkMode`. Pacing and store remain session lifecycle.

### 7. Import-time checks move, they still run on load

**Choice:** Move `assertUploadSessionFixtures`, `assertUploadRejectsWithoutMidi`, `assertUserIrSession`, and their USB/Bluetooth stubs into `checks.ts`. `index.ts` side-effect imports that file so Vite still executes them with the app, same pattern as `encode.ts` / `patch-store.ts`. `checks.ts` imports `DeviceSession` from `./device-session` (not from `index.ts`) to avoid a cycle.

**Why:** ~350 lines of fixtures are not session logic. A real test runner is a later tooling change.

### 8. When to add a sibling (the durable rule)

Extract a new file under `src/device/session/` when at least one is true:

- A new inbound family (live follow, dump apply stays on the class unless it is a distinct decoder pipeline).
- A new throttled command-out family.
- A new current-patch file format or upload step planner.

Do not extract a lone helper, a second session per link, or “just in case” wrappers. UI, Connect, and Controller keep importing `@/device/session` only. Codecs stay in `src/device/*.ts` (`encode.ts`, `chain-codec.ts`, …). A later oversized `device-session.ts` is Direct-lane if this rule does not change.

### 9. Where the rule lives

**Choice:** Three durable places, same text in spirit:

- `docs/architecture.md` — repo tree lists `src/device/session/` instead of a single `session.ts`.
- `openspec/config.yaml` `context` — DeviceSession is the façade; live inbound, throttled writes, and current-patch file I/O are siblings; UI does not import those files.
- `.cursor/rules/device-session.mdc` — `alwaysApply: true`, under ~50 lines, with a good/bad path example (same pattern as `feature-ui.mdc`).

**Why:** Architecture is the agreed plan; `context` is the agent constraint; the Cursor rule fires even when those docs are not open. Do not add a capability spec: folder names are not observable behavior.

## Risks / Trade-offs

- [Move changes MIDI timing or live follow] → Move method bodies as-is; do not retune gaps, throttle, or `liveFromPedal` gates. Typecheck (`npx tsc -b --pretty false`) is the gate; import-time checks must still run.
- [Circular imports] → Class in `device-session.ts`; checks import that file; `index.ts` re-exports and side-effect imports checks.
- [React reaches into `inbound.ts` / `writes.ts`] → Cursor rule + `context`; no public API from those files except what the class needs.
- [Later features ignore the folder] → Same mitigation as split-feature-ui. Adding Editor SysEx to `device-session.ts` is wrong unless it is connect/sync lifecycle.

## Migration Plan

Document the tree and Cursor rule with the code. Move working-patch and checks first (no MIDI). Then writes, patch-io, inbound. Delete `src/device/session.ts` once `index.ts` exists. Rollback is reverting the change; no protocol or data migration.

## Open Questions

None. File list in decision 1 is fixed; apply should not invent extra files.
