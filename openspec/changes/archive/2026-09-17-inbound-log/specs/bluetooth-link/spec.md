## MODIFIED Requirements

### Requirement: Web and desktop use the same Bluetooth contract

On the web app the system MUST use the browser Bluetooth API. In the desktop app the system MUST use the native Bluetooth backend. Callers MUST use the same discover/open/send/subscribe/close contract in both environments. Browser-only Bluetooth types MUST NOT leak to callers.

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

### Requirement: Inbound notification bytes can be received on an open session

The system SHALL deliver inbound bytes from the open Bluetooth pedal's GATT notifications to subscribers. Those bytes MUST NOT arrive through the USB-MIDI pipe. Subscribers MUST receive MIDI message bytes, not Bluetooth packet framing. Close MUST stop further inbound delivery. Opening or closing MUST NOT send a control message solely because the session opened or closed.

#### Scenario: Open then inbound
- **WHEN** the app opens a Bluetooth endpoint and the pedal notifies on the control characteristic
- **THEN** subscribers receive the MIDI message bytes from that notification
- **AND** those bytes are not delivered as USB-MIDI

#### Scenario: Close then inbound stops
- **WHEN** the app closes the open Bluetooth endpoint
- **THEN** further GATT notifications are not delivered to subscribers until another Bluetooth endpoint is opened
