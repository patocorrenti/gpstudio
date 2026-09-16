## ADDED Requirements

### Requirement: SysEx bytes are delivered on an open endpoint

On the web app the system MUST request MIDI SysEx access so inbound SysEx reaches subscribers. In the desktop app the native backend MUST forward SysEx the same as any other MIDI bytes. If the user denies SysEx on the web, discover or open MUST fail with an English error that SysEx is required, rather than silently dropping dumps.

#### Scenario: Web requests SysEx
- **WHEN** discover is called in the web app
- **THEN** the browser MIDI API is asked for SysEx access

#### Scenario: Inbound SysEx
- **WHEN** the open endpoint receives a SysEx message
- **THEN** subscribers receive those bytes including `F0` and `F7`

#### Scenario: Web SysEx denied
- **WHEN** the user denies SysEx access in the browser
- **THEN** the UI shows an English error that SysEx is required
- **AND** the session stays disconnected
