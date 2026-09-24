# live-controller Specification

## Purpose

Shows Controller as the live home: an empty state with no pedal, a loading state while the session syncs patch identity and the current audio chain, patch 00–99 previous / select / next once that identity is known or the sync times out, and an audio chain for the current patch whose effect modules can be turned on or off and whose movable modules can be reordered. On Bluetooth, pedal chain-order reports also update that row.

## Requirements

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

### Requirement: Connected Controller selects patches 00-99 after sync

Once initial sync completes or times out, Controller SHALL show a patch bar: previous, the current patch as a two-digit selectable label (`00`–`99`), next, Reload, and English controls to Save, rename, duplicate, download, and upload the current patch. Reload MUST sit immediately left of Save. It MUST be an icon-only control with an English tooltip. Activating Reload MUST re-request the current patch's preset dump through the device session, MUST NOT change the selected patch, and MUST NOT send patch recall. The label MUST show the pedal's current patch when that index was received. If the index was not received, the label MUST stay at `00` and MUST NOT send patch `00` solely because sync ended. Choosing a patch or stepping previous/next MUST update the session patch and send that patch to the pedal through the device session using official CC 0 (value 0–99). Previous from `00` MUST wrap to `99`. Next from `99` MUST wrap to `00`. Save, rename, duplicate, download, and upload MUST go through the device session and MUST NOT send raw MIDI from React. Disconnecting MUST hide the patch bar and return to the empty state. Controller MUST NOT send raw MIDI.

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

### Requirement: User can reorder movable chain modules

After the chain is shown, Controller SHALL let the user drag a movable effect module (NR, PRE, MOD, DLY, or RVB) to another effect slot through the device session. Fixed effect modules (DST, NS, AMP, CAB, EQ) MUST NOT be draggable and MUST stay a contiguous block in that order; a drop that would place a module between them MUST leave the chain unchanged. Movable modules MAY occupy slots before or after that block. On GP-50, EXP MUST NOT be draggable and MUST stay the last slot; a drop onto EXP MUST leave the chain unchanged. Dropping a movable module onto a valid new effect slot MUST move that module there, MUST keep every other module's on/off, and MUST keep the fixed block intact. Each movable slot MUST show a three-dot grip at the top. Dropping a module onto its current slot, dragging a fixed module, or any other invalid drop MUST leave the chain unchanged. Flipping an on/off switch MUST still toggle that module and MUST NOT start a drag. Activating the rest of a movable slot MUST NOT toggle on/off. While the chain busy overlay is shown, slots MUST NOT be draggable. The same drag presentation MUST be used on USB and Bluetooth. Controller MUST NOT send raw MIDI.

#### Scenario: Drag a movable module to a new slot
- **WHEN** a GP-5 session is showing NR, PRE, DST, NS, AMP, CAB, EQ, MOD, DLY, RVB and the user drops RVB before DST
- **THEN** Controller shows NR, PRE, RVB, DST, NS, AMP, CAB, EQ, MOD, DLY
- **AND** each module keeps its previous on/off
- **AND** that change is sent through the device session

#### Scenario: USB and Bluetooth share chain drag
- **WHEN** a Bluetooth session is showing the audio chain and the user drops PRE after EQ
- **THEN** Controller shows the same new order as USB would for that model
- **AND** that change is sent through the device session

#### Scenario: Nothing may sit between the fixed block
- **WHEN** a GP-5 session is showing NR, PRE, DST, NS, AMP, CAB, EQ, MOD, DLY, RVB and the user drops PRE after AMP
- **THEN** module order does not change
- **AND** no chain-order write is sent

#### Scenario: Fixed modules cannot be dragged
- **WHEN** the user tries to drag DST to another slot
- **THEN** module order does not change
- **AND** no chain-order write is sent

#### Scenario: EXP cannot be dragged or receive a drop
- **WHEN** a GP-50 session is showing the audio chain and the user tries to drop MOD onto EXP
- **THEN** module order does not change
- **AND** EXP stays the last slot
- **AND** no chain-order write is sent

#### Scenario: Toggle still does not reorder
- **WHEN** the user turns DST off after sync
- **THEN** the DST slot is shown as off
- **AND** module order does not change

#### Scenario: Busy overlay blocks drag
- **WHEN** Controller is covering the chain with the busy overlay and the user tries to drag PRE
- **THEN** module order does not change
- **AND** no chain-order write is sent

### Requirement: Bluetooth pedal module changes update the chain

After initial sync, when the session is on Bluetooth and the pedal reports a module on/off change for the current patch, Controller MUST update that slot's on/off through the device session without changing module order and without sending patch recall or a chain dump solely because that report arrived. Stomp-mode footswitches that toggle effect modules are such reports: Controller MUST follow those on/off changes through the device session. Controller MUST NOT show the chain-refresh busy overlay solely because a footswitch was pressed. When the session is on USB, Controller MUST keep the last known on/off for that slot even if a live-module or stomp report arrives. Volume and other non-module live controls MUST NOT update the chain.

#### Scenario: Pedal turns a module off over Bluetooth
- **WHEN** a Bluetooth session is showing DST on and the pedal reports DST off
- **THEN** the DST slot is shown as off
- **AND** module order does not change
- **AND** no patch recall is sent solely because that report arrived

#### Scenario: Pedal turns EXP off over Bluetooth
- **WHEN** a GP-50 Bluetooth session is showing EXP on and the pedal reports EXP off
- **THEN** the EXP slot is shown as off
- **AND** no patch recall is sent solely because that report arrived

#### Scenario: Stomp footswitch toggles a module over Bluetooth
- **WHEN** a Bluetooth session is showing DST on and the user presses a Stomp-mode footswitch that turns DST off
- **THEN** the DST slot is shown as off
- **AND** module order does not change
- **AND** no patch recall is sent solely because that footswitch was pressed
- **AND** the chain-refresh busy overlay is not shown solely because that footswitch was pressed

#### Scenario: Stomp footswitch updates every reported module
- **WHEN** a Bluetooth session is showing MOD on and DLY off and a Stomp-mode footswitch reports MOD off and DLY on
- **THEN** the MOD slot is shown as off
- **AND** the DLY slot is shown as on
- **AND** module order does not change

#### Scenario: GP-5 Bluetooth footswitch follows the chain
- **WHEN** a GP-5 Bluetooth session is showing AMP on and a footswitch turns AMP off
- **THEN** the AMP slot is shown as off
- **AND** the chain-refresh busy overlay is not shown solely because that footswitch was pressed

#### Scenario: USB does not follow pedal module reports
- **WHEN** a USB session is showing DST on and a live-module report for DST off arrives
- **THEN** the DST slot stays shown as on

#### Scenario: USB does not follow a Stomp footswitch
- **WHEN** a USB session is showing DST on and a Stomp-mode footswitch turns DST off on the pedal
- **THEN** the DST slot stays shown as on

### Requirement: Bluetooth pedal chain-order changes update the chain

After initial sync, when the session is on Bluetooth and the pedal reports a chain-order change for the current patch, Controller MUST update the slot order through the device session without sending patch recall or a chain dump solely because that report arrived. On/off for modules that stay in the chain MUST be preserved unless that report also carries on/off. When the session is on USB, Controller MUST keep the last known order even if a live chain-order report arrives.

#### Scenario: Pedal reorders over Bluetooth
- **WHEN** a Bluetooth session is showing RVB last among effects and the pedal reports RVB before DST
- **THEN** Controller shows RVB before DST
- **AND** no patch recall is sent solely because that report arrived

#### Scenario: USB does not follow pedal chain-order reports
- **WHEN** a USB session is showing RVB last among effects and a live chain-order report for RVB before DST arrives
- **THEN** Controller keeps RVB last among effects

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

### Requirement: NS on marks AMP and CAB as disabled

When NS is on, Controller MUST mark the AMP and CAB slots as disabled with a prohibition overlay. The overlay MUST appear whether those slots are on or off. AMP and CAB MUST still show their stored on/off. Flipping an AMP or CAB on/off switch while the overlay is shown MUST still flip that module's on/off through the device session and MUST NOT change NS on/off or module order. Turning NS off MUST remove the overlay. Other chain slots MUST NOT receive this overlay. The same presentation MUST be used on USB and Bluetooth. Controller MUST NOT send raw MIDI.

#### Scenario: NS on marks AMP while AMP is on
- **WHEN** the audio chain is shown with NS on and AMP on
- **THEN** the AMP slot is shown as on
- **AND** the AMP slot is marked disabled with a prohibition overlay

#### Scenario: NS on marks CAB while CAB is off
- **WHEN** the audio chain is shown with NS on and CAB off
- **THEN** the CAB slot is shown as off
- **AND** the CAB slot is marked disabled with a prohibition overlay

#### Scenario: NS off clears the mark
- **WHEN** the audio chain is shown with NS on, AMP on, and CAB off and the user turns NS off
- **THEN** the AMP and CAB prohibition overlays are hidden
- **AND** the AMP slot is still shown as on
- **AND** the CAB slot is still shown as off

#### Scenario: AMP still toggles while marked
- **WHEN** the audio chain is shown with NS on and AMP on and the user turns AMP off
- **THEN** the AMP slot is shown as off
- **AND** the AMP slot stays marked disabled with a prohibition overlay
- **AND** that change is sent through the device session
- **AND** NS stays on

#### Scenario: USB and Bluetooth share the mark
- **WHEN** a Bluetooth session is showing NS on
- **THEN** Controller marks AMP and CAB with the same prohibition overlay as USB

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

### Requirement: CAB panel lists onboard user IR slots

When Controller is showing a CAB control panel, the model select MUST include the twenty onboard user IR slots together with the factory CAB models for the connected pedal. Until IR names are known, those slots MUST use the English fallback labels `User IR 01` through `User IR 20`. When the session has a name for a slot, the select MUST show that name instead of the fallback. A blank or missing name MUST keep the fallback. The same labels MUST be used on USB and Bluetooth. Controller MUST NOT send raw MIDI.

Selecting a user IR slot MUST go through the device session the same way as selecting a factory CAB model. Identity loading and chain refresh MUST NOT wait for IR names. If names arrive after the CAB panel is already shown, the select MUST update those labels without hiding the panel or sending patch recall.

#### Scenario: User IR dump shows the CAB panel
- **WHEN** a session is showing the audio chain with CAB on and a dump that loaded User IR 03 with VOL at 50
- **THEN** Controller shows a CAB panel
- **AND** that panel lists User IR 03 or that slot's dumped name
- **AND** that panel shows VOL at 50

#### Scenario: Fallback labels before names arrive
- **WHEN** a session is showing a CAB panel whose loaded model is a user IR slot and IR names have not arrived
- **THEN** that panel's model select lists `User IR 01` through `User IR 20`

#### Scenario: Dumped name replaces the fallback
- **WHEN** a CAB panel is listing `User IR 03` and the session receives the name `Greenback 412` for that slot
- **THEN** that panel's model select lists `Greenback 412` for that slot
- **AND** the panel stays shown
- **AND** no patch recall is sent solely because the name arrived

#### Scenario: Blank IR name keeps the fallback
- **WHEN** a session receives a blank name for user IR slot 07
- **THEN** the CAB model select still lists `User IR 07` for that slot

#### Scenario: User selects a user IR slot
- **WHEN** the CAB panel is showing a factory CAB model and the user selects User IR 03
- **THEN** the CAB panel lists User IR 03 or that slot's dumped name
- **AND** that change is sent through the device session

#### Scenario: USB and Bluetooth share user IR labels
- **WHEN** a Bluetooth session is showing a CAB panel with dumped IR names
- **THEN** Controller shows the same CAB user IR labels as USB for that pedal

### Requirement: Controller saves, renames, duplicates, and downloads the current patch

After the patch bar is shown, Controller SHALL let the user Save the current working patch onto the current slot, rename that patch, duplicate it onto another 00–99 slot, download it to the PC, and upload a Valeton `.prst` into the current working patch, all through the device session. Labels MUST be in English. The same controls MUST be used on USB and Bluetooth.

Save MUST store the current working patch on the pedal in the current slot. Rename MUST change the onboard name of the current patch (at most 10 characters) through the session and MUST update the selector when that name is known. Duplicate MUST ask for a destination slot other than the current one; confirming MUST copy the current working patch onto that slot without changing the selected patch; overwriting a destination that already has a patch MUST require confirmation. Download MUST produce a Valeton `.prst` of the current patch for the connected pedal (GP-50 session → GP-50 `.prst`; GP-5 session → GP-5 `.prst`). Download MUST NOT convert the patch to the other model. If the current-preset dump is missing, download MUST NOT invent a file.

Upload MUST let the user pick a `.prst` from the PC. After a file is chosen, Controller MUST ask the user to confirm that this will load into the current working patch. Cancel MUST NOT apply the file and MUST NOT send MIDI. Confirm MUST apply that file onto the currently selected patch through the device session and MUST NOT store it on the pedal. Save remains the control that stores the working patch. Upload MUST NOT change which patch is selected. Upload MUST NOT convert a GP-5 file for a GP-50 session or the reverse. A file whose model does not match the connected pedal, or that is not a valid Valeton `.prst`, MUST produce an English error and MUST NOT be applied. The slot number in the filename MUST be ignored. Controller MUST NOT send raw MIDI.

While the current patch is syncing, Reload, Save, rename, duplicate, download, upload, previous, and next MUST NOT be usable. Disconnecting MUST hide those controls with the patch bar.

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

#### Scenario: User downloads a GP-50 preset file
- **WHEN** a GP-50 session is ready, the current patch is `60` named `TOB` and synced with a current-preset dump, and the user activates download
- **THEN** a Valeton `.prst` for GP-50 is produced through the device session
- **AND** the filename identifies GP-50, slot `60`, and `TOB`
- **AND** no extra patch recall is sent solely because download ran

#### Scenario: User downloads a GP-5 preset file
- **WHEN** a GP-5 session is ready, the current patch is synced with a current-preset dump, and the user activates download
- **THEN** a Valeton `.prst` for GP-5 is produced through the device session
- **AND** the filename identifies GP-5 and that slot and name

#### Scenario: Download is unavailable without a dump
- **WHEN** the session is ready without a current-preset dump
- **THEN** download cannot be used
- **AND** no local patch file is produced

#### Scenario: Upload asks before loading into the current patch
- **WHEN** the session is ready, the current patch is `60` named `TOB` and synced, and the user picks a Valeton `.prst` to upload
- **THEN** Controller asks the user to confirm that this will load into the current working patch
- **AND** no upload write is sent until the user confirms

#### Scenario: User cancels upload
- **WHEN** Controller is asking to confirm an upload and the user cancels
- **THEN** the current patch is not replaced
- **AND** no upload write is sent

#### Scenario: User uploads a GP-50 preset into the working patch
- **WHEN** a GP-50 session is ready, the current patch is `05` named `Flow` and synced, and the user confirms upload of a valid GP-50 `.prst` named `TOB`
- **THEN** that file is applied onto the working patch through the device session
- **AND** no store write is sent solely because upload ran
- **AND** the selected patch stays `05`
- **AND** the selector lists patch `05` with name `Flow`
- **AND** no extra patch recall is sent solely because upload ran

#### Scenario: User uploads a GP-5 preset into the working patch
- **WHEN** a GP-5 session is ready, the current patch is synced, and the user confirms upload of a valid GP-5 `.prst`
- **THEN** that file is applied onto the working patch through the device session
- **AND** no store write is sent solely because upload ran
- **AND** the selected patch does not change

#### Scenario: Wrong-model file is rejected
- **WHEN** a GP-50 session is ready and the user picks a GP-5 `.prst`
- **THEN** Controller shows an English error
- **AND** no upload write is sent

#### Scenario: Invalid file is rejected
- **WHEN** the session is ready and the user picks a file that is not a valid Valeton `.prst`
- **THEN** Controller shows an English error
- **AND** no upload write is sent

#### Scenario: Busy patch bar blocks store actions
- **WHEN** the user has selected another patch after sync and the new chain dump has not arrived yet
- **THEN** Reload, Save, rename, duplicate, download, and upload cannot be used
- **AND** previous and next cannot be used

#### Scenario: USB and Bluetooth share the patch bar actions
- **WHEN** a Bluetooth session is ready with a synced current patch and the user activates Save
- **THEN** Controller uses the same Save presentation as USB
- **AND** that store is sent through the device session

### Requirement: Patch bar edits patch volume and patch BPM

After the patch bar is shown, Controller SHALL show a patch-volume control for GP-5 and GP-50 and a patch-BPM control for GP-50 only. Labels MUST be in English (`P-Vol` and `BPM`). The volume control MUST cover 0–100. The BPM control MUST cover 40–260. GP-5 MUST NOT show a BPM control. Placement inside the patch bar is enough; a later layout pass may move them within that bar.

Each control MUST show the value from the current-preset dump once that value is known, and MUST NOT be usable before then. It MUST NOT send a write while it is unusable, including while the current patch is syncing. Dragging MUST update the displayed number on-change. Writes for that drag MUST be throttled so the session does not send a value for every intermediate step. Releasing MUST send the last value if it was not already sent. Setting a value MUST go through the device session and MUST NOT send raw MIDI from React. The same controls MUST be used on USB and Bluetooth. Disconnecting MUST hide them with the patch bar.

#### Scenario: GP-50 bar shows volume and BPM from the dump
- **WHEN** a GP-50 session is showing the patch bar and the current-preset dump has patch volume 80 and patch BPM 120
- **THEN** Controller shows P-Vol at 80 and BPM at 120

#### Scenario: GP-5 bar shows volume and hides BPM
- **WHEN** a GP-5 session is showing the patch bar and the current-preset dump has patch volume 80
- **THEN** Controller shows P-Vol at 80
- **AND** Controller does not show a BPM control

#### Scenario: Unknown dump keeps the controls unusable
- **WHEN** the patch bar is shown and the current-preset dump has not supplied patch volume
- **THEN** P-Vol cannot be used
- **AND** no patch-volume write is sent

#### Scenario: User sets patch volume through the session
- **WHEN** P-Vol is showing 80 and the user sets it to 60
- **THEN** P-Vol shows 60
- **AND** that change is sent through the device session

#### Scenario: User sets GP-50 patch BPM through the session
- **WHEN** a GP-50 session is showing BPM at 120 and the user sets it to 140
- **THEN** BPM shows 140
- **AND** that change is sent through the device session

#### Scenario: Slider drag does not send every step
- **WHEN** P-Vol is showing 80 and the user drags it toward 40 without releasing
- **THEN** P-Vol follows the dragged value
- **AND** the session does not send a patch-volume write for every intermediate value

#### Scenario: Slider release sends the last value
- **WHEN** the user releases the P-Vol control after dragging
- **THEN** the last displayed volume is sent through the device session if it was not already sent

#### Scenario: Syncing blocks volume and BPM
- **WHEN** the user has selected another patch and the new current-preset dump has not arrived yet
- **THEN** P-Vol cannot be used
- **AND** on GP-50, BPM cannot be used
- **AND** no patch-volume or patch-BPM write is sent

#### Scenario: USB and Bluetooth share the controls
- **WHEN** a Bluetooth session is showing P-Vol from a current-preset dump and the user sets a new volume
- **THEN** Controller uses the same P-Vol control as USB
- **AND** that change is sent through the device session

#### Scenario: Disconnect hides volume and BPM
- **WHEN** the user disconnects while P-Vol is showing
- **THEN** P-Vol is hidden
- **AND** BPM is hidden

### Requirement: Controller Save follows the working modified state

After the patch bar is shown, Save MUST appear before Rename. Save MUST NOT be usable when the current working patch is not modified, and MUST NOT be usable while the current patch is syncing. When the working patch is modified and synced, Save MUST be usable and MUST use an emerald style distinct from the other patch-bar actions. Hovering previous, next, or the patch selector MUST show an English tooltip that unsaved changes will be lost. That tooltip MUST NOT block choosing or stepping to another patch. Controller MUST NOT show a separate Modified label. The same presentation MUST be used on USB and Bluetooth. Controller MUST NOT send raw MIDI.

A patch-volume edit, and on GP-50 a patch-BPM edit, that differs from the baseline MUST make Save usable with that same emerald style. Restoring patch volume, and on GP-50 patch BPM, to the baseline while the rest of the working patch also matches MUST make Save unusable.

#### Scenario: Loaded patch cannot Save
- **WHEN** the session is ready, a current-preset dump for the selected patch has landed, and the user has not changed the working patch (chain, patch volume, and on GP-50 patch BPM)
- **THEN** Save cannot be used
- **AND** Controller does not show a Modified label

#### Scenario: A working edit enables emerald Save
- **WHEN** the session is ready with a dumped current patch and the user turns DST off
- **THEN** Save can be used
- **AND** Save uses an emerald style
- **AND** Save appears before Rename

#### Scenario: A volume edit enables emerald Save
- **WHEN** the session is ready with dumped patch volume 80 and the user sets P-Vol to 60
- **THEN** Save can be used
- **AND** Save uses an emerald style

#### Scenario: A GP-50 BPM edit enables emerald Save
- **WHEN** a GP-50 session is ready with dumped patch BPM 120 and the user sets BPM to 140
- **THEN** Save can be used
- **AND** Save uses an emerald style

#### Scenario: Restoring the baseline disables Save
- **WHEN** Save is usable because DST was turned off and the user turns DST on again so the working chain matches the dumped patch
- **THEN** Save cannot be used

#### Scenario: Restoring patch volume disables Save
- **WHEN** Save is usable only because P-Vol was set away from the dumped value and the user sets P-Vol back to that dumped value
- **THEN** Save cannot be used

#### Scenario: Restoring GP-50 patch BPM disables Save
- **WHEN** Save is usable only because BPM was set away from the dumped value and the user sets BPM back to that dumped value
- **THEN** Save cannot be used

#### Scenario: Save after an edit stores and disables Save
- **WHEN** Save is usable and the user Saves the current slot
- **THEN** the current working patch is stored on the pedal in the current slot through the device session
- **AND** Save cannot be used
- **AND** the selected patch does not change

#### Scenario: Rename of the current slot disables Save
- **WHEN** Save is usable and the user renames the current patch
- **THEN** Save cannot be used

#### Scenario: Duplicate keeps Save enabled
- **WHEN** Save is usable and the user duplicates onto another slot
- **THEN** Save can still be used
- **AND** the selected patch does not change

#### Scenario: Upload of a different file enables Save
- **WHEN** the session is ready with a dumped current patch and the user confirms upload of a Valeton `.prst` whose chain differs from that dump
- **THEN** Save can be used
- **AND** no store write is sent solely because upload ran

#### Scenario: Changing patch disables Save
- **WHEN** Save is usable and the user selects another patch
- **THEN** Save cannot be used for the newly selected patch after that patch's dump lands

#### Scenario: Identical patch dump keeps Save disabled until an edit
- **WHEN** the user selects another patch after sync, that patch's dump matches the chain already shown, and the user has not changed the working patch
- **THEN** Save cannot be used
- **AND** after the user turns DST off, Save can be used

#### Scenario: Disconnect hides Save
- **WHEN** Save is usable and the user disconnects
- **THEN** Save is hidden
- **AND** the screen states that no pedals are connected

#### Scenario: Unsaved-edit tooltip warns without blocking
- **WHEN** Save is usable and the user hovers previous, next, or the patch selector
- **THEN** Controller shows an English tooltip that unsaved changes will be lost
- **AND** previous, next, and the selector can still change patch

#### Scenario: Clean patch has no unsaved-edit tooltip
- **WHEN** the session is ready with a dumped current patch that matches the baseline
- **THEN** hovering previous, next, or the patch selector does not show an unsaved-changes tooltip

#### Scenario: USB and Bluetooth share Save
- **WHEN** a Bluetooth session is ready with a dumped current patch and the user turns DST off
- **THEN** Controller shows the same Save presentation as USB

### Requirement: Patch store and upload report status with toasts

After the patch bar is shown, Save, rename, duplicate, and a confirmed upload MUST each show an English toast with a loading spinner while that action runs through the device session, then a success toast when it completes or an error toast if it fails. Labels MUST be in English. Those toasts MUST NOT send raw MIDI from React. The same toast behavior MUST be used on USB and Bluetooth.

After a successful upload, the success toast MUST offer an English Save action for the current slot. Activating that Save MUST store the current working patch on the pedal in the current slot through the device session. The toast MUST NOT store the patch solely because upload succeeded. Dismissing the toast without activating Save MUST NOT send a store write. Rename, duplicate, and upload confirm Dialogs, and the English error Dialog for an invalid or wrong-model file, MUST stay as Dialogs. Download MUST NOT emit a toast.

If the session becomes disconnected while Save, rename, duplicate, or upload is in progress, that action's toast MUST become an error toast. The disconnect toast defined by device-connection MUST still appear, and the Connect modal MUST still close.

#### Scenario: Save shows loading then success
- **WHEN** the session is ready, the current patch is synced, Save is usable, and the user activates Save
- **THEN** a toast shows a loading spinner while the store runs
- **AND** a success toast appears when the current working patch is stored on the pedal in the current slot through the device session
- **AND** the selected patch does not change

#### Scenario: Rename shows loading then success
- **WHEN** the session is ready, the current patch is synced, and the user confirms a rename
- **THEN** a toast shows a loading spinner while the rename runs
- **AND** a success toast appears when that name change is sent through the device session

#### Scenario: Duplicate shows loading then success
- **WHEN** the session is ready, the current patch is synced, and the user confirms duplicate onto another slot
- **THEN** a toast shows a loading spinner while the duplicate runs
- **AND** a success toast appears when the current working patch is stored on the destination slot through the device session
- **AND** the selected patch does not change

#### Scenario: Failed store shows an error toast
- **WHEN** the user activates Save, rename, or duplicate and that store fails
- **THEN** the loading toast becomes an English error toast

#### Scenario: Confirmed upload shows loading then success with Save
- **WHEN** the session is ready, the current patch is synced, and the user confirms upload of a valid Valeton `.prst` for the connected model
- **THEN** a toast shows a loading spinner while the file is applied onto the working patch through the device session
- **AND** a success toast appears when that apply completes
- **AND** that success toast offers Save
- **AND** no store write is sent solely because upload ran
- **AND** the selected patch does not change

#### Scenario: User Saves from the upload toast
- **WHEN** a successful upload toast is showing Save and the user activates Save on that toast
- **THEN** the current working patch is stored on the pedal in the current slot through the device session
- **AND** a toast reports that Save

#### Scenario: User dismisses the upload toast without Save
- **WHEN** a successful upload toast is showing Save and the user dismisses it without activating Save
- **THEN** no store write is sent solely because the toast was dismissed

#### Scenario: Failed upload shows an error toast
- **WHEN** the user confirms upload and applying the file fails
- **THEN** the loading toast becomes an English error toast
- **AND** that toast does not offer Save

#### Scenario: Invalid file still uses the error Dialog
- **WHEN** the session is ready and the user picks a file that is not a valid Valeton `.prst`
- **THEN** Controller shows an English error Dialog
- **AND** no upload toast is shown
- **AND** no upload write is sent

#### Scenario: Download does not toast
- **WHEN** the session is ready with a current-preset dump and the user activates download
- **THEN** a Valeton `.prst` is produced through the device session
- **AND** no toast is shown solely because download ran

### Requirement: Shell offers reachable global settings in a modal

When a pedal session is connected and exposes at least one reachable global setting, the chrome next to the connection status SHALL offer an English Global control (gear icon) that opens a Global settings modal. The control MUST NOT be a route, MUST NOT be a main-menu item, and MUST NOT sit on the patch bar. The chain-sync overlay MUST NOT block that control. The modal title MUST read Global settings. Master volume MUST be listed first when the session exposes it. Global volume MUST be listed first when the session exposes it and does not expose master volume. The modal MUST list only settings the device session exposes for the connected model, in English, and MUST NOT list a setting the session does not expose. There MUST be no Save control in the modal. Each edit MUST be sent immediately through the device session and MUST NOT send raw MIDI from React. A control whose value is not yet known MUST NOT be usable and MUST NOT send a write. Slider drags MUST update the displayed number on-change and MUST throttle writes the same way effect sliders do; release MUST send the last value if it was not already sent. Toggles and selects MUST send on-change. Closing the modal MUST NOT revert a value already sent. Disconnecting MUST close the modal and hide the control. Changing the current patch MUST NOT clear the modal's global values and MUST NOT close it solely because the patch changed.

GP-50 MUST be able to show: master volume (0 to 100), input level (−20 to +20 dB), No CAB (off or on), REC level (−20 to +20 dB), BT REC (−20 to +20 dB), monitor level (−20 to +20 dB), REC mode left (Dry or Wet), REC mode right (Dry or Wet), and footswitch mode (Patch or Stomp). GP-5 MUST be able to show: global volume (0 to 100), input level (−20 to +20 dB), No CAB (off or on), REC level (−20 to +20 dB), BT REC (−20 to +20 dB), monitor level (−20 to +20 dB), screen brightness (1 to 100), and footswitch mode (`0-99`, `0-9`, `A-Z`, `CTL`, or `Tuner`). GP-5 MUST NOT show master volume, REC mode left, REC mode right, or Patch or Stomp. GP-5 MUST NOT show a Global BPM control in the modal. The modal MUST NOT show the Global control when the session exposes no global settings.

#### Scenario: GP-50 opens the modal with dumped values
- **WHEN** a GP-50 session is connected and the globals snapshot has input level 0, No CAB off, and master volume 63
- **THEN** the chrome shows a Global control next to the connection status
- **AND** opening it shows those values with master volume first
- **AND** the modal has no Save control

#### Scenario: GP-5 hides the control when no global is exposed
- **WHEN** a GP-5 session is connected and the session exposes no global settings
- **THEN** the chrome does not show a Global control

#### Scenario: GP-5 opens the modal with its rows
- **WHEN** a GP-5 session is connected and the globals snapshot has global volume 40, input level 0, No CAB off, and footswitch mode `0-99`
- **THEN** the chrome shows a Global control next to the connection status
- **AND** opening it shows global volume first, then input level and No CAB
- **AND** the modal can show REC level, BT REC, monitor level, and screen brightness
- **AND** the footswitch control offers `0-99`, `0-9`, `A-Z`, `CTL`, and `Tuner`
- **AND** the modal does not show master volume, REC mode, Patch, Stomp, or Global BPM
- **AND** the modal has no Save control

#### Scenario: GP-5 does not show GP-50-only rows
- **WHEN** a GP-5 session exposes input level and the user opens Global settings
- **THEN** the modal can show input level
- **AND** the modal does not show master volume, REC mode, Patch, or Stomp

#### Scenario: Unknown value stays unusable
- **WHEN** the user opens Global settings before master volume is known
- **THEN** master volume cannot be used
- **AND** no master-volume write is sent

#### Scenario: Unknown GP-5 value stays unusable
- **WHEN** a GP-5 user opens Global settings before global volume is known
- **THEN** global volume cannot be used
- **AND** no global-volume write is sent

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

### Requirement: Controller shows and edits stomp assignment

After the audio chain is shown, Controller MUST show the current patch's stomp assignment on each effect module through the device session. EXP MUST NOT have a stomp mark. GP-5 MUST expose one stomp: the mark toggles empty and filled. GP-50 MUST expose two stomps: the mark cycles empty, A, and B. Changing an assignment MUST go through the device session and MUST NOT send raw MIDI from React. The same assignment UI MUST be used on USB and Bluetooth. Controller MUST NOT show the chain-refresh busy overlay solely because the user edited a stomp assignment. Disconnecting MUST hide the assignment UI.

#### Scenario: GP-5 shows one stomp
- **WHEN** a GP-5 session is showing the audio chain after a dump that assigns PRE to the only stomp
- **THEN** Controller shows a filled stomp mark on PRE
- **AND** no second footswitch letter is shown on that mark

#### Scenario: GP-50 shows two stomps
- **WHEN** a GP-50 session is showing the audio chain after a dump that assigns PRE to stomp 1 and MOD plus DLY to stomp 2
- **THEN** Controller shows an A mark on PRE
- **AND** Controller shows a B mark on MOD and on DLY

#### Scenario: User assigns a module to a stomp
- **WHEN** a GP-50 session is showing DST without a stomp mark and the user assigns DST to stomp 1
- **THEN** DST shows an A mark
- **AND** that change is sent through the device session
- **AND** the chain-refresh busy overlay is not shown solely because that assignment changed

#### Scenario: User clears a module from a stomp
- **WHEN** a GP-50 session is showing DST with an A mark and the user clears DST from stomp 1
- **THEN** DST no longer shows an A mark
- **AND** that change is sent through the device session

#### Scenario: EXP is not assignable
- **WHEN** a GP-50 session is showing the audio chain
- **THEN** EXP has no stomp mark

#### Scenario: USB and Bluetooth share assignment UI
- **WHEN** a Bluetooth session is showing stomp assignment marks
- **THEN** Controller shows the same stomp capacity for that model as USB
- **AND** edits go through the device session

#### Scenario: Disconnect hides assignment
- **WHEN** the user disconnects while Controller is showing stomp assignment marks
- **THEN** the assignment UI is hidden
- **AND** the screen states that no pedals are connected
