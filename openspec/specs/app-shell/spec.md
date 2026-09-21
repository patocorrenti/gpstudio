# app-shell Specification

## Purpose

Provides the runnable web and desktop application shell for Patone GP Studio: layout, a global connection-status control, section navigation, and dark-default appearance so later MIDI and controller work can land in a real app.

## Requirements

### Requirement: Web and desktop shells launch without a backend

The system SHALL serve the UI as a local web app and as a native desktop window. The shell MUST start without an HTTP backend and MUST NOT require network access to render the first screen. The web document title and the native window title MUST be GP Studio.

#### Scenario: Web development launch
- **WHEN** the operator starts the web development command
- **THEN** the UI is reachable in a Chromium-based browser on localhost
- **AND** the document title is GP Studio

#### Scenario: Desktop development launch
- **WHEN** the operator starts the desktop development command
- **THEN** a native window opens titled GP Studio and hosts the same UI

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

The shell SHALL expose a global connection-status control and areas for Controller, Editor, and Library. Those areas MUST be visible and labeled in English. Connect MUST NOT be a navigation destination. Editor and Library placeholders MUST NOT send MIDI or implement preset/IR features. Controller empty-state and live-control behavior is defined by live-controller. Connection-status behavior (discover, connect, disconnect, connected label, USB vs Bluetooth tabs) is defined by device-connection. The chrome wordmark MUST read GP Studio. The UI MUST NOT show the brand name Patone.

#### Scenario: Shell identifies the product
- **WHEN** the user opens the app
- **THEN** the shell shows the product name GP Studio, a connection-status control, section navigation, and a way to change appearance
- **AND** Controller is the active section
- **AND** the visible chrome does not include the word Patone

#### Scenario: Connection status is always visible
- **WHEN** the user is on Controller, Editor, Library, or About
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

### Requirement: About page is reachable from chrome

The shell SHALL expose an About item in the main navigation, after Log. The About page MUST be titled About GP Studio and MUST be readable without a connected pedal. Copy MUST be in English. The page MUST describe GP Studio as an independent controller for Valeton GP-5 and GP-50. The page MUST include a What's next section and a Changelog for the current version. About MUST NOT send MIDI or change the session.

#### Scenario: About follows Log in the main menu
- **WHEN** the user opens the app
- **THEN** section navigation includes About after Log

#### Scenario: About page copy
- **WHEN** the user opens About
- **THEN** the page is titled About GP Studio
- **AND** the page states that GP Studio is an independent controller for Valeton GP-5 and GP-50
- **AND** the page includes a What's next heading
- **AND** the page includes a Changelog heading for the current version
- **AND** no device or MIDI action occurs

#### Scenario: About does not require a pedal
- **WHEN** the user opens About with no pedal connected
- **THEN** the About copy is visible
- **AND** the disconnected empty state is not shown

### Requirement: Shell hosts a global toast region

The shell SHALL host a global toast region that can show English status messages without changing the current section. Toasts MUST remain available on Controller, Editor, Library, and About. The toast region MUST NOT be a navigation destination. Which operations emit toasts is defined by device-connection and live-controller.

#### Scenario: Toast region is present on first screen
- **WHEN** the user opens the app
- **THEN** the shell can show a toast without changing the current section
- **AND** Controller remains the active section

#### Scenario: Toasts stay global across sections
- **WHEN** a toast is shown and the user navigates from Controller to Editor, Library, or About
- **THEN** that toast remains visible
- **AND** the connection-status control remains visible

### Requirement: Shell footer names GP Studio as independent

The shell SHALL show a footer that names GP Studio and states that it is an Independent controller for Valeton GP5/50. The footer MUST NOT use Unofficial or Unoficial. The footer MUST NOT include the brand name Patone.

#### Scenario: Footer copy on first screen
- **WHEN** the user opens the app
- **THEN** the footer shows GP Studio
- **AND** the footer includes Independent
- **AND** the footer does not include Unofficial, Unoficial, or Patone
