## REMOVED Requirements

### Requirement: Controller saves, renames, duplicates, and downloads the current patch

**Reason**: Upload no longer rejects a Valeton `.prst` from the other model. Keeping this requirement would preserve the scenario "Wrong-model file is rejected".
**Migration**: Save, rename, duplicate, native download, and upload move to "Controller saves, renames, duplicates, downloads, and uploads the current patch". The confirm step names omitted factory models and still loads the file.

## ADDED Requirements

### Requirement: Controller saves, renames, duplicates, downloads, and uploads the current patch

After the patch bar is shown, Controller SHALL let the user Save the current working patch onto the current slot, rename that patch, duplicate it onto another 00–99 slot, download it to the PC, and upload a Valeton `.prst` into the current working patch, all through the device session. Labels MUST be in English. The same controls MUST be used on USB and Bluetooth.

Save MUST store the current working patch on the pedal in the current slot. Rename MUST change the onboard name of the current patch (at most 10 characters) through the session and MUST update the selector when that name is known. Duplicate MUST ask for a destination slot other than the current one; confirming MUST copy the current working patch onto that slot without changing the selected patch; overwriting a destination that already has a patch MUST require confirmation. Download MUST produce a Valeton `.prst` of the current patch for the connected pedal (GP-50 session → GP-50 `.prst`; GP-5 session → GP-5 `.prst`). Download MUST NOT convert the patch to the other model. If the current-preset dump is missing, download MUST NOT invent a file.

Upload MUST let the user pick a `.prst` from the PC. After a file is chosen, Controller MUST ask the user to confirm that this will load into the current working patch. When the file contains factory models the connected pedal's catalog does not include, that confirmation MUST name those models in English and MUST still offer confirm. When the file has no such models, the confirmation MUST NOT add an omission warning. Cancel MUST NOT apply the file and MUST NOT send MIDI. Confirm MUST apply that file onto the currently selected patch through the device session and MUST NOT store it on the pedal. Save remains the control that stores the working patch. Upload MUST NOT change which patch is selected. A valid `.prst` from either model MUST be eligible to confirm. A file that is not a valid Valeton `.prst` MUST produce an English error and MUST NOT be applied. The slot number in the filename MUST be ignored. Controller MUST NOT send raw MIDI.

While the current patch is syncing, Reload, Save, rename, duplicate, download, upload, previous, and next MUST NOT be usable. Disconnecting MUST hide those controls with the patch bar.

#### Scenario: User saves the current patch

- **WHEN** the session is ready, the current patch is synced, and the user activates Save
- **THEN** the current working patch is stored on the pedal in the current slot through the device session
- **AND** the selected patch does not change
- **AND** no extra patch recall is sent solely because Save ran

#### Scenario: User renames the current patch

- **WHEN** the session is ready, the current patch is synced, the selector lists patch `42` with name `Old Name`, and the user renames it to `New Name`
- **THEN** the selector lists patch `42` with name `New Name`
- **AND** that name change is sent through the device session

#### Scenario: User duplicates onto another slot

- **WHEN** the session is ready, the current patch is `05` and synced, and the user confirms duplicate onto slot `80`
- **THEN** the current working patch is stored on the pedal in slot `80` through the device session
- **AND** the selected patch stays `05`
- **AND** no patch recall of `80` is sent solely because duplicate ran

#### Scenario: Duplicate overwrite needs confirmation

- **WHEN** the session is ready, the current patch is synced, and the user picks a destination slot that already has a patch
- **THEN** Controller asks the user to confirm overwrite
- **AND** no store write is sent until the user confirms

#### Scenario: User downloads a GP-50 preset file

- **WHEN** a GP-50 session is ready, the current patch is `60` named `TOB` and synced with a current-preset dump, and the user activates download
- **THEN** a Valeton `.prst` for GP-50 is produced through the device session
- **AND** the filename identifies GP-50, slot `60`, and `TOB`
- **AND** no extra patch recall is sent solely because download ran

#### Scenario: User downloads a GP-5 preset file

- **WHEN** a GP-5 session is ready, the current patch is synced with a current-preset dump, and the user activates download
- **THEN** a Valeton `.prst` for GP-5 is produced through the device session
- **AND** the filename identifies GP-5 and that slot and name

#### Scenario: Download is unavailable without a dump

- **WHEN** the session is ready without a current-preset dump
- **THEN** download cannot be used
- **AND** no local patch file is produced

#### Scenario: Upload asks before loading into the current patch

- **WHEN** the session is ready, the current patch is `60` named `TOB` and synced, and the user picks a Valeton `.prst` to upload
- **THEN** Controller asks the user to confirm that this will load into the current working patch
- **AND** no upload write is sent until the user confirms

#### Scenario: User cancels upload

- **WHEN** Controller is asking to confirm an upload and the user cancels
- **THEN** the current patch is not replaced
- **AND** no upload write is sent

#### Scenario: User uploads a GP-50 preset into the working patch

- **WHEN** a GP-50 session is ready, the current patch is `05` named `Flow` and synced, and the user confirms upload of a valid GP-50 `.prst` named `TOB`
- **THEN** that file is applied onto the working patch through the device session
- **AND** no store write is sent solely because upload ran
- **AND** the selected patch stays `05`
- **AND** the selector lists patch `05` with name `Flow`
- **AND** no extra patch recall is sent solely because upload ran
- **AND** Controller does not warn about omitted models

#### Scenario: User uploads a GP-5 preset into the working patch

- **WHEN** a GP-5 session is ready, the current patch is synced, and the user confirms upload of a valid GP-5 `.prst`
- **THEN** that file is applied onto the working patch through the device session
- **AND** no store write is sent solely because upload ran
- **AND** the selected patch does not change
- **AND** Controller does not warn about omitted models

#### Scenario: Other-model file with nothing omitted asks to load

- **WHEN** a GP-50 session is ready and the user picks a valid GP-5 `.prst`
- **THEN** Controller asks the user to confirm that this will load into the current working patch
- **AND** that confirmation does not warn about omitted models
- **AND** no upload write is sent until the user confirms

#### Scenario: Other-model file warns about omitted models

- **WHEN** a GP-5 session is ready and the user picks a valid GP-50 `.prst` that includes PRE C-Wah
- **THEN** Controller asks the user to confirm the load
- **AND** the confirmation names PRE C-Wah in English
- **AND** no upload write is sent until the user confirms

#### Scenario: Confirm still loads a file with omitted models

- **WHEN** Controller is asking to confirm a GP-50 `.prst` on a GP-5 session and has named PRE C-Wah, and the user confirms
- **THEN** that file is applied onto the working patch through the device session
- **AND** no store write is sent solely because upload ran
- **AND** the selected patch does not change

#### Scenario: Invalid file is rejected

- **WHEN** the session is ready and the user picks a file that is not a valid Valeton `.prst`
- **THEN** Controller shows an English error
- **AND** no upload write is sent

#### Scenario: Busy patch bar blocks store actions

- **WHEN** the user has selected another patch after sync and the new chain dump has not arrived yet
- **THEN** Reload, Save, rename, duplicate, download, and upload cannot be used
- **AND** previous and next cannot be used

#### Scenario: USB and Bluetooth share the patch bar actions

- **WHEN** a Bluetooth session is ready with a synced current patch and the user activates Save
- **THEN** Controller uses the same Save presentation as USB
- **AND** that store is sent through the device session
