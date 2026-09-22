## MODIFIED Requirements

### Requirement: Patch changes refresh the audio chain

After initial sync, when the selected patch changes (user previous / select / next, or a pedal-initiated patch report), Controller MUST update the chain through the device session when a dump for that patch arrives. A dump whose chain equals the chain already shown MUST still count as that dump arriving. Controller MUST NOT send patch recall solely to obtain that dump. While that refresh is in progress, Controller MUST cover every patch control below the patch bar with an English busy overlay so those controls cannot be used. Previous, next, Save, rename, duplicate, download, and upload MUST NOT be usable until that dump arrives or the refresh times out. The 00–99 selector MAY stay usable. The same chain MUST be used on USB and Bluetooth.

#### Scenario: User selects another patch

- **WHEN** the user selects patch `42` after sync and a chain dump for that patch arrives
- **THEN** Controller shows that dump's module order and on/off states
- **AND** no extra patch recall is sent solely to obtain the dump

#### Scenario: Chain refresh covers patch controls

- **WHEN** the user selects another patch after sync and the new chain dump has not arrived yet
- **THEN** Controller shows a busy overlay over the audio chain and any other patch controls below the patch bar
- **AND** those covered controls cannot be used

#### Scenario: Patch bar waits for the new dump

- **WHEN** the user selects another patch after sync and the new chain dump has not arrived yet
- **THEN** previous, next, Save, rename, duplicate, download, and upload cannot be used
- **AND** the 00–99 selector may still change patch

#### Scenario: Chain refresh overlay clears

- **WHEN** a chain dump for the newly selected patch arrives
- **THEN** the busy overlay is hidden
- **AND** Controller shows that dump's module order and on/off states
- **AND** previous, next, Save, rename, duplicate, download, and upload are usable again

#### Scenario: Identical patch dump clears the overlay

- **WHEN** the user selects another patch after sync and the dump for that patch has the same module order and on/off as the chain already shown
- **THEN** the busy overlay is hidden
- **AND** previous, next, Save, rename, duplicate, download, and upload are usable again
- **AND** Controller shows that chain

#### Scenario: Pedal changes patch after sync

- **WHEN** the pedal reports it moved to patch `17` after sync and a chain dump for that patch arrives
- **THEN** Controller shows that dump's module order and on/off states
- **AND** no patch recall is sent solely because that inbound report arrived

#### Scenario: Lost link during a patch change shows the empty state

- **WHEN** the user selects another patch after sync and the pedal is no longer connected
- **THEN** Controller states that no pedals are connected
- **AND** the patch bar and audio chain are hidden

#### Scenario: USB and Bluetooth share the chain

- **WHEN** a Bluetooth session finishes initial sync with a chain dump
- **THEN** Controller shows the same slot count and on/off presentation as USB for that model

### Requirement: Controller Save follows the working modified state

After the patch bar is shown, Save MUST appear before Rename. Save MUST NOT be usable when the current working patch is not modified, and MUST NOT be usable while the current patch is syncing. When the working patch is modified and synced, Save MUST be usable and MUST use an emerald style distinct from the other patch-bar actions. Hovering previous, next, or the patch selector MUST show an English tooltip that unsaved changes will be lost. That tooltip MUST NOT block choosing or stepping to another patch. Controller MUST NOT show a separate Modified label. The same presentation MUST be used on USB and Bluetooth. Controller MUST NOT send raw MIDI.

#### Scenario: Loaded patch cannot Save

- **WHEN** the session is ready, a current-preset dump for the selected patch has landed, and the user has not changed the working chain
- **THEN** Save cannot be used
- **AND** Controller does not show a Modified label

#### Scenario: A working edit enables emerald Save

- **WHEN** the session is ready with a dumped current patch and the user turns DST off
- **THEN** Save can be used
- **AND** Save uses an emerald style
- **AND** Save appears before Rename

#### Scenario: Restoring the baseline disables Save

- **WHEN** Save is usable because DST was turned off and the user turns DST on again so the working chain matches the dumped patch
- **THEN** Save cannot be used

#### Scenario: Save after an edit stores and disables Save

- **WHEN** Save is usable and the user Saves the current slot
- **THEN** the current working patch is stored on the pedal in the current slot through the device session
- **AND** Save cannot be used
- **AND** the selected patch does not change

#### Scenario: Rename of the current slot disables Save

- **WHEN** Save is usable and the user renames the current patch
- **THEN** Save cannot be used

#### Scenario: Duplicate keeps Save enabled

- **WHEN** Save is usable and the user duplicates onto another slot
- **THEN** Save can still be used
- **AND** the selected patch does not change

#### Scenario: Upload of a different file enables Save

- **WHEN** the session is ready with a dumped current patch and the user confirms upload of a Valeton `.prst` whose chain differs from that dump
- **THEN** Save can be used
- **AND** no store write is sent solely because upload ran

#### Scenario: Changing patch disables Save

- **WHEN** Save is usable and the user selects another patch
- **THEN** Save cannot be used for the newly selected patch after that patch's dump lands

#### Scenario: Identical patch dump keeps Save disabled until an edit

- **WHEN** the user selects another patch after sync, that patch's dump matches the chain already shown, and the user has not changed the working chain
- **THEN** Save cannot be used
- **AND** after the user turns DST off, Save can be used

#### Scenario: Disconnect hides Save

- **WHEN** Save is usable and the user disconnects
- **THEN** Save is hidden
- **AND** the screen states that no pedals are connected

#### Scenario: Unsaved-edit tooltip warns without blocking

- **WHEN** Save is usable and the user hovers previous, next, or the patch selector
- **THEN** Controller shows an English tooltip that unsaved changes will be lost
- **AND** previous, next, and the selector can still change patch

#### Scenario: Clean patch has no unsaved-edit tooltip

- **WHEN** the session is ready with a dumped current patch that matches the baseline
- **THEN** hovering previous, next, or the patch selector does not show an unsaved-changes tooltip

#### Scenario: USB and Bluetooth share Save

- **WHEN** a Bluetooth session is ready with a dumped current patch and the user turns DST off
- **THEN** Controller shows the same Save presentation as USB
