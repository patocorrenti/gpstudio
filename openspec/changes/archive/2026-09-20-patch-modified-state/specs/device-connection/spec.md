## ADDED Requirements

### Requirement: Connected session tracks whether the working patch is modified

After a USB or Bluetooth session is ready, the connected snapshot MUST report whether the current working chain (module order, on/off, factory model, and control values) differs from a baseline kept for the selected patch. The session MUST capture that baseline from the current-preset dump that lands for a newly selected patch (connect, user recall, or pedal-initiated patch change) and MUST report not modified then. The session MUST recapture that baseline from the current working chain after a successful Save or rename of the current slot and MUST report not modified then.

Any later working-chain change that still differs from the baseline (module on/off, reorder, model, control, Bluetooth live follow of those fields, or a successful upload whose dump does not match the baseline) MUST report modified. A later working-chain change that matches the baseline again MUST report not modified. Duplicate onto another slot MUST NOT recapture the current-slot baseline. A dump refresh that is not a newly selected patch (download, upload) MUST NOT recapture the baseline as the stored patch. While the current patch is syncing, or when no dump has been captured for the selected patch, the snapshot MUST report not modified. Changing patch MUST drop the baseline. Disconnect MUST drop that working state.

#### Scenario: Dump of the selected patch starts clean
- **WHEN** a USB or Bluetooth session is ready and a current-preset dump for the selected patch is decoded
- **THEN** the snapshot reports not modified

#### Scenario: A working edit is modified
- **WHEN** the snapshot has a baseline from that dump and the user turns DST off
- **THEN** the snapshot reports modified
- **AND** no extra patch recall is sent solely because the module was toggled

#### Scenario: Restoring the dumped values clears modified
- **WHEN** the snapshot is modified because DST was turned off and the user turns DST on again so the working chain matches the baseline
- **THEN** the snapshot reports not modified

#### Scenario: A knob that returns to the dumped value clears modified
- **WHEN** the snapshot has a baseline AMP Gain of 30, the user drags that control to 45, then drags it back to 30
- **THEN** the snapshot reports not modified

#### Scenario: Bluetooth live follow can mark modified
- **WHEN** a Bluetooth session has a baseline from the current dump and the pedal reports DST off
- **THEN** the snapshot reports modified
- **AND** no extra patch recall is sent solely because that inbound report arrived

#### Scenario: USB live reports do not mark modified
- **WHEN** a USB session has a baseline from the current dump and a live-module report arrives
- **THEN** the snapshot modified flag does not change from that inbound report

#### Scenario: Save recaptures the baseline
- **WHEN** the snapshot is modified and the user Saves the current slot
- **THEN** the snapshot reports not modified
- **AND** no extra patch recall or chain dump is sent solely because Save ran

#### Scenario: Rename of the current slot recaptures the baseline
- **WHEN** the snapshot is modified and the user renames the current patch
- **THEN** the snapshot reports not modified
- **AND** the snapshot name for that slot is the new name

#### Scenario: Duplicate does not recapture the current baseline
- **WHEN** the snapshot is modified and the user duplicates onto another slot
- **THEN** the snapshot still reports modified
- **AND** the current patch index does not change

#### Scenario: Download dump does not recapture as stored
- **WHEN** the snapshot is modified and the user downloads the current patch
- **THEN** the snapshot still reports modified after that dump refresh

#### Scenario: Upload dump does not recapture as stored
- **WHEN** the snapshot has a baseline from the current dump and a successful upload of a different Valeton `.prst` refreshes the current-preset dump
- **THEN** the snapshot reports modified
- **AND** no store write is sent solely because upload ran

#### Scenario: Changing patch drops the baseline
- **WHEN** the snapshot is modified, the user selects another patch, and a dump for that patch is decoded
- **THEN** the snapshot reports not modified

#### Scenario: Missing dump is not modified
- **WHEN** the session is ready without a current-preset dump for the selected patch
- **THEN** the snapshot reports not modified

#### Scenario: Disconnect drops modified state
- **WHEN** the user disconnects while the snapshot reports modified
- **THEN** that working modified state is dropped
