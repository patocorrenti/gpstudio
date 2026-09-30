## REMOVED Requirements

### Requirement: Connected session stores, duplicates, and downloads the current patch

**Reason**: Upload no longer rejects a Valeton `.prst` from the other model. Keeping this requirement would preserve the scenario "Wrong-model upload does not write".
**Migration**: Save, rename, duplicate, native download, and upload move to "Connected session stores, duplicates, downloads, and uploads the current patch". Upload applies either model and reports omitted factory models.

## ADDED Requirements

### Requirement: Connected session stores, duplicates, downloads, and uploads the current patch

After a USB or Bluetooth session is ready and the current patch is not syncing, Save MUST store the current working patch on the pedal in the current slot through the open link. Rename MUST store that working patch in the current slot with the new onboard name (at most 10 characters) and MUST update the snapshot name list for that slot. Duplicate onto a different 00–99 slot MUST store the current working patch in that destination slot, MUST update the snapshot name list for the destination, and MUST NOT change the current patch index. Duplicate MUST NOT send patch recall of the destination solely because duplicate ran. A blank name MUST NOT be stored.

Those store writes MUST use the parameter-write SET family (path `01 01 04`, CRC-8 + nibble-expand), not live notify path `01 02 04`. The session MUST NOT send extra patch recall or an audio-chain dump solely because Save, rename, or duplicate ran. While the current patch is syncing, Save, rename, and duplicate MUST leave the snapshot unchanged and MUST NOT send a store write.

Download MUST produce a Valeton `.prst` of the current patch for the connected pedal from the current-preset dump the session already holds or re-requests (GP-50 session → GP-50 `.prst`; GP-5 session → GP-5 `.prst`). Download MUST NOT convert the dump to the other model's `.prst`. Download MUST NOT send extra patch recall solely to obtain that file. If no current-preset dump is available, the session MUST NOT invent a file.

Upload MUST apply a valid Valeton `.prst` from either model onto the current working patch through the open link. A same-model file MUST apply that file's chain order, module on/off, factory models, controls the connected catalog includes, and patch volume. A GP-50 file uploaded to a GP-50 session MUST also apply that file's patch BPM. A file from the other model MUST be decoded as that file's model and MUST still be applied: the session MUST write chain order, module on/off, patch volume, every factory model the connected catalog includes (including a user-IR CAB slot both catalogs list), and every control of those models that the connected catalog includes. The session MUST NOT write a factory model the connected catalog does not include, and MUST NOT write a control the connected catalog does not include. The session MUST NOT invent a substitute factory model for an omitted slot; that slot's order and on/off from the file MUST still be written, and the model already on the pedal for that slot MUST be left in place. A GP-50 file's patch BPM MUST NOT be written on a GP-5 session. A GP-5 file MUST NOT overwrite GP-50 patch BPM. The session MUST NOT send a stomp-assignment write or an EXP write solely because upload ran. When the file contains one or more factory models the connected catalog does not include, the session MUST report those omitted models (slot kind and model label) and MUST still apply the rest. When every factory model in the file is in the connected catalog, the session MUST NOT report an omission. A control that exists only on the other model MUST NOT be reported as an omission. Upload MUST NOT send a store write. Upload MUST NOT change the current patch index. Upload MUST NOT update the snapshot name list. Bytes that are not a valid Valeton `.prst` MUST NOT send a write. Upload MUST NOT send extra patch recall solely because upload ran. After a successful upload, the session MUST refresh the current-preset dump for the current patch so the snapshot matches the working buffer. While the current patch is syncing, upload MUST leave the snapshot unchanged and MUST NOT send a write. Disconnect MUST drop working store state.

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

#### Scenario: GP-50 download writes a GP-50 preset file

- **WHEN** a GP-50 session is ready, the current patch is synced with a current-preset dump, and the user downloads
- **THEN** a Valeton `.prst` for GP-50 is produced
- **AND** no extra patch recall is sent solely because download ran

#### Scenario: GP-5 download writes a GP-5 preset file

- **WHEN** a GP-5 session is ready, the current patch is synced with a current-preset dump, and the user downloads
- **THEN** a Valeton `.prst` for GP-5 is produced
- **AND** no extra patch recall is sent solely because download ran

#### Scenario: Missing dump does not invent a download

- **WHEN** a session is ready without a current-preset dump and the user would download
- **THEN** no local patch file is produced

#### Scenario: GP-50 upload loads the working patch

- **WHEN** a GP-50 session is ready, the current patch is `05` named `Flow` and synced, and the user uploads a valid GP-50 `.prst` named `TOB`
- **THEN** that file is applied onto the working patch through the open link
- **AND** no store write is sent solely because upload ran
- **AND** the snapshot name for `05` stays `Flow`
- **AND** the snapshot current patch stays `05`
- **AND** no extra patch recall is sent solely because upload ran
- **AND** no omission is reported

#### Scenario: GP-5 upload loads the working patch

- **WHEN** a GP-5 session is ready, the current patch is synced, and the user uploads a valid GP-5 `.prst`
- **THEN** that file is applied onto the working patch through the open link
- **AND** no store write is sent solely because upload ran
- **AND** the snapshot current patch does not change
- **AND** no omission is reported

#### Scenario: GP-5 session loads a shared GP-50 file

- **WHEN** a GP-5 session is ready and the user uploads a valid GP-50 `.prst` whose factory models are all in the GP-5 catalog
- **THEN** that file is applied onto the working patch through the open link
- **AND** no store write is sent solely because upload ran
- **AND** no patch BPM write is sent
- **AND** no omission is reported
- **AND** the snapshot current patch does not change

#### Scenario: GP-50 session loads a GP-5 file

- **WHEN** a GP-50 session is ready and the user uploads a valid GP-5 `.prst`
- **THEN** that file is applied onto the working patch through the open link
- **AND** no store write is sent solely because upload ran
- **AND** GP-50 patch BPM is not overwritten by that file
- **AND** no omission is reported
- **AND** the snapshot current patch does not change

#### Scenario: GP-50-only model is omitted on GP-5

- **WHEN** a GP-5 session is ready, PRE is currently a model the GP-5 catalog includes, and the user uploads a valid GP-50 `.prst` whose PRE model is C-Wah
- **THEN** the session reports that PRE C-Wah was omitted
- **AND** no model write for C-Wah is sent
- **AND** the other transferable slots are still written
- **AND** PRE order and on/off from the file are still written
- **AND** no store write is sent solely because upload ran

#### Scenario: Shared model drops a GP-50-only control without an omission

- **WHEN** a GP-5 session is ready and the user uploads a valid GP-50 `.prst` whose MOD model exists on both pedals and includes a Sync control that only GP-50 has
- **THEN** that MOD model is written
- **AND** no Sync control write is sent
- **AND** no omission is reported for Sync

#### Scenario: User IR slot transfers across models

- **WHEN** a GP-5 session is ready and the user uploads a valid GP-50 `.prst` whose CAB model is User IR 03
- **THEN** a model write for that user-IR slot is sent
- **AND** no omission is reported for that CAB slot

#### Scenario: Invalid upload does not write

- **WHEN** a session is ready and the user would upload bytes that are not a valid Valeton `.prst`
- **THEN** the snapshot does not change
- **AND** no upload write is sent

#### Scenario: Syncing blocks upload

- **WHEN** the session is ready, the current patch is syncing, and the user would upload
- **THEN** the snapshot does not change
- **AND** no upload write is sent
