## ADDED Requirements

### Requirement: Controller renames an occupied user SnapTone

In the SnapTone modal, a user slot (protocol indices 50–79) that holds a capture MUST offer an English rename. The rename MUST show that protocol index and the current name, and MUST start from that name. Cancel MUST send nothing. Confirm MUST send the edited name through the device session for that slot. Factory rows (protocol indices 0–49) MUST NOT offer rename. A user slot that does not hold a capture MUST NOT offer rename. The edited name MUST keep ASCII letters and digits and MUST keep at most 10 characters. When the session reports that the open link cannot accept a SnapTone file, the modal MUST explain that in English with the same message used for a SnapTone file and MUST NOT send a rename. While a rename is in progress, Reload, Save, patch rename, duplicate, download, patch upload, previous, next, and slot edits MUST NOT be usable, the same as while a SnapTone file send is in progress, and the chain-sync overlay MUST NOT be shown solely because of the rename. A SnapTone file send or a user SnapTone delete already in progress MUST leave rename unusable. Controller MUST NOT send raw MIDI.

Success MUST be shown only after the refreshed snapshot names that slot with the sanitized name. A name that sanitizes to nothing MUST succeed only as `X`. If the rename fails and the slot is left unnamed, the modal MUST tell the user, in English, that the slot is unknown until SnapTone names are read again. When the failure is that the MIDI port cannot be written, that error MUST suggest closing Valeton Suite. The rename MUST NOT change which patch is selected. A chain label that already shows that slot MUST show the refreshed name without patch recall.

#### Scenario: Occupied user slot can be renamed

- **WHEN** protocol index 77 holds a capture named `MyAmp` and the user starts a rename for that slot
- **THEN** the modal shows index 77 and starts from `MyAmp`
- **AND** no rename is sent until the user confirms

#### Scenario: Cancel sends nothing

- **WHEN** the modal is renaming protocol index 77 and the user cancels
- **THEN** no rename is sent

#### Scenario: Factory row is not renamed

- **WHEN** the modal lists factory index 10
- **THEN** that row does not offer rename

#### Scenario: Empty user slot is not renamed

- **WHEN** protocol index 50 is named `Empty` with an occupancy flag other than 0
- **THEN** that row does not offer rename

#### Scenario: Name keeps letters and digits

- **WHEN** the user edits a rename to `Lead Ch$`
- **THEN** the name the modal will submit is `LeadCh`

#### Scenario: Bluetooth explains and does not send

- **WHEN** the session reports that the open link cannot accept a SnapTone file and the user opens the modal
- **THEN** the modal explains that in English
- **AND** no rename is sent

#### Scenario: Rename does not show the chain overlay

- **WHEN** a user SnapTone rename is in progress
- **THEN** Save is not usable
- **AND** the chain-sync overlay is not shown solely because of the rename

#### Scenario: Success follows the refreshed name

- **WHEN** the user confirms a rename of protocol index 77 to `LeadCh` and the refreshed snapshot names that slot `LeadCh`
- **THEN** the modal shows success for index 77
- **AND** the selected patch is unchanged

#### Scenario: Chain label follows the refreshed name

- **WHEN** the current patch NS model is protocol index 77 and that slot's refreshed name is `LeadCh`
- **THEN** the chain shows `LeadCh` for that slot
- **AND** no patch recall is sent solely because of the rename

#### Scenario: Failed rename leaves the slot unknown

- **WHEN** the user confirms a rename and the session leaves that slot unnamed
- **THEN** the modal tells the user that the slot is unknown until SnapTone names are read again

#### Scenario: Port failure names Valeton Suite

- **WHEN** the user confirms a rename and the session reports that the MIDI port cannot be written
- **THEN** the modal tells the user to close Valeton Suite
