## ADDED Requirements

### Requirement: Controller offers a SnapTone file modal

When a pedal session is connected, the patch bar SHALL offer an English SnapTone control that opens a modal. The control MUST NOT be a route or a main-menu item. The modal MUST list the connected pedal's factory NS models (protocol indices 0–49) and its thirty user SnapTone slots (protocol indices 50–79). Factory rows MUST show the catalog label and MUST NOT accept a file. User rows MUST show the protocol index and the slot-table name, or `SnapTone 50` through `SnapTone 79` when the name is missing. They are not the twenty-four `SnapTone 01` through `SnapTone 24` rows. The modal MUST read those names and occupancy flags from the session snapshot. When names arrive after the modal is open, the user rows MUST update without closing the modal and without sending patch recall. Disconnecting MUST close the modal. Controller MUST NOT send raw MIDI.

A user row MUST accept a `.nam` by button or by drop. After a file is chosen, the modal MUST show the inspection the session returns: kind, version when present, and name when present. An unsupported file MUST show the session's English reason on one line and MUST NOT start a send. An A1 file MUST show `A1 captures aren't supported yet`. The modal MUST offer a slot-name field that starts with the file name when the inspection includes one. The field MUST submit at most 10 characters, and only ASCII letters and digits (the form the pedal stores). A name that has no letter or digit MUST be submitted as `X`.

When the chosen user slot holds a capture (occupancy flag 0), confirming the send MUST ask before replace, including when the name is blank. The confirmation MUST show that protocol index and the dumped name when one exists. The confirmation MUST NOT list patches. Cancel MUST NOT send. When the slot does not hold a capture (the name `Empty` with a flag other than 0), the send MUST NOT require that confirmation. A blank name MUST NOT skip the ask when the flag is 0. A confirmed send MUST go through the device session for that user slot and MUST NOT change which patch is selected. Patches that already point at that slot number keep pointing at it.

The modal MUST show two English progress stages for a send that starts: `Converting…` and then `Sending to the multi-effects…`. Cancel during conversion MUST stop the conversion and MUST NOT send. Cancel during the send MUST stop further sends and MUST tell the user, in English, that the slot is unknown until SnapTone names are read again. When the session reports that the open link cannot accept a SnapTone file, the modal MUST explain that in English and MUST NOT convert or send. While a SnapTone file send is in progress, Reload, Save, rename, duplicate, download, patch upload, previous, next, and slot edits MUST NOT be usable, the same as while the current patch is syncing. Disconnect during a send MUST show an English message that the slot is unknown until names are read again. A failed send MUST show an English error. When the failure is that the MIDI port cannot be written, that error MUST suggest closing Valeton Suite. Success MUST be shown only after the refreshed snapshot carries the submitted name for that slot.

#### Scenario: Connected patch bar opens the modal

- **WHEN** a pedal session is connected and the user activates the patch bar SnapTone control
- **THEN** a modal lists the factory NS models (indices 0–49) and user slots `SnapTone 50` through `SnapTone 79` or their dumped names
- **AND** factory rows do not accept a file
- **AND** no patch recall is sent solely because the modal opened

#### Scenario: Names fill in while the modal is open

- **WHEN** the modal is listing `SnapTone 52` and the session receives the name `MyAmp` for protocol index 52
- **THEN** that row shows `MyAmp`
- **AND** the modal stays open
- **AND** no patch recall is sent solely because the name arrived

#### Scenario: A1 file is rejected

- **WHEN** the user loads an A1 `.nam` onto a user slot
- **THEN** the modal shows `A1 captures aren't supported yet`
- **AND** no SnapTone file is sent

#### Scenario: Named slot asks before replace

- **WHEN** protocol index 52 holds a capture named `MyAmp` and the user confirms a supported `.nam` for that slot
- **THEN** the modal asks to replace index 52, `MyAmp`
- **AND** the ask does not list patches
- **AND** no SnapTone file is sent until the user confirms

#### Scenario: Blank name with a capture still asks

- **WHEN** protocol index 52 has a blank name and occupancy flag 0 and the user confirms a supported `.nam` for that slot
- **THEN** the modal asks to replace index 52
- **AND** no SnapTone file is sent until the user confirms

#### Scenario: Empty slot does not ask

- **WHEN** protocol index 50 is named `Empty` with an occupancy flag other than 0 and the user confirms a supported `.nam` for that slot
- **THEN** the modal does not ask to replace it before the send

#### Scenario: Cancel during conversion sends nothing

- **WHEN** the user cancels while the modal shows `Converting…`
- **THEN** conversion stops
- **AND** no SnapTone file is sent

#### Scenario: Link that cannot accept a file explains and does not send

- **WHEN** the session reports that the open link cannot accept a SnapTone file and the user opens the modal
- **THEN** the modal explains that in English
- **AND** no conversion or send starts

#### Scenario: Success follows the refreshed name

- **WHEN** the user confirms a send of a supported `.nam` named `NewAmp` to protocol index 52 and the refreshed snapshot name for that slot is `NewAmp`
- **THEN** the modal shows success for index 52
- **AND** the selected patch does not change

#### Scenario: Disconnect closes the modal

- **WHEN** the user disconnects while the SnapTone modal is open
- **THEN** the modal closes
