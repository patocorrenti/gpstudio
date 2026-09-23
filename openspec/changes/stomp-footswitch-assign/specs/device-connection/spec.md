## ADDED Requirements

### Requirement: Connected session reads and writes stomp assignment

After a USB or Bluetooth session is ready, stomp assignment for the current patch MUST come from the same current-preset dump already requested after connect and when the patch changes. GP-5 MUST expose one stomp. GP-50 MUST expose two stomps. Each stomp's assignment is the set of effect modules it toggles (NR, PRE, DST, NS, AMP, CAB, EQ, MOD, DLY, RVB). EXP MUST NOT be part of any stomp assignment. If that dump is missing, the session MUST NOT invent an assignment that is written to the pedal.

When the user changes a stomp's assigned modules, the session MUST update the snapshot on-change and MUST send that assignment through the open link as a per-effect parameter write (not a full preset dump and not an echo of a live notify). The session MUST NOT send extra patch recall or an audio-chain dump solely because assignment changed. Assignment MUST NOT change module order or on/off by itself. USB MUST NOT apply unsolicited inbound assignment reports to the snapshot. On Bluetooth, when `liveFromPedal` is true, the session MAY apply a live stomp-assignment notify after a write path is known to work; until then, dumps remain the source of truth. Disconnect MUST drop assignment state.

#### Scenario: Dump fills GP-50 stomps
- **WHEN** a GP-50 session is ready and the current-preset dump assigns PRE to stomp 1 and MOD plus DLY to stomp 2
- **THEN** the snapshot has two stomps
- **AND** stomp 1 includes PRE
- **AND** stomp 2 includes MOD and DLY

#### Scenario: Dump fills the GP-5 stomp
- **WHEN** a GP-5 session is ready and the current-preset dump assigns AMP to the only stomp
- **THEN** the snapshot has one stomp
- **AND** that stomp includes AMP

#### Scenario: User edit sends assignment
- **WHEN** a USB or Bluetooth session is ready and the user assigns DST to stomp 1
- **THEN** the snapshot stomp 1 includes DST
- **AND** an assignment write is sent on the open link
- **AND** no patch recall or chain dump is sent solely because that assignment changed

#### Scenario: Missing dump does not write invented assignment
- **WHEN** a session becomes ready without a current-preset dump
- **THEN** the session does not send a stomp assignment write solely because dump was missing

#### Scenario: USB ignores unsolicited assignment reports
- **WHEN** a USB session is ready and an unsolicited live stomp-assignment report arrives
- **THEN** the snapshot assignment does not change from that inbound report
