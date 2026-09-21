# app-shell Specification

## Purpose

Provides the runnable web and desktop application shell for Patone GP Studio: layout, a global connection-status control, section navigation, and dark-default appearance so later MIDI and controller work can land in a real app.

## Requirements

### Requirement: Web and desktop shells launch without a backend

The system SHALL serve the UI as a local web app and as a native desktop window. The shell MUST start without an HTTP backend and MUST NOT require network access to render the first screen.

#### Scenario: Web development launch
- **WHEN** the operator starts the web development command
- **THEN** the UI is reachable in a Chromium-based browser on localhost

#### Scenario: Desktop development launch
- **WHEN** the operator starts the desktop development command
- **THEN** a native window opens titled Patone and hosts the same UI

#### Scenario: Production build artifacts
- **WHEN** the operator runs the documented build commands
- **THEN** the system produces a web bundle and a Windows installer package (NSIS or MSI)

### Requirement: Dark appearance is the default

On first launch with no stored preference, the shell SHALL present a dark color scheme before the user interacts. If the user previously chose light or dark, the shell MUST restore that choice on the next launch.

#### Scenario: First launch is dark
- **WHEN** a user opens the app with no stored appearance preference
- **THEN** the UI uses the dark color scheme on the first paint

#### Scenario: User switches to light
- **WHEN** a user selects the light appearance
- **THEN** the UI switches to the light color scheme without restarting
- **AND** a later launch restores light

#### Scenario: User switches back to dark
- **WHEN** a user selects the dark appearance after using light
- **THEN** the UI returns to the dark color scheme
- **AND** a later launch restores dark

### Requirement: Planned feature areas exist as placeholders

The shell SHALL expose a global connection-status control and areas for Controller, Editor, and Library. Those areas MUST be visible and labeled in English. Connect MUST NOT be a navigation destination. Editor and Library placeholders MUST NOT send MIDI or implement preset/IR features. Controller empty-state and live-control behavior is defined by live-controller. Connection-status behavior (discover, connect, disconnect, connected label, USB vs Bluetooth tabs) is defined by device-connection.

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

#### Scenario: Controller is the live home
- **WHEN** the user opens the app or the Controller section while disconnected
- **THEN** Controller shows the disconnected empty state defined by live-controller
- **AND** Editor and Library remain stubs

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
