## ADDED Requirements

### Requirement: Desktop nav offers TONE3000 beside Pedal on USB

While a pedal session is connected over USB and the shell shows Pedal as a navigation link, the shell SHALL show the TONE3000 control defined by tone3000 immediately before Pedal. The control MUST be absent when the pedal is disconnected, when the link is Bluetooth, when Pedal is inside the narrow-screen menu, and in the native desktop window. Activating the control MUST open its modal without changing the current section and MUST NOT send MIDI.

#### Scenario: USB desktop nav places TONE3000 before Pedal

- **WHEN** a USB pedal session is connected and Pedal is shown as a navigation link
- **THEN** the TONE3000 control is immediately before Pedal

#### Scenario: Bluetooth nav has no TONE3000 control

- **WHEN** a Bluetooth pedal session is connected and Pedal is shown as a navigation link
- **THEN** the navigation does not show the TONE3000 control

#### Scenario: Native window has no TONE3000 control

- **WHEN** the native desktop window has a USB pedal session connected and Pedal is shown as a navigation link
- **THEN** the navigation does not show the TONE3000 control

#### Scenario: Activating TONE3000 stays on the section

- **WHEN** the user activates the TONE3000 control while About is open
- **THEN** About stays open
- **AND** no MIDI is sent
