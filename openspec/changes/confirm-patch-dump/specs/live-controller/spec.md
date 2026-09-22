## MODIFIED Requirements

### Requirement: Patch changes refresh the audio chain

After initial sync, when the selected patch changes (user previous / select / next, or a pedal-initiated patch report), Controller MUST update the chain through the device session when a dump for that patch arrives. A dump whose chain equals the chain already shown MUST still count as that dump arriving. Controller MUST NOT send patch recall solely to obtain that dump. While that refresh is in progress, Controller MUST cover every patch control below the patch bar with an English busy overlay so those controls cannot be used. Previous, next, Reload, Save, rename, duplicate, download, and upload MUST NOT be usable until that dump arrives or the refresh times out. The 00–99 selector MAY stay usable. A confirmation dump after that first dump MUST NOT cover the patch controls again. A confirmation that matches the chain already shown MUST leave that chain on screen. A confirmation that differs MUST update the chain when the user has not edited the working patch, and MUST leave an edited chain on screen. The same chain MUST be used on USB and Bluetooth.

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
- **THEN** previous, next, Reload, Save, rename, duplicate, download, and upload cannot be used
- **AND** the 00–99 selector may still change patch

#### Scenario: Chain refresh overlay clears

- **WHEN** a chain dump for the newly selected patch arrives
- **THEN** the busy overlay is hidden
- **AND** Controller shows that dump's module order and on/off states
- **AND** previous, next, Reload, Save, rename, duplicate, download, and upload are usable again

#### Scenario: Identical patch dump clears the overlay

- **WHEN** the user selects another patch after sync and the dump for that patch has the same module order and on/off as the chain already shown
- **THEN** the busy overlay is hidden
- **AND** previous, next, Reload, Save, rename, duplicate, download, and upload are usable again
- **AND** Controller shows that chain

#### Scenario: Matching confirmation leaves the chain

- **WHEN** the newly selected patch's dump is already shown and a confirmation dump matches that chain
- **THEN** Controller keeps that chain
- **AND** the busy overlay stays hidden

#### Scenario: Mismatched confirmation updates the chain

- **WHEN** the newly selected patch's dump is already shown, the user has not edited it, and a confirmation dump has different module order or on/off
- **THEN** Controller shows the confirmation's chain
- **AND** the busy overlay stays hidden

#### Scenario: An edit is kept when a confirmation arrives

- **WHEN** the newly selected patch's dump is already shown, the user turns DST off, and a confirmation dump then arrives
- **THEN** Controller keeps DST off
- **AND** the busy overlay stays hidden

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
