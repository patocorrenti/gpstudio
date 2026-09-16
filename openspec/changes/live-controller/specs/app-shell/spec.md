## MODIFIED Requirements

### Requirement: Planned feature areas exist as placeholders

The shell SHALL expose a global connection-status control and areas for Controller, Editor, and Library. Those areas MUST be visible and labeled in English. Connect MUST NOT be a navigation destination. Editor and Library placeholders MUST NOT send MIDI or implement preset/IR features. Controller empty-state and patch-selector behavior is defined by live-controller. Connection-status behavior (discover, connect, disconnect, connected label) is defined by device-connection.

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
- **THEN** a modal opens for MIDI device connection
- **AND** the current section does not change

#### Scenario: Later features are stubbed
- **WHEN** the user opens the Editor or Library placeholder
- **THEN** the UI states that the feature is not available yet
- **AND** no device or MIDI action occurs

#### Scenario: Controller is the live home
- **WHEN** the user opens the app or the Controller section while disconnected
- **THEN** Controller shows the disconnected empty state defined by live-controller
- **AND** Editor and Library remain stubs
