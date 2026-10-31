## ADDED Requirements

### Requirement: Connected session uploads a user SnapTone file

A connected session SHALL inspect a `.nam` the user loads and SHALL report its kind. Kind A1 MUST be reported unsupported with the English reason `A1 captures aren't supported yet`. An invalid file or an A2 geometry the session cannot convert MUST be reported unsupported with an English reason. A supported A2 file MUST be convertible to the bytes for one user SnapTone slot without blocking the UI. Conversion MUST NOT open a MIDI link. The session MUST report whether the open link can accept a SnapTone file. USB MUST be able to accept one once the upload path is implemented. Bluetooth MUST be reported as unable until research shows that pedal accepts the file on Bluetooth. UI MUST NOT send raw MIDI.

When the link can accept a file, the session SHALL write a converted SnapTone to one of the twenty-four user slots on the open link, with the submitted slot name. The write MUST NOT select a different patch and MUST NOT send patch recall solely because the file was written. Factory NS models MUST NOT accept a SnapTone file. While that write is in progress, other app writes that already wait during chain sync MUST wait, and the session MUST reject them as busy. Cancel before the first byte MUST send nothing. Cancel after the send has started MUST stop further bytes. Disconnect during the send MUST drop the in-memory SnapTone names, as any disconnect does.

After a write completes, the session MUST request the Nam name dump again on that link and replace the in-memory snapshot with the result. That refresh MUST NOT run on Reload or on patch change. A missing or failed refresh MUST leave the slot unnamed rather than inventing the submitted name. The same upload path MUST be used for GP-5 and GP-50 except for the connected model the session already records. The SysEx MUST be GP Studio-owned. The session MUST NOT copy a third-party uploader.

#### Scenario: A1 inspect does not write

- **WHEN** a connected session inspects an A1 `.nam`
- **THEN** the inspection is unsupported with reason `A1 captures aren't supported yet`
- **AND** no SnapTone file is sent

#### Scenario: USB write goes to the chosen user slot

- **WHEN** a USB session that can accept a SnapTone file writes a converted file named `New Amp` to user slot 03
- **THEN** the write addresses user slot 03
- **AND** the selected patch does not change
- **AND** no patch recall is sent solely because the file was written

#### Scenario: Bluetooth does not accept a file until research says it can

- **WHEN** a Bluetooth session is connected and research has not shown that the pedal accepts a SnapTone file on Bluetooth
- **THEN** the session reports that the open link cannot accept a SnapTone file
- **AND** no SnapTone file is sent

#### Scenario: Other writes wait during the send

- **WHEN** a SnapTone file send is in progress and the user saves the current patch
- **THEN** the session rejects that save as busy
- **AND** the SnapTone send is the write still in progress

#### Scenario: Completed write refreshes names

- **WHEN** a SnapTone file write to user slot 03 completes
- **THEN** the session requests the Nam name dump again
- **AND** the in-memory names are replaced by that dump
- **AND** a later patch change does not request the Nam dump solely because the patch changed

#### Scenario: Failed refresh does not invent the name

- **WHEN** a SnapTone file write completes and the Nam refresh does not arrive
- **THEN** that user slot stays unnamed in the snapshot
- **AND** the session does not store the submitted name as if the pedal had confirmed it
