## ADDED Requirements

### Requirement: Connected session reorders movable audio-chain modules

After a USB or Bluetooth session is ready, moving a movable effect module (NR, PRE, MOD, DLY, or RVB) to another effect slot MUST update the snapshot chain order on-change and MUST send a chain-order write for the current patch through the open link. The write MUST encode only chain order. It MUST NOT write full preset parameters. The session MUST NOT send extra patch recall or an audio-chain dump solely because the user reordered. Invalid moves (fixed modules DST, NS, AMP, CAB, or EQ; EXP; a drop onto EXP; a drop onto the module's current slot) MUST leave the snapshot unchanged and MUST NOT send a chain-order write. GP-50 EXP MUST stay the last slot. Toggling a module MUST still send that module's on/off and MUST NOT change order.

When the link can apply live pedal module state (`liveFromPedal`, Bluetooth), inbound live chain-order SysEx MUST update the snapshot order without sending patch recall. USB MUST NOT apply those inbound reports to the snapshot. Requested or opportunistic audio-chain dumps MUST still replace order and on/off as they do today. Disconnect MUST drop chain state.

#### Scenario: USB reorder sends chain-order write
- **WHEN** a USB session is ready and the user moves RVB before DST
- **THEN** the snapshot shows RVB before DST
- **AND** a chain-order write is sent on the USB link
- **AND** no patch recall or chain dump is sent solely because RVB was moved

#### Scenario: Bluetooth reorder sends chain-order write
- **WHEN** a Bluetooth session is ready and the user moves PRE after AMP
- **THEN** the snapshot shows PRE after AMP
- **AND** a chain-order write is sent on the Bluetooth link
- **AND** no patch recall or chain dump is sent solely because PRE was moved

#### Scenario: Invalid move is ignored
- **WHEN** a session is ready and the user tries to move DST after CAB
- **THEN** the snapshot order does not change
- **AND** no chain-order write is sent

#### Scenario: Bluetooth inbound order report updates the chain
- **WHEN** a Bluetooth session is ready and the pedal reports a new chain order over live chain-order SysEx
- **THEN** the snapshot shows that order
- **AND** no patch recall is sent solely because that report arrived

#### Scenario: USB ignores inbound live chain-order reports
- **WHEN** a USB session is ready and a live chain-order SysEx arrives
- **THEN** the snapshot order does not change from that inbound report
