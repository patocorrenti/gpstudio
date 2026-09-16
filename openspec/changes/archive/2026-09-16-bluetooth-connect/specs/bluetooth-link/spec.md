## Purpose

Lets the app find nearby Valeton GP-5 and GP-50 pedals over Bluetooth and open one GATT session, without using the USB-MIDI pipe or sending a control protocol.

## ADDED Requirements

### Requirement: Bluetooth peripherals can be discovered

The system SHALL list nearby Bluetooth peripherals that advertise as a Valeton GP-5 or GP-50. Each endpoint MUST have a stable id for this process, a human-readable label from the advertised name, kind `bluetooth`, and an optional suggested device model derived from the label with the same GP-50-before-GP-5 rule as USB. Discover MUST NOT return USB-MIDI ports.

#### Scenario: Pedal appears with its advertised name
- **WHEN** a GP-5 or GP-50 is advertising over Bluetooth
- **THEN** discover returns an endpoint whose label is that advertised name
- **AND** the endpoint kind is `bluetooth`

#### Scenario: Label suggests GP-50
- **WHEN** an endpoint label matches GP-50 (including `GP-50` or `GP50`)
- **THEN** suggested model is GP-50

#### Scenario: Label suggests GP-5
- **WHEN** an endpoint label matches GP-5 (including `GP-5` or `GP5`) and does not match GP-50
- **THEN** suggested model is GP-5

#### Scenario: USB ports are not mixed in
- **WHEN** discover runs for Bluetooth
- **THEN** the list contains no `usb-midi` endpoints

### Requirement: One GATT session can be opened and closed

The system SHALL open one Bluetooth endpoint at a time and close it on request. Opening a different Bluetooth endpoint MUST close the previous one. Close MUST release the GATT connection. This capability MUST NOT send control messages (MIDI CC or SysEx) to the pedal.

#### Scenario: Open then close
- **WHEN** the app opens a Bluetooth endpoint and later closes it
- **THEN** the GATT connection is released
- **AND** no control message is sent solely because the session opened or closed

#### Scenario: Opening another pedal replaces the first
- **WHEN** a Bluetooth endpoint is open and the app opens a different one
- **THEN** the previous GATT connection is closed

### Requirement: Web and desktop use the same Bluetooth contract

On the web app the system MUST use the browser Bluetooth API. In the desktop app the system MUST use the native Bluetooth backend. Callers MUST use the same discover/open/close contract in both environments. Browser-only Bluetooth types MUST NOT leak to callers.

#### Scenario: Web without Bluetooth support
- **WHEN** discover is called in a browser that does not expose the Web Bluetooth API
- **THEN** discover fails with an English error that Bluetooth is unavailable

#### Scenario: Desktop lists host peripherals
- **WHEN** discover is called in the desktop app
- **THEN** the list comes from the native Bluetooth backend, not the WebView Bluetooth API
