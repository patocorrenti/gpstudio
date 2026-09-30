## 1. Codec and session path

- [x] 1.1 Confirm GP-5 Bluetooth and USB globals classify/decode against `_reference/GP5bluetooth.html` / `_reference/gp5usb.html` offsets; relax apply so an unused or out-of-range volume byte does not block Settings rows, and verify `assertGlobalsCodec` (or equivalent) still passes for GP-5 fixtures
- [x] 1.2 Trace connect → post-chain globals ask → `GlobalsDumpDecoder` → snapshot on a GP-5 USB and Bluetooth session path; fix any classify/apply/ask gap so a fixture dump fills input / No CAB / REC / BT / monitor / foot (and screen when present), verified by a session check or scripted push
- [x] 1.3 Confirm GP-5 Global settings writes (levels, No CAB, screen brightness, footswitch `1115`) encode the reference effect/flag pairs and leave the patch unmodified; verify no CC 1 / CC 28 and no Global-settings write for global volume

## 2. Modal

- [x] 2.1 Remove Master / Global volume from `Gp5GlobalSettingsForm` so the modal matches reference Settings rows only, and verify TypeScript build (`npm run build` or `tsc -b`) succeeds
- [x] 2.2 Keep GP-50 master volume first and unchanged; verify the modal still branches on `globals.model`

## 3. Docs lock-in (ready for archive)

- [x] 3.1 Update `openspec/config.yaml` context bullets that still say GP-5 Global settings lists Global volume first, and align the short globals notes in `docs/protocol-references.md` / `docs/architecture.md` so they match the new specs
