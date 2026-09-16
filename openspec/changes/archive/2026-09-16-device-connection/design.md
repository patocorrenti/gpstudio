## Context

See `proposal.md` for why. The shell already has a Connect button and an empty dialog (`src/features/connect/ConnectionStatus.tsx`). `src/midi/` and `src/device/` are empty. WebView2 has no Web MIDI, so desktop must use Rust `midir` per `docs/architecture.md`.

## Goals / Non-Goals

**Goals:**

- One `MidiTransport` contract: discover endpoints, open/send/subscribe/close bytes.
- Web MIDI + Tauri/`midir` as USB backends; `kind` is always `usb-midi`.
- `DeviceSession` owns model + connection; React never imports `MIDIPort`.
- Modal flow: list devices → pick → ask model only if unknown → connect → chrome shows the port label.

**Non-Goals:**

- BLE backend or a throwing Bluetooth stub.
- Sending live-controller CCs from this change (maps may exist as data).
- Auto-connecting on launch.

## Decisions

### 1. Fold `midi-transport` into this change

**Choice:** Implement the USB byte pipe here so the modal can actually open a pedal.

**Why:** A Connect UI without `MidiTransport` would be another placeholder. Architecture listed them as consecutive changes; shipping both is the smallest working connection.

**Alternative:** Two sequential OpenSpec changes. Rejected for this request; the user asked for a working connect flow.

### 2. Endpoints, not MIDIPort

**Choice:** Public type is `{ id, label, kind: "usb-midi", suggestedModel? }`. Web and Tauri keep input/output handles internally.

**Why:** BLE later can implement the same shape. DeviceSession must not depend on Web MIDI types.

**Alternative:** Expose `MIDIPort` to the modal. Rejected; that is the frankenstein path.

### 3. Suggest model from label; ask before open if unknown

**Choice:** Match `/gp-?50/i` first, then `/gp-?5(?!0)/i`. If present, connect with that model. If absent, ask GP-5 vs GP-50, then `open()`. USB can open without a model; the session cannot.

**Why:** Matches the agreed UX. Asking after open would leave a connected link with no profile.

**Alternative:** Always ask. Extra friction when the port already says GP-50.

### 4. One open endpoint; chrome label is the port name

**Choice:** Transport allows a single open link. Connected chrome text is `endpoint.label` (the USB name), not a generic "Connected". Modal when connected offers Disconnect.

**Why:** User asked for the device name. Disconnect needs a place to live without a new nav item.

**Alternative:** Show "GP-50" even when the port is named something else. Worse for picking among several MIDI devices.

### 5. Runtime pick: Tauri internals vs Web MIDI

**Choice:** `createMidiTransport()` uses `__TAURI_INTERNALS__` (or `@tauri-apps/api` `isTauri`) to pick `TauriMidiTransport` vs `WebMidiTransport`.

**Why:** WebView2 has no `requestMIDIAccess`.

**Alternative:** User-facing USB vs desktop toggle. Unnecessary.

### 6. Official CC maps live in `src/device/cc.ts` unused by UI

**Choice:** Store the published GP-5/GP-50 CC tables next to the session. Do not send them yet.

**Why:** Session owns profiles now; live-controller should not invent a second map. No SysEx.

## Risks / Trade-offs

- [Web MIDI permission / Firefox] → Clear English error; Chrome/Edge or the desktop app.
- [Port name is not identity] → User can still pick GP-5 vs GP-50 when the label is generic.
- [midir input+output pairing] → Pair by equal port name; endpoint still listed if only output exists (needed to send).
- [Linux host / Windows WinMM names] → Treat label matching as heuristic; verify on the user's Windows box with a real pedal.
- [No in-browser agent test] → `tsc` / lint here; the user tests the modal.

## Migration Plan

Additive. Rollback is reverting the change. No stored session to migrate.

## Open Questions

None. Connected chrome text is the endpoint label; model is asked only when unknown, before open.
