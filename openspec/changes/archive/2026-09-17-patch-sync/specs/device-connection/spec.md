## ADDED Requirements

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

## MODIFIED Requirements

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
