## MODIFIED Requirements

### Requirement: Connected Controller selects patches 00-99 after sync

Once initial sync completes or times out, Controller SHALL show a patch bar: previous, the current patch as a two-digit selectable label (`00`–`99`), next, Reload, and English controls to Save, rename, duplicate, download, and upload the current patch. Reload MUST sit immediately left of Save. It MUST be an icon-only control with an English tooltip. Activating Reload MUST re-request the current patch's preset dump through the device session, MUST NOT change the selected patch, and MUST NOT send patch recall. The label MUST show the pedal's current patch when that index was received. If the index was not received, the label MUST stay at `00` and MUST NOT send patch `00` solely because sync ended. Choosing a patch or stepping previous/next MUST update the session patch and send that patch to the pedal through the device session (USB: official CC 0 value 0–99; Bluetooth: parameter-write SET packed family `1143`). Previous from `00` MUST wrap to `99`. Next from `99` MUST wrap to `00`. Save, rename, duplicate, download, and upload MUST go through the device session and MUST NOT send raw MIDI from React. Disconnecting MUST hide the patch bar and return to the empty state. Controller MUST NOT send raw MIDI.

#### Scenario: Patch bar appears with the pedal's patch
- **WHEN** initial sync receives that the pedal is on patch `42`
- **THEN** Controller shows previous, the current patch label, next, Reload, Save, rename, duplicate, download, and upload
- **AND** the label reads `42`
- **AND** no patch recall is sent solely because sync completed

#### Scenario: Reload requests the current patch again
- **WHEN** the session is ready, the current patch is synced on slot `42`, and the user activates Reload
- **THEN** the session re-requests the current-preset dump for that patch
- **AND** the selected patch stays `42`
- **AND** no patch recall is sent solely because Reload ran

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
