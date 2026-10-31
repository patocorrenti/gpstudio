## ADDED Requirements

### Requirement: Controller offers a SnapTone file modal

When a pedal session is connected, the patch bar SHALL offer an English SnapTone control that opens a modal. The control MUST NOT be a route or a main-menu item. The modal MUST list the connected pedal's factory NS models and its twenty-four user SnapTone slots. Factory rows MUST show the catalog label and MUST NOT accept a file. User rows MUST show the slot number and the same label the NS model select uses for that slot (dumped name, or `SnapTone 01` through `SnapTone 24`). The modal MUST read those names from the session snapshot. When names arrive after the modal is open, the user rows MUST update without closing the modal and without sending patch recall. Disconnecting MUST close the modal. Controller MUST NOT send raw MIDI.

A user row MUST accept a `.nam` by button or by drop. After a file is chosen, the modal MUST show the inspection the session returns: kind, version when present, and name when present. An unsupported file MUST show the session's English reason on one line and MUST NOT start a send. An A1 file MUST show `A1 captures aren't supported yet`. The modal MUST offer a slot-name field that starts with the file name when the inspection includes one. The field MUST NOT submit a name longer than the length the pedal stores for a SnapTone slot name.

When the chosen user slot has a dumped name, confirming the send MUST ask before replace and MUST show that slot number and dumped name. The confirmation MUST NOT list patches. Cancel MUST NOT send. When the slot has no dumped name, the send MUST NOT require that confirmation. A confirmed send MUST go through the device session for that user slot and MUST NOT change which patch is selected. Patches that already point at that slot number keep pointing at it.

The modal MUST show two English progress stages for a send that starts: `Converting…` and then `Sending to the multi-effects…`. Cancel during conversion MUST stop the conversion and MUST NOT send. Cancel during the send MUST stop further sends and MUST tell the user, in English, that the slot is unknown until SnapTone names are read again. When the session reports that the open link cannot accept a SnapTone file, the modal MUST explain that in English and MUST NOT convert or send. While a SnapTone file send is in progress, Reload, Save, rename, duplicate, download, patch upload, previous, next, and slot edits MUST NOT be usable, the same as while the current patch is syncing. Disconnect during a send MUST show an English message that the slot is unknown until names are read again. A failed send MUST show an English error. When the failure is that the MIDI port cannot be written, that error MUST suggest closing Valeton Suite. Success MUST be shown only after the refreshed snapshot carries the submitted name for that slot.

#### Scenario: Connected patch bar opens the modal

- **WHEN** a pedal session is connected and the user activates the patch bar SnapTone control
- **THEN** a modal lists the factory NS models and user slots `SnapTone 01` through `SnapTone 24` or their dumped names
- **AND** factory rows do not accept a file
- **AND** no patch recall is sent solely because the modal opened

#### Scenario: Names fill in while the modal is open

- **WHEN** the modal is listing `SnapTone 03` and the session receives the name `My Amp` for that slot
- **THEN** that row shows `My Amp`
- **AND** the modal stays open
- **AND** no patch recall is sent solely because the name arrived

#### Scenario: A1 file is rejected

- **WHEN** the user loads an A1 `.nam` onto a user slot
- **THEN** the modal shows `A1 captures aren't supported yet`
- **AND** no SnapTone file is sent

#### Scenario: Named slot asks before replace

- **WHEN** user slot 03 has dumped name `My Amp` and the user confirms a supported `.nam` for that slot
- **THEN** the modal asks to replace slot 03, `My Amp`
- **AND** the ask does not list patches
- **AND** no SnapTone file is sent until the user confirms

#### Scenario: Cancel during conversion sends nothing

- **WHEN** the user cancels while the modal shows `Converting…`
- **THEN** conversion stops
- **AND** no SnapTone file is sent

#### Scenario: Link that cannot accept a file explains and does not send

- **WHEN** the session reports that the open link cannot accept a SnapTone file and the user opens the modal
- **THEN** the modal explains that in English
- **AND** no conversion or send starts

#### Scenario: Success follows the refreshed name

- **WHEN** the user confirms a send of a supported `.nam` named `New Amp` to user slot 03 and the refreshed snapshot name for that slot is `New Amp`
- **THEN** the modal shows success for slot 03
- **AND** the selected patch does not change

#### Scenario: Disconnect closes the modal

- **WHEN** the user disconnects while the SnapTone modal is open
- **THEN** the modal closes
