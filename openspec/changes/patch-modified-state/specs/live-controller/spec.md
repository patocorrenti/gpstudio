## ADDED Requirements

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
