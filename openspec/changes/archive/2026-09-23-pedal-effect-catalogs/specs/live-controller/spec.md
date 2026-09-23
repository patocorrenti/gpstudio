## MODIFIED Requirements

### Requirement: Controller shows enabled slot control panels

After the audio chain is shown, Controller SHALL show a control panel below the chain for each enabled effect slot (NR, PRE, DST, NS, AMP, CAB, EQ, MOD, DLY, RVB) whose loaded model and control values are known from the device session. Panels MUST be laid out in two columns when width allows. Each panel MUST show that slot's kind, the loaded model's English label, and that model's visible controls for the connected pedal (label, current value, and the catalog min / max / step). The model select MUST list only factory models that exist on the connected pedal. When a kind has more than one such model, the panel MUST offer a model select. A kind with only one factory model MUST still show its controls and MUST NOT require a select. GP-5 PRE MUST NOT list C-Wah or AC Sim. GP-50 PRE MUST list C-Wah and AC Sim. GP-5 CAB MUST NOT list AC. GP-50 CAB MUST list AC. GP-5 panels MUST NOT show Sync, S-Sync, or D-Sync. A B-Boost panel MUST show Gain, VOL, Bass, and Treble on both pedals and MUST NOT show Tone. GP-50 EXP MUST NOT get a control panel. Disabled effect slots MUST NOT show a panel. AMP and CAB panels MUST NOT appear while NS marks those slots bypassed. Labels MUST be in English.

Changing the selected model or a control value MUST go through the device session and MUST NOT send raw MIDI from React. Dragging a slider MUST update the displayed value on-change. Control writes for that drag MUST be throttled so the session does not send a SET for every intermediate value. Releasing the slider MUST send the last value if it was not already sent. Toggles and model selects MUST send on-change. The same panels MUST be used on USB and Bluetooth for a given pedal. While the chain-refresh busy overlay is shown, those panels MUST be covered with it and MUST NOT be usable. Disconnecting MUST hide the panels. If the chain dump did not supply a slot's model and values, Controller MUST NOT show an editable panel for that slot.

#### Scenario: Enabled AMP shows its panel
- **WHEN** a session is showing the audio chain with AMP on and a dump that loaded Tweedy with Gain at 30
- **THEN** Controller shows an AMP panel below the chain
- **AND** that panel lists Tweedy
- **AND** that panel shows Gain at 30

#### Scenario: Off DST hides its panel
- **WHEN** a session is showing the audio chain with DST off and AMP on
- **THEN** Controller does not show a DST panel
- **AND** Controller still shows an AMP panel

#### Scenario: User changes a control through the session
- **WHEN** the AMP panel is showing Gain at 30 and the user sets Gain to 45
- **THEN** the AMP panel shows Gain at 45
- **AND** that change is sent through the device session

#### Scenario: Slider drag does not send every step
- **WHEN** the AMP panel is showing Gain at 30 and the user drags Gain toward 80 without releasing
- **THEN** the AMP panel follows the dragged Gain
- **AND** the session does not send a control write for every intermediate Gain

#### Scenario: Slider release sends the last value
- **WHEN** the user releases an AMP Gain slider after dragging
- **THEN** the last displayed Gain is sent through the device session if it was not already sent

#### Scenario: User changes the loaded model through the session
- **WHEN** the AMP panel is showing Tweedy and the user selects Bellman 59N
- **THEN** the AMP panel lists Bellman 59N
- **AND** that panel shows Bellman 59N's controls
- **AND** that change is sent through the device session

#### Scenario: GP-5 PRE omits GP-50-only models
- **WHEN** a GP-5 session is showing the audio chain with PRE on and a known PRE model
- **THEN** the PRE model select does not list C-Wah
- **AND** the PRE model select does not list AC Sim

#### Scenario: GP-50 PRE lists its extra models
- **WHEN** a GP-50 session is showing the audio chain with PRE on and a known PRE model
- **THEN** the PRE model select lists C-Wah
- **AND** the PRE model select lists AC Sim

#### Scenario: GP-5 CAB omits AC
- **WHEN** a GP-5 session is showing a CAB panel
- **THEN** the CAB model select does not list AC

#### Scenario: GP-50 CAB lists AC
- **WHEN** a GP-50 session is showing a CAB panel
- **THEN** the CAB model select lists AC

#### Scenario: B-Boost panel shows Bass and Treble
- **WHEN** a session is showing PRE on B-Boost
- **THEN** the PRE panel shows Gain, VOL, Bass, and Treble
- **AND** the PRE panel does not show Tone

#### Scenario: GP-5 panel omits Sync
- **WHEN** a GP-5 session is showing a panel for a model that has Sync on GP-50
- **THEN** that panel does not show Sync, S-Sync, or D-Sync

#### Scenario: GP-50 A-Chorus shows Sync
- **WHEN** a GP-50 session is showing MOD on A-Chorus
- **THEN** that panel shows Sync

#### Scenario: NR has no model select
- **WHEN** a session is showing the audio chain with NR on and a known NR model
- **THEN** Controller shows an NR panel
- **AND** that panel has no model select

#### Scenario: EXP has no panel
- **WHEN** a GP-50 session is showing the audio chain with EXP on
- **THEN** Controller does not show an EXP control panel

#### Scenario: NS-bypassed AMP hides its panel
- **WHEN** the audio chain is shown with NS on and AMP on
- **THEN** Controller does not show an AMP panel
- **AND** the AMP slot stays marked disabled with a prohibition overlay

#### Scenario: Unknown dump hides editable panels
- **WHEN** initial sync ended without an audio-chain dump
- **THEN** Controller shows the default-order chain
- **AND** it does not show editable slot control panels

#### Scenario: Busy overlay covers the panels
- **WHEN** the user selects another patch after sync and the new chain dump has not arrived yet
- **THEN** Controller shows a busy overlay over the slot control panels
- **AND** those panels cannot be used

#### Scenario: USB and Bluetooth share the panels
- **WHEN** a Bluetooth session is showing AMP on with a known model
- **THEN** Controller shows the same AMP panel presentation as USB for that pedal
- **AND** a control change is sent through the device session

#### Scenario: Bluetooth panel follows a pedal control change
- **WHEN** a Bluetooth session is showing AMP Gain at 30 and the pedal reports AMP Gain 45
- **THEN** the AMP panel shows Gain at 45

#### Scenario: Disconnect hides the panels
- **WHEN** the user disconnects while Controller is showing slot control panels
- **THEN** the panels are hidden
- **AND** the screen states that no pedals are connected
