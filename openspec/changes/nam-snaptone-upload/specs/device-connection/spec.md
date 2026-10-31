## ADDED Requirements

### Requirement: Connected session uploads a user SnapTone file

A connected session SHALL inspect a `.nam` the user loads and SHALL report its kind. Kind A1 MUST be reported unsupported with the English reason `A1 captures aren't supported yet`. An invalid file or an A2 geometry the session cannot convert MUST be reported unsupported with an English reason. A supported A2 file MUST be convertible to the bytes for one user SnapTone slot without blocking the UI. Conversion MUST NOT open a MIDI link. The session MUST report whether the open link can accept a SnapTone file. USB MUST be able to accept one once the upload path is implemented. Bluetooth MUST be reported as unable until research shows that pedal accepts the file on Bluetooth. UI MUST NOT send raw MIDI.

When the link can accept a file, the session SHALL write a converted SnapTone to one of the thirty user slots (protocol indices 50–79) on the open link, with the submitted slot name. The write MUST NOT select a different patch and MUST NOT send patch recall solely because the file was written. Factory NS models (protocol indices 0–49) MUST NOT accept a SnapTone file. The session MUST report, for each user slot, whether it holds a capture. That report MUST follow the slot-table occupancy flag: flag 0 means the slot holds a capture, including when the name is blank. The name `Empty` with a flag other than 0 MUST be reported as not holding a capture. A blank name MUST NOT be treated as empty. Indices 50–55 are user slots, not factory models. The identity-family Nam dump window of indices 56–79 is not the user-slot list. While that write is in progress, other app writes that already wait during chain sync MUST wait, and the session MUST reject them as busy. Cancel before the first byte MUST send nothing. Cancel after the send has started MUST stop further bytes. Disconnect during the send MUST drop the in-memory SnapTone names, as any disconnect does.

After a write completes, the session MUST read the user-slot table again on that link (protocol indices 50–79, including the occupancy flag) and replace the in-memory snapshot with the result. That refresh MUST NOT run on Reload or on patch change. A missing or failed refresh MUST leave the slot unnamed rather than inventing the submitted name. The same upload path MUST be used for GP-5 and GP-50 except for the connected model the session already records. The SysEx MUST be GP Studio-owned. The session MUST NOT copy a third-party uploader.

#### Scenario: A1 inspect does not write

- **WHEN** a connected session inspects an A1 `.nam`
- **THEN** the inspection is unsupported with reason `A1 captures aren't supported yet`
- **AND** no SnapTone file is sent

#### Scenario: USB write goes to the chosen user slot

- **WHEN** a USB session that can accept a SnapTone file writes a converted file named `NewAmp` to protocol index 52
- **THEN** the write addresses protocol index 52
- **AND** the selected patch does not change
- **AND** no patch recall is sent solely because the file was written

#### Scenario: A blank name still holds a capture

- **WHEN** user protocol index 52 has a blank name and occupancy flag 0
- **THEN** the session reports that the slot holds a capture

#### Scenario: Empty is the name Empty without user content

- **WHEN** user protocol index 50 is named `Empty` and its occupancy flag is not 0
- **THEN** the session reports that the slot does not hold a capture

#### Scenario: Bluetooth does not accept a file until research says it can

- **WHEN** a Bluetooth session is connected and research has not shown that the pedal accepts a SnapTone file on Bluetooth
- **THEN** the session reports that the open link cannot accept a SnapTone file
- **AND** no SnapTone file is sent

#### Scenario: Other writes wait during the send

- **WHEN** a SnapTone file send is in progress and the user saves the current patch
- **THEN** the session rejects that save as busy
- **AND** the SnapTone send is the write still in progress

#### Scenario: Completed write refreshes names

- **WHEN** a SnapTone file write to protocol index 52 completes
- **THEN** the session reads the user-slot table again (indices 50–79, including the occupancy flag)
- **AND** the in-memory names and flags are replaced by that table
- **AND** a later patch change does not request that table solely because the patch changed

#### Scenario: Failed refresh does not invent the name

- **WHEN** a SnapTone file write completes and the Nam refresh does not arrive
- **THEN** that user slot stays unnamed in the snapshot
- **AND** the session does not store the submitted name as if the pedal had confirmed it
