## MODIFIED Requirements

### Requirement: Connect modal lists USB devices then resolves the model

Activating the disconnected Connect control SHALL open a modal (not a route) with USB and Bluetooth method tabs. The USB tab MUST start USB-MIDI discovery and MUST list discovered devices for the user to pick. If the chosen USB device has a suggested model, the system MUST use that model and MUST NOT ask. If it has none, the system MUST ask GP-5 vs GP-50 before opening the link. The model MUST be known before the session is marked connected. Opening the modal MUST default to the USB tab.

#### Scenario: Discover then pick a device
- **WHEN** the user opens Connect while disconnected
- **THEN** the modal shows USB and Bluetooth tabs
- **AND** the USB tab is selected
- **AND** the USB tab lists available USB-MIDI devices
- **AND** the current section does not change

#### Scenario: Known model connects without asking
- **WHEN** the user picks a USB device whose label suggests GP-5 or GP-50
- **THEN** the system connects using that model without asking which pedal it is
- **AND** the connected session link mode is USB

#### Scenario: Unknown model is asked before connect
- **WHEN** the user picks a USB device with no suggested model
- **THEN** the modal asks GP-5 or GP-50
- **AND** the link is opened only after the user chooses a model

#### Scenario: No devices
- **WHEN** the USB tab is active, discovery succeeds, and finds no USB-MIDI devices
- **THEN** the modal states that none were found
- **AND** the user can retry discovery

#### Scenario: Discovery fails
- **WHEN** the USB tab is active and MIDI access is denied or MIDI is unavailable
- **THEN** the modal shows an English error
- **AND** the session stays disconnected

## ADDED Requirements

### Requirement: Connect tabs state each link's tradeoff

The disconnected Connect modal MUST label the methods USB and Bluetooth. The USB tab MUST describe a one-way connection that is super fast. The Bluetooth tab MUST describe a two-way connection that is slower. Switching tabs MUST NOT change the current section or connect a device by itself.

#### Scenario: USB tradeoff copy
- **WHEN** the USB tab is selected while disconnected
- **THEN** the modal states that USB is a one-way connection and super fast

#### Scenario: Bluetooth tradeoff copy
- **WHEN** the Bluetooth tab is selected while disconnected
- **THEN** the modal states that Bluetooth is a two-way connection and slower

### Requirement: Bluetooth tab is not connectable yet

While Bluetooth linking is not implemented, the Bluetooth tab MUST NOT list devices, MUST NOT start USB-MIDI discovery, and MUST NOT open a session. It MUST state in English that Bluetooth is not available yet.

#### Scenario: Bluetooth tab does not connect
- **WHEN** the user selects the Bluetooth tab while disconnected
- **THEN** the modal does not list USB-MIDI devices
- **AND** the session stays disconnected
- **AND** the modal states that Bluetooth is not available yet

### Requirement: Connected session exposes the link mode

While a pedal session is connected, the session MUST record the link mode (USB or Bluetooth) so later screens can share controls and disable features the link cannot feed from the pedal. The reopened Connect modal MUST identify the connected device and its link mode. USB inbound MIDI, including patch-load dumps, MUST still reach the session log; this capability MUST NOT require decoding those dumps.

#### Scenario: USB connection shows USB mode
- **WHEN** the user is connected over USB
- **THEN** the connection modal identifies the device as a USB link
- **AND** disconnect still closes the MIDI link

#### Scenario: Patch-load inbound still logs
- **WHEN** the pedal sends MIDI while connected over USB
- **THEN** that inbound traffic is still available on the session log
