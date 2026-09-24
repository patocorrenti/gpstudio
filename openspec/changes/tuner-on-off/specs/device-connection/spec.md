## ADDED Requirements

### Requirement: Connected session toggles the tuner

After a USB or Bluetooth session is ready and the current chain is shown, toggling the tuner MUST send official MIDI CC 58 on the open link. Turning the tuner on MUST send value 127. Turning it off MUST send value 0. The session MUST keep an on/off state for the last app-written tuner value so the UI can show it. That state MUST start off when the session becomes connected and MUST drop on disconnect.

The session MUST NOT apply inbound CC 58 to the snapshot. The session MUST NOT mark the working patch modified solely because of a tuner write. The session MUST NOT send patch recall or a chain-dump request solely because of a tuner write. Module on/off, order, models, controls, stomp assignment, patch index, patch volume, and patch BPM MUST NOT change solely because of a tuner write. While the chain is syncing, or while no session is connected, a tuner toggle MUST NOT send.

#### Scenario: Turning the tuner on sends CC 58 value 127

- **WHEN** a ready session has the tuner off and the user turns the tuner on
- **THEN** the session sends CC 58 with value 127
- **AND** the snapshot shows the tuner on
- **AND** no patch recall is sent solely because of that write
- **AND** no chain dump is requested solely because of that write
- **AND** the working patch is not marked modified solely because of that write

#### Scenario: Turning the tuner off sends CC 58 value 0

- **WHEN** a ready session has the tuner on and the user turns the tuner off
- **THEN** the session sends CC 58 with value 0
- **AND** the snapshot shows the tuner off

#### Scenario: Inbound CC 58 is ignored

- **WHEN** a USB or Bluetooth session has the tuner off and an inbound CC 58 with value 127 arrives
- **THEN** the snapshot still shows the tuner off

#### Scenario: Syncing or disconnected does not send

- **WHEN** the chain is syncing, or no session is connected, and a tuner toggle is requested
- **THEN** the session does not send CC 58
