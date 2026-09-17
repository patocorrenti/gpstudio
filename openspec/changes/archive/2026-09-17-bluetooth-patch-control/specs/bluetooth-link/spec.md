## MODIFIED Requirements

### Requirement: One GATT session can be opened and closed

The system SHALL open one Bluetooth endpoint at a time and close it on request. Opening a different Bluetooth endpoint MUST close the previous one. Close MUST release the GATT connection. Opening or closing MUST NOT send a control message solely because the session opened or closed.

#### Scenario: Open then close
- **WHEN** the app opens a Bluetooth endpoint and later closes it
- **THEN** the GATT connection is released
- **AND** no control message is sent solely because the session opened or closed

#### Scenario: Opening another pedal replaces the first
- **WHEN** a Bluetooth endpoint is open and the app opens a different one
- **THEN** the previous GATT connection is closed

### Requirement: Web and desktop use the same Bluetooth contract

On the web app the system MUST use the browser Bluetooth API. In the desktop app the system MUST use the native Bluetooth backend. Callers MUST use the same discover/open/send/close contract in both environments. Browser-only Bluetooth types MUST NOT leak to callers.

#### Scenario: Web without Bluetooth support
- **WHEN** discover is called in a browser that does not expose the Web Bluetooth API
- **THEN** discover fails with an English error that Bluetooth is unavailable

#### Scenario: Desktop lists host peripherals
- **WHEN** discover is called in the desktop app
- **THEN** the list comes from the native Bluetooth backend, not the WebView Bluetooth API

#### Scenario: Send without an open session
- **WHEN** send is called and no Bluetooth endpoint is open
- **THEN** send fails

## ADDED Requirements

### Requirement: Control bytes can be sent on an open session

The system SHALL write caller-provided control bytes to the open Bluetooth pedal over GATT. Those bytes MUST NOT be sent as USB-MIDI. Send MUST fail when no Bluetooth endpoint is open.

#### Scenario: Open then send
- **WHEN** the app opens a Bluetooth endpoint and sends control bytes
- **THEN** those bytes are written over the GATT connection to that pedal
- **AND** they are not sent as USB-MIDI

#### Scenario: Close then send fails
- **WHEN** the app closes the open Bluetooth endpoint and then sends
- **THEN** send fails until another Bluetooth endpoint is opened
