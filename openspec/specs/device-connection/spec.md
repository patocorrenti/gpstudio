# device-connection Specification

## Purpose

Lets the user connect a Valeton GP-5 or GP-50 over USB-MIDI or Bluetooth from the global Connect control, keep that session across sections, and see the connected device name and link mode.

## Requirements

### Requirement: Connect modal lists USB devices then resolves the model

Activating the disconnected Connect control SHALL open a modal (not a route) with USB and Bluetooth method tabs. The USB tab MUST start USB-MIDI discovery and MUST list discovered USB-MIDI devices for the user to pick. The Bluetooth tab MUST start Bluetooth discovery and MUST list discovered Bluetooth pedals. If the chosen device has a suggested model, the system MUST use that model and MUST NOT ask. If it has none, the system MUST ask GP-5 vs GP-50 before opening the link. The model MUST be known before the session is marked connected. Opening the modal MUST default to the USB tab. Switching tabs MUST NOT by itself connect a device.

#### Scenario: Discover then pick a USB device
- **WHEN** the user opens Connect while disconnected
- **THEN** the modal shows USB and Bluetooth tabs
- **AND** the USB tab is selected
- **AND** the USB tab lists available USB-MIDI devices
- **AND** the current section does not change

#### Scenario: Known USB model connects without asking
- **WHEN** the user picks a USB device whose label suggests GP-5 or GP-50
- **THEN** the system connects using that model without asking which pedal it is
- **AND** the connected session link mode is USB

#### Scenario: Unknown model is asked before connect
- **WHEN** the user picks a USB or Bluetooth device with no suggested model
- **THEN** the modal asks GP-5 or GP-50
- **AND** the link is opened only after the user chooses a model

#### Scenario: No USB devices
- **WHEN** the USB tab is active, discovery succeeds, and finds no USB-MIDI devices
- **THEN** the modal states that none were found
- **AND** the user can retry discovery

#### Scenario: USB discovery fails
- **WHEN** the USB tab is active and MIDI access is denied or MIDI is unavailable
- **THEN** the modal shows an English error
- **AND** the session stays disconnected

### Requirement: Connected chrome shows the device name

While a pedal session is connected, the chrome connection control MUST remain visible on every section and MUST display the connected endpoint's label instead of Connect. Activating it SHALL reopen the modal, which MUST identify the connected device, its link mode (USB or Bluetooth), and offer disconnect. After disconnect the control MUST read Connect again. Disconnect MUST close the active link (USB-MIDI or Bluetooth). Session state MUST be shared across Controller, Editor, and Library.

#### Scenario: Connected label
- **WHEN** a session is connected to an endpoint labeled `GP-50`
- **THEN** the chrome control displays `GP-50`
- **AND** it remains visible on Controller, Editor, and Library

#### Scenario: Disconnect USB
- **WHEN** the user disconnects a USB session from the connection modal
- **THEN** the USB-MIDI link is closed
- **AND** the chrome control reads Connect

#### Scenario: Disconnect Bluetooth
- **WHEN** the user disconnects a Bluetooth session from the connection modal
- **THEN** the Bluetooth link is closed
- **AND** the chrome control reads Connect

#### Scenario: Connect stays global
- **WHEN** the user is connected and navigates from Controller to Editor or Library
- **THEN** the session remains connected
- **AND** the chrome still shows the device name

### Requirement: Connected chrome stays up during patch sync

After a USB or Bluetooth session is marked connected, the chrome connection control MUST keep showing the connected endpoint's label while initial patch identity sync is in progress. Activating it SHALL still reopen the connection modal. Disconnect MUST remain available during sync. Sync MUST NOT by itself send patch recall.

#### Scenario: USB chrome during sync
- **WHEN** a USB session is connected and Controller is still syncing patch identity
- **THEN** the chrome control displays the connected endpoint's label
- **AND** the user can open the connection modal and disconnect

#### Scenario: Bluetooth chrome during sync
- **WHEN** a Bluetooth session is connected and Controller is still syncing patch identity
- **THEN** the chrome control displays the connected endpoint's label
- **AND** the user can open the connection modal and disconnect

### Requirement: Bluetooth tab lists pedals then connects

While the Bluetooth tab is selected, the modal MUST scan for Bluetooth pedals and MUST list them for the user to pick. It MUST keep the two-way / slower tradeoff copy. It MUST NOT list USB-MIDI devices. If the chosen Bluetooth device has a suggested model, the system MUST use that model and MUST NOT ask. Connecting MUST mark the session connected with Bluetooth link mode. The user MUST be able to retry the scan.

#### Scenario: Bluetooth scan then pick
- **WHEN** the user selects the Bluetooth tab while disconnected
- **THEN** the modal lists nearby Bluetooth pedals
- **AND** it does not list USB-MIDI devices
- **AND** the modal states that Bluetooth is a two-way connection and slower
- **AND** the session stays disconnected until the user picks a device

#### Scenario: Known Bluetooth model connects without asking
- **WHEN** the user picks a Bluetooth device whose label suggests GP-5 or GP-50
- **THEN** the system connects using that model without asking which pedal it is
- **AND** the connected session link mode is Bluetooth

#### Scenario: No Bluetooth pedals
- **WHEN** the Bluetooth tab is active, discovery succeeds, and finds no matching pedals
- **THEN** the modal states that none were found
- **AND** the user can retry discovery

#### Scenario: Bluetooth discovery fails
- **WHEN** the Bluetooth tab is active and Bluetooth access is denied or Bluetooth is unavailable
- **THEN** the modal shows an English error
- **AND** the session stays disconnected

### Requirement: Bluetooth session sends patch recall

While a session is connected over Bluetooth and initial patch identity sync has completed or timed out, Controller MUST offer working patch previous, patch next, and patch select (00–99), the same controls as a USB session. Choosing a patch or stepping previous/next MUST update the session patch and send that patch to the pedal through the device session. Connecting MUST NOT send a patch recall message by itself. USB sessions MUST keep sending patch recall through the device session using official CC 0.

#### Scenario: Bluetooth connected shows working patch send
- **WHEN** the user is connected over Bluetooth, initial sync has completed or timed out, and opens Controller
- **THEN** patch previous, patch next, and patch select are offered as working controls
- **AND** no patch recall is sent solely because the session connected or Controller opened

#### Scenario: Select a patch over Bluetooth
- **WHEN** the user is connected over Bluetooth and selects patch `42` from the center selector
- **THEN** the label reads `42`
- **AND** the pedal is sent patch 42 through the device session

#### Scenario: USB patch send unchanged
- **WHEN** the user is connected over USB and selects a patch
- **THEN** that patch is still sent through the device session using official CC 0
