## MODIFIED Requirements

### Requirement: Disconnected Controller shows an empty state

When no pedal session is connected, Controller SHALL tell the user that no pedals are connected. The empty state MUST be in English. It MUST NOT show patch previous, patch next, a patch selector, Save, rename, duplicate, download, a syncing state, or an audio chain.

#### Scenario: Open Controller with no pedal
- **WHEN** the user opens Controller while disconnected
- **THEN** the screen states that no pedals are connected
- **AND** no patch controls are shown
- **AND** no syncing state is shown
- **AND** no audio chain is shown

### Requirement: Connected Controller selects patches 00-99 after sync

Once initial sync completes or times out, Controller SHALL show a patch bar: previous, the current patch as a two-digit selectable label (`00`–`99`), next, and English controls to Save, rename, duplicate, and download the current patch. The label MUST show the pedal's current patch when that index was received. If the index was not received, the label MUST stay at `00` and MUST NOT send patch `00` solely because sync ended. Choosing a patch or stepping previous/next MUST update the session patch and send that patch to the pedal through the device session using official CC 0 (value 0–99). Previous from `00` MUST wrap to `99`. Next from `99` MUST wrap to `00`. Save, rename, duplicate, and download MUST go through the device session and MUST NOT send raw MIDI from React. Disconnecting MUST hide the patch bar and return to the empty state. Controller MUST NOT send raw MIDI.

#### Scenario: Patch bar appears with the pedal's patch
- **WHEN** initial sync receives that the pedal is on patch `42`
- **THEN** Controller shows previous, the current patch label, next, Save, rename, duplicate, and download
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

### Requirement: Patch changes refresh the audio chain

After initial sync, when the selected patch changes (user previous / select / next, or a pedal-initiated patch report), Controller MUST update the chain through the device session when a dump for that patch arrives. Controller MUST NOT send patch recall solely to obtain that dump. While that refresh is in progress, Controller MUST cover every patch control below the patch bar with an English busy overlay so those controls cannot be used. Previous, next, Save, rename, duplicate, and download MUST NOT be usable until that dump arrives or the refresh times out. The 00–99 selector MAY stay usable. The same chain MUST be used on USB and Bluetooth.

#### Scenario: User selects another patch
- **WHEN** the user selects patch `42` after sync and a chain dump for that patch arrives
- **THEN** Controller shows that dump's module order and on/off states
- **AND** no extra patch recall is sent solely to obtain the dump

#### Scenario: Chain refresh covers patch controls
- **WHEN** the user selects another patch after sync and the new chain dump has not arrived yet
- **THEN** Controller shows a busy overlay over the audio chain and any other patch controls below the patch bar
- **AND** those covered controls cannot be used

#### Scenario: Patch bar waits for the new dump
- **WHEN** the user selects another patch after sync and the new chain dump has not arrived yet
- **THEN** previous, next, Save, rename, duplicate, and download cannot be used
- **AND** the 00–99 selector may still change patch

#### Scenario: Chain refresh overlay clears
- **WHEN** a chain dump for the newly selected patch arrives
- **THEN** the busy overlay is hidden
- **AND** Controller shows that dump's module order and on/off states
- **AND** previous, next, Save, rename, duplicate, and download are usable again

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

## ADDED Requirements

### Requirement: Controller saves, renames, duplicates, and downloads the current patch

After the patch bar is shown, Controller SHALL let the user Save the current working patch onto the current slot, rename that patch, duplicate it onto another 00–99 slot, and download it to the PC, all through the device session. Labels MUST be in English. The same controls MUST be used on USB and Bluetooth.

Save MUST store the current working patch on the pedal in the current slot. Rename MUST change the onboard name of the current patch (at most 10 characters) through the session and MUST update the selector when that name is known. Duplicate MUST ask for a destination slot other than the current one; confirming MUST copy the current working patch onto that slot without changing the selected patch; overwriting a destination that already has a patch MUST require confirmation. Download MUST produce a local file of the current patch. If the current-preset dump is missing, download MUST NOT invent a file. Controller MUST NOT send raw MIDI.

While the current patch is syncing, Save, rename, duplicate, download, previous, and next MUST NOT be usable. Disconnecting MUST hide those controls with the patch bar.

#### Scenario: User saves the current patch
- **WHEN** the session is ready, the current patch is synced, and the user activates Save
- **THEN** the current working patch is stored on the pedal in the current slot through the device session
- **AND** the selected patch does not change
- **AND** no extra patch recall is sent solely because Save ran

#### Scenario: User renames the current patch
- **WHEN** the session is ready, the current patch is synced, the selector lists patch `42` with name `Old Name`, and the user renames it to `New Name`
- **THEN** the selector lists patch `42` with name `New Name`
- **AND** that name change is sent through the device session

#### Scenario: User duplicates onto another slot
- **WHEN** the session is ready, the current patch is `05` and synced, and the user confirms duplicate onto slot `80`
- **THEN** the current working patch is stored on the pedal in slot `80` through the device session
- **AND** the selected patch stays `05`
- **AND** no patch recall of `80` is sent solely because duplicate ran

#### Scenario: Duplicate overwrite needs confirmation
- **WHEN** the session is ready, the current patch is synced, and the user picks a destination slot that already has a patch
- **THEN** Controller asks the user to confirm overwrite
- **AND** no store write is sent until the user confirms

#### Scenario: User downloads the current patch
- **WHEN** the session is ready, the current patch is synced with a current-preset dump, and the user activates download
- **THEN** a local file of that current patch is produced through the device session
- **AND** no extra patch recall is sent solely because download ran

#### Scenario: Download is unavailable without a dump
- **WHEN** the session is ready without a current-preset dump
- **THEN** download cannot be used
- **AND** no local patch file is produced

#### Scenario: Busy patch bar blocks store actions
- **WHEN** the user has selected another patch after sync and the new chain dump has not arrived yet
- **THEN** Save, rename, duplicate, and download cannot be used
- **AND** previous and next cannot be used

#### Scenario: USB and Bluetooth share the patch bar actions
- **WHEN** a Bluetooth session is ready with a synced current patch and the user activates Save
- **THEN** Controller uses the same Save presentation as USB
- **AND** that store is sent through the device session
