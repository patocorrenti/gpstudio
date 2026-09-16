# midi-transport Specification

## Purpose

Provides a USB-MIDI byte pipe so the app can discover endpoints and send or receive MIDI without the UI depending on Web MIDI or Tauri types.

## Requirements

### Requirement: USB MIDI endpoints can be discovered

The system SHALL list currently available USB-MIDI endpoints. Each endpoint MUST have a stable id for this process, a human-readable label, kind `usb-midi`, and an optional suggested device model derived from the label. GP-50 MUST be matched before GP-5 so a GP-50 label is not treated as a GP-5.

#### Scenario: Pedal appears as a named port
- **WHEN** a USB-MIDI device is available to the host MIDI API
- **THEN** discover returns an endpoint whose label is the system port name
- **AND** the endpoint kind is `usb-midi`

#### Scenario: Label suggests GP-50
- **WHEN** an endpoint label matches GP-50 (including `GP-50` or `GP50`)
- **THEN** suggested model is GP-50

#### Scenario: Label suggests GP-5
- **WHEN** an endpoint label matches GP-5 (including `GP-5` or `GP5`) and does not match GP-50
- **THEN** suggested model is GP-5

#### Scenario: Label is ambiguous
- **WHEN** an endpoint label does not match GP-5 or GP-50
- **THEN** suggested model is absent

### Requirement: MIDI bytes can be sent and received on an open endpoint

The system SHALL open one USB-MIDI endpoint at a time, send raw MIDI bytes to it, and deliver inbound MIDI bytes to subscribers. Opening a different endpoint MUST close the previous one. Close MUST release the host MIDI ports.

#### Scenario: Open then send
- **WHEN** the app opens an endpoint and sends MIDI bytes
- **THEN** those bytes are written to that endpoint's MIDI output

#### Scenario: Inbound bytes
- **WHEN** the open endpoint's MIDI input receives bytes
- **THEN** subscribers receive those bytes

#### Scenario: Close releases the port
- **WHEN** the app closes the open endpoint
- **THEN** further sends fail until another endpoint is opened

### Requirement: Web and desktop use the same transport contract

On the web app the system MUST use the browser MIDI API. In the desktop app the system MUST use the native MIDI backend. Callers MUST use the same discover/open/send/subscribe/close contract in both environments. Browser-only MIDI types MUST NOT leak to callers.

#### Scenario: Web without MIDI support
- **WHEN** discover is called in a browser that does not expose the Web MIDI API
- **THEN** discover fails with an error that MIDI is unavailable

#### Scenario: Desktop lists host ports
- **WHEN** discover is called in the desktop app
- **THEN** the list comes from the native MIDI backend, not the WebView MIDI API
