## MODIFIED Requirements

### Requirement: Log records inbound MIDI only while visible

While a pedal session is connected and the Log page is open, the system SHALL append inbound MIDI from that session to the Log. The same Log surface MUST be used for USB and Bluetooth. Capture MUST run through the device session. While Log is not open, inbound MIDI MUST NOT be stored in the Log buffer. Leaving Log MUST release that buffer. Returning to Log MUST start with an empty list until new inbound MIDI arrives. The Log page MUST NOT apply inbound MIDI to the session snapshot. The device session MAY apply decoded patch identity (current patch index and names), decoded audio-chain dumps, and Bluetooth live-module on/off SysEx to the snapshot independently of whether Log capture is on.

#### Scenario: USB inbound appears on Log
- **WHEN** the user is connected over USB, has Log open, and the pedal sends MIDI
- **THEN** that traffic appears on Log as a MIDI summary and hex dump
- **AND** Log itself does not apply that traffic to the session snapshot

#### Scenario: Bluetooth inbound appears on Log
- **WHEN** the user is connected over Bluetooth, has Log open, and the pedal sends MIDI
- **THEN** that traffic appears on the same Log as USB
- **AND** the summary describes the MIDI message, not Bluetooth packet framing
- **AND** Log itself does not apply that traffic to the session snapshot

#### Scenario: Leaving Log stops capture
- **WHEN** inbound MIDI has been shown on Log and the user navigates to another section
- **THEN** later inbound MIDI is not stored
- **AND** returning to Log shows an empty list until new inbound MIDI arrives

#### Scenario: Log is empty until traffic arrives
- **WHEN** the user opens Log while connected and no inbound MIDI has arrived since opening it
- **THEN** Log states that it is waiting for MIDI from the pedal

#### Scenario: User can clear Log
- **WHEN** Log is showing inbound events and the user clears it
- **THEN** the list is empty
- **AND** later inbound MIDI while Log stays open still appears

#### Scenario: Patch identity can apply while Log is closed
- **WHEN** the user is connected, Log is not open, and the pedal reports a current patch index
- **THEN** the session snapshot current patch updates
- **AND** that inbound message is not stored in the Log buffer

#### Scenario: Audio chain can apply while Log is closed
- **WHEN** the user is connected, Log is not open, and the pedal reports a current-patch audio-chain dump
- **THEN** the session snapshot audio chain updates
- **AND** that inbound message is not stored in the Log buffer

#### Scenario: Bluetooth live module report can apply while Log is closed
- **WHEN** the user is connected over Bluetooth, Log is not open, and the pedal sends a live-module on/off SysEx
- **THEN** the session snapshot chain on/off for that module updates
- **AND** that inbound message is not stored in the Log buffer
