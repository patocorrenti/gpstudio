# Protocol references

Third-party GP-5 / GP-50 web editors that already solve connect, dump, and live control. Use them as **behavioral and runtime references** (what happens after connect, USB vs Bluetooth, loading, name list, current preset).

**Do not copy their source, JavaScript, or SysEx payloads into Patone.** Identity and current-patch chain requests/decoders live in `src/device/` from Patone captures and our own codecs.

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
- Bluetooth uses the BLE-MIDI GATT service and the same SysEx conversation, wrapped in BLE-MIDI packets.

Patone’s in-scope subset is current patch index, onboard names, and the current preset’s audio chain (module order + on/off) from that class of dump. Full preset parameters, IRs, and NAM stay out.

Stomp **assignment** (which modules each footswitch toggles) is a paused lab, not product: decode from the current-preset dump is locked for GP-50; every Patone-owned SET candidate was ignored. Do not copy those editors’ assignment SysEx. Resume notes: `openspec/changes/stomp-assignment/spike-assignment-write.md`.
