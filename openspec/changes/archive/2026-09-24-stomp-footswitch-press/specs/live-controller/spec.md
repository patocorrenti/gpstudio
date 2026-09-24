## ADDED Requirements

### Requirement: Controller presses a stomp

After the audio chain is shown, Controller MUST offer a stomp press through the device session. GP-5 MUST offer one press. GP-50 MUST offer two presses, labeled A and B. The press MUST go through the device session and MUST NOT send raw MIDI from React. The same press UI MUST be used on USB and Bluetooth. Controller MUST NOT show the chain-refresh busy overlay solely because the user pressed a stomp. While the chain is refreshing, the press MUST NOT be sent. Disconnecting MUST hide the press UI. The assignment marks MUST remain the control for editing which modules a stomp owns.

#### Scenario: GP-5 offers one press

- **WHEN** a GP-5 session is showing the audio chain
- **THEN** Controller offers one stomp press
- **AND** no second press is shown

#### Scenario: GP-50 offers stomp A and stomp B

- **WHEN** a GP-50 session is showing the audio chain
- **THEN** Controller offers a press for stomp A
- **AND** Controller offers a press for stomp B

#### Scenario: Press updates the chain without a refresh overlay

- **WHEN** a session is showing MOD on and DLY off, both assigned to stomp A, and the user presses stomp A
- **THEN** Controller shows MOD off and DLY on
- **AND** the change is sent through the device session
- **AND** the chain-refresh busy overlay is not shown solely because that press happened

#### Scenario: USB and Bluetooth share the press UI

- **WHEN** a Bluetooth session is showing the stomp press
- **THEN** Controller shows the same press count for that model as USB
- **AND** the press goes through the device session

#### Scenario: Chain refresh does not send a press

- **WHEN** the chain is refreshing and the user activates the stomp press
- **THEN** Controller does not send that press

#### Scenario: Disconnect hides the press

- **WHEN** the user disconnects while Controller is showing the stomp press
- **THEN** the press UI is hidden
