## Purpose

Shows Controller as the live home: an empty state with no pedal, a loading state while the session syncs patch identity, and patch 00–99 previous / select / next through the device session once that identity is known or the sync times out.

## ADDED Requirements

### Requirement: Disconnected Controller shows an empty state

When no pedal session is connected, Controller SHALL tell the user that no pedals are connected. The empty state MUST be in English. It MUST NOT show patch previous, patch next, a patch selector, or a syncing state.

#### Scenario: Open Controller with no pedal
- **WHEN** the user opens Controller while disconnected
- **THEN** the screen states that no pedals are connected
- **AND** no patch controls are shown
- **AND** no syncing state is shown

### Requirement: Controller syncs patch identity after connect

After a pedal session becomes connected, Controller SHALL show an English loading state while the session requests the pedal's current patch index and onboard patch names. The loading state MUST NOT send patch recall (official CC 0) solely because the session connected or Controller opened. Disconnecting during sync MUST return to the empty state. Controller MUST NOT send raw MIDI.

#### Scenario: Loading after USB connect
- **WHEN** a USB session becomes connected and patch identity is not yet known
- **THEN** Controller shows a loading state
- **AND** the patch bar is not shown yet
- **AND** no patch recall is sent solely because the session connected

#### Scenario: Loading after Bluetooth connect
- **WHEN** a Bluetooth session becomes connected and patch identity is not yet known
- **THEN** Controller shows a loading state
- **AND** the patch bar is not shown yet
- **AND** no patch recall is sent solely because the session connected

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
