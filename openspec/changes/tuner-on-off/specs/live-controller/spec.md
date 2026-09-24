## ADDED Requirements

### Requirement: Controller toggles the tuner

After the audio chain is shown, Controller MUST offer a Tuner control through the device session. The control MUST go through the device session and MUST NOT send raw MIDI from React. The same control MUST be used on USB and Bluetooth. Controller MUST NOT show a pitch or note display for this control. Controller MUST NOT show the chain-refresh busy overlay solely because the user toggled the tuner. While the chain is refreshing, the toggle MUST NOT be sent. Disconnecting MUST hide the Tuner control.

#### Scenario: Tuner control appears with the chain

- **WHEN** a session is showing the audio chain
- **THEN** Controller offers a Tuner control
- **AND** no pitch or note display is shown for that control

#### Scenario: Toggle goes through the session

- **WHEN** the user activates the Tuner control
- **THEN** the change is sent through the device session
- **AND** the chain-refresh busy overlay is not shown solely because of that toggle

#### Scenario: USB and Bluetooth share the control

- **WHEN** a Bluetooth session is showing the Tuner control
- **THEN** Controller shows the same Tuner control as USB
- **AND** the toggle goes through the device session

#### Scenario: Chain refresh does not send

- **WHEN** the chain is refreshing and the user activates the Tuner control
- **THEN** Controller does not send that toggle

#### Scenario: Disconnect hides Tuner

- **WHEN** the user disconnects while Controller is showing the Tuner control
- **THEN** the Tuner control is hidden
