## ADDED Requirements

### Requirement: NS panel lists onboard user SnapTone slots

When Controller is showing an NS control panel, the model select MUST include the twenty-four onboard user SnapTone slots together with the factory NS models for the connected pedal. Until SnapTone names are known, those slots MUST use the English fallback labels `SnapTone 01` through `SnapTone 24`. When the session has a name for a slot, the select MUST show that name instead of the fallback. A blank or missing name MUST keep the fallback. The same labels MUST be used on USB and Bluetooth. Controller MUST NOT send raw MIDI.

Selecting a user SnapTone slot MUST go through the device session the same way as selecting a factory NS model. Identity loading and chain refresh MUST NOT wait for SnapTone names. If names arrive after the NS panel is already shown, the select MUST update those labels without hiding the panel or sending patch recall.

#### Scenario: User SnapTone dump shows the NS panel
- **WHEN** a session is showing the audio chain with NS on and a dump that loaded SnapTone 03 with Gain at 40
- **THEN** Controller shows an NS panel
- **AND** that panel lists SnapTone 03 or that slot's dumped name
- **AND** that panel shows Gain at 40

#### Scenario: Fallback labels before names arrive
- **WHEN** a session is showing an NS panel whose loaded model is a user SnapTone slot and SnapTone names have not arrived
- **THEN** that panel's model select lists `SnapTone 01` through `SnapTone 24`

#### Scenario: Dumped name replaces the fallback
- **WHEN** an NS panel is listing `SnapTone 03` and the session receives the name `My Amp` for that slot
- **THEN** that panel's model select lists `My Amp` for that slot
- **AND** the panel stays shown
- **AND** no patch recall is sent solely because the name arrived

#### Scenario: Blank SnapTone name keeps the fallback
- **WHEN** a session receives a blank name for user SnapTone slot 07
- **THEN** the NS model select still lists `SnapTone 07` for that slot

#### Scenario: User selects a user SnapTone slot
- **WHEN** the NS panel is showing a factory NS model and the user selects SnapTone 03
- **THEN** the NS panel lists SnapTone 03 or that slot's dumped name
- **AND** that change is sent through the device session

#### Scenario: USB and Bluetooth share SnapTone labels
- **WHEN** a Bluetooth session is showing an NS panel with dumped SnapTone names
- **THEN** Controller shows the same NS user SnapTone labels as USB for that pedal

## MODIFIED Requirements

### Requirement: Controller syncs patch identity after connect

After a pedal session becomes connected, Controller SHALL show an English loading state while the session requests the pedal's current patch index and onboard patch names. The loading state MUST NOT wait for the audio-chain dump. The loading state MUST NOT wait for the IR-name dump. The loading state MUST NOT wait for the SnapTone / Nam name dump. The loading state MUST NOT wait for the globals dump. The loading state MUST NOT send patch recall (official CC 0) solely because the session connected or Controller opened. Disconnecting during sync MUST return to the empty state. Controller MUST NOT send raw MIDI.

#### Scenario: Loading after USB connect
- **WHEN** a USB session becomes connected and patch identity is not yet known
- **THEN** Controller shows a loading state
- **AND** the patch bar is not shown yet
- **AND** the audio chain is not shown yet
- **AND** no patch recall is sent solely because the session connected
- **AND** that loading state does not wait for the IR-name dump
- **AND** that loading state does not wait for the SnapTone name dump

#### Scenario: Loading after Bluetooth connect
- **WHEN** a Bluetooth session becomes connected and patch identity is not yet known
- **THEN** Controller shows a loading state
- **AND** the patch bar is not shown yet
- **AND** the audio chain is not shown yet
- **AND** no patch recall is sent solely because the session connected
- **AND** that loading state does not wait for the IR-name dump
- **AND** that loading state does not wait for the SnapTone name dump

#### Scenario: Patch bar appears before the audio chain
- **WHEN** a session has received patch identity and the audio-chain dump has not arrived yet
- **THEN** Controller shows the patch bar
- **AND** patch controls below the bar are covered by a busy overlay
- **AND** no patch recall is sent solely to wait for that dump

#### Scenario: Disconnect during sync
- **WHEN** the user disconnects while Controller is showing the loading state
- **THEN** the loading state is hidden
- **AND** the screen states that no pedals are connected
