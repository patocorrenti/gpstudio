## MODIFIED Requirements

### Requirement: Controller saves, renames, duplicates, and downloads the current patch

After the patch bar is shown, Controller SHALL let the user Save the current working patch onto the current slot, rename that patch, duplicate it onto another 00–99 slot, and download it to the PC, all through the device session. Labels MUST be in English. The same controls MUST be used on USB and Bluetooth.

Save MUST store the current working patch on the pedal in the current slot. Rename MUST change the onboard name of the current patch (at most 10 characters) through the session and MUST update the selector when that name is known. Duplicate MUST ask for a destination slot other than the current one; confirming MUST copy the current working patch onto that slot without changing the selected patch; overwriting a destination that already has a patch MUST require confirmation. Download MUST produce a Valeton `.prst` of the current patch for the connected pedal (GP-50 session → GP-50 `.prst`; GP-5 session → GP-5 `.prst`). Download MUST NOT convert the patch to the other model. If the current-preset dump is missing, download MUST NOT invent a file. Controller MUST NOT send raw MIDI.

While the current patch is syncing, Save, rename, duplicate, download, previous, and next MUST NOT be usable. Disconnecting MUST hide those controls with the patch bar.

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

#### Scenario: Busy patch bar blocks store actions
- **WHEN** the user has selected another patch after sync and the new chain dump has not arrived yet
- **THEN** Save, rename, duplicate, and download cannot be used
- **AND** previous and next cannot be used

#### Scenario: USB and Bluetooth share the patch bar actions
- **WHEN** a Bluetooth session is ready with a synced current patch and the user activates Save
- **THEN** Controller uses the same Save presentation as USB
- **AND** that store is sent through the device session
