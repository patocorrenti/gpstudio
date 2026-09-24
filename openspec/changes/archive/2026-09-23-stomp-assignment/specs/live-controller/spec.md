## ADDED Requirements

### Requirement: Controller shows and edits stomp assignment

After the audio chain is shown, Controller MUST show the current patch's stomp assignment through the device session. GP-5 MUST show one stomp. GP-50 MUST show two stomps. Each stomp MUST list the effect modules assigned to it (none, one, or several of NR, PRE, DST, NS, AMP, CAB, EQ, MOD, DLY, RVB). EXP MUST NOT be assignable. Changing an assignment MUST go through the device session and MUST NOT send raw MIDI from React. The same assignment UI MUST be used on USB and Bluetooth. Controller MUST NOT show the chain-refresh busy overlay solely because the user edited a stomp assignment. Disconnecting MUST hide the assignment UI.

#### Scenario: GP-5 shows one stomp
- **WHEN** a GP-5 session is showing the audio chain after a dump that assigns PRE to the only stomp
- **THEN** Controller shows one stomp
- **AND** that stomp lists PRE
- **AND** no second stomp is shown

#### Scenario: GP-50 shows two stomps
- **WHEN** a GP-50 session is showing the audio chain after a dump that assigns PRE to stomp 1 and MOD plus DLY to stomp 2
- **THEN** Controller shows two stomps
- **AND** stomp 1 lists PRE
- **AND** stomp 2 lists MOD and DLY

#### Scenario: User assigns a module to a stomp
- **WHEN** a GP-50 session is showing stomp 1 without DST and the user assigns DST to stomp 1
- **THEN** stomp 1 lists DST
- **AND** that change is sent through the device session
- **AND** the chain-refresh busy overlay is not shown solely because that assignment changed

#### Scenario: EXP is not assignable
- **WHEN** a GP-50 session is showing stomp assignment
- **THEN** EXP is not offered as a stomp target

#### Scenario: USB and Bluetooth share assignment UI
- **WHEN** a Bluetooth session is showing stomp assignment
- **THEN** Controller shows the same stomp count for that model as USB
- **AND** edits go through the device session

#### Scenario: Disconnect hides assignment
- **WHEN** the user disconnects while Controller is showing stomp assignment
- **THEN** the assignment UI is hidden
- **AND** the screen states that no pedals are connected
