## ADDED Requirements

### Requirement: CAB panel lists onboard user IR slots

When Controller is showing a CAB control panel, the model select MUST include the twenty onboard user IR slots together with the factory CAB models for the connected pedal. Until IR names are known, those slots MUST use the English fallback labels `User IR 01` through `User IR 20`. When the session has a name for a slot, the select MUST show that name instead of the fallback. A blank or missing name MUST keep the fallback. The same labels MUST be used on USB and Bluetooth. Controller MUST NOT send raw MIDI.

Selecting a user IR slot MUST go through the device session the same way as selecting a factory CAB model. Identity loading and chain refresh MUST NOT wait for IR names. If names arrive after the CAB panel is already shown, the select MUST update those labels without hiding the panel or sending patch recall.

#### Scenario: User IR dump shows the CAB panel
- **WHEN** a session is showing the audio chain with CAB on and a dump that loaded User IR 03 with VOL at 50
- **THEN** Controller shows a CAB panel
- **AND** that panel lists User IR 03 or that slot's dumped name
- **AND** that panel shows VOL at 50

#### Scenario: Fallback labels before names arrive
- **WHEN** a session is showing a CAB panel whose loaded model is a user IR slot and IR names have not arrived
- **THEN** that panel's model select lists `User IR 01` through `User IR 20`

#### Scenario: Dumped name replaces the fallback
- **WHEN** a CAB panel is listing `User IR 03` and the session receives the name `Greenback 412` for that slot
- **THEN** that panel's model select lists `Greenback 412` for that slot
- **AND** the panel stays shown
- **AND** no patch recall is sent solely because the name arrived

#### Scenario: Blank IR name keeps the fallback
- **WHEN** a session receives a blank name for user IR slot 07
- **THEN** the CAB model select still lists `User IR 07` for that slot

#### Scenario: User selects a user IR slot
- **WHEN** the CAB panel is showing a factory CAB model and the user selects User IR 03
- **THEN** the CAB panel lists User IR 03 or that slot's dumped name
- **AND** that change is sent through the device session

#### Scenario: USB and Bluetooth share user IR labels
- **WHEN** a Bluetooth session is showing a CAB panel with dumped IR names
- **THEN** Controller shows the same CAB user IR labels as USB for that pedal

## MODIFIED Requirements

### Requirement: Controller syncs patch identity after connect

After a pedal session becomes connected, Controller SHALL show an English loading state while the session requests the pedal's current patch index and onboard patch names. The loading state MUST NOT wait for the audio-chain dump. The loading state MUST NOT wait for the IR-name dump. The loading state MUST NOT send patch recall (official CC 0) solely because the session connected or Controller opened. Disconnecting during sync MUST return to the empty state. Controller MUST NOT send raw MIDI.

#### Scenario: Loading after USB connect
- **WHEN** a USB session becomes connected and patch identity is not yet known
- **THEN** Controller shows a loading state
- **AND** the patch bar is not shown yet
- **AND** the audio chain is not shown yet
- **AND** no patch recall is sent solely because the session connected
- **AND** that loading state does not wait for the IR-name dump

#### Scenario: Loading after Bluetooth connect
- **WHEN** a Bluetooth session becomes connected and patch identity is not yet known
- **THEN** Controller shows a loading state
- **AND** the patch bar is not shown yet
- **AND** the audio chain is not shown yet
- **AND** no patch recall is sent solely because the session connected
- **AND** that loading state does not wait for the IR-name dump

#### Scenario: Patch bar appears before the audio chain
- **WHEN** a session has received patch identity and the audio-chain dump has not arrived yet
- **THEN** Controller shows the patch bar
- **AND** patch controls below the bar are covered by a busy overlay
- **AND** no patch recall is sent solely to wait for that dump

#### Scenario: Disconnect during sync
- **WHEN** the user disconnects while Controller is showing the loading state
- **THEN** the loading state is hidden
- **AND** the screen states that no pedals are connected
