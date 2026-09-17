## MODIFIED Requirements

### Requirement: Controller shows the current patch audio chain

Once initial sync completes or times out, Controller SHALL draw the current patch's audio chain through the device session. GP-5 MUST show 10 ordered slots. GP-50 MUST show 11 ordered slots (the same 10 effect modules plus EXP at the end). Each occupied slot MUST show the module that sits there and whether that module is on or off. Labels MUST be in English. After the chain is shown, the ten effect slots (NR, PRE, DST, NS, AMP, CAB, EQ, MOD, DLY, RVB) MUST be toggles: activating one MUST flip that module's on/off through the device session and MUST NOT change module order. On GP-50, the EXP slot MUST be a toggle through the device session and MUST NOT appear on GP-5. Controller MUST NOT send raw MIDI. If the initial chain dump is missing, Controller MUST still show the default-order slots and MUST NOT treat unknown modules as on; those effect slots MUST still be togglable. Disconnecting MUST hide the chain.

Default order is NR (noise gate), PRE, DST, NS (SnapTone), AMP, CAB, EQ, MOD, DLY, RVB, then EXP on GP-50.

#### Scenario: GP-5 chain after sync
- **WHEN** a GP-5 session finishes initial sync with a chain dump
- **THEN** Controller shows 10 slots in the dumped order
- **AND** each slot shows its module and on/off state
- **AND** no EXP slot is shown

#### Scenario: GP-50 chain includes EXP
- **WHEN** a GP-50 session finishes initial sync with a chain dump
- **THEN** Controller shows 11 slots
- **AND** the last slot is EXP
- **AND** each slot shows its module and on/off state

#### Scenario: Module off is visible
- **WHEN** the current chain dump has DST off and AMP on
- **THEN** the DST slot is shown as off
- **AND** the AMP slot is shown as on

#### Scenario: Chain dump missing
- **WHEN** initial sync ends without an audio-chain dump
- **THEN** Controller still shows the patch bar
- **AND** it shows default-order slots for that model
- **AND** those modules are not shown as on
- **AND** no patch recall is sent solely because the dump was missing

#### Scenario: User toggles an effect slot
- **WHEN** the user activates the DST slot after sync while DST is on
- **THEN** the DST slot is shown as off
- **AND** that change is sent through the device session
- **AND** module order does not change

#### Scenario: Toggle still works without a dump
- **WHEN** initial sync ended without an audio-chain dump and the user activates the AMP slot
- **THEN** the AMP slot is shown as on
- **AND** that change is sent through the device session

#### Scenario: Slots do not edit yet
- **WHEN** a GP-50 session is showing the audio chain and the user activates the EXP slot while EXP is on
- **THEN** the EXP slot is shown as off
- **AND** that change is sent through the device session
- **AND** module order does not change

#### Scenario: USB and Bluetooth share the chain toggles
- **WHEN** a Bluetooth session is showing the audio chain and the user activates the MOD slot
- **THEN** Controller shows the same toggle presentation as USB for that model
- **AND** that change is sent through the device session

#### Scenario: Disconnect hides the chain
- **WHEN** the user disconnects while Controller is showing the audio chain
- **THEN** the chain is hidden
- **AND** the screen states that no pedals are connected

## ADDED Requirements

### Requirement: Bluetooth pedal module changes update the chain

After initial sync, when the session is on Bluetooth and the pedal reports a module on/off change for the current patch, Controller MUST update that slot's on/off through the device session without changing module order and without sending patch recall or a chain dump solely because that report arrived. When the session is on USB, Controller MUST keep the last known on/off for that slot even if a live-module report arrives. Volume and other non-module live controls MUST NOT update the chain.

#### Scenario: Pedal turns a module off over Bluetooth
- **WHEN** a Bluetooth session is showing DST on and the pedal reports DST off
- **THEN** the DST slot is shown as off
- **AND** module order does not change
- **AND** no patch recall is sent solely because that report arrived

#### Scenario: Pedal turns EXP off over Bluetooth
- **WHEN** a GP-50 Bluetooth session is showing EXP on and the pedal reports EXP off
- **THEN** the EXP slot is shown as off
- **AND** no patch recall is sent solely because that report arrived

#### Scenario: USB does not follow pedal module reports
- **WHEN** a USB session is showing DST on and a live-module report for DST off arrives
- **THEN** the DST slot stays shown as on
