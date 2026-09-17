## MODIFIED Requirements

### Requirement: Planned feature areas exist as placeholders

The shell SHALL expose a global connection-status control and placeholder areas for Controller, Editor, and Library. Those placeholders MUST be visible and labeled in English. Connect MUST NOT be a navigation destination. Controller, Editor, and Library placeholders MUST NOT send MIDI or implement preset/IR features. Connection-status behavior (discover, connect, disconnect, connected label, USB vs Bluetooth tabs) is defined by device-connection.

#### Scenario: Shell identifies the product
- **WHEN** the user opens the app
- **THEN** the shell shows the product name Patone, a connection-status control, section navigation, and a way to change appearance
- **AND** Controller is the active section

#### Scenario: Connection status is always visible
- **WHEN** the user is on Controller, Editor, or Library
- **THEN** the connection-status control remains visible in the shell
- **AND** it reads Connect because no pedal is connected

#### Scenario: Connection opens a modal, not a page
- **WHEN** the user activates the connection-status control
- **THEN** a modal opens so the user can choose a connection method
- **AND** the current section does not change

#### Scenario: Later features are stubbed
- **WHEN** the user opens the Editor or Library placeholder
- **THEN** the UI states that the feature is not available yet
- **AND** no device or MIDI action occurs

#### Scenario: Controller home is reserved
- **WHEN** the user opens the app or the Controller section
- **THEN** the UI shows a reserved screen for Controller
- **AND** no live controls are present
