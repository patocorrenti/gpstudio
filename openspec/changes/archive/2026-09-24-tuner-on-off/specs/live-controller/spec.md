## ADDED Requirements

### Requirement: Shell offers Tuner next to Global

While a pedal is connected, the shell chrome next to Global MUST offer a Tuner control through the device session. The control MUST go through the device session and MUST NOT send raw MIDI from React. The same control MUST be used on USB and Bluetooth. The shell MUST NOT show a pitch or note display for this control. The shell MUST NOT place Tuner in the patch body. Controller MUST NOT show the chain-refresh busy overlay solely because the user toggled the tuner. While identity sync or the chain is refreshing, the toggle MUST NOT be sent. Disconnecting MUST hide the Tuner control.

#### Scenario: Tuner appears next to Global

- **WHEN** a session is connected
- **THEN** the shell offers a Tuner control next to Global
- **AND** no pitch or note display is shown for that control
- **AND** the patch body does not show that control

#### Scenario: Toggle goes through the session

- **WHEN** the user activates the Tuner control
- **THEN** the change is sent through the device session
- **AND** the chain-refresh busy overlay is not shown solely because of that toggle

#### Scenario: USB and Bluetooth share the control

- **WHEN** a Bluetooth session is connected
- **THEN** the shell shows the same Tuner control as USB
- **AND** the toggle goes through the device session

#### Scenario: Chain refresh does not send

- **WHEN** the chain is refreshing and the user activates the Tuner control
- **THEN** the shell does not send that toggle

#### Scenario: Disconnect hides Tuner

- **WHEN** the user disconnects while the shell is showing the Tuner control
- **THEN** the Tuner control is hidden
