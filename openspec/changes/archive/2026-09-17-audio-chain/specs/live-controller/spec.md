## ADDED Requirements

### Requirement: Controller shows the current patch audio chain

Once initial sync completes or times out, Controller SHALL draw the current patch's audio chain through the device session. GP-5 MUST show 10 ordered slots. GP-50 MUST show 11 ordered slots (the same 10 effect modules plus EXP at the end). Each occupied slot MUST show the module that sits there and whether that module is on or off. Labels MUST be in English. The chain MUST be display-only: activating a slot MUST NOT send MIDI and MUST NOT change on/off or order. Controller MUST NOT send raw MIDI. If the initial chain dump is missing, Controller MUST still show the default-order slots and MUST NOT treat unknown modules as on. Disconnecting MUST hide the chain.

Default order is NR (noise gate), PRE, DST, NS (SnapTone), AMP, CAB, EQ, MOD, DLY, RVB, then EXP on GP-50.

#### Scenario: GP-5 chain after sync
- **WHEN** a GP-5 session finishes initial sync with a chain dump
- **THEN** Controller shows 10 slots in the dumped order
- **AND** each slot shows its module and on/off state
- **AND** no EXP slot is shown

#### Scenario: GP-50 chain includes EXP
- **WHEN** a GP-50 session finishes initial sync with a chain dump
- **THEN** Controller shows 11 slots
- **AND** the last slot is EXP
- **AND** each slot shows its module and on/off state

#### Scenario: Module off is visible
- **WHEN** the current chain dump has DST off and AMP on
- **THEN** the DST slot is shown as off
- **AND** the AMP slot is shown as on

#### Scenario: Chain dump missing
- **WHEN** initial sync ends without an audio-chain dump
- **THEN** Controller still shows the patch bar
- **AND** it shows default-order slots for that model
- **AND** those modules are not shown as on
- **AND** no patch recall is sent solely because the dump was missing

#### Scenario: Slots do not edit yet
- **WHEN** the user activates a chain slot after sync
- **THEN** no MIDI is sent for that activation
- **AND** the slot on/off state does not change

#### Scenario: Disconnect hides the chain
- **WHEN** the user disconnects while Controller is showing the audio chain
- **THEN** the chain is hidden
- **AND** the screen states that no pedals are connected

### Requirement: Patch changes refresh the audio chain

After initial sync, when the selected patch changes (user previous / select / next, or a pedal-initiated patch report), Controller MUST update the chain through the device session when a dump for that patch arrives. Controller MUST NOT send patch recall solely to obtain that dump. While that refresh is in progress, Controller MUST cover every patch control below the patch bar with an English busy overlay so those controls cannot be used. The patch bar MAY stay usable. The same chain MUST be used on USB and Bluetooth.

#### Scenario: User selects another patch
- **WHEN** the user selects patch `42` after sync and a chain dump for that patch arrives
- **THEN** Controller shows that dump's module order and on/off states
- **AND** no extra patch recall is sent solely to obtain the dump

#### Scenario: Chain refresh covers patch controls
- **WHEN** the user selects another patch after sync and the new chain dump has not arrived yet
- **THEN** Controller shows a busy overlay over the audio chain and any other patch controls below the patch bar
- **AND** those covered controls cannot be used

#### Scenario: Chain refresh overlay clears
- **WHEN** a chain dump for the newly selected patch arrives
- **THEN** the busy overlay is hidden
- **AND** Controller shows that dump's module order and on/off states

#### Scenario: Pedal changes patch after sync
- **WHEN** the pedal reports it moved to patch `17` after sync and a chain dump for that patch arrives
- **THEN** Controller shows that dump's module order and on/off states
- **AND** no patch recall is sent solely because that inbound report arrived

#### Scenario: Lost link during a patch change shows the empty state
- **WHEN** the user selects another patch after sync and the pedal is no longer connected
- **THEN** Controller states that no pedals are connected
- **AND** the patch bar and audio chain are hidden

#### Scenario: USB and Bluetooth share the chain
- **WHEN** a Bluetooth session finishes initial sync with a chain dump
- **THEN** Controller shows the same slot count and on/off presentation as USB for that model

## MODIFIED Requirements

### Requirement: Disconnected Controller shows an empty state

When no pedal session is connected, Controller SHALL tell the user that no pedals are connected. The empty state MUST be in English. It MUST NOT show patch previous, patch next, a patch selector, a syncing state, or an audio chain.

#### Scenario: Open Controller with no pedal
- **WHEN** the user opens Controller while disconnected
- **THEN** the screen states that no pedals are connected
- **AND** no patch controls are shown
- **AND** no syncing state is shown
- **AND** no audio chain is shown

### Requirement: Controller syncs patch identity after connect

After a pedal session becomes connected, Controller SHALL show an English loading state while the session requests the pedal's current patch index and onboard patch names. The loading state MUST NOT wait for the audio-chain dump. The loading state MUST NOT send patch recall (official CC 0) solely because the session connected or Controller opened. Disconnecting during sync MUST return to the empty state. Controller MUST NOT send raw MIDI.

#### Scenario: Loading after USB connect
- **WHEN** a USB session becomes connected and patch identity is not yet known
- **THEN** Controller shows a loading state
- **AND** the patch bar is not shown yet
- **AND** the audio chain is not shown yet
- **AND** no patch recall is sent solely because the session connected

#### Scenario: Loading after Bluetooth connect
- **WHEN** a Bluetooth session becomes connected and patch identity is not yet known
- **THEN** Controller shows a loading state
- **AND** the patch bar is not shown yet
- **AND** the audio chain is not shown yet
- **AND** no patch recall is sent solely because the session connected

#### Scenario: Patch bar appears before the audio chain
- **WHEN** a session has received patch identity and the audio-chain dump has not arrived yet
- **THEN** Controller shows the patch bar
- **AND** patch controls below the bar are covered by a busy overlay
- **AND** no patch recall is sent solely to wait for that dump

#### Scenario: Disconnect during sync
- **WHEN** the user disconnects while Controller is showing the loading state
- **THEN** the loading state is hidden
- **AND** the screen states that no pedals are connected
