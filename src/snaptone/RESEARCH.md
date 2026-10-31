# SnapTone upload research (VLTN Tone Studio)

Source: local clone of [VLTN Tone Studio](https://github.com/grzmol/VLTN-Tone-Studio) at `9591679ea3c41ec56938ff5af937af6c3ba2bdef` (Merge pull request #33, release/0.8.1). Paths below are in that repo. Line numbers are from that commit.

GP Studio already reads an identity-family Nam name dump and keeps dump indices 56–79 (`src/device/nam-names.ts`). VLTN reads a different table and treats a different range as user slots. This note is the Phase 0 record. It does not add a worker, a wasm binary, or a session writer.

## 1. Slot catalog

VLTN does not use GP Studio's identity-family Nam request (`F0 03 05 … 02 01 02 02 04 F7`). It sends a GP-5-family read.

- Request payload is `[0x12, 0x24]`. Selector `READ.SNAPTONES = 0x24` (`app/src/renderer/src/gp5/lib/protocol.mjs` lines 24–28 and 387–389). `Gp5Session.readSnapTones` is `decodeSlotTable(await this.read(READ.SNAPTONES))` (`app/src/renderer/src/gp5/lib/session.mjs` lines 282–284).
- The reply is kind `0x12`, selector `0x24`, then 80 flag bytes, then 80 names of 16 Latin-1 bytes (`protocol.mjs` `decodeSlotTable`, lines 500–517). A session test expects 80 entries (`app/src/renderer/src/gp5/tests/session.test.mjs` line 26).
- Split, stated on the decoder and on the profile: indices **0–49 factory**, **50–79 user** (30 slots). `protocol.mjs` lines 501–503; `app/src/shared/devices.ts` lines 121–129 (`slots: 80, userRange: [50, 79]`); `app/src/renderer/src/gp5/lib/snaptone.mjs` lines 25–26 (`FIRST_USER_SLOT = 50`, `LAST_USER_SLOT = 79`). The README device table says the same: “SnapTones (NAM) over USB — 30 user slots” for GP-5 and GP-50 (`README.md` line 338).
- fxid of slot `n` is `0x0f000000 | n` (`snaptone.mjs` lines 24 and 129–132; `app/src/renderer/src/gp5/lib/catalog.mjs` lines 35–37 and 42–45). Slot 50 is wire `32 00 00 0f`. Slot 79 is `4f 00 00 0f`.
- Occupancy is a **flag byte**, not a blank name. Comment, marked verified on hardware (`protocol.mjs` lines 501–503): flag `0` = user-loaded content, flag `1` = factory or empty. `decodeSlotTable` (lines 512–515) sets `kind` to `"user"` whenever the flag is 0, before it looks at the name. Empty is the name `"Empty"` (or a User IR pattern) when the flag is not 0. The mock pedal stores unused user slots as `{ name: "Empty", flag: 1 }` and factory slots with flag 1 (`app/src/renderer/src/gp5/lib/mock-device.mjs` lines 96–97).
- The GP-5 model picker treats a user slot as empty only when `slot.name === "Empty"` (`app/src/renderer/src/screens/rig/ModelPicker.tsx` lines 85–87). A test feeds `{ slot: 50, name: "Empty", kind: "user" }` and expects an empty user slot (`ModelPicker.test.ts` lines 40–41). A blank name is not that test.
- Display label is the protocol index, not a 1-based user count: `SnapTone ${slot}` (`devices.ts` lines 244–249). The comment says the pedal's own on-screen numbering is not confirmed.
- GP Studio's window is a different cut of the same 80-wide index. Dump indices 56–79 are VLTN slots 56–79 (still user). Dump indices 50–55 are VLTN user slots whose fxids are `0x0f000032`–`0x0f000037`. GP Studio catalogs those six as factory NS models (`PCCowboys` through `MesaTriMod` in `src/device/catalog/ns.ts`, wires `0x32`–`0x37`). The archived `ns-user-snaptone` design left wires `00`–`37` as factory. VLTN's upload refuses slot 49 and accepts 50–79 (`snaptone.mjs` lines 127 and 156–158; `app/src/renderer/src/gp5/tests/snaptone.test.mjs` line 79).

The identity-family Nam dump has no flag byte (`src/device/nam-names.ts`). It cannot answer occupied-versus-empty. VLTN's `0x24` table can. GP Studio does not need a second name dump if the slot table is read; the existing 56–79 window is not the user list.

## 2. Parsing a `.nam`

Check lives in `app/src/shared/nam.ts`.

- A2 is `architecture === "SlimmableContainer"`, or a bare `WaveNet` whose version starts with `0.7` and whose single layer array uses `LeakyReLU` (`nam.ts` lines 206–213 and 251–257).
- `selectA2` (lines 185–204) requires a NAM version in `0.5`–`0.7` (lines 57–66), a non-empty `config.submodels` list, `max_value` strictly ascending, and the last `max_value` ≥ 1. It returns **the last submodel** (`subs[subs.length - 1]`). A bare WaveNet is used as-is. That matches Suite not calling `SetSlimmableSize` (`a2.ts` lines 1–4; `nam.ts` lines 8–10 and 181–183).
- The chosen WaveNet must match NAM core's A2 shape (`assertA2Shape`, lines 134–168): one layer array, channels 8 (standard) or 3 (nano), the kernel/dilation tables at lines 38–39, `LeakyReLU(0.01)` on every layer, a 16-tap head with bias, no FiLM, no gating. Weight count is `a2WeightCount` (line 171).
- Sample rate, when present, must be 44100, 48000, or 96000 (`SNAPTONE_RATES`, lines 26 and 68–73). Missing rate is rendered at 48000 (`DEFAULT_MODEL_RATE`, line 27).
- A1 is a `WaveNet` that is not A2-shaped: version `0.5.x` as-is, or `0.7.x` reshaped to the `0.5.x` layout (`examine`, lines 215–228). Sizes are standard / lite / feather / nano (`A1_SIZES`, lines 30–35). This change rejects A1; the detector is only so `inspectNam` can say so.
- The file name shown to the user is `metadata.name` when that field is a non-empty string (`app/src/renderer/src/screens/tones/LocalNamDialog.tsx` lines 42–55).

## 3. Conversion pipeline (A2 → SnapTone)

`app/src/renderer/src/snaptone/pipeline.ts` `namToCloneBlob` (lines 135–151), described at lines 1–11. It is a clone fit, not a distillation of A2 into A1.

1. **Excitation.** Channel 0 of Valeton Suite's `nam_input_wav.wav`: 44.1 kHz, 16-bit PCM, at least 70 s (`app/src/shared/host/snaptone.ts` lines 15–17 and 29–45). Resampled to the model rate with the r8brain port inside `htkpa.ts`, then a 24-bit PCM round trip (`pipeline.ts` lines 145–147; `pcmRoundTrip` lines 29–42).
2. **Render.** The last A2 submodel runs in the wasm kernel, prewarmed, in 1024-frame blocks (`a2.ts` lines 38–84). Output is multiplied by `0.31` (`pipeline.ts` lines 19–20 and 122–127).
3. **Clone.** `htkpa.ts` `cloneSnapTone` (lines 2788–2827) is Suite's HTKPA: detrend, delay, amp-curve fit, transfer-function iterations, two impulse responses, then an 8840-byte `VTSI` blob (`buildBlob`, lines 2760–2781). Header comment (lines 1–12): bit-identical to the Suite dylib except last-ulp IR differences.

`convert.ts` then cuts the clone to the upload file (`snapToneFile`, lines 74–79) via `cloneToSnapToneFile` (`snaptone.mjs` lines 80–97): keep the header and the first 2560 bytes of float data, patch sizes, cap the second float array at 512 taps, recompute CRC-16/MODBUS. Result is **2696 bytes** (`FILE_SIZE`, `snaptone.mjs` line 22).

Optional cab-IR convolution (`pipeline.ts` `applyCabIr`, lines 87–99) is marked “Our addition” (lines 6–7). Suite's path has no cab IR. Do not port it.

Measured time in Node, from `convert.ts` lines 23–24: resample about 0.8 s, render about 3.9 s, clone about 7 s. The worker comment says about 10 s (`worker.ts` lines 1–2). `app/README.md` line 79 says about 10–20 s off the UI thread. The clone is the heavy step. It is one CPU-bound worker job, not a background service.

`nam_input_wav.wav` is not in the VLTN repo (`app/README.md` lines 86–87; `shared/host/snaptone.ts` lines 1–4). Published builds ask the user for it or find it in a Valeton Suite install. Do not commit that wav.

## 4. A2 wasm kernel

- Source: `app/src/renderer/src/snaptone/a2kernel.c` (167 lines). Header (lines 1–10): freestanding C, no libc, wasm32 + SIMD128, operation order of NeuralAmpModelerCore `NAM/wavenet/a2_fast.cpp` at commit `baf1bf8`.
- It is **committed** as `a2kernel.wasm`. Size at this commit: **9379 bytes**.
- Rebuild: `npm run build:wasm` in `app/` (`app/package.json` line 19; `a2kernel.c` line 10):

  `clang --target=wasm32 -O3 -msimd128 -nostdlib -Wl,--no-entry -Wl,--export=a2_process -Wl,--export=__heap_base -Wl,--import-memory`

  Needs clang with the wasm32 target. No Emscripten. No second toolchain.
- Host side: `kernel.ts` `loadKernel` instantiates the module with imported memory and calls `a2_process` (`kernel.ts` lines 21–26). `a2.ts` lays the model out in that heap (lines 63–84).
- `a1kernel.wasm` (7546 bytes) is only for A1. This change does not need it.

## 5. USB upload sequence

This is the wire sequence to reimplement in the session. It is not a port of `uploadSnapTone`.

Logical payload (`snaptone.mjs` lines 5–8 and 135–163), command `CMD.IMPORT_SNAPTONE = 0x25` (`protocol.mjs` line 40):

`[0x11, 0x25, nId u32 = 0, fxId u32, name[16], node[16] = 0, fPara f32[8] = 0, file[2696]]`

- Length 2770 bytes. `fxId = 0x0f000000 + slot` with slot in 50–79.
- Name: Suite's SnapTone rule (`sanitizeSnapToneName`, `snaptone.mjs` lines 99–125). Drop `.nam`, keep ASCII letters and digits, cut to **10** characters (`NAME_MAX`). If nothing remains, the stored name is `X`. The wire field is 16 bytes (`NAME_FIELD`); bytes after the name are zero. A test sends `"Lead Ch$"` and reads back `"LeadCh"` (`snaptone.test.mjs` lines 89–94).
- File: the 2696-byte VTSI unit. Magic `"VTSI"`, size fields, type 0 version 0, CRC-16/MODBUS (poly `0xA001`, init `0xFFFF`) over the bytes from offset 12, stored big-endian at offset 8 (`snaptone.mjs` lines 11–14 and 38–77).

Framing (`protocol.mjs` lines 1–10, 21–22, 288–325):

- Split the payload into frames of at most **19** bytes (`FRAME_PAYLOAD_MAX`). 2770 bytes → **146 frames** (`snaptone.test.mjs` lines 70–72). The last frame is 15 bytes (line 77).
- Each frame body is `[crc8, total, index, len, …chunk]`. CRC-8 poly `0x07`, init 0, over the body after the crc byte (`crc8`, lines 288–296).
- On the wire: `F0`, each body byte expanded to high and low nibbles, `F7` (`frameToSysex`, lines 305–316).

Flow (`session.mjs` `uploadSnapTone` lines 521–535 and `#sendFileFrames` lines 552–575):

1. Wait 300 ms, then hold the session exclusively.
2. Send one frame, then wait for an ACK. Accepted ACK: payload kind `0x14` or `0x13`, and the first data byte is 0 (`p[2] === 0`, lines 561–563).
3. A non-zero data byte, or no ACK within **3000 ms** (`snapToneAckTimeoutMs`, `session.mjs` line 49), resends **the same frame**. More than **9** resends aborts (`snapToneResends`, line 50; throw at lines 570–571). The test that injects a rejection is `snaptone.test.mjs` lines 99–121.
4. Outgoing messages stay at least 20 ms apart (`interMessageMs`, line 43).
5. After the last ACK, read `0x24` again. The entry at that slot must have flag 0 and the sanitized name. Up to 3 tries, 500 ms apart (`#verifyTableEntry`, lines 577–585). There is no separate “done” SysEx from the pedal (`session.mjs` lines 537–540 say the same for User IR: no final reply).
6. The write does not select a preset. Preset select is `selectPreset` (lines 313–323), and `uploadSnapTone` does not call it. The test checks the file landed in the slot map and the table, not a program change (`snaptone.test.mjs` lines 82–97).

Factory slots are refused: `isUserSnapToneSlot` throws before any byte is sent (`session.mjs` lines 527–529; test line 87, slot 12).

## 6. Pedal errors

- **NACK:** an ACK whose first data byte is not 0 is a rejection of that frame. The same frame is resent. After 9 resends the upload throws `Gp5Error` code `"verify"` (`session.mjs` lines 561–572).
- **Timeout:** no matching ACK within 3000 ms is the same resend path (`#waitFor` lines 141–147; file-upload timeout line 49). A read of the slot table that never arrives is code `"timeout"` (`#request`, lines 182–191, `readTimeoutMs` 2500, one retry).
- **Verify failure:** the table never shows flag 0 and the expected name (`#verifyTableEntry`, line 584). The slot may be unchanged or half-written; VLTN does not invent the name.
- **Disconnect:** the transport fires `onDisconnect` when the MIDI port state becomes `"disconnected"` (`transport-webmidi.mjs` lines 54 and 81). `close()` sets `#closed` (`session.mjs` lines 240–243). The next `#send` throws code `"closed"` (lines 132–133). In-flight frames stop because send refuses. VLTN does not roll the slot back.
- **Port busy:** the WebMIDI open error tells the user to close Valeton Suite (`transport-webmidi.mjs` lines 71–72). Windows MIDI ports are exclusive (line 3 of that file).

## 7. Transport

USB only.

- README connection row: “WebMIDI with SysEx, straight to the pedal over USB” (`README.md` line 420). SnapTone row: “uploads them over USB” (line 423). Device table header is “SnapTones (NAM) over USB” (line 338).
- The protocol file is titled as the USB-MIDI SysEx codec (`protocol.mjs` line 1). The only transport is `transport-webmidi.mjs`. There is no Bluetooth GATT path and no file-upload command wrapped as GP Studio's BLE-MIDI.
- Nothing in this clone shows the pedal accepting command `0x25` over Bluetooth. Until a capture says otherwise, Bluetooth cannot take the file.

## 8. GP-5 and GP-50

Same SnapTone file and same upload command.

- Both models share `gp5Family`: 80 slots, user range 50–79, NS fxid base `0x0f000000` (`devices.ts` lines 121–136). `snapToneFile` uses `cloneToSnapToneFile` for every non-GP-200 family (`convert.ts` lines 74–79). GP-200's 4744-byte cut is out of scope.
- `uploadSnapTone` does not branch on model (`session.mjs` lines 527–534). The 146-frame count is cited from a Suite capture on a GP-50 (`snaptone.mjs` lines 8–9). The file layout comment says GP-5 (`snaptone.mjs` line 1). One 2696-byte blob for both.
- Differences that do **not** change the blob: preset body length (466 vs 511, `session.mjs` lines 261–263), `.prst` size (507 vs 552, `README.md` line 422), and GP-50-only preset commands (`session.mjs` lines 13–15). None of those run during a SnapTone upload.
- `device` on `convertNamToSnapTone` can be dropped for this change. GP-5 and GP-50 blobs match.

## Decision 1

Two gates tripped. Delta specs for `device-connection` and `live-controller` were updated. Section 2 does not start until that summary is accepted.

- **User slots are not the twenty-four dump indices 56–79.** They are protocol indices **50–79** (thirty). See section 1.
- **A blank name can still hold audio.** Flag 0 means user-loaded content even when the name is blank (`protocol.mjs` lines 503 and 512–515). Empty is the name `"Empty"` with a flag other than 0. A missing name is not the empty test (`ModelPicker.tsx` lines 85–87). The replace ask has to follow the flag, not “no dumped name”.
- **Bluetooth does not accept the file.** Gate not tripped. Section 7.
- **The uploader does not have to be copied.** The sequence in section 5 is enough to write a GP Studio session sibling. Gate not tripped.

## Open questions (not gates)

- The clone needs Valeton's `nam_input_wav.wav`, and VLTN does not ship it (`app/README.md` lines 86–87). GP Studio must not commit a copy taken from a Suite install. Section 3 cannot run a real convert until that excitation exists some other way (a fixture whose license allows it, or a local file the user points at and that stays out of git).
- VLTN's `isEmptySlot` (`app/src/shared/tone3000.ts` lines 167–184) treats `""` as empty, which disagrees with the flag and with the GP-5 model picker. The flag is the one marked verified on hardware. Follow the flag.
- Pedal on-screen numbering for slots 50–79 is unconfirmed (`devices.ts` lines 244–246). Labels in the updated spec use the protocol index (`SnapTone 50` … `SnapTone 79`).
- The excitation wav is present locally at `src/snaptone/fixtures/nam_input_wav.wav` and is gitignored. It is not committed.

## Golden compare

`scripts/snaptone-golden.ts` renders `fixtures/nam_core_a2.nam` (NAM core A2 example) through the ported pipeline and compares the 8840-byte clone to VLTN's `snaptone-a2.clo` at the same commit. The check stays byte-for-byte. It is not loosened.

Run on this machine (about 26 s): both blobs are 8840 bytes. Bytes 0–7 and 10–135 match. Bytes 8–9 are the CRC-16 (`fa 3a` here, `a9 6a` in the VLTN file) and differ because the impulse responses differ. The first payload difference is byte 136 (`BLOB_IR_DATA`, `0x88`). 3298 payload bytes differ. The first IR floats are last-ulp apart, for example `6.065848350524902` versus `6.065850734710693`. That is the same class of difference VLTN's `htkpa.ts` header already describes against Suite's dylib. The import-time check only rejects a truncated buffer so the app does not run this convert on startup.
