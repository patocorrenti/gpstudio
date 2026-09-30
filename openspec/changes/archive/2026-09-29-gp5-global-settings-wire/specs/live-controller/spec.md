## MODIFIED Requirements

### Requirement: Shell offers reachable global settings in a modal

When a pedal session is connected and exposes at least one reachable global setting, the chrome next to the connection status SHALL offer an English Global control (gear icon) that opens a Global settings modal. The control MUST NOT be a route, MUST NOT be a main-menu item, and MUST NOT sit on the patch bar. The chain-sync overlay MUST NOT block that control. The modal title MUST read Global settings. Master volume MUST be listed first when the session exposes it. The modal MUST list only settings the device session exposes for the connected model, in English, and MUST NOT list a setting the session does not expose. There MUST be no Save control in the modal. Each edit MUST be sent immediately through the device session and MUST NOT send raw MIDI from React. A control whose value is not yet known MUST NOT be usable and MUST NOT send a write. Slider drags MUST update the displayed number on-change and MUST throttle writes the same way effect sliders do; release MUST send the last value. Toggle and select changes MUST send on-change. Disconnect MUST close the modal and hide the Global control. Opening the modal MUST NOT clear global values when the user later selects another patch.

GP-50 MUST be able to show: master volume (0 to 100), input level (−20 to +20 dB), No CAB (off or on), REC level (−20 to +20 dB), BT REC (−20 to +20 dB), monitor level (−20 to +20 dB), REC mode left (Dry or Wet), REC mode right (Dry or Wet), and footswitch mode (Patch or Stomp). GP-5 MUST be able to show: input level (−20 to +20 dB), No CAB (off or on), REC level (−20 to +20 dB), BT REC (−20 to +20 dB), monitor level (−20 to +20 dB), screen brightness (1 to 100), and footswitch mode (`0-99`, `0-9`, `A-Z`, `CTL`, or `Tuner`). GP-5 MUST NOT show master volume, global volume, REC mode left, REC mode right, or Patch or Stomp. GP-5 MUST NOT show a Global BPM control in the modal. The modal MUST NOT show the Global control when the session exposes no global settings.

#### Scenario: GP-50 opens the modal with dumped values

- **WHEN** a GP-50 session is connected and the globals snapshot has input level 0, No CAB off, and master volume 63
- **THEN** the chrome shows a Global control next to the connection status
- **AND** opening it shows those values with master volume first
- **AND** the modal has no Save control

#### Scenario: GP-5 hides the control when no global is exposed

- **WHEN** a GP-5 session is connected and the session exposes no global settings
- **THEN** the chrome does not show a Global control

#### Scenario: GP-5 opens the modal with its rows

- **WHEN** a GP-5 session is connected and the globals snapshot has input level 0, No CAB off, and footswitch mode `0-99`
- **THEN** the chrome shows a Global control next to the connection status
- **AND** opening it shows input level and No CAB without a master or Global volume row
- **AND** the modal can show REC level, BT REC, monitor level, and screen brightness
- **AND** the footswitch control offers `0-99`, `0-9`, `A-Z`, `CTL`, and `Tuner`
- **AND** the modal does not show master volume, global volume, REC mode, Patch, Stomp, or Global BPM
- **AND** the modal has no Save control

#### Scenario: GP-5 does not show GP-50-only rows

- **WHEN** a GP-5 session exposes input level and the user opens Global settings
- **THEN** the modal can show input level
- **AND** the modal does not show master volume, global volume, REC mode, Patch, or Stomp

#### Scenario: Unknown value stays unusable

- **WHEN** the user opens Global settings before master volume is known
- **THEN** master volume cannot be used
- **AND** no master-volume write is sent

#### Scenario: Unknown GP-5 value stays unusable

- **WHEN** a GP-5 user opens Global settings before input level is known
- **THEN** input level cannot be used
- **AND** no input-level write is sent

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
