## 1. Architecture and context

- [x] 1.1 Update `docs/architecture.md` so Controller marks AMP and CAB as bypassed (prohibition overlay) when NS is on, without rewriting those slots' on/off, and verify the out-of-scope list still forbids IR / SnapTone upload, copied SysEx, and USB duplex knobs
- [x] 1.2 Mirror that in `openspec/config.yaml` context (NS bypasses AMP/CAB visually; do not rewrite AMP/CAB `enabled` when NS toggles) and verify the file still parses as YAML

## 2. Chain helper

- [x] 2.1 Add `chainSlotBypassed` (or equivalent) in `src/device/chain.ts` that is true only for `amp` and `cab` when the NS slot is on, is false for every other id and when NS is missing or off, does not mutate `enabled`, and verify a chain with NS on / AMP on / CAB off / DST on returns true for amp and cab and false for dst and ns
- [x] 2.2 Re-export the helper from `src/device/session.ts` like `chainSlotLabel` and verify Controller can import it from the session module

## 3. Session

- [x] 3.1 Keep `toggleChainSlot` flipping only the requested slot and sending only that module's CC (no AMP/CAB rewrite when NS changes), and verify turning NS on in a snapshot with AMP on and CAB off still leaves AMP on and CAB off

## 4. Controller

- [x] 4.1 When NS is on, overlay AMP and CAB with lucide `Ban` (pointer-events none on the overlay), keep on/off styling from `enabled`, keep the switch toggling through the session, hide the overlay when NS is off, and verify DST never gets the overlay
- [x] 4.2 Use the same overlay on USB and Bluetooth and verify React still does not send raw MIDI

## 5. Check

- [x] 5.1 Run `npx tsc -b --pretty false` and fix type errors from this change
