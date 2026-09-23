## MODIFIED Requirements

### Requirement: Disconnected Controller shows an empty state

When no pedal session is connected, Controller SHALL tell the user that no pedals are connected. The empty state MUST be in English. It MUST NOT show patch previous, patch next, a patch selector, Reload, Save, rename, duplicate, download, upload, a Global settings control, a syncing state, or an audio chain.

#### Scenario: Open Controller with no pedal
- **WHEN** the user opens Controller while disconnected
- **THEN** the screen states that no pedals are connected
- **AND** no patch controls are shown
- **AND** no Global settings control is shown
- **AND** no syncing state is shown
- **AND** no audio chain is shown

### Requirement: Controller syncs patch identity after connect

After a pedal session becomes connected, Controller SHALL show an English loading state while the session requests the pedal's current patch index and onboard patch names. The loading state MUST NOT wait for the audio-chain dump. The loading state MUST NOT wait for the IR-name dump. The loading state MUST NOT wait for the globals dump. The loading state MUST NOT send patch recall (official CC 0) solely because the session connected or Controller opened. Disconnecting during sync MUST return to the empty state. Controller MUST NOT send raw MIDI.

#### Scenario: Loading after USB connect
- **WHEN** a USB session becomes connected and patch identity is not yet known
- **THEN** Controller shows a loading state
- **AND** the patch bar is not shown yet
- **AND** the audio chain is not shown yet
- **AND** no patch recall is sent solely because the session connected
- **AND** that loading state does not wait for the IR-name dump
- **AND** that loading state does not wait for the globals dump

#### Scenario: Loading after Bluetooth connect
- **WHEN** a Bluetooth session becomes connected and patch identity is not yet known
- **THEN** Controller shows a loading state
- **AND** the patch bar is not shown yet
- **AND** the audio chain is not shown yet
- **AND** no patch recall is sent solely because the session connected
- **AND** that loading state does not wait for the IR-name dump
- **AND** that loading state does not wait for the globals dump

#### Scenario: Patch bar appears before the audio chain
- **WHEN** a session has received patch identity and the audio-chain dump has not arrived yet
- **THEN** Controller shows the patch bar
- **AND** patch controls below the bar are covered by a busy overlay
- **AND** no patch recall is sent solely to wait for that dump

#### Scenario: Disconnect during sync
- **WHEN** the user disconnects while Controller is showing the loading state
- **THEN** the loading state is hidden
- **AND** the screen states that no pedals are connected

## ADDED Requirements

### Requirement: Shell offers reachable global settings in a modal

When a pedal session is connected and exposes at least one reachable global setting, the chrome next to the connection status SHALL offer an English Global control (gear icon) that opens a Global settings modal. The control MUST NOT be a route, MUST NOT be a main-menu item, and MUST NOT sit on the patch bar. The chain-sync overlay MUST NOT block that control. The modal title MUST read Global settings. Master volume MUST be listed first when the session exposes it. The modal MUST list only settings the device session exposes for the connected model, in English, and MUST NOT list a setting the session does not expose. There MUST be no Save control in the modal. Each edit MUST be sent immediately through the device session and MUST NOT send raw MIDI from React. A control whose value is not yet known MUST NOT be usable and MUST NOT send a write. Slider drags MUST update the displayed number on-change and MUST throttle writes the same way effect sliders do; release MUST send the last value if it was not already sent. Toggles and selects MUST send on-change. Closing the modal MUST NOT revert a value already sent. Disconnecting MUST close the modal and hide the control. Changing the current patch MUST NOT clear the modal's global values and MUST NOT close it solely because the patch changed.

GP-50 MUST be able to show: master volume (0 to 100), input level (−20 to +20 dB), No CAB (off or on), REC level (−20 to +20 dB), BT REC (−20 to +20 dB), monitor level (−20 to +20 dB), REC mode left (Dry or Wet), REC mode right (Dry or Wet), and footswitch mode (Patch or Stomp). GP-5 MUST NOT show master volume, REC mode left, REC mode right, or footswitch mode. GP-5 MUST show input level, No CAB, REC level, BT REC, and monitor level only when the session exposes them, and MUST NOT show the Global control when the session exposes none.

#### Scenario: GP-50 opens the modal with dumped values
- **WHEN** a GP-50 session is connected and the globals snapshot has input level 0, No CAB off, and master volume 63
- **THEN** the chrome shows a Global control next to the connection status
- **AND** opening it shows those values with master volume first
- **AND** the modal has no Save control

#### Scenario: GP-5 hides the control when no global is exposed
- **WHEN** a GP-5 session is connected and the session exposes no global settings
- **THEN** the chrome does not show a Global control

#### Scenario: GP-5 does not show GP-50-only rows
- **WHEN** a GP-5 session exposes input level and the user opens Global settings
- **THEN** the modal can show input level
- **AND** the modal does not show master volume, REC mode, or footswitch mode

#### Scenario: Unknown value stays unusable
- **WHEN** the user opens Global settings before master volume is known
- **THEN** master volume cannot be used
- **AND** no master-volume write is sent

#### Scenario: An edit is sent without Save
- **WHEN** No CAB is off and the user turns it on
- **THEN** No CAB shows on
- **AND** that change is sent through the device session
- **AND** the modal does not ask the user to save

#### Scenario: Disconnect closes the modal
- **WHEN** Global settings is open and the user disconnects
- **THEN** the modal is closed
- **AND** the Global control is hidden

#### Scenario: A patch change keeps global values
- **WHEN** Global settings is showing input level 6 and the user selects another patch
- **THEN** input level still shows 6
