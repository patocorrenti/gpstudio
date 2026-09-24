## ADDED Requirements

### Requirement: Connected session presses a stomp

After a USB or Bluetooth session is ready and the current chain is shown, a stomp press MUST send one official MIDI CC on the open link and MUST update that chain on-change. GP-5 MUST send CC 69 with value 127. GP-50 stomp A MUST send CC 69 with value 127. GP-50 stomp B MUST send CC 70 with value 127. The session MUST NOT send module on/off CC 48–57, a stomp-assignment write, patch recall, or a chain-dump request solely because of that press.

Each effect assigned to that stomp MUST toggle on/off. Effects not assigned to it MUST keep their on/off. EXP MUST NOT change. Module order, models, controls, stomp assignment, patch index, patch volume, and patch BPM MUST NOT change solely because of the press. The working patch MUST be marked modified when the resulting on/off differs from the baseline, and MUST NOT stay marked modified when the press restores the baseline. An empty assignment MUST still send the CC and MUST leave on/off unchanged. A press for a stomp the connected model does not expose MUST NOT send. While the chain is syncing, or while no session is connected, a press MUST NOT send.

USB MUST NOT apply an unsolicited live stomp report to the snapshot. On Bluetooth, when live pedal state is applied, an inbound stomp mask MAY replace the on-change on/off with the reported mask and MUST NOT be treated as a patch change. The press MUST NOT change GP-50 Patch or Stomp mode and MUST NOT change the GP-5 footswitch mode.

#### Scenario: GP-5 press sends CC 69 and toggles the assigned effect

- **WHEN** a ready GP-5 session has AMP on and assigned to the only stomp, and the user presses that stomp
- **THEN** the session sends CC 69 with value 127
- **AND** the snapshot shows AMP off
- **AND** no patch recall is sent solely because of that press
- **AND** no chain dump is requested solely because of that press

#### Scenario: GP-50 stomp A and stomp B use CC 69 and CC 70

- **WHEN** a ready GP-50 session presses stomp A and then stomp B
- **THEN** the first press sends CC 69 with value 127
- **AND** the second press sends CC 70 with value 127

#### Scenario: Each assigned effect toggles

- **WHEN** a ready session has MOD on and DLY off, both assigned to stomp A, and PRE on and not assigned to stomp A, and the user presses stomp A
- **THEN** the snapshot shows MOD off and DLY on
- **AND** PRE stays on
- **AND** the stomp assignment is unchanged

#### Scenario: EXP is not toggled

- **WHEN** a ready GP-50 session has EXP on and the user presses stomp A
- **THEN** EXP stays on

#### Scenario: Empty assignment still sends the CC

- **WHEN** a ready GP-50 session has no effects assigned to stomp B and the user presses stomp B
- **THEN** the session sends CC 70 with value 127
- **AND** every module on/off stays as it was

#### Scenario: GP-5 does not send a second stomp

- **WHEN** a ready GP-5 session is asked to press a second stomp
- **THEN** the session does not send a stomp CC

#### Scenario: Press marks the working patch modified

- **WHEN** a ready session's chain matches the baseline and the user presses a stomp that toggles an assigned effect
- **THEN** the working patch is marked modified

#### Scenario: A restoring press clears modified

- **WHEN** the only difference from the baseline is an on/off bit that a stomp press set, and the user presses that stomp again
- **THEN** the working patch is not marked modified

#### Scenario: USB ignores a live stomp report after the press

- **WHEN** a USB session has pressed a stomp and an unsolicited live stomp report arrives
- **THEN** the snapshot keeps the on/off from the press
- **AND** that report is not treated as a patch change

#### Scenario: Bluetooth stomp mask may replace the on-change state

- **WHEN** a Bluetooth session has pressed a stomp and a live stomp mask reports the resulting on/off
- **THEN** the snapshot chain matches that mask
- **AND** no patch recall is sent solely because that mask arrived

#### Scenario: Syncing or disconnected does not send

- **WHEN** the chain is syncing, or no session is connected, and a stomp press is requested
- **THEN** the session does not send a stomp CC
