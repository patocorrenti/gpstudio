## ADDED Requirements

### Requirement: Connected session writes patch volume and patch BPM

After a USB or Bluetooth session is ready and a current-preset dump has supplied the value, the connected snapshot MUST carry patch volume for GP-5 and GP-50 (integer 0–100) and patch BPM for GP-50 (integer 40–260). GP-5 MUST NOT carry an editable patch BPM and MUST NOT send a tempo write.

Changing patch volume MUST update the snapshot on-change and MUST send official MIDI CC 7 with that value (0–100) through the open link. Changing GP-50 patch BPM MUST update the snapshot on-change and MUST send official tempo as CC 73 then CC 74: BPM 40–127 is CC 73 = 0 and CC 74 = BPM; BPM 128–255 is CC 73 = 1 and CC 74 = BPM − 128; BPM 256–260 is CC 73 = 2 and CC 74 = BPM − 256. Slider drags MUST coalesce those writes (throttle, flush on release) so Bluetooth is not flooded. The session MUST NOT send a value outside those ranges. The session MUST NOT send the GP-50 relative step controllers (CC 17, CC 19, or CC 21) for these edits. The session MUST NOT send extra patch recall or an audio-chain dump solely because volume or BPM changed.

A current-preset dump for a newly selected patch, a user reload, or a dump applied while the working patch is not modified MUST set the snapshot volume and, on GP-50, BPM from that dump. A dump discarded because the user already edited MUST leave the edited volume and BPM on the snapshot. Download of a patch the user has edited MUST carry that edited patch volume and, on GP-50, that edited patch BPM. Inbound CC 7, CC 73, and CC 74 MUST NOT update snapshot volume, BPM, or the chain while the selected patch stays the same, on USB and on Bluetooth. On Bluetooth, an inbound live patch-volume SysEx notify (identity-family, size `0x07`, path `01 02 04`, preset-volume body) MUST update snapshot patch volume and MUST update `modified` when that value differs from the baseline. USB MUST NOT apply that notify to the snapshot. Disconnect MUST drop those values.

#### Scenario: USB volume sends CC 7
- **WHEN** a USB session is ready with dumped patch volume 80 and the user sets patch volume to 60
- **THEN** the snapshot patch volume is 60
- **AND** CC 7 value 60 is sent on the USB link
- **AND** no patch recall or chain dump is sent solely because volume changed

#### Scenario: Bluetooth volume sends CC 7
- **WHEN** a Bluetooth session is ready with a dumped patch volume and the user sets patch volume to 60
- **THEN** the snapshot patch volume is 60
- **AND** CC 7 value 60 is sent on the Bluetooth link

#### Scenario: GP-50 BPM 120 sends tempo CC
- **WHEN** a GP-50 session is ready with dumped patch BPM 100 and the user sets patch BPM to 120
- **THEN** the snapshot patch BPM is 120
- **AND** CC 73 value 0 is sent, then CC 74 value 120
- **AND** no patch recall or chain dump is sent solely because BPM changed

#### Scenario: GP-50 BPM 140 uses the second tempo range
- **WHEN** a GP-50 session is ready and the user sets patch BPM to 140
- **THEN** CC 73 value 1 is sent, then CC 74 value 12

#### Scenario: GP-50 BPM 260 uses the third tempo range
- **WHEN** a GP-50 session is ready and the user sets patch BPM to 260
- **THEN** CC 73 value 2 is sent, then CC 74 value 4

#### Scenario: GP-5 does not send tempo
- **WHEN** a GP-5 session is ready
- **THEN** the snapshot has no editable patch BPM
- **AND** no CC 73 or CC 74 write is sent

#### Scenario: Out-of-range volume is not sent
- **WHEN** a session is ready and a patch volume outside 0–100 would be written
- **THEN** the snapshot patch volume does not change
- **AND** no CC 7 is sent

#### Scenario: Dump fills volume and BPM
- **WHEN** a GP-50 session decodes a current-preset dump for the selected patch with patch volume 80 and patch BPM 120, and the working patch is not modified
- **THEN** the snapshot patch volume is 80
- **AND** the snapshot patch BPM is 120

#### Scenario: Edited volume survives a discarded dump
- **WHEN** the user has set patch volume away from the dump and a later dump is discarded because the working patch is already edited
- **THEN** the snapshot keeps that edited patch volume

#### Scenario: Download carries the edited volume
- **WHEN** a session is ready, the user sets patch volume to 60, and the user downloads the current patch
- **THEN** the Valeton `.prst` carries patch volume 60
- **AND** the snapshot patch volume stays 60

#### Scenario: Download carries the edited GP-50 BPM
- **WHEN** a GP-50 session is ready, the user sets patch BPM to 140, and the user downloads the current patch
- **THEN** the Valeton `.prst` carries patch BPM 140

#### Scenario: Inbound volume CC does not move the snapshot
- **WHEN** a session is ready with patch volume 80 and inbound CC 7 value 40 arrives while the selected patch stays the same
- **THEN** the snapshot patch volume stays 80
- **AND** the snapshot chain does not change from that CC

#### Scenario: Bluetooth live volume SysEx updates the snapshot
- **WHEN** a Bluetooth session is ready with patch volume 50 and an inbound live patch-volume SysEx for 51 arrives while the selected patch stays the same
- **THEN** the snapshot patch volume is 51
- **AND** no patch recall or chain dump is sent solely because that notify arrived

#### Scenario: USB ignores live volume SysEx
- **WHEN** a USB session is ready with patch volume 50 and an inbound live patch-volume SysEx for 51 arrives
- **THEN** the snapshot patch volume stays 50

#### Scenario: Disconnect drops volume and BPM
- **WHEN** the user disconnects while the snapshot has a patch volume
- **THEN** that patch volume and patch BPM are dropped

## MODIFIED Requirements

### Requirement: Connected session tracks whether the working patch is modified

After a USB or Bluetooth session is ready, the connected snapshot MUST report whether the current working patch differs from a baseline kept for the selected patch. That comparison MUST include the working chain (module order, on/off, factory model, and control values), patch volume on GP-5 and GP-50, and patch BPM on GP-50. GP-5 MUST NOT include BPM in that comparison. The session MUST capture that baseline from the current-preset dump that lands for a newly selected patch (connect, user recall, or pedal-initiated patch change) and MUST report not modified then. A dump that matches the chain already shown MUST still capture that baseline and MUST still report not modified. A matching confirmation dump MUST NOT recapture the baseline and MUST leave modified unchanged. A mismatched confirmation that replaces the chain MUST recapture the baseline and MUST report not modified. A confirmation discarded because the user already edited MUST leave modified as it was. A user reload of the selected patch MUST re-request that patch's current-preset dump, MUST NOT send patch recall, MUST capture the baseline from the dump that lands, and MUST report not modified then. The session MUST recapture that baseline from the current working patch after a successful Save or rename of the current slot and MUST report not modified then.

Any later working-patch change that still differs from the baseline (module on/off, reorder, model, control, patch volume, GP-50 patch BPM, Bluetooth live follow of chain fields, or a successful upload whose dump does not match the baseline) MUST report modified. A later working-patch change that matches the baseline again MUST report not modified. Duplicate onto another slot MUST NOT recapture the current-slot baseline. A dump refresh that is not a newly selected patch (download, upload) MUST NOT recapture the baseline as the stored patch. While the current patch is syncing, or when no dump has been captured for the selected patch, the snapshot MUST report not modified. Changing patch MUST drop the baseline. Disconnect MUST drop that working state. Inbound patch-volume or tempo CC MUST NOT by itself report modified while the selected patch stays the same. A Bluetooth live patch-volume SysEx that leaves the baseline MUST report modified.

#### Scenario: Dump of the selected patch starts clean
- **WHEN** a USB or Bluetooth session is ready and a current-preset dump for the selected patch is decoded
- **THEN** the snapshot reports not modified

#### Scenario: Identical patch dump starts clean
- **WHEN** the session is ready, the user selects another patch, and the dump for that patch decodes to the same chain already shown
- **THEN** the snapshot reports not modified
- **AND** a later edit that turns DST off reports modified

#### Scenario: Matching confirmation leaves modified unchanged
- **WHEN** a patch-change dump has been applied and a confirmation dump matches that chain
- **THEN** the snapshot reports not modified
- **AND** the baseline stays the chain from the patch-change dump

#### Scenario: Mismatched confirmation starts clean
- **WHEN** a patch-change dump has been applied, the working patch is not modified, and a confirmation dump has a different chain
- **THEN** the snapshot reports not modified
- **AND** the baseline is that confirmation's chain

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

#### Scenario: A volume edit is modified
- **WHEN** the snapshot has a baseline patch volume of 80 and the user sets patch volume to 60
- **THEN** the snapshot reports modified
- **AND** no extra patch recall is sent solely because volume changed

#### Scenario: A GP-50 BPM edit is modified
- **WHEN** a GP-50 snapshot has a baseline patch BPM of 120 and the user sets patch BPM to 140
- **THEN** the snapshot reports modified

#### Scenario: Restoring the dumped values clears modified
- **WHEN** the snapshot is modified because DST was turned off and the user turns DST on again so the working chain matches the baseline
- **THEN** the snapshot reports not modified

#### Scenario: Restoring patch volume clears modified
- **WHEN** the snapshot is modified only because patch volume left the baseline and the user sets that volume back to the baseline
- **THEN** the snapshot reports not modified

#### Scenario: Restoring GP-50 patch BPM clears modified
- **WHEN** the snapshot is modified only because patch BPM left the baseline and the user sets that BPM back to the baseline
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

#### Scenario: Inbound volume CC does not mark modified
- **WHEN** a session has a baseline patch volume of 80 and inbound CC 7 value 40 arrives while the selected patch stays the same
- **THEN** the snapshot reports not modified

#### Scenario: Bluetooth live volume SysEx can mark modified
- **WHEN** a Bluetooth session has a baseline patch volume of 50 and an inbound live patch-volume SysEx for 51 arrives
- **THEN** the snapshot reports modified

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
