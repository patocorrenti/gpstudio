# live-controller Specification

## Purpose

Shows Controller as the live home: an empty state with no pedal, a loading state while the session syncs patch identity and the current audio chain, patch 00–99 previous / select / next once that identity is known or the sync times out, and an audio chain for the current patch whose effect modules can be turned on or off.

## Requirements

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

### Requirement: Connected Controller selects patches 00-99 after sync

Once initial sync completes or times out, Controller SHALL show a patch bar: previous, the current patch as a two-digit selectable label (`00`–`99`), and next. The label MUST show the pedal's current patch when that index was received. If the index was not received, the label MUST stay at `00` and MUST NOT send patch `00` solely because sync ended. Choosing a patch or stepping previous/next MUST update the session patch and send that patch to the pedal through the device session using official CC 0 (value 0–99). Previous from `00` MUST wrap to `99`. Next from `99` MUST wrap to `00`. Disconnecting MUST hide the patch bar and return to the empty state. Controller MUST NOT send raw MIDI.

#### Scenario: Patch bar appears with the pedal's patch
- **WHEN** initial sync receives that the pedal is on patch `42`
- **THEN** Controller shows previous, the current patch label, and next
- **AND** the label reads `42`
- **AND** no patch recall is sent solely because sync completed

#### Scenario: Sync times out without a current patch
- **WHEN** initial sync ends without a current patch index
- **THEN** Controller shows the patch bar
- **AND** the label reads `00`
- **AND** no patch recall is sent solely because sync ended

#### Scenario: Select a patch from the label
- **WHEN** the user selects patch `42` from the center selector after sync
- **THEN** the label reads `42`
- **AND** the pedal is sent patch 42 through the device session

#### Scenario: Next wraps from 99 to 00
- **WHEN** the current patch is `99` and the user activates next
- **THEN** the label reads `00`
- **AND** the pedal is sent patch 0 through the device session

#### Scenario: Previous wraps from 00 to 99
- **WHEN** the current patch is `00` and the user activates previous
- **THEN** the label reads `99`
- **AND** the pedal is sent patch 99 through the device session

#### Scenario: Disconnect returns to empty state
- **WHEN** the user disconnects while Controller is showing the patch bar
- **THEN** the patch bar is hidden
- **AND** the screen states that no pedals are connected

### Requirement: Patch selector shows onboard names when known

When onboard patch names were received, the patch selector MUST include those names with the two-digit index. Missing or unavailable names MUST fall back to the two-digit index only. The same selector MUST be used on USB and Bluetooth.

#### Scenario: Names populate the list
- **WHEN** initial sync receives names for the 00–99 patches
- **THEN** the selector lists each patch with its two-digit index and name

#### Scenario: Names unavailable
- **WHEN** initial sync ends without patch names
- **THEN** the selector lists patches as two-digit indexes only
- **AND** the patch bar remains usable

### Requirement: Pedal patch changes update the selector

After initial sync, when the pedal reports a new current patch, Controller MUST update the displayed patch through the device session without sending patch recall for that inbound report. If a name is known for that index, the selector MUST show it.

#### Scenario: Pedal changes patch after sync
- **WHEN** the pedal reports it moved to patch `17` after sync
- **THEN** the label reads `17`
- **AND** no patch recall is sent solely because that inbound report arrived

### Requirement: Controller shows the current patch audio chain

Once initial sync completes or times out, Controller SHALL draw the current patch's audio chain through the device session. GP-5 MUST show 10 ordered slots. GP-50 MUST show 11 ordered slots (the same 10 effect modules plus EXP at the end). Each occupied slot MUST show the module that sits there and whether that module is on or off. Labels MUST be in English. After the chain is shown, the ten effect slots (NR, PRE, DST, NS, AMP, CAB, EQ, MOD, DLY, RVB) MUST each expose an on/off switch: flipping it MUST flip that module's on/off through the device session and MUST NOT change module order. Activating the rest of the slot MUST NOT toggle on/off. On GP-50, the EXP slot MUST expose the same on/off switch through the device session and MUST NOT appear on GP-5. Controller MUST NOT send raw MIDI. If the initial chain dump is missing, Controller MUST still show the default-order slots and MUST NOT treat unknown modules as on; those effect slots MUST still be togglable. Disconnecting MUST hide the chain.

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

#### Scenario: User toggles an effect slot
- **WHEN** the user activates the DST slot after sync while DST is on
- **THEN** the DST slot is shown as off
- **AND** that change is sent through the device session
- **AND** module order does not change

#### Scenario: Toggle still works without a dump
- **WHEN** initial sync ended without an audio-chain dump and the user activates the AMP slot
- **THEN** the AMP slot is shown as on
- **AND** that change is sent through the device session

#### Scenario: Slots do not edit yet
- **WHEN** a GP-50 session is showing the audio chain and the user activates the EXP slot while EXP is on
- **THEN** the EXP slot is shown as off
- **AND** that change is sent through the device session
- **AND** module order does not change

#### Scenario: USB and Bluetooth share the chain toggles
- **WHEN** a Bluetooth session is showing the audio chain and the user activates the MOD slot
- **THEN** Controller shows the same toggle presentation as USB for that model
- **AND** that change is sent through the device session

#### Scenario: Disconnect hides the chain
- **WHEN** the user disconnects while Controller is showing the audio chain
- **THEN** the chain is hidden
- **AND** the screen states that no pedals are connected

### Requirement: Bluetooth pedal module changes update the chain

After initial sync, when the session is on Bluetooth and the pedal reports a module on/off change for the current patch, Controller MUST update that slot's on/off through the device session without changing module order and without sending patch recall or a chain dump solely because that report arrived. When the session is on USB, Controller MUST keep the last known on/off for that slot even if a live-module report arrives. Volume and other non-module live controls MUST NOT update the chain.

#### Scenario: Pedal turns a module off over Bluetooth
- **WHEN** a Bluetooth session is showing DST on and the pedal reports DST off
- **THEN** the DST slot is shown as off
- **AND** module order does not change
- **AND** no patch recall is sent solely because that report arrived

#### Scenario: Pedal turns EXP off over Bluetooth
- **WHEN** a GP-50 Bluetooth session is showing EXP on and the pedal reports EXP off
- **THEN** the EXP slot is shown as off
- **AND** no patch recall is sent solely because that report arrived

#### Scenario: USB does not follow pedal module reports
- **WHEN** a USB session is showing DST on and a live-module report for DST off arrives
- **THEN** the DST slot stays shown as on

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
