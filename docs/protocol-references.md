# Protocol references

Third-party GP-5 / GP-50 web editors that already solve connect, dump, and live control.

**Read** the local copy in `reference/` (GP-50 editor HTML) when encoding or decoding SysEx. Do **not** paste that JavaScript into `src/`. Implement Patone-owned codecs; match operator captures and Patone Log.

Online copies (behavioral / runtime):

| Pedal | Link | Editor |
| --- | --- | --- |
| GP-50 | Bluetooth | https://rvalladares.com/gp5/gp50editor/ |
| GP-50 | USB | https://rvalladares.com/gp5/gp50editor/usb.html |
| GP-5 | Bluetooth | https://rvalladares.com/gp5/gp5editor/ |
| GP-5 | USB | https://rvalladares.com/gp5/gp5editor/usb.html |

Useful observations (not a protocol spec):

- After connect they show a loading overlay (`Syncing with GP-50 …` / GP-5) and request a patch-name list, then the current patch index, then the current preset, then other dumps we do not implement (globals, IRs, NAM). On patch change they request that preset dump again.
- Those three asks are the same identity-family SysEx template Patone already owns: name-list is size `0x0E` / command `0x00`, current-patch is size `0x07` / command `0x03`, current-preset is size `0x09` / command `0x01`. A GP-50 Bluetooth Patone capture of size `0x0E` / command `0x01` only returned a 16-byte ACK, not a dump.
- Inbound current-preset fragments differ by pedal and link. Bluetooth GP-50 uses command `00 06` (short terminator); GP-5 uses `00 05`. USB GP-50 uses `01 0B`; GP-5 uses `01 09`. Name-list dumps stay `01 05` (Bluetooth) / `06 0A` (USB) and must not be parsed as a chain.
- USB uses Web MIDI with SysEx enabled. Some live global/footswitch changes are not notified over USB.
- Bluetooth uses the BLE-MIDI GATT service and the same SysEx conversation, wrapped in BLE-MIDI packets. Host SET SysEx is one GATT write (`80 80` + full `F0`…`F7`), as in the accepted chain-order capture. Do not chunk a 38-byte `1147`/`1148` SysEx into 20-byte packets; the pedal ignores that.
- **Two families:** identity / live notify uses path `01 02 04` (checksum unknown). Parameter **SET** uses path `01 01 04`, CRC-8 ATM (poly `0x07`, init 0) of the packed body, then nibble-expand each hex digit to a `0x0n` MIDI byte (`src/device/sysex-nibble.ts`). Echoing a live notify is not a SET.
- Pedal chain-order **notify** (Patone Log, Bluetooth): size `0x0C` / command `0x04` / path `01 02 04`, 34 bytes, nibble-expanded `DUMP_MODULE_IDS` indices. Patone applies it on Bluetooth (`liveFromPedal`). USB does not emit it and must not apply it.
- Pedal chain-order **SET** (accepted operator log, Bluetooth, PRE before NR): same 10-slot payload, path `01 01 04`, CRC `08 07` for that order. Packed body `01 00 0C 11 44` + ten dump indices. W1 (host `01 02 04`) and W2 (notify echo, checksum `00 00`) were ignored. Notebook: `openspec/changes/chain-reorder/spike-chain-order-write.md`.
- Current-preset **model + control** fields live in that same dump (wire identity + float32 LE per kind). App→pedal model write is packed family `1147`; control write is `1148`. Same CRC-8 + nibble-expand SET path `01 01 04`. Pedal→app live model is identity-family command `07`; live control is command `08` (path `01 02 04`). Patone applies those on Bluetooth (`liveFromPedal`) and ignores them on USB. The reference editor debounce is 50 ms on slider `input`. Patone updates the snapshot on every step and coalesces the `1148` SET (~80 ms throttle, flush on pointer-up) so BLE-MIDI is not flooded. Do **not** copy `reference/` JavaScript; match captures.

Movable chain modules: NR, PRE, MOD, DLY, RVB. DST, NS, AMP, CAB, EQ stay a contiguous block.

Patone’s in-scope subset is current patch index, onboard names, the current preset’s audio chain (module order + on/off + factory model and control values for the ten effect slots), Bluetooth live chain-order follow, Bluetooth live model/control follow, the order-only SET, and model/control SETs of the same parameter-write family (`1147` / `1148`). Library, IRs, NAM, the Editor route, volume, and tuner stay out.

Stomp **assignment** (which modules each footswitch toggles) is a paused lab, not product: decode from the current-preset dump is locked for GP-50; SET candidates were ignored. Same CRC + nibble family as chain-order SET (`sendCTL` in the reference editor); H7 used the wrong size/command/body. Resume notes: `openspec/changes/stomp-assignment/spike-assignment-write.md`.
