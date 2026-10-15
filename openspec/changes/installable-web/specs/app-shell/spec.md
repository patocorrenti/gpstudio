## ADDED Requirements

### Requirement: Production web app is installable and store-ready

The production web app SHALL be installable from Chrome and Edge on Windows, Android, Mac, and Linux. The install surface MUST use the name GP Studio and MUST display as a standalone app. The production bundle MUST include a web app manifest and a service worker that handles fetch. The manifest MUST name the app GP Studio, MUST include an English description, a root start URL, a root scope, a stable id, language English, standalone display, PNG icons at 192 and 512, and the dark theme and background colors already used for first paint. The browser's install UI is how the user installs. The app MUST NOT add its own install button. Those manifest fields and the fetch handler MUST be enough to generate a Microsoft Store Windows package that hosts the same HTTPS URL in Edge, without a further code change. This requirement does not submit that package.

#### Scenario: Production bundle carries install metadata

- **WHEN** the operator runs the production web build
- **THEN** the bundle includes a manifest named GP Studio with standalone display, a root start URL and scope, a stable id, an English description, dark theme and background colors, and PNG icons at 192 and 512
- **AND** the bundle includes a service worker that handles fetch

#### Scenario: The app does not add an install button

- **WHEN** a user opens the production site in Chrome or Edge
- **THEN** installation is left to the browser
- **AND** the shell does not show its own install control

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

The About page SHALL include an English section about the installed web app once that section's sentences are supplied. The section MUST be readable without a connected pedal and MUST NOT send MIDI or change the session. The sentences MUST match the affirmed platforms in this capability, MUST state that iPhone and iPad are not supported for connecting to the pedal, and MUST NOT say a Microsoft Store listing is already available. Until those sentences are supplied, About MUST NOT show an invented platform section.

#### Scenario: Missing copy adds no invented section

- **WHEN** the installed-app sentences have not been supplied and the user opens About
- **THEN** About does not show an invented platform section
- **AND** no device or MIDI action occurs

#### Scenario: Supplied copy is shown without a pedal

- **WHEN** the agreed English sentences have been supplied and the user opens About with no pedal connected
- **THEN** the page shows that section
- **AND** the section does not present iPhone or iPad as a way to connect to the pedal
- **AND** no device or MIDI action occurs
