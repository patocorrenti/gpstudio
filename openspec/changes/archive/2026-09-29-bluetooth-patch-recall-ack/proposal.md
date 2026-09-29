## Why

After Bluetooth patch recall (`1143`) started working, rapid navigation still hangs the pedal until a power cycle. The reference editors wait for a short “Command received” ACK after `1143` before asking for the preset dump; Patone asks for the dump immediately (then still runs the confirmation dump). Racing the dump against an unfinished recall is a likely cause of the GATT drop we already warn about elsewhere.

## What Changes

- On Bluetooth app→pedal recall (GP-5 and GP-50), after sending SET `1143`, wait for the pedal’s command-received ACK before requesting the current-preset dump.
- Keep the existing confirmation dump after the first dump applies (USB and Bluetooth unchanged in that respect).
- USB recall stays immediate dump after CC 0 (no `1143` ACK path).
- If the ACK never arrives within a short timeout, still request the dump so the UI does not stick forever.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `device-connection`: Bluetooth app recall MUST wait for the `1143` command-received ACK (or a short timeout) before the chain-dump request; confirmation dump stays.

## Non-goals

- Removing or skipping the confirmation dump.
- Waiting for ACK on USB (CC 0 path).
- Changing pedal→app current-patch handling beyond not racing a dump before the app-recall ACK when applicable.
- Copying reference editor JavaScript into `src/`.

## Impact

- `DeviceSession.setPatch` / `refreshChain` sequencing on Bluetooth; a small decoder for the ACK frame; session checks; a short note in `docs/protocol-references.md`.
