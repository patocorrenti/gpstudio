# Protocol references

Third-party GP-5 / GP-50 web editors that already solve connect, dump, and live control. Use them as **behavioral and runtime references** (what happens after connect, USB vs Bluetooth, loading, name list, current patch).

**Do not copy their source, JavaScript, or SysEx payloads into Patone.** Identity requests and decoders live in `src/device/` from Patone captures and our own codec.

| Pedal | Link | Editor |
| --- | --- | --- |
| GP-50 | Bluetooth | https://rvalladares.com/gp5/gp50editor/ |
| GP-50 | USB | https://rvalladares.com/gp5/gp50editor/usb.html |
| GP-5 | Bluetooth | https://rvalladares.com/gp5/gp5editor/ |
| GP-5 | USB | https://rvalladares.com/gp5/gp5editor/usb.html |

Useful observations (not a protocol spec):

- After connect they show a loading overlay (`Syncing with GP-50 …` / GP-5) and request a patch-name list, then the current preset, then other dumps we do not implement (globals, IRs, NAM).
- USB uses Web MIDI with SysEx enabled. Some live global/footswitch changes are not notified over USB.
- Bluetooth uses the BLE-MIDI GATT service and the same SysEx conversation, wrapped in BLE-MIDI packets.

Patone’s in-scope subset is current patch index + onboard names. Full preset editor dumps stay out.
