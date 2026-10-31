## MODIFIED Requirements

### Requirement: Controller shows enabled slot control panels

After the audio chain is shown, Controller SHALL show a control panel below the chain for each enabled effect slot (NR, PRE, DST, NS, AMP, CAB, EQ, MOD, DLY, RVB) whose loaded model and control values are known from the device session. Panels MUST be laid out in two columns when width allows. Each panel MUST show that slot's kind, the loaded model's English label, and that model's visible controls for the connected pedal (label, current value, and the catalog min / max / step). The model select MUST list only factory models that exist on the connected pedal. When a kind has more than one such model, the panel MUST offer a model select. A kind with only one factory model MUST still show its controls and MUST NOT require a select. GP-5 PRE MUST NOT list C-Wah or AC Sim. GP-50 PRE MUST list C-Wah and AC Sim. GP-5 CAB MUST NOT list AC. GP-50 CAB MUST list AC. GP-5 panels MUST NOT show Sync, S-Sync, or D-Sync. A B-Boost panel MUST show Gain, VOL, Bass, and Treble on both pedals and MUST NOT show Tone. GP-50 EXP MUST NOT get a control panel. Disabled effect slots MUST NOT show a panel. AMP and CAB panels MUST NOT appear while NS marks those slots bypassed. Labels MUST be in English.

Each panel header MUST show that slot's kind icon and MUST NOT show a separate info button. When the loaded model has a description, activating that icon MUST open a dialog titled with the model's English name and containing that description, and MUST NOT send a model or control write. When the loaded model has no description, activating the icon MUST NOT open a dialog. Each panel shown in the grid MUST include an A/B control that shows the same compare icon as patch A/B. Its tooltip MUST read `A/B Test - Compare Settings`. Activating that control MUST open module A/B for that slot. While a slot is open in module A/B, that slot's panel MUST NOT also appear in the grid, and the audio chain MUST still show that slot.

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

#### Scenario: Kind icon opens the model description

- **WHEN** a panel is showing a model that has a description and the user activates that panel's kind icon
- **THEN** a dialog opens with that model's English name and description
- **AND** no model or control write is sent

#### Scenario: Kind icon stays inert without a description

- **WHEN** a panel is showing a model that has no description
- **THEN** activating that panel's kind icon does not open a dialog
- **AND** the panel does not show an info button

#### Scenario: Panel offers module A/B

- **WHEN** an AMP panel is shown in the grid
- **THEN** that panel includes an A/B control with the same compare icon as patch A/B
- **AND** its tooltip reads `A/B Test - Compare Settings`
- **AND** the panel does not show an info button

### Requirement: A/B play alternates two patches

While A/B setup is open and Play is usable, activating Play MUST start a cycle and show Stop in place of Play. Space MUST start or stop that cycle the same way when A/B setup is open, the module A/B block is not open, and focus is not in an editable field, button, combobox, or dialog. While the module A/B block is open, Space MUST NOT start or stop this patch cycle. Starting this cycle while a module A/B cycle is running MUST stop that module cycle without closing the module A/B block and MUST NOT apply a module version solely because the patch cycle started. The cycle MUST capture side A's slot and side B's slot at that moment. It MUST NOT send patch recall for A when Play starts if the pedal is already on that slot. If the pedal is on a different slot, Play MUST recall side A before the first dwell. Side A MUST keep showing its captured slot while the pedal is on side B. After the chain is idle, it MUST wait the captured dwell in seconds, then recall B through the device session. After that recall's chain is idle, it MUST wait the same dwell, then recall A, and MUST repeat that alternation. A chain sync that starts during a dwell MUST cancel that dwell; the next dwell MUST start only once the chain is idle again. The cycle MUST NOT send patch recall while the chain is syncing.

While the cycle is running, both selectors and the seconds input MUST NOT be usable. Previous and next stay hidden. Stop and X MUST stay usable, including while the chain is syncing. X MUST NOT send patch recall by itself. Stop MUST end the cycle, recall side A when the pedal is not already on that slot, and return the bar to A/B setup with Play. Side A stays the selected slot. X MUST end the cycle and restore the normal patch bar. A patch change reported by the pedal MUST end the cycle if one is running, close A/B setup, and MUST NOT send another patch recall solely because the setup closed. An app recall from this cycle MUST NOT close the setup. Disconnecting MUST end the cycle and hide the bar. Each recall MUST follow the existing patch-change chain refresh. Unsaved working edits MUST be discarded by those recalls the same way as manual navigation, without an extra confirm. The same cycle MUST be used on USB and Bluetooth. Controller MUST NOT send raw MIDI.

#### Scenario: Play dwells on the loaded patch before the first switch

- **WHEN** A/B setup is open, the chain is idle, the current patch is `10`, the comparison slot is `11`, the seconds input is 5, and the user activates Play
- **THEN** Play is replaced by Stop
- **AND** the current patch stays `10` when the cycle starts
- **AND** no patch recall is sent until 5 seconds have passed with the chain idle
- **AND** the pedal is then sent patch 11 through the device session
- **AND** the side A selector still reads `10`

#### Scenario: Space toggles Play and Stop

- **WHEN** A/B setup is open, the module A/B block is not open, Play is usable, and the user presses Space without focus in an editable field, button, combobox, or dialog
- **THEN** the cycle starts as if Play had been activated
- **AND** pressing Space again stops the cycle as if Stop had been activated

#### Scenario: Space does not drive the patch cycle during module A/B

- **WHEN** patch A/B setup is open, the module A/B block is open, and the user presses Space without focus in an editable field, button, combobox, or dialog
- **THEN** the patch cycle does not start
- **AND** no patch recall is sent solely because Space was pressed

#### Scenario: Starting patch Play stops a running module cycle

- **WHEN** a module A/B cycle is running and the user activates Play on patch A/B setup
- **THEN** the module cycle ends
- **AND** the module A/B block stays open
- **AND** no module version is applied solely because the patch cycle started
- **AND** the patch cycle starts

#### Scenario: The cycle returns to A and continues

- **WHEN** a cycle captured A as `10` and B as `11` with a 5 second dwell, patch `11` is loaded, and that patch's chain is idle
- **THEN** the pedal is sent patch 10 through the device session after 5 idle seconds
- **AND** after patch `10` is idle for 5 seconds the pedal is sent patch 11 again

#### Scenario: Sync delays the next recall

- **WHEN** a cycle is waiting to recall the other slot and the chain is syncing
- **THEN** no patch recall is sent while the chain is syncing
- **AND** the dwell starts once the chain is idle
- **AND** the other slot is recalled only after that full dwell

#### Scenario: Stop returns to side A

- **WHEN** a cycle is running, side A is patch `10`, patch `11` is loaded, and the user activates Stop
- **THEN** the cycle ends
- **AND** the pedal is sent patch 10 through the device session
- **AND** the bar stays in A/B setup and shows Play
- **AND** the side A selector still reads `10`

#### Scenario: A pedal patch change closes A/B

- **WHEN** A/B setup is open and the pedal changes the current patch
- **THEN** the cycle ends if one is running
- **AND** the normal patch bar is shown
- **AND** no patch recall is sent solely because the setup closed

#### Scenario: Close during the cycle restores the normal bar

- **WHEN** a cycle is running and the user activates X
- **THEN** the cycle ends
- **AND** the normal patch bar is shown
- **AND** no patch recall is sent solely because the setup closed

#### Scenario: Stop and close stay usable while the chain syncs

- **WHEN** a cycle recall is in progress and the chain is syncing
- **THEN** both selectors and the seconds input are not usable
- **AND** Stop and X remain usable
- **AND** activating either one does not send another patch recall

#### Scenario: Disconnect ends the cycle

- **WHEN** the user disconnects while a cycle is running
- **THEN** the cycle ends
- **AND** the patch bar is hidden
- **AND** no further patch recall is sent for that cycle

#### Scenario: USB and Bluetooth share the cycle

- **WHEN** a USB session and a Bluetooth session each start a cycle from patch `10` to comparison slot `11`
- **THEN** both alternate those slots through the device session
- **AND** neither sends raw MIDI from Controller

## ADDED Requirements

### Requirement: Controller offers module A/B

After the audio chain and its panels are shown, activating a panel's A/B control MUST open one module A/B block for that effect slot and MUST NOT send a model or control write. The block MUST sit directly under the audio chain and above every other panel, on a darker band matching the patch A/B bar and spanning the page width. It MUST show Use A centered above side A, Play centered above the seconds input, and Use B centered above side B. Use A's tooltip MUST read `Set side A and close`. Use B's tooltip MUST read `Set side B and close`. Activating Use A or Use B MUST end module A/B, set that side on the pedal when it is not already the slot's model and control values, MUST NOT save the patch, discard the other side, and return the slot's panel to the grid showing the chosen side. The block MUST show, in order, side A, a seconds input, and side B. When width allows, those three MUST sit on one row.

Side A MUST be that slot's panel, moved out of the grid. Side B MUST start as a copy of side A: the same model and the same control values. Both sides MUST offer the same model select and visible controls as a normal panel for that slot and pedal. The seconds input MUST show an integer dwell from 2 through 200, MUST show 5 when the block opens, and MUST use the accessible name `Seconds`. Clearing the field while editing MUST be allowed; blur or Play MUST resolve an empty value to 5 and clamp out-of-range values into that range.

While the cycle is not running, the side that matches the pedal is sounding and the other side is held locally. Edits on the sounding side MUST go through the device session with the same throttle and on-change rules as a normal panel. Edits on the other side, including a model change, MUST update only that side and MUST NOT send a model or control write. A model change on the local side MUST update that side's controls the same way a live model change updates a panel. The sounding side MUST be marked so it can be told apart from the other side. The module box of the side that is not sounding MUST be shown at 60% opacity, and it MUST stay editable.

Only one module A/B block MUST be open. While it is open, A/B controls on the remaining panels MUST NOT be usable. Disconnect, turning that slot off, NS bypass hiding that slot's panel, or the chain-refresh busy overlay MUST end module A/B and leave the pedal on the side last applied. The audio chain MUST keep showing the slot while the block is open. The same block MUST be used on USB and Bluetooth. Controller MUST NOT send raw MIDI.

#### Scenario: A/B lifts the panel out of the grid

- **WHEN** MOD is on with a known model and the user activates A/B on the MOD panel
- **THEN** a module A/B block is shown under the audio chain and above the other panels
- **AND** the MOD panel is no longer in the grid
- **AND** the MOD slot remains in the audio chain
- **AND** no model or control write is sent solely because the block opened

#### Scenario: B starts as a copy of A

- **WHEN** the user opens module A/B on AMP while AMP is Tweedy with Gain at 30
- **THEN** side A shows Tweedy with Gain at 30
- **AND** side B shows Tweedy with Gain at 30
- **AND** the seconds input shows 5
- **AND** Use A is centered above side A, Play is centered above the seconds input, and Use B is centered above side B

#### Scenario: Editing B does not write

- **WHEN** module A/B is open, the cycle is not running, side A is sounding, and the user sets Gain on side B to 80
- **THEN** side B shows Gain at 80
- **AND** side A stays unchanged
- **AND** no control write is sent for that edit

#### Scenario: Editing the sounding side writes

- **WHEN** module A/B is open, the cycle is not running, side A is sounding with Gain at 30, and the user sets Gain on side A to 45
- **THEN** side A shows Gain at 45
- **AND** that change is sent through the device session
- **AND** side B stays unchanged

#### Scenario: Seconds match patch A/B

- **WHEN** module A/B is open and the user clears the seconds input, then leaves the field
- **THEN** the seconds input shows 5
- **AND** a value below 2 or above 200 is clamped into 2 through 200 on blur

#### Scenario: A second module cannot open another block

- **WHEN** module A/B is already open on MOD
- **THEN** A/B on the other panels is not usable
- **AND** the MOD block stays the only module A/B block

#### Scenario: Use A keeps the sounding side without a write

- **WHEN** module A/B is open, side A is sounding, side B differs, and the user activates Use A
- **THEN** the block closes
- **AND** the slot's panel returns to the grid showing side A
- **AND** side B is discarded
- **AND** no model or control write is sent solely because Use A ran
- **AND** the patch is not saved

#### Scenario: Use B sets the other side and closes

- **WHEN** module A/B is open, side A is sounding, side B differs, and the user activates Use B
- **THEN** the block closes
- **AND** the slot is set to side B through the device session
- **AND** the slot's panel returns to the grid showing side B
- **AND** side A is discarded
- **AND** the patch is not saved

#### Scenario: Turning the slot off ends module A/B

- **WHEN** module A/B is open on DLY and the user turns DLY off
- **THEN** the block closes
- **AND** the DLY panel is hidden
- **AND** the pedal stays on the side that was sounding

#### Scenario: USB and Bluetooth share module A/B setup

- **WHEN** a USB session and a Bluetooth session each open module A/B on the same kind of panel
- **THEN** both show the same block layout, tooltips, and seconds range

### Requirement: Module A/B play alternates two versions

While module A/B is open, activating Play MUST start a cycle and show Stop in place of Play. Space MUST start or stop that cycle the same way when the block is open and focus is not in an editable field, button, combobox, or dialog. Starting this cycle while a patch A/B cycle is running MUST stop that patch cycle without closing patch A/B setup and MUST NOT send patch recall solely because the module cycle started. The module cycle MUST capture side A and side B at that moment. It MUST NOT re-apply the side that is already sounding when Play starts. After the chain is idle, it MUST wait the seconds shown when that dwell starts, then apply the other captured side through the device session. After that apply's chain is idle, it MUST wait the seconds shown when the next dwell starts, then apply the remaining side, and MUST repeat that alternation. A chain sync that starts during a dwell MUST cancel that dwell; the next dwell MUST start only once the chain is idle again. The cycle MUST NOT apply a side while the chain is syncing. Applying a side MUST make that slot's model and control values match the captured side.

While the cycle is running, both sides MUST stay usable. An edit on the sounding side MUST go through the device session, with the same throttle and on-change rules as a normal panel, and MUST update that captured side. An edit on the other side, including a model change, MUST update only that captured side and MUST NOT send a model or control write until that side is applied. The seconds input MUST be replaced by a countdown of the seconds left in the current dwell, and a progress line above that countdown MUST show that dwell running toward the other side. The sounding side's rule MUST be lit, and the other side's rule MUST not. Both sides MUST keep showing their captured versions, including those edits. The sounding side MUST stay marked, and the module box of the side that is not sounding MUST stay at 60% opacity. Use A, Use B, and Stop MUST stay usable, including while the chain is syncing. Stop MUST end the cycle, set the slot to captured side A when it is not already there, and return the block to setup with Play, with side A sounding. Stop MUST NOT save the patch. Use A or Use B MUST end the cycle, set that captured side on the pedal when it is not already there, MUST NOT save the patch, and return the slot's panel to the grid showing the chosen side. Disconnect, turning that slot off, NS bypass hiding that panel, or the chain-refresh busy overlay MUST end the cycle and leave the pedal on the side last applied. The same cycle MUST be used on USB and Bluetooth. Controller MUST NOT send raw MIDI.

#### Scenario: Play dwells on A before the first switch

- **WHEN** module A/B is open, the chain is idle, side A is sounding as Tweedy with Gain at 30, side B is Tweedy with Gain at 80, the seconds input is 5, and the user activates Play
- **THEN** Play is replaced by Stop
- **AND** the slot stays Tweedy with Gain at 30 when the cycle starts
- **AND** no model or control write is sent until 5 seconds have passed with the chain idle
- **AND** the slot is then set to Tweedy with Gain at 80 through the device session

#### Scenario: Space toggles module Play and Stop

- **WHEN** module A/B is open and the user presses Space without focus in an editable field, button, combobox, or dialog
- **THEN** the cycle starts as if Play had been activated
- **AND** pressing Space again stops the cycle as if Stop had been activated
- **AND** a patch A/B cycle does not start

#### Scenario: Starting module Play stops a running patch cycle

- **WHEN** a patch A/B cycle is running and the user activates Play on the module A/B block
- **THEN** the patch cycle ends
- **AND** patch A/B setup stays open
- **AND** no patch recall is sent solely because the module cycle started
- **AND** the module cycle starts

#### Scenario: The cycle returns to A and continues

- **WHEN** a module cycle captured A as Gain 30 and B as Gain 80 with a 5 second dwell, B has been applied, and the chain is idle
- **THEN** the slot is set to Gain 30 through the device session after 5 idle seconds
- **AND** after that apply is idle for 5 seconds the slot is set to Gain 80 again

#### Scenario: Sync delays the next apply

- **WHEN** a module cycle is waiting to apply the other side and the chain is syncing
- **THEN** no model or control write for that side is sent while the chain is syncing
- **AND** the dwell starts once the chain is idle
- **AND** the other side is applied only after that full dwell

#### Scenario: Stop returns to side A

- **WHEN** a module cycle is running, side B was the last side applied, and the user activates Stop
- **THEN** the cycle ends
- **AND** the slot is set to side A through the device session
- **AND** the block stays open and shows Play
- **AND** side A is sounding
- **AND** the patch is not saved

#### Scenario: Use A during the cycle sets A and closes

- **WHEN** a module cycle is running, side B was the last side applied, and the user activates Use A
- **THEN** the cycle ends
- **AND** the slot is set to side A through the device session
- **AND** the slot's panel returns to the grid showing side A
- **AND** side B is discarded
- **AND** the patch is not saved

#### Scenario: Editing the sounding side during the cycle writes

- **WHEN** a module cycle is running, side A is sounding with Gain at 30, and the user sets Gain on side A to 45
- **THEN** side A shows Gain at 45
- **AND** that change is sent through the device session
- **AND** the next time side A is applied, Gain is 45

#### Scenario: Editing the other side during the cycle does not write yet

- **WHEN** a module cycle is running, side A is sounding, side B has Gain at 80, and the user sets Gain on side B to 60
- **THEN** side B shows Gain at 60
- **AND** no control write is sent for that edit
- **AND** the next apply of side B uses Gain at 60

#### Scenario: Play shows the countdown and lights the sounding side

- **WHEN** a module cycle is running, side A is sounding, and the dwell is 5 seconds
- **THEN** the seconds input is a countdown of the seconds left in that dwell
- **AND** a progress line above the countdown runs toward side B
- **AND** side A's rule is lit
- **AND** side B's rule is not lit

#### Scenario: Use A, Use B, and Stop stay usable while the cycle runs

- **WHEN** a module cycle is running
- **THEN** both sides stay usable
- **AND** Use A, Use B, and Stop remain usable

#### Scenario: USB and Bluetooth share the module cycle

- **WHEN** a USB session and a Bluetooth session each start a module cycle between two captured versions of the same slot
- **THEN** both alternate those versions through the device session
- **AND** neither sends raw MIDI from Controller
