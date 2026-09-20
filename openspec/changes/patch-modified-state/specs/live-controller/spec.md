## ADDED Requirements

### Requirement: Controller shows when the working patch is modified

After the patch bar is shown, Controller MUST show an English Modified mark when the device session reports that the current working patch differs from the last loaded or stored baseline. The mark MUST NOT appear after a current-preset dump for the selected patch lands if the user has not changed that working chain. The mark MUST hide when the working chain matches that baseline again, after Save or rename of the current slot, after the selected patch changes, while the current patch is syncing, and when disconnected. Duplicate MUST NOT hide the mark solely because another slot was stored. Download MUST NOT hide the mark solely because a file was produced. Upload MUST show the mark when the loaded file differs from the baseline. The same presentation MUST be used on USB and Bluetooth. Controller MUST NOT send raw MIDI.

#### Scenario: Loaded patch is not modified
- **WHEN** the session is ready, a current-preset dump for the selected patch has landed, and the user has not changed the working chain
- **THEN** Controller does not show Modified

#### Scenario: A working edit shows Modified
- **WHEN** the session is ready with a dumped current patch and the user turns DST off
- **THEN** Controller shows Modified

#### Scenario: Restoring the baseline hides Modified
- **WHEN** Controller is showing Modified because DST was turned off and the user turns DST on again so the working chain matches the dumped patch
- **THEN** Controller does not show Modified

#### Scenario: Save hides Modified
- **WHEN** Controller is showing Modified and the user Saves the current slot
- **THEN** Controller does not show Modified
- **AND** the selected patch does not change

#### Scenario: Rename of the current slot hides Modified
- **WHEN** Controller is showing Modified and the user renames the current patch
- **THEN** Controller does not show Modified

#### Scenario: Duplicate keeps Modified
- **WHEN** Controller is showing Modified and the user duplicates onto another slot
- **THEN** Controller still shows Modified
- **AND** the selected patch does not change

#### Scenario: Upload of a different file shows Modified
- **WHEN** the session is ready with a dumped current patch and the user confirms upload of a Valeton `.prst` whose chain differs from that dump
- **THEN** Controller shows Modified
- **AND** no store write is sent solely because upload ran

#### Scenario: Changing patch hides Modified
- **WHEN** Controller is showing Modified and the user selects another patch
- **THEN** Controller does not show Modified for the newly selected patch after that patch's dump lands

#### Scenario: Disconnect hides Modified
- **WHEN** Controller is showing Modified and the user disconnects
- **THEN** the Modified mark is hidden
- **AND** the screen states that no pedals are connected

#### Scenario: USB and Bluetooth share Modified
- **WHEN** a Bluetooth session is ready with a dumped current patch and the user turns DST off
- **THEN** Controller shows the same Modified presentation as USB
