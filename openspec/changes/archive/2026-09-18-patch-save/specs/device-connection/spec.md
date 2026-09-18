## ADDED Requirements

### Requirement: Connected session stores, duplicates, and downloads the current patch

After a USB or Bluetooth session is ready and the current patch is not syncing, Save MUST store the current working patch on the pedal in the current slot through the open link. Rename MUST store that working patch in the current slot with the new onboard name (at most 10 characters) and MUST update the snapshot name list for that slot. Duplicate onto a different 00–99 slot MUST store the current working patch in that destination slot, MUST update the snapshot name list for the destination, and MUST NOT change the current patch index. Duplicate MUST NOT send patch recall of the destination solely because duplicate ran. A blank name MUST NOT be stored.

Those store writes MUST use the parameter-write SET family (path `01 01 04`, CRC-8 + nibble-expand), not live notify path `01 02 04`. The session MUST NOT send extra patch recall or an audio-chain dump solely because Save, rename, or duplicate ran. While the current patch is syncing, Save, rename, and duplicate MUST leave the snapshot unchanged and MUST NOT send a store write.

Download MUST produce a local file of the current patch from the current-preset dump the session already holds or re-requests. Download MUST NOT send extra patch recall solely to obtain that file. If no current-preset dump is available, the session MUST NOT invent a file. Disconnect MUST drop working store state.

#### Scenario: USB Save stores the current slot
- **WHEN** a USB session is ready, the current patch is `42` and synced, and the user Saves
- **THEN** a store write for slot `42` is sent on the USB link
- **AND** the snapshot current patch stays `42`
- **AND** no extra patch recall or chain dump is sent solely because Save ran

#### Scenario: Bluetooth rename updates the name list
- **WHEN** a Bluetooth session is ready, the current patch is `42` named `Old Name` and synced, and the user renames it to `New Name`
- **THEN** a store write for slot `42` is sent on the Bluetooth link
- **AND** the snapshot name for `42` is `New Name`
- **AND** the snapshot current patch stays `42`
- **AND** no extra patch recall is sent solely because rename ran

#### Scenario: Duplicate stores another slot without recalling it
- **WHEN** a session is ready, the current patch is `05` and synced, and the user duplicates onto slot `80`
- **THEN** a store write for slot `80` is sent on the open link
- **AND** the snapshot current patch stays `05`
- **AND** no patch recall of `80` is sent solely because duplicate ran

#### Scenario: Duplicate copies the current name onto the destination
- **WHEN** a session is ready, the current patch is `05` named `Flow` and synced, and the user duplicates onto slot `80`
- **THEN** the snapshot name for `80` is `Flow`
- **AND** the snapshot name for `05` stays `Flow`

#### Scenario: Syncing blocks store writes
- **WHEN** the session is ready, the current patch is syncing, and the user would Save, rename, or duplicate
- **THEN** the snapshot does not change
- **AND** no store write is sent

#### Scenario: Download writes a local file
- **WHEN** a session is ready, the current patch is synced with a current-preset dump, and the user downloads
- **THEN** a local file of that current patch is produced
- **AND** no extra patch recall is sent solely because download ran

#### Scenario: Missing dump does not invent a download
- **WHEN** a session is ready without a current-preset dump and the user would download
- **THEN** no local patch file is produced
