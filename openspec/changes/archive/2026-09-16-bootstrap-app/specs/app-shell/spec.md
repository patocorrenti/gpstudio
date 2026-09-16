## Purpose

Provides the runnable web and desktop application shell for Patone: layout, navigation placeholders, and dark-default appearance so later MIDI and controller work can land in a real app.

## ADDED Requirements

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

The shell SHALL expose placeholder areas for Connect, Controller, Editor, and Library. Those placeholders MUST be visible and labeled in English. They MUST NOT talk to a device, send MIDI, or implement preset/IR features.

#### Scenario: Shell identifies the product
- **WHEN** the user opens the app
- **THEN** the shell shows the product name Patone and a way to change appearance

#### Scenario: Later features are stubbed
- **WHEN** the user opens the Editor or Library placeholder
- **THEN** the UI states that the feature is not available yet
- **AND** no device or MIDI action occurs

#### Scenario: Phase 1 screens are reserved
- **WHEN** the user opens the Connect or Controller placeholder
- **THEN** the UI shows a reserved screen for that area
- **AND** no device connection or live controls are present
