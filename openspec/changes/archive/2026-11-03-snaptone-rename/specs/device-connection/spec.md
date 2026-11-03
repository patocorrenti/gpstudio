## ADDED Requirements

### Requirement: Connected session renames a user SnapTone

A connected USB session SHALL rename one user SnapTone at protocol indices 50–79 with the captured parameter-write for that slot (header `02 00`, length `13`, family `1126`, fxId `0x0F000000` plus the protocol slot, then the sanitized name in 13 zero-padded bytes). The sanitized name MUST be ASCII letters and digits, at most 10 characters, and MUST be `X` when nothing remains. Factory NS models (protocol indices 0–49) MUST NOT be renamed, and that request MUST send nothing. A user slot that does not hold a capture MUST NOT be renamed, and that request MUST send nothing. Bluetooth MUST send nothing and MUST report that the open link cannot accept a SnapTone file. The rename MUST NOT send patch recall, MUST NOT mark the chain as syncing, and MUST NOT include the 2696-byte SnapTone file. It MUST NOT send the Android SnapTone rename command (`0x27`). UI MUST NOT send raw MIDI.

While that rename is in progress, other app writes that already wait during a SnapTone file send MUST wait, and the session MUST reject them as busy. After the pedal acknowledges the rename, the session MUST send the captured follow-up packed `02 01 03 00 00 00` and MUST wait for that command to be acknowledged. It MUST NOT read the user-slot table before the pedal notify `12 1B`. After that notify, or after the wait for it times out, the session MUST read the user-slot table (protocol indices 50–79, including the occupancy flag) and replace the in-memory snapshot with that table. Success MUST be that refreshed slot named with the sanitized name and still holding a capture. The session MUST NOT invent that name. If an acknowledgement or the refresh fails, that slot MUST stay unnamed until the next table read. The same rename MUST be used for GP-5 and GP-50. The SysEx MUST be GP Studio-owned. The session MUST NOT send the pedal notify `12 1B` or the globals ask `12 1C`.

#### Scenario: Factory slot is not renamed

- **WHEN** a USB session is asked to rename protocol index 10 to `LeadCh`
- **THEN** the session refuses
- **AND** no rename is sent

#### Scenario: Empty user slot is not renamed

- **WHEN** protocol index 50 is named `Empty` with an occupancy flag other than 0 and a USB session is asked to rename it
- **THEN** the session refuses
- **AND** no rename is sent

#### Scenario: Bluetooth sends nothing

- **WHEN** a Bluetooth session is asked to rename protocol index 77 to `LeadCh`
- **THEN** the session reports that the open link cannot accept a SnapTone file
- **AND** no rename is sent

#### Scenario: Other writes wait during the rename

- **WHEN** a user SnapTone rename is in progress and the user saves the current patch
- **THEN** the session rejects that save as busy
- **AND** the chain is not marked syncing solely because of the rename

#### Scenario: Punctuation is stripped before the send

- **WHEN** a USB session renames protocol index 77 from a name that holds a capture to `Lead Ch$`
- **THEN** the name in the captured parameter-write is `LeadCh`
- **AND** the 2696-byte SnapTone file is not sent

#### Scenario: Empty sanitized name is X

- **WHEN** a USB session renames an occupied user slot to `$$$`
- **THEN** the name in the captured parameter-write is `X`

#### Scenario: Acknowledged rename refreshes that name

- **WHEN** a USB session renames protocol index 77 to `LeadCh` and the pedal acknowledges the command
- **THEN** the session sends the captured follow-up packed `02 01 03 00 00 00`
- **AND** the session does not read the user-slot table until the pedal notify `12 1B` arrives
- **AND** success requires that table to name index 77 `LeadCh` with an occupancy flag of 0
- **AND** the session does not write `LeadCh` into the snapshot before that table arrives
- **AND** no patch recall is sent

#### Scenario: Missing acknowledgement leaves the slot unnamed

- **WHEN** a USB session sends the rename for protocol index 77 and the command acknowledgement does not arrive
- **THEN** that slot stays unnamed in the snapshot
- **AND** the session does not store the submitted name as if the pedal had confirmed it

#### Scenario: Android rename command is not sent

- **WHEN** a USB session renames a user SnapTone
- **THEN** the send is the captured parameter-write for that slot, then the captured follow-up packed `02 01 03 00 00 00`
- **AND** the Android rename command `0x27` is not sent
- **AND** the pedal notify `12 1B` is not sent
- **AND** the globals ask `12 1C` is not sent
