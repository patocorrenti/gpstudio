## ADDED Requirements

### Requirement: NS panel lists onboard user SnapTone slots

When Controller is showing an NS control panel, the model select MUST include the twenty-four onboard user SnapTone slots together with the factory NS models for the connected pedal. Until SnapTone names are known, those slots MUST use the English fallback labels `SnapTone 01` through `SnapTone 24`. When the session has a name for a slot, the select MUST show that name instead of the fallback. A blank or missing name MUST keep the fallback. The same labels MUST be used on USB and Bluetooth. Controller MUST NOT send raw MIDI.

Selecting a user SnapTone slot MUST go through the device session the same way as selecting a factory NS model. Identity loading and chain refresh MUST NOT wait for SnapTone names. If names arrive after the NS panel is already shown, the select MUST update those labels without hiding the panel or sending patch recall.

#### Scenario: User SnapTone dump shows the NS panel
- **WHEN** a session is showing the audio chain with NS on and a dump that loaded SnapTone 03 with Gain at 40
- **THEN** Controller shows an NS panel
- **AND** that panel lists SnapTone 03 or that slot's dumped name
- **AND** that panel shows Gain at 40

#### Scenario: Fallback labels before names arrive
- **WHEN** a session is showing an NS panel whose loaded model is a user SnapTone slot and SnapTone names have not arrived
- **THEN** that panel's model select lists `SnapTone 01` through `SnapTone 24`

#### Scenario: Dumped name replaces the fallback
- **WHEN** an NS panel is listing `SnapTone 03` and the session receives the name `My Amp` for that slot
- **THEN** that panel's model select lists `My Amp` for that slot
- **AND** the panel stays shown
- **AND** no patch recall is sent solely because the name arrived

#### Scenario: Blank SnapTone name keeps the fallback
- **WHEN** a session receives a blank name for user SnapTone slot 07
- **THEN** the NS model select still lists `SnapTone 07` for that slot

#### Scenario: User selects a user SnapTone slot
- **WHEN** the NS panel is showing a factory NS model and the user selects SnapTone 03
- **THEN** the NS panel lists SnapTone 03 or that slot's dumped name
- **AND** that change is sent through the device session

#### Scenario: USB and Bluetooth share SnapTone labels
- **WHEN** a Bluetooth session is showing an NS panel with dumped SnapTone names
- **THEN** Controller shows the same NS user SnapTone labels as USB for that pedal

## MODIFIED Requirements

### Requirement: Controller saves, renames, duplicates, downloads, and uploads the current patch

After the patch bar is shown, Controller SHALL let the user Save the current working patch onto the current slot, rename that patch, duplicate it onto another 00–99 slot, download it to the PC, and upload a Valeton `.prst` into the current working patch, all through the device session. Labels MUST be in English. The same controls MUST be used on USB and Bluetooth.

Save MUST store the current working patch on the pedal in the current slot. Rename MUST change the onboard name of the current patch (at most 10 characters) through the session and MUST update the selector when that name is known. Duplicate MUST ask for a destination slot other than the current one; confirming MUST copy the current working patch onto that slot without changing the selected patch; overwriting a destination that already has a patch MUST require confirmation. Download MUST produce a Valeton `.prst` of the current patch for the connected pedal (GP-50 session → GP-50 `.prst`; GP-5 session → GP-5 `.prst`). Download MUST NOT convert the patch to the other model. If the current-preset dump is missing, download MUST NOT invent a file. When the working patch's CAB model is an onboard user IR slot, or its NS model is an onboard user SnapTone slot, Download MUST ask for English confirmation before producing the file; that confirmation MUST say the file references the slot but does not include the IR or SnapTone file. Cancel MUST NOT produce a file. When the working patch uses neither a user IR nor a user SnapTone, Download MUST NOT show that confirmation.

Upload MUST let the user pick a `.prst` from the PC. After a file is chosen, Controller MUST ask the user to confirm that this will load into the current working patch. When the file contains factory models the connected pedal's catalog does not include, that confirmation MUST name those models in English and MUST still offer confirm. When the file has no such models, the confirmation MUST NOT add an omission warning. Cancel MUST NOT apply the file and MUST NOT send MIDI. Confirm MUST apply that file onto the currently selected patch through the device session and MUST NOT store it on the pedal. Save remains the control that stores the working patch. Upload MUST NOT change which patch is selected. A valid `.prst` from either model MUST be eligible to confirm. A file that is not a valid Valeton `.prst` MUST produce an English error and MUST NOT be applied. The slot number in the filename MUST be ignored. Controller MUST NOT send raw MIDI.

While the current patch is syncing, Reload, Save, rename, duplicate, download, upload, previous, and next MUST NOT be usable. Disconnecting MUST hide those controls with the patch bar.

#### Scenario: Download warns for a custom SnapTone
- **WHEN** the session is ready, the current patch's NS model is a user SnapTone slot, and the user activates download
- **THEN** Controller asks the user to confirm in English that the file references the SnapTone slot but does not include the SnapTone file
- **AND** no local patch file is produced until the user confirms

#### Scenario: Download warns for a custom IR
- **WHEN** the session is ready, the current patch's CAB model is a user IR slot, and the user activates download
- **THEN** Controller asks the user to confirm in English that the file references the IR slot but does not include the IR file
- **AND** no local patch file is produced until the user confirms

### Requirement: Controller syncs patch identity after connect

After a pedal session becomes connected, Controller SHALL show an English loading state while the session requests the pedal's current patch index and onboard patch names. The loading state MUST NOT wait for the audio-chain dump. The loading state MUST NOT wait for the IR-name dump. The loading state MUST NOT wait for the SnapTone / Nam name dump. The loading state MUST NOT wait for the globals dump. The loading state MUST NOT send patch recall (official CC 0) solely because the session connected or Controller opened. Disconnecting during sync MUST return to the empty state. Controller MUST NOT send raw MIDI.

#### Scenario: Loading after USB connect
- **WHEN** a USB session becomes connected and patch identity is not yet known
- **THEN** Controller shows a loading state
- **AND** the patch bar is not shown yet
- **AND** the audio chain is not shown yet
- **AND** no patch recall is sent solely because the session connected
- **AND** that loading state does not wait for the IR-name dump
- **AND** that loading state does not wait for the SnapTone name dump

#### Scenario: Loading after Bluetooth connect
- **WHEN** a Bluetooth session becomes connected and patch identity is not yet known
- **THEN** Controller shows a loading state
- **AND** the patch bar is not shown yet
- **AND** the audio chain is not shown yet
- **AND** no patch recall is sent solely because the session connected
- **AND** that loading state does not wait for the IR-name dump
- **AND** that loading state does not wait for the SnapTone name dump

#### Scenario: Patch bar appears before the audio chain
- **WHEN** a session has received patch identity and the audio-chain dump has not arrived yet
- **THEN** Controller shows the patch bar
- **AND** patch controls below the bar are covered by a busy overlay
- **AND** no patch recall is sent solely to wait for that dump

#### Scenario: Disconnect during sync
- **WHEN** the user disconnects while Controller is showing the loading state
- **THEN** the loading state is hidden
- **AND** the screen states that no pedals are connected
