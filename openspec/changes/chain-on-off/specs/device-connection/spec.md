## ADDED Requirements

### Requirement: Connected session toggles audio-chain modules

After a USB or Bluetooth session is ready, toggling an effect module (NR, PRE, DST, NS, AMP, CAB, EQ, MOD, DLY, or RVB) MUST update the snapshot chain on-change and MUST send that module's official MIDI CC through the open link. The session MUST NOT send SysEx, extra patch recall, or an audio-chain dump solely because a module was toggled. Toggling MUST NOT change module order. EXP MUST NOT be togglable through this session action.

When the link can apply live pedal module state (`liveFromPedal`, Bluetooth), inbound official module CC 48–57 MUST update the matching slot's on/off without changing order. USB MUST NOT apply inbound module CC to the snapshot. Inbound volume, tuner, and other non-module CCs MUST NOT update the chain. Disconnect MUST drop chain state.

#### Scenario: USB toggle sends module CC
- **WHEN** a USB session is ready and the user turns DST off
- **THEN** the snapshot shows DST off
- **AND** DST's official module CC is sent on the USB link
- **AND** no patch recall or chain dump is sent solely because DST was toggled

#### Scenario: Bluetooth toggle sends module CC
- **WHEN** a Bluetooth session is ready and the user turns AMP on
- **THEN** the snapshot shows AMP on
- **AND** AMP's official module CC is sent on the Bluetooth link
- **AND** no patch recall or chain dump is sent solely because AMP was toggled

#### Scenario: Bluetooth inbound module CC updates the chain
- **WHEN** a Bluetooth session is ready and the pedal sends DST's official module CC as off
- **THEN** the snapshot shows DST off
- **AND** module order does not change
- **AND** no patch recall is sent solely because that CC arrived

#### Scenario: USB ignores inbound module CC
- **WHEN** a USB session is ready and DST's official module CC arrives as off
- **THEN** the snapshot DST on/off does not change from that inbound CC

#### Scenario: EXP cannot be toggled
- **WHEN** a GP-50 session is ready and a toggle is requested for EXP
- **THEN** no MIDI is sent for that request
- **AND** the EXP slot on/off does not change
