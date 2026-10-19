# app-shell Specification

## Purpose

Provides the runnable web and desktop application shell for GP Studio: layout, a global connection-status control, section navigation, and dark-default appearance so later MIDI and controller work can land in a real app.

## Requirements

### Requirement: Web and desktop shells launch without a backend

The system SHALL serve the UI as a local web app and as a native desktop window. The shell MUST start without an HTTP backend and MUST NOT require network access to render the first screen. The native window title MUST be GP Studio. The web document title MUST be GP Studio on the home screen. While About is open, the web document title MUST be GP Studio | About.

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

The shell SHALL expose a global connection-status control and areas for Controller, Editor, and Library. Those areas MUST be visible and labeled in English. Connect MUST NOT be a navigation destination. Editor and Library placeholders MUST NOT send MIDI or implement preset/IR features. Controller empty-state and live-control behavior is defined by live-controller. Connection-status behavior (discover, connect, disconnect, connected label, USB vs Bluetooth tabs) is defined by device-connection. The chrome wordmark MUST read GP Studio.

#### Scenario: Shell identifies the product
- **WHEN** the user opens the app
- **THEN** the shell shows the product name GP Studio, a connection-status control, section navigation, and a way to change appearance
- **AND** Controller is the active section

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

The shell SHALL expose an About item in the main navigation, after Log. The About page MUST be titled About GP Studio and MUST be readable without a connected pedal. Copy MUST be in English. The page MUST describe GP Studio as an independent controller for Valeton GP-5 and GP-50. The page MUST include subscribe-for-updates, report-a-bug, support, and get-the-code actions. The page MUST include the Install section defined by About describes the installed web app. The page MUST NOT require an in-page Changelog or What's next block. While About is open, the web document title MUST be GP Studio | About. About MUST NOT send MIDI or change the session. Pato Correnti in the footer MUST open About.

#### Scenario: About follows Log in the main menu
- **WHEN** the user opens the app
- **THEN** section navigation includes About after Log

#### Scenario: About page copy
- **WHEN** the user opens About
- **THEN** the page is titled About GP Studio
- **AND** the page states that GP Studio is an independent controller for Valeton GP-5 and GP-50
- **AND** the page includes a subscribe-for-updates link and a report-a-bug link
- **AND** the page includes the Install section
- **AND** no device or MIDI action occurs

#### Scenario: About does not require a pedal
- **WHEN** the user opens About with no pedal connected
- **THEN** the About copy is visible
- **AND** the disconnected empty state is not shown

#### Scenario: About sets the document title
- **WHEN** the user opens About
- **THEN** the web document title is GP Studio | About

#### Scenario: Leaving About restores the document title
- **WHEN** the user leaves About for Controller
- **THEN** the web document title is GP Studio

### Requirement: Production web app is installable and store-ready

The production web app SHALL be installable from Chrome and Edge on Windows, Android, Mac, and Linux. The install surface MUST use the name GP Studio and MUST display as a standalone app. The production bundle MUST include a web app manifest and a service worker that handles fetch. The manifest MUST name the app GP Studio, MUST include an English description, a root start URL, a root scope, a stable id, language English, standalone display, PNG icons at 192 and 512, and the dark theme and background colors already used for first paint. Those manifest fields and the fetch handler MUST be enough to generate a Microsoft Store Windows package that hosts the same HTTPS URL in Edge, without a further code change. This requirement does not submit that package.

#### Scenario: Production bundle carries install metadata
- **WHEN** the operator runs the production web build
- **THEN** the bundle includes a manifest named GP Studio with standalone display, a root start URL and scope, a stable id, an English description, dark theme and background colors, and PNG icons at 192 and 512
- **AND** the bundle includes a service worker that handles fetch

### Requirement: Installed production app reopens without a network

After the production web app has been cached, opening it with no network SHALL render the shell, restore the stored appearance, and keep saved preferences. A pedal link still requires the browser APIs for that session. Closing the installed app ends the pedal link.

#### Scenario: Offline reopen shows the shell
- **WHEN** the user has opened the production app online and then opens it with no network
- **THEN** the shell renders
- **AND** the stored light or dark appearance is restored
- **AND** saved preferences remain available

#### Scenario: Offline reopen stays disconnected
- **WHEN** the installed app opens with no network and no pedal link
- **THEN** the connection status stays disconnected

### Requirement: A newer deploy waits for reload

When a newer production version is waiting, the shell SHALL show an English prompt to reload. The running version MUST remain until the user reloads. The prompt MUST NOT change the current section.

#### Scenario: The session stays on the running version
- **WHEN** a newer version is waiting while the user is on a section
- **THEN** the shell shows an English reload prompt
- **AND** the current section stays on the running version until the user reloads

### Requirement: Desktop and development skip the production service worker

The native desktop window MUST NOT register a service worker. The web development server MUST NOT register the production service worker. The existing local web app and native window still start without an HTTP backend.

#### Scenario: Desktop launch registers no service worker
- **WHEN** the user opens the native desktop window
- **THEN** that window has no registered service worker

#### Scenario: Development launch registers no production service worker
- **WHEN** the operator starts the web development command
- **THEN** the production service worker is not registered

### Requirement: Installed app reaches the pedal only on affirmed platforms

The installed app SHALL use the same pedal links as the browser tab on that platform. Pedal connection MUST be affirmed only for Chrome or Edge on Windows (USB and Bluetooth), including a Microsoft Store package that hosts Edge; Chrome or Edge on Mac (USB and Bluetooth); Chrome on Android (Bluetooth); and Chrome or Edge on Linux (USB and Bluetooth). The app MUST NOT affirm USB on Android. iPhone and iPad MUST NOT be presented as a way to connect to the pedal.

#### Scenario: Windows keeps USB and Bluetooth
- **WHEN** the user installs the app from Chrome or Edge on Windows, or from an Edge-hosted Microsoft Store package of the same site
- **THEN** Connect still offers USB and Bluetooth as in the browser tab

#### Scenario: Android affirms Bluetooth
- **WHEN** the user installs the app from Chrome on Android
- **THEN** Bluetooth is the affirmed pedal link
- **AND** USB is not affirmed

#### Scenario: Mac keeps USB and Bluetooth
- **WHEN** the user installs the app from Chrome or Edge on Mac
- **THEN** Connect still offers USB and Bluetooth as in the browser tab

#### Scenario: Linux keeps USB and Bluetooth
- **WHEN** the user installs the app from Chrome or Edge on Linux
- **THEN** Connect still offers USB and Bluetooth as in the browser tab

#### Scenario: iPhone and iPad are excluded
- **WHEN** the production app is opened on an iPhone or iPad
- **THEN** that device is not a supported way to connect to the pedal

### Requirement: About describes the installed web app

The About page SHALL include an English Install section for the installed web app. The section MUST be readable without a connected pedal and MUST NOT send MIDI or change the session. The section MUST state platform limits that match the affirmed platforms in this capability, MUST state that iPhone and iPad are not supported for connecting to the pedal, and MUST NOT show a Microsoft Store badge or claim a Store listing is already available until that listing exists. About MUST offer an Install now control that uses the browser install prompt when the browser has offered one, and MUST show an English fallback that points at the Chrome or Edge install menu when that prompt is not available.

#### Scenario: Install section is shown without a pedal
- **WHEN** the user opens About with no pedal connected
- **THEN** the page shows the Install section
- **AND** the section does not present iPhone or iPad as a way to connect to the pedal
- **AND** no device or MIDI action occurs

#### Scenario: Install now uses the browser prompt when available
- **WHEN** the browser has offered an install prompt and the user activates Install now on About
- **THEN** the shell shows the browser install UI
- **AND** the current section stays About

#### Scenario: Install now falls back when no prompt is available
- **WHEN** no browser install prompt is available and the user activates Install now on About
- **THEN** the shell shows an English toast that points at the Chrome or Edge install menu
- **AND** the current section stays About

### Requirement: iPhone and iPad web home shows a connection notice

When the web app is opened on an iPhone or iPad, the home screen SHALL show an English notice over the home content. The notice MUST state that connecting from iPhone or iPad is not supported for now, briefly explain that USB and Bluetooth are blocked in every browser on those devices including Chrome, and link to the same subscribe-for-updates form as About so the user can stay informed about the project. The subscribe line MUST be visually separate from the explanation. The notice MUST cover the home content so that content cannot be used while it is shown. The notice MUST NOT appear on About, Log, Editor, or Library, and MUST NOT appear in a desktop browser or in the desktop shell.

#### Scenario: iPhone or iPad home
- **WHEN** a user opens the home screen in a browser on an iPhone or iPad
- **THEN** a notice covers the home content
- **AND** the notice states that connecting from iPhone or iPad is not supported for now
- **AND** the notice explains that USB and Bluetooth are blocked in every browser, including Chrome
- **AND** the notice links to the subscribe-for-updates form to stay informed about the project

#### Scenario: Other sections stay clear
- **WHEN** that user opens About, Log, Editor, or Library
- **THEN** the notice is not shown

#### Scenario: Desktop home has no notice
- **WHEN** a user opens the home screen in a desktop browser or the desktop shell
- **THEN** the notice is not shown

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

The shell SHALL show a footer that names GP Studio and states that it is an Independent controller for Valeton GP5/50. The footer MUST NOT use Unofficial or Unoficial. The name Pato Correnti in the footer MUST open About and MUST NOT navigate to an external site.

#### Scenario: Footer copy on first screen
- **WHEN** the user opens the app
- **THEN** the footer shows GP Studio
- **AND** the footer includes Independent
- **AND** the footer does not include Unofficial or Unoficial

#### Scenario: Footer name opens About
- **WHEN** the user activates Pato Correnti in the footer
- **THEN** About opens
- **AND** the app does not navigate to an external site

### Requirement: Production web app reports an online open

The production web app SHALL send one same-origin GET to `/usage` on each cold start, after the shell has started rendering. The request MUST include query parameter `v` set to the published package version and query parameter `mode` set to `standalone` when the app is displayed as an installed standalone app and `browser` otherwise. The request MUST NOT include a body, a client identifier, pedal data, or patch data. The request MUST NOT block the first paint and MUST NOT be required for the shell to render. A failure, including no network, MUST be ignored: no retry, no queue, and no error in the UI. Moving between sections in the same load MUST NOT send another request. The native desktop window MUST NOT send the request. The web development server MUST NOT send the request. When the production app is already cached and the user opens it online, the usage request MUST reach the origin rather than being answered from the service worker cache.

#### Scenario: Online production open in a browser tab

- **WHEN** the user opens the production web app in a browser tab while online
- **THEN** the app sends one GET `/usage` with `mode=browser` and `v` set to the published package version
- **AND** the shell renders whether or not a response arrives

#### Scenario: Online open of the installed app

- **WHEN** the user opens the installed production app while online
- **THEN** the app sends one GET `/usage` with `mode=standalone` and `v` set to the published package version
- **AND** the shell renders whether or not a response arrives

#### Scenario: Offline production open

- **WHEN** the user opens the production web app with no network
- **THEN** the shell renders
- **AND** the failed usage request does not change the UI

#### Scenario: Section changes stay on the same open

- **WHEN** the user moves between sections during one load of the production web app
- **THEN** the app does not send another `/usage` request

#### Scenario: Desktop does not report

- **WHEN** the user opens the native desktop window
- **THEN** no request to `/usage` is sent

#### Scenario: Development does not report

- **WHEN** the operator starts the web development command
- **THEN** no request to `/usage` is sent

#### Scenario: Cached reopen still reaches the origin when online

- **WHEN** the production app is already cached and the user opens it online
- **THEN** the usage request is sent to the origin
- **AND** the service worker cache does not answer it
