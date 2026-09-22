## MODIFIED Requirements

### Requirement: Connected session syncs the current audio chain

After a USB or Bluetooth session is marked connected, the device session SHALL request the current patch's audio-chain dump on the open link after patch identity (names and current index) or when that identity step times out. The connected snapshot MUST carry the current chain (module order and on/off) when a dump is decoded. If the dump times out or SysEx is unavailable, the session MUST still become ready after patch identity and MUST NOT send patch recall solely because the dump was missing. The chain request MAY continue in the background after the session is ready. After the session is ready, choosing a patch or a pedal-initiated patch report MUST refresh the chain for that patch without sending extra patch recall solely to obtain the dump. A decoded dump for that newly selected patch MUST be applied even when its chain equals the chain already shown. The session MUST NOT discard that dump because of that equality. Applying it MUST end the refresh: the snapshot carries that chain, the dump is held for download, and the patch is no longer syncing. Disconnect MUST drop chain state.

#### Scenario: USB connect requests the chain

- **WHEN** a USB session becomes connected and SysEx is available
- **THEN** the session requests the current patch audio-chain dump on the USB link
- **AND** no patch recall is sent solely because the session connected

#### Scenario: Bluetooth connect requests the chain

- **WHEN** a Bluetooth session becomes connected
- **THEN** the session requests the current patch audio-chain dump on the Bluetooth link
- **AND** no patch recall is sent solely because the session connected

#### Scenario: Chain dump timeout still becomes ready

- **WHEN** initial sync ends without an audio-chain dump
- **THEN** the session is ready
- **AND** no patch recall is sent solely because the dump was missing

#### Scenario: User patch change refreshes the chain

- **WHEN** the session is ready and the user selects another patch
- **THEN** that patch is sent through the device session
- **AND** the session requests or applies a chain dump for the new patch
- **AND** no extra patch recall is sent solely to obtain that dump

#### Scenario: Identical patch dump is applied

- **WHEN** the session is ready, the user selects another patch, and the dump for that patch decodes to the same chain already shown
- **THEN** the session applies that dump
- **AND** the current patch is no longer syncing
- **AND** download can use that dump
- **AND** no extra patch recall is sent solely to obtain that dump

#### Scenario: Pedal identical patch dump is applied

- **WHEN** the session is ready, the pedal reports a new current patch, and the dump for that patch decodes to the same chain already shown
- **THEN** the session applies that dump
- **AND** the current patch is no longer syncing
- **AND** no patch recall is sent solely because that inbound report arrived

#### Scenario: Pedal patch change refreshes the chain

- **WHEN** the session is ready and the pedal reports a new current patch
- **THEN** the session requests or applies a chain dump for that patch
- **AND** no patch recall is sent solely because that inbound report arrived

#### Scenario: Lost link during a patch change disconnects

- **WHEN** the session is ready, the user selects another patch, and the open USB or Bluetooth link is gone
- **THEN** the session becomes disconnected
- **AND** the chrome control reads Connect

### Requirement: Connected session tracks whether the working patch is modified

After a USB or Bluetooth session is ready, the connected snapshot MUST report whether the current working chain (module order, on/off, factory model, and control values) differs from a baseline kept for the selected patch. The session MUST capture that baseline from the current-preset dump that lands for a newly selected patch (connect, user recall, or pedal-initiated patch change) and MUST report not modified then. A dump that matches the chain already shown MUST still capture that baseline and MUST still report not modified. A user reload of the selected patch MUST re-request that patch's current-preset dump, MUST NOT send patch recall, MUST capture the baseline from the dump that lands, and MUST report not modified then. The session MUST recapture that baseline from the current working chain after a successful Save or rename of the current slot and MUST report not modified then.

Any later working-chain change that still differs from the baseline (module on/off, reorder, model, control, Bluetooth live follow of those fields, or a successful upload whose dump does not match the baseline) MUST report modified. A later working-chain change that matches the baseline again MUST report not modified. Duplicate onto another slot MUST NOT recapture the current-slot baseline. A dump refresh that is not a newly selected patch (download, upload) MUST NOT recapture the baseline as the stored patch. While the current patch is syncing, or when no dump has been captured for the selected patch, the snapshot MUST report not modified. Changing patch MUST drop the baseline. Disconnect MUST drop that working state.

#### Scenario: Dump of the selected patch starts clean

- **WHEN** a USB or Bluetooth session is ready and a current-preset dump for the selected patch is decoded
- **THEN** the snapshot reports not modified

#### Scenario: Identical patch dump starts clean

- **WHEN** the session is ready, the user selects another patch, and the dump for that patch decodes to the same chain already shown
- **THEN** the snapshot reports not modified
- **AND** a later edit that turns DST off reports modified

#### Scenario: Reload of the selected patch starts clean

- **WHEN** the session is ready on the selected patch and the user reloads that patch
- **THEN** the session re-requests the current-preset dump
- **AND** the snapshot reports not modified after that dump lands
- **AND** the selected patch does not change
- **AND** no patch recall is sent solely because reload ran

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
