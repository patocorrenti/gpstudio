## Purpose

Shows Controller as the live home: an empty state with no pedal, and patch 00–99 previous / select / next through the device session using official MIDI CC.

## ADDED Requirements

### Requirement: Disconnected Controller shows an empty state

When no pedal session is connected, Controller SHALL tell the user that no pedals are connected. The empty state MUST be in English. It MUST NOT show patch previous, patch next, or a patch selector.

#### Scenario: Open Controller with no pedal
- **WHEN** the user opens Controller while disconnected
- **THEN** the screen states that no pedals are connected
- **AND** no patch controls are shown

### Requirement: Connected Controller selects patches 00-99

While a pedal session is connected, Controller SHALL show a patch bar: previous, the current patch as a two-digit selectable label (`00`–`99`), and next. Choosing a patch or stepping previous/next MUST update the session patch and send that patch to the pedal through the device session using official CC 0 (value 0–99). Previous from `00` MUST wrap to `99`. Next from `99` MUST wrap to `00`. Connecting MUST NOT send a patch message by itself. Disconnecting MUST hide the patch bar and return to the empty state. Controller MUST NOT send raw MIDI.

#### Scenario: Patch bar appears when connected
- **WHEN** a pedal session becomes connected
- **THEN** Controller shows previous, the current patch label, and next
- **AND** the empty state is not shown
- **AND** no patch MIDI is sent solely because the session connected

#### Scenario: Select a patch from the label
- **WHEN** the user selects patch `42` from the center selector
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
