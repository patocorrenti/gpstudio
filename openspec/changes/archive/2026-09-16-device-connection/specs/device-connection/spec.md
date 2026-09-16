## Purpose

Lets the user connect a USB Valeton GP-5 or GP-50 from the global Connect control, keep that session across sections, and see the connected device name.

## ADDED Requirements

### Requirement: Connect modal lists USB devices then resolves the model

Activating the disconnected Connect control SHALL open a modal (not a route) and start USB-MIDI discovery. The modal MUST list discovered devices for the user to pick. It MUST NOT offer a USB vs Bluetooth choice. If the chosen device has a suggested model, the system MUST use that model and MUST NOT ask. If it has none, the system MUST ask GP-5 vs GP-50 before opening the link. The model MUST be known before the session is marked connected.

#### Scenario: Discover then pick a device
- **WHEN** the user opens Connect while disconnected
- **THEN** the modal lists available USB-MIDI devices
- **AND** the current section does not change

#### Scenario: Known model connects without asking
- **WHEN** the user picks a device whose label suggests GP-5 or GP-50
- **THEN** the system connects using that model without asking which pedal it is

#### Scenario: Unknown model is asked before connect
- **WHEN** the user picks a device with no suggested model
- **THEN** the modal asks GP-5 or GP-50
- **AND** the link is opened only after the user chooses a model

#### Scenario: No devices
- **WHEN** discovery succeeds and finds no USB-MIDI devices
- **THEN** the modal states that none were found
- **AND** the user can retry discovery

#### Scenario: Discovery fails
- **WHEN** MIDI access is denied or MIDI is unavailable
- **THEN** the modal shows an error in English
- **AND** the session stays disconnected

### Requirement: Connected chrome shows the device name

While a pedal session is connected, the chrome connection control MUST remain visible on every section and MUST display the connected endpoint's label instead of Connect. Activating it SHALL reopen the modal, which MUST identify the connected device and offer disconnect. After disconnect the control MUST read Connect again. Session state MUST be shared across Controller, Editor, and Library.

#### Scenario: Connected label
- **WHEN** a session is connected to an endpoint labeled `GP-50`
- **THEN** the chrome control displays `GP-50`
- **AND** it remains visible on Controller, Editor, and Library

#### Scenario: Disconnect
- **WHEN** the user disconnects from the connection modal
- **THEN** the MIDI link is closed
- **AND** the chrome control reads Connect

#### Scenario: Connect stays global
- **WHEN** the user is connected and navigates from Controller to Editor or Library
- **THEN** the session remains connected
- **AND** the chrome still shows the device name
