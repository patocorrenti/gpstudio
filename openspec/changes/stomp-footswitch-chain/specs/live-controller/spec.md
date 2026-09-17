## MODIFIED Requirements

### Requirement: Bluetooth pedal module changes update the chain

After initial sync, when the session is on Bluetooth and the pedal reports a module on/off change for the current patch, Controller MUST update that slot's on/off through the device session without changing module order and without sending patch recall or a chain dump solely because that report arrived. Stomp-mode footswitches that toggle effect modules are such reports: Controller MUST follow those on/off changes through the device session. Controller MUST NOT show the chain-refresh busy overlay solely because a footswitch was pressed. When the session is on USB, Controller MUST keep the last known on/off for that slot even if a live-module or stomp report arrives. Volume and other non-module live controls MUST NOT update the chain.

#### Scenario: Pedal turns a module off over Bluetooth
- **WHEN** a Bluetooth session is showing DST on and the pedal reports DST off
- **THEN** the DST slot is shown as off
- **AND** module order does not change
- **AND** no patch recall is sent solely because that report arrived

#### Scenario: Pedal turns EXP off over Bluetooth
- **WHEN** a GP-50 Bluetooth session is showing EXP on and the pedal reports EXP off
- **THEN** the EXP slot is shown as off
- **AND** no patch recall is sent solely because that report arrived

#### Scenario: Stomp footswitch toggles a module over Bluetooth
- **WHEN** a Bluetooth session is showing DST on and the user presses a Stomp-mode footswitch that turns DST off
- **THEN** the DST slot is shown as off
- **AND** module order does not change
- **AND** no patch recall is sent solely because that footswitch was pressed
- **AND** the chain-refresh busy overlay is not shown solely because that footswitch was pressed

#### Scenario: Stomp footswitch updates every reported module
- **WHEN** a Bluetooth session is showing MOD on and DLY off and a Stomp-mode footswitch reports MOD off and DLY on
- **THEN** the MOD slot is shown as off
- **AND** the DLY slot is shown as on
- **AND** module order does not change

#### Scenario: GP-5 Bluetooth footswitch follows the chain
- **WHEN** a GP-5 Bluetooth session is showing AMP on and a footswitch turns AMP off
- **THEN** the AMP slot is shown as off
- **AND** the chain-refresh busy overlay is not shown solely because that footswitch was pressed

#### Scenario: USB does not follow pedal module reports
- **WHEN** a USB session is showing DST on and a live-module report for DST off arrives
- **THEN** the DST slot stays shown as on

#### Scenario: USB does not follow a Stomp footswitch
- **WHEN** a USB session is showing DST on and a Stomp-mode footswitch turns DST off on the pedal
- **THEN** the DST slot stays shown as on
