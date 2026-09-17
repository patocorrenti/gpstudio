## MODIFIED Requirements

### Requirement: Connected session toggles audio-chain modules

After a USB or Bluetooth session is ready, toggling an effect module (NR, PRE, DST, NS, AMP, CAB, EQ, MOD, DLY, or RVB) MUST update the snapshot chain on-change and MUST send that module's official MIDI CC through the open link. On GP-50, toggling EXP MUST send official CC 13 on USB and on Bluetooth. The session MUST NOT send extra patch recall or an audio-chain dump solely because a module was toggled. Toggling MUST NOT change module order. GP-5 MUST NOT expose an EXP toggle.

When the link can apply live pedal module state (`liveFromPedal`, Bluetooth), inbound live-module SysEx (identity-family command `09`) MUST update the matching slot's on/off without changing order. On GP-50 Bluetooth, inbound EXP SysEx (identity-family command `02`) MUST update the EXP slot. Stomp-mode footswitch reports that change module on/off are the same class of live module reports, including a captured equivalent if the frame is not command `09` or `02`. Those reports MUST NOT be treated as a pedal-initiated patch change: the session MUST NOT send patch recall or request a chain dump solely because a footswitch was pressed. USB MUST NOT apply those inbound reports to the snapshot. Inbound volume, tuner, and other non-module CCs MUST NOT update the chain. Disconnect MUST drop chain state.

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

#### Scenario: Bluetooth inbound module report updates the chain
- **WHEN** a Bluetooth session is ready and the pedal reports DST off over live-module SysEx
- **THEN** the snapshot shows DST off
- **AND** module order does not change
- **AND** no patch recall is sent solely because that report arrived

#### Scenario: Bluetooth Stomp footswitch updates the chain
- **WHEN** a Bluetooth session is ready and a Stomp-mode footswitch reports DST off
- **THEN** the snapshot shows DST off
- **AND** module order does not change
- **AND** no patch recall is sent solely because that footswitch was pressed
- **AND** no chain dump is requested solely because that footswitch was pressed

#### Scenario: Bluetooth Stomp footswitch is not a patch change
- **WHEN** a Bluetooth session is ready on the current patch and a Stomp-mode footswitch reports a module on/off change
- **THEN** the snapshot current patch does not change from that inbound report
- **AND** the session does not treat that inbound as a pedal-initiated patch report

#### Scenario: USB ignores inbound live module reports
- **WHEN** a USB session is ready and a live-module SysEx for DST off arrives
- **THEN** the snapshot DST on/off does not change from that inbound report

#### Scenario: USB ignores Stomp footswitch reports
- **WHEN** a USB session is ready and a Stomp-mode footswitch report for DST off arrives
- **THEN** the snapshot DST on/off does not change from that inbound report

#### Scenario: GP-50 EXP toggle over Bluetooth sends CC 13
- **WHEN** a GP-50 Bluetooth session is ready and the user turns EXP off
- **THEN** the snapshot shows EXP off
- **AND** official EXP on/off CC 13 is sent on the Bluetooth link
- **AND** no patch recall or chain dump is sent solely because EXP was toggled

#### Scenario: GP-50 EXP toggle over USB sends CC 13
- **WHEN** a GP-50 USB session is ready and the user turns EXP off
- **THEN** the snapshot shows EXP off
- **AND** official EXP on/off CC 13 is sent on the USB link
- **AND** no patch recall or chain dump is sent solely because EXP was toggled

#### Scenario: Bluetooth inbound EXP report updates the chain
- **WHEN** a GP-50 Bluetooth session is ready and the pedal reports EXP off over EXP SysEx
- **THEN** the snapshot shows EXP off
- **AND** no patch recall is sent solely because that report arrived
