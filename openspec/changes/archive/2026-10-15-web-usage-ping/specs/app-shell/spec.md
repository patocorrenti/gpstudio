## ADDED Requirements

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
