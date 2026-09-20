## ADDED Requirements

### Requirement: Shell hosts a global toast region

The shell SHALL host a global toast region that can show English status messages without changing the current section. Toasts MUST remain available on Controller, Editor, and Library. The toast region MUST NOT be a navigation destination. Which operations emit toasts is defined by device-connection and live-controller.

#### Scenario: Toast region is present on first screen
- **WHEN** the user opens the app
- **THEN** the shell can show a toast without changing the current section
- **AND** Controller remains the active section

#### Scenario: Toasts stay global across sections
- **WHEN** a toast is shown and the user navigates from Controller to Editor or Library
- **THEN** that toast remains visible
- **AND** the connection-status control remains visible
