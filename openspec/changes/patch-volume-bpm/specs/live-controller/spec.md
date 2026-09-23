## ADDED Requirements

### Requirement: Patch bar edits patch volume and patch BPM

After the patch bar is shown, Controller SHALL show a patch-volume control for GP-5 and GP-50 and a patch-BPM control for GP-50 only. Labels MUST be in English (`Volume` and `BPM`). The volume control MUST cover 0–100. The BPM control MUST cover 40–260. GP-5 MUST NOT show a BPM control. Placement inside the patch bar is enough; a later layout pass may move them within that bar.

Each control MUST show the value from the current-preset dump once that value is known, and MUST NOT be usable before then. It MUST NOT send a write while it is unusable, including while the current patch is syncing. Dragging MUST update the displayed number on-change. Writes for that drag MUST be throttled so the session does not send a value for every intermediate step. Releasing MUST send the last value if it was not already sent. Setting a value MUST go through the device session and MUST NOT send raw MIDI from React. The same controls MUST be used on USB and Bluetooth. Disconnecting MUST hide them with the patch bar.

#### Scenario: GP-50 bar shows volume and BPM from the dump
- **WHEN** a GP-50 session is showing the patch bar and the current-preset dump has patch volume 80 and patch BPM 120
- **THEN** Controller shows Volume at 80 and BPM at 120

#### Scenario: GP-5 bar shows volume and hides BPM
- **WHEN** a GP-5 session is showing the patch bar and the current-preset dump has patch volume 80
- **THEN** Controller shows Volume at 80
- **AND** Controller does not show a BPM control

#### Scenario: Unknown dump keeps the controls unusable
- **WHEN** the patch bar is shown and the current-preset dump has not supplied patch volume
- **THEN** Volume cannot be used
- **AND** no patch-volume write is sent

#### Scenario: User sets patch volume through the session
- **WHEN** Volume is showing 80 and the user sets it to 60
- **THEN** Volume shows 60
- **AND** that change is sent through the device session

#### Scenario: User sets GP-50 patch BPM through the session
- **WHEN** a GP-50 session is showing BPM at 120 and the user sets it to 140
- **THEN** BPM shows 140
- **AND** that change is sent through the device session

#### Scenario: Slider drag does not send every step
- **WHEN** Volume is showing 80 and the user drags it toward 40 without releasing
- **THEN** Volume follows the dragged value
- **AND** the session does not send a patch-volume write for every intermediate value

#### Scenario: Slider release sends the last value
- **WHEN** the user releases the Volume control after dragging
- **THEN** the last displayed volume is sent through the device session if it was not already sent

#### Scenario: Syncing blocks volume and BPM
- **WHEN** the user has selected another patch and the new current-preset dump has not arrived yet
- **THEN** Volume cannot be used
- **AND** on GP-50, BPM cannot be used
- **AND** no patch-volume or patch-BPM write is sent

#### Scenario: USB and Bluetooth share the controls
- **WHEN** a Bluetooth session is showing Volume from a current-preset dump and the user sets a new volume
- **THEN** Controller uses the same Volume control as USB
- **AND** that change is sent through the device session

#### Scenario: Disconnect hides volume and BPM
- **WHEN** the user disconnects while Volume is showing
- **THEN** Volume is hidden
- **AND** BPM is hidden

## MODIFIED Requirements

### Requirement: Controller Save follows the working modified state

After the patch bar is shown, Save MUST appear before Rename. Save MUST NOT be usable when the current working patch is not modified, and MUST NOT be usable while the current patch is syncing. When the working patch is modified and synced, Save MUST be usable and MUST use an emerald style distinct from the other patch-bar actions. Hovering previous, next, or the patch selector MUST show an English tooltip that unsaved changes will be lost. That tooltip MUST NOT block choosing or stepping to another patch. Controller MUST NOT show a separate Modified label. The same presentation MUST be used on USB and Bluetooth. Controller MUST NOT send raw MIDI.

A patch-volume edit, and on GP-50 a patch-BPM edit, that differs from the baseline MUST make Save usable with that same emerald style. Restoring patch volume, and on GP-50 patch BPM, to the baseline while the rest of the working patch also matches MUST make Save unusable.

#### Scenario: Loaded patch cannot Save
- **WHEN** the session is ready, a current-preset dump for the selected patch has landed, and the user has not changed the working patch (chain, patch volume, and on GP-50 patch BPM)
- **THEN** Save cannot be used
- **AND** Controller does not show a Modified label

#### Scenario: A working edit enables emerald Save
- **WHEN** the session is ready with a dumped current patch and the user turns DST off
- **THEN** Save can be used
- **AND** Save uses an emerald style
- **AND** Save appears before Rename

#### Scenario: A volume edit enables emerald Save
- **WHEN** the session is ready with dumped patch volume 80 and the user sets Volume to 60
- **THEN** Save can be used
- **AND** Save uses an emerald style

#### Scenario: A GP-50 BPM edit enables emerald Save
- **WHEN** a GP-50 session is ready with dumped patch BPM 120 and the user sets BPM to 140
- **THEN** Save can be used
- **AND** Save uses an emerald style

#### Scenario: Restoring the baseline disables Save
- **WHEN** Save is usable because DST was turned off and the user turns DST on again so the working chain matches the dumped patch
- **THEN** Save cannot be used

#### Scenario: Restoring patch volume disables Save
- **WHEN** Save is usable only because Volume was set away from the dumped value and the user sets Volume back to that dumped value
- **THEN** Save cannot be used

#### Scenario: Restoring GP-50 patch BPM disables Save
- **WHEN** Save is usable only because BPM was set away from the dumped value and the user sets BPM back to that dumped value
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
- **WHEN** the user selects another patch after sync, that patch's dump matches the chain already shown, and the user has not changed the working patch
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
