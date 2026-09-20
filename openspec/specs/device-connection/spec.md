# device-connection Specification

## Purpose

Lets the user connect a Valeton GP-5 or GP-50 over USB-MIDI or Bluetooth from the global Connect control, keep that session across sections, and see the connected device name and link mode.

## Requirements

### Requirement: Connect modal lists USB devices then resolves the model

Activating the disconnected Connect control SHALL open a modal (not a route) with USB and Bluetooth method tabs. The USB tab MUST start USB-MIDI discovery and MUST list discovered USB-MIDI devices for the user to pick. The USB tab MUST describe a one-way connection that is super fast. The Bluetooth tab MUST start Bluetooth discovery and MUST list discovered Bluetooth pedals. If the chosen device has a suggested model, the system MUST use that model and MUST NOT ask. If it has none, the system MUST ask GP-5 vs GP-50 before opening the link. The model MUST be known before the session is marked connected. Opening the modal MUST default to the USB tab. Switching tabs MUST NOT by itself connect a device.

#### Scenario: Discover then pick a USB device
- **WHEN** the user opens Connect while disconnected
- **THEN** the modal shows USB and Bluetooth tabs
- **AND** the USB tab is selected
- **AND** the USB tab lists available USB-MIDI devices
- **AND** the USB tab states that USB is a one-way connection and super fast
- **AND** the current section does not change

#### Scenario: Known USB model connects without asking
- **WHEN** the user picks a USB device whose label suggests GP-5 or GP-50
- **THEN** the system connects using that model without asking which pedal it is
- **AND** the connected session link mode is USB

#### Scenario: Unknown model is asked before connect
- **WHEN** the user picks a USB or Bluetooth device with no suggested model
- **THEN** the modal asks GP-5 or GP-50
- **AND** the link is opened only after the user chooses a model

#### Scenario: No USB devices
- **WHEN** the USB tab is active, discovery succeeds, and finds no USB-MIDI devices
- **THEN** the modal states that none were found
- **AND** the user can retry discovery

#### Scenario: USB discovery fails
- **WHEN** the USB tab is active and MIDI access is denied or MIDI is unavailable
- **THEN** the modal shows an English error
- **AND** the session stays disconnected

### Requirement: Connected chrome shows the device name

While a pedal session is connected, the chrome connection control MUST remain visible on every section and MUST display the connected endpoint's label instead of Connect. Activating it SHALL reopen the modal, which MUST identify the connected device, its link mode (USB or Bluetooth), and offer disconnect. After disconnect the control MUST read Connect again. Disconnect MUST close the active link (USB-MIDI or Bluetooth). Session state MUST be shared across Controller, Editor, and Library.

#### Scenario: Connected label
- **WHEN** a session is connected to an endpoint labeled `GP-50`
- **THEN** the chrome control displays `GP-50`
- **AND** it remains visible on Controller, Editor, and Library

#### Scenario: Disconnect USB
- **WHEN** the user disconnects a USB session from the connection modal
- **THEN** the USB-MIDI link is closed
- **AND** the chrome control reads Connect

#### Scenario: Disconnect Bluetooth
- **WHEN** the user disconnects a Bluetooth session from the connection modal
- **THEN** the Bluetooth link is closed
- **AND** the chrome control reads Connect

#### Scenario: Connect stays global
- **WHEN** the user is connected and navigates from Controller to Editor or Library
- **THEN** the session remains connected
- **AND** the chrome still shows the device name

### Requirement: Connected chrome stays up during patch sync

After a USB or Bluetooth session is marked connected, the chrome connection control MUST keep showing the connected endpoint's label while initial patch identity and audio-chain sync is in progress. Activating it SHALL still reopen the connection modal. Disconnect MUST remain available during sync. Sync MUST NOT by itself send patch recall.

#### Scenario: USB chrome during sync
- **WHEN** a USB session is connected and Controller is still syncing patch identity
- **THEN** the chrome control displays the connected endpoint's label
- **AND** the user can open the connection modal and disconnect

#### Scenario: Bluetooth chrome during sync
- **WHEN** a Bluetooth session is connected and Controller is still syncing patch identity
- **THEN** the chrome control displays the connected endpoint's label
- **AND** the user can open the connection modal and disconnect

#### Scenario: USB chrome during chain dump
- **WHEN** a USB session is connected and Controller is still waiting for the audio-chain dump
- **THEN** the chrome control displays the connected endpoint's label
- **AND** the user can open the connection modal and disconnect

### Requirement: Bluetooth tab lists pedals then connects

While the Bluetooth tab is selected, the modal MUST scan for Bluetooth pedals and MUST list them for the user to pick. It MUST keep the two-way / slower tradeoff copy. It MUST NOT list USB-MIDI devices. If the chosen Bluetooth device has a suggested model, the system MUST use that model and MUST NOT ask. Connecting MUST mark the session connected with Bluetooth link mode. The user MUST be able to retry the scan.

#### Scenario: Bluetooth scan then pick
- **WHEN** the user selects the Bluetooth tab while disconnected
- **THEN** the modal lists nearby Bluetooth pedals
- **AND** it does not list USB-MIDI devices
- **AND** the modal states that Bluetooth is a two-way connection and slower
- **AND** the session stays disconnected until the user picks a device

#### Scenario: Known Bluetooth model connects without asking
- **WHEN** the user picks a Bluetooth device whose label suggests GP-5 or GP-50
- **THEN** the system connects using that model without asking which pedal it is
- **AND** the connected session link mode is Bluetooth

#### Scenario: No Bluetooth pedals
- **WHEN** the Bluetooth tab is active, discovery succeeds, and finds no matching pedals
- **THEN** the modal states that none were found
- **AND** the user can retry discovery

#### Scenario: Bluetooth discovery fails
- **WHEN** the Bluetooth tab is active and Bluetooth access is denied or Bluetooth is unavailable
- **THEN** the modal shows an English error
- **AND** the session stays disconnected

### Requirement: Bluetooth session sends patch recall

While a session is connected over Bluetooth and initial patch identity sync has completed or timed out, Controller MUST offer working patch previous, patch next, and patch select (00–99), the same controls as a USB session. Choosing a patch or stepping previous/next MUST update the session patch and send that patch to the pedal through the device session. Connecting MUST NOT send a patch recall message by itself. USB sessions MUST keep sending patch recall through the device session using official CC 0.

#### Scenario: Bluetooth connected shows working patch send
- **WHEN** the user is connected over Bluetooth, initial sync has completed or timed out, and opens Controller
- **THEN** patch previous, patch next, and patch select are offered as working controls
- **AND** no patch recall is sent solely because the session connected or Controller opened

#### Scenario: Select a patch over Bluetooth
- **WHEN** the user is connected over Bluetooth and selects patch `42` from the center selector
- **THEN** the label reads `42`
- **AND** the pedal is sent patch 42 through the device session

#### Scenario: USB patch send unchanged
- **WHEN** the user is connected over USB and selects a patch
- **THEN** that patch is still sent through the device session using official CC 0

### Requirement: Connected session syncs the current audio chain

After a USB or Bluetooth session is marked connected, the device session SHALL request the current patch's audio-chain dump on the open link after patch identity (names and current index) or when that identity step times out. The connected snapshot MUST carry the current chain (module order and on/off) when a dump is decoded. If the dump times out or SysEx is unavailable, the session MUST still become ready after patch identity and MUST NOT send patch recall solely because the dump was missing. The chain request MAY continue in the background after the session is ready. After the session is ready, choosing a patch or a pedal-initiated patch report MUST refresh the chain for that patch without sending extra patch recall solely to obtain the dump. Disconnect MUST drop chain state.

#### Scenario: USB connect requests the chain
- **WHEN** a USB session becomes connected and SysEx is available
- **THEN** the session requests the current patch audio-chain dump on the USB link
- **AND** no patch recall is sent solely because the session connected

#### Scenario: Bluetooth connect requests the chain
- **WHEN** a Bluetooth session becomes connected
- **THEN** the session requests the current patch audio-chain dump on the Bluetooth link
- **AND** no patch recall is sent solely because the session connected

#### Scenario: Chain dump timeout still becomes ready
- **WHEN** initial sync ends without an audio-chain dump
- **THEN** the session is ready
- **AND** no patch recall is sent solely because the dump was missing

#### Scenario: User patch change refreshes the chain
- **WHEN** the session is ready and the user selects another patch
- **THEN** that patch is sent through the device session
- **AND** the session requests or applies a chain dump for the new patch
- **AND** no extra patch recall is sent solely to obtain that dump

#### Scenario: Pedal patch change refreshes the chain
- **WHEN** the session is ready and the pedal reports a new current patch
- **THEN** the session requests or applies a chain dump for that patch
- **AND** no patch recall is sent solely because that inbound report arrived

#### Scenario: Lost link during a patch change disconnects
- **WHEN** the session is ready, the user selects another patch, and the open USB or Bluetooth link is gone
- **THEN** the session becomes disconnected
- **AND** the chrome control reads Connect

### Requirement: Connected session toggles audio-chain modules

After a USB or Bluetooth session is ready, toggling an effect module (NR, PRE, DST, NS, AMP, CAB, EQ, MOD, DLY, or RVB) MUST update the snapshot chain on-change and MUST send that module's official MIDI CC through the open link. On GP-50, toggling EXP MUST send official CC 13 on USB and on Bluetooth. The session MUST NOT send extra patch recall or an audio-chain dump solely because a module was toggled. Toggling MUST NOT change module order. GP-5 MUST NOT expose an EXP toggle.

When the link can apply live pedal module state (`liveFromPedal`, Bluetooth), inbound live-module SysEx (identity-family command `09`) MUST update the matching slot's on/off without changing order. On GP-50 Bluetooth, inbound EXP SysEx (identity-family command `02`) MUST update the EXP slot. Stomp-mode footswitch reports that change module on/off are the same class of live module reports, including a captured equivalent if the frame is not command `09` or `02`. Those reports MUST NOT be treated as a pedal-initiated patch change: the session MUST NOT send patch recall or request a chain dump solely because a footswitch was pressed. USB MUST NOT apply those inbound reports to the snapshot. Inbound volume, tuner, and other non-module CCs MUST NOT update the chain. Disconnect MUST drop chain state.

#### Scenario: USB toggle sends module CC
- **WHEN** a USB session is ready and the user turns DST off
- **THEN** the snapshot shows DST off
- **AND** DST's official module CC is sent on the USB link
- **AND** no patch recall or chain dump is sent solely because DST was toggled

#### Scenario: Bluetooth toggle sends module CC
- **WHEN** a Bluetooth session is ready and the user turns AMP on
- **THEN** the snapshot shows AMP on
- **AND** AMP's official module CC is sent on the Bluetooth link
- **AND** no patch recall or chain dump is sent solely because AMP was toggled

#### Scenario: Bluetooth inbound module report updates the chain
- **WHEN** a Bluetooth session is ready and the pedal reports DST off over live-module SysEx
- **THEN** the snapshot shows DST off
- **AND** module order does not change
- **AND** no patch recall is sent solely because that report arrived

#### Scenario: Bluetooth Stomp footswitch updates the chain
- **WHEN** a Bluetooth session is ready and a Stomp-mode footswitch reports DST off
- **THEN** the snapshot shows DST off
- **AND** module order does not change
- **AND** no patch recall is sent solely because that footswitch was pressed
- **AND** no chain dump is requested solely because that footswitch was pressed

#### Scenario: Bluetooth Stomp footswitch is not a patch change
- **WHEN** a Bluetooth session is ready on the current patch and a Stomp-mode footswitch reports a module on/off change
- **THEN** the snapshot current patch does not change from that inbound report
- **AND** the session does not treat that inbound as a pedal-initiated patch report

#### Scenario: USB ignores inbound live module reports
- **WHEN** a USB session is ready and a live-module SysEx for DST off arrives
- **THEN** the snapshot DST on/off does not change from that inbound report

#### Scenario: USB ignores Stomp footswitch reports
- **WHEN** a USB session is ready and a Stomp-mode footswitch report for DST off arrives
- **THEN** the snapshot DST on/off does not change from that inbound report

#### Scenario: GP-50 EXP toggle over Bluetooth sends CC 13
- **WHEN** a GP-50 Bluetooth session is ready and the user turns EXP off
- **THEN** the snapshot shows EXP off
- **AND** official EXP on/off CC 13 is sent on the Bluetooth link
- **AND** no patch recall or chain dump is sent solely because EXP was toggled

#### Scenario: GP-50 EXP toggle over USB sends CC 13
- **WHEN** a GP-50 USB session is ready and the user turns EXP off
- **THEN** the snapshot shows EXP off
- **AND** official EXP on/off CC 13 is sent on the USB link
- **AND** no patch recall or chain dump is sent solely because EXP was toggled

#### Scenario: Bluetooth inbound EXP report updates the chain
- **WHEN** a GP-50 Bluetooth session is ready and the pedal reports EXP off over EXP SysEx
- **THEN** the snapshot shows EXP off
- **AND** no patch recall is sent solely because that report arrived

### Requirement: Connected session reorders movable audio-chain modules

After a USB or Bluetooth session is ready, moving a movable effect module (NR, PRE, MOD, DLY, or RVB) to another effect slot MUST update the snapshot chain order on-change and MUST send a chain-order write for the current patch through the open link. The write MUST encode only chain order. It MUST NOT write full preset parameters. The session MUST NOT send extra patch recall or an audio-chain dump solely because the user reordered. DST, NS, AMP, CAB, and EQ MUST stay a contiguous block in that order; a move that would insert a module between them MUST be treated as invalid. Invalid moves (fixed modules DST, NS, AMP, CAB, or EQ; EXP; a drop onto EXP; a drop onto the module's current slot; a split of the fixed block) MUST leave the snapshot unchanged and MUST NOT send a chain-order write. GP-50 EXP MUST stay the last slot. Toggling a module MUST still send that module's on/off and MUST NOT change order.

#### Scenario: USB reorder sends chain-order write
- **WHEN** a USB session is ready and the user moves RVB before DST
- **THEN** the snapshot shows RVB before DST
- **AND** a chain-order write is sent on the USB link
- **AND** no patch recall or chain dump is sent solely because RVB was moved

#### Scenario: Bluetooth reorder sends chain-order write
- **WHEN** a Bluetooth session is ready and the user moves PRE after EQ
- **THEN** the snapshot shows PRE after EQ
- **AND** a chain-order write is sent on the Bluetooth link
- **AND** no patch recall or chain dump is sent solely because PRE was moved

#### Scenario: Invalid move is ignored
- **WHEN** a session is ready and the user tries to move DST after CAB
- **THEN** the snapshot order does not change
- **AND** no chain-order write is sent

#### Scenario: Inserting between the fixed block is ignored
- **WHEN** a session is ready and the user tries to move PRE after AMP
- **THEN** the snapshot order does not change
- **AND** no chain-order write is sent

### Requirement: Connected session applies Bluetooth live chain-order

When the link can apply live pedal module state (`liveFromPedal`, Bluetooth), inbound live chain-order SysEx MUST update the snapshot order without sending patch recall or requesting a chain dump solely because that report arrived. USB MUST NOT apply those inbound reports to the snapshot. Requested or opportunistic audio-chain dumps MUST still replace order and on/off. Disconnect MUST drop chain state.

#### Scenario: Bluetooth inbound order report updates the chain
- **WHEN** a Bluetooth session is ready and the pedal reports a new chain order over live chain-order SysEx
- **THEN** the snapshot shows that order
- **AND** no patch recall is sent solely because that report arrived

#### Scenario: USB ignores inbound live chain-order reports
- **WHEN** a USB session is ready and a live chain-order SysEx arrives
- **THEN** the snapshot order does not change from that inbound report

### Requirement: Toggling NS does not rewrite AMP or CAB on/off

After a USB or Bluetooth session is ready, toggling NS MUST update only NS's on/off in the snapshot and MUST send only NS's official module CC through the open link. AMP and CAB on/off MUST stay unchanged. The session MUST NOT send AMP or CAB CCs solely because NS was toggled. Toggling AMP or CAB while NS is on MUST still update only that slot and MUST send only that slot's official module CC. Toggling MUST NOT change module order.

#### Scenario: Turning NS on keeps AMP and CAB on/off
- **WHEN** a session is ready with NS off, AMP on, and CAB off and the user turns NS on
- **THEN** the snapshot shows NS on, AMP on, and CAB off
- **AND** only NS's official module CC is sent
- **AND** no AMP or CAB CC is sent solely because NS was toggled

#### Scenario: Turning NS off keeps AMP and CAB on/off
- **WHEN** a session is ready with NS on, AMP on, and CAB off and the user turns NS off
- **THEN** the snapshot shows NS off, AMP on, and CAB off
- **AND** only NS's official module CC is sent
- **AND** no AMP or CAB CC is sent solely because NS was toggled

#### Scenario: AMP toggle while NS is on does not change NS
- **WHEN** a session is ready with NS on and AMP on and the user turns AMP off
- **THEN** the snapshot shows AMP off and NS on
- **AND** only AMP's official module CC is sent

### Requirement: Connected session applies slot models and control values

After a USB or Bluetooth session is ready, the connected snapshot MUST carry each effect slot's loaded factory model and control values when those fields are decoded from the same current-preset dump already used for chain order and on/off. GP-5 and GP-50 MUST only expose factory models that exist on that pedal. EXP MUST NOT carry a model or control values. If a dump is missing, a slot's wire identity is unknown, or a control value cannot be decoded, the session MUST leave that slot's model and values unknown and MUST NOT invent values that are written to the pedal.

Live module on/off reports and live chain-order reports MUST preserve each slot's last known model and control values. When the link can apply live pedal module state (`liveFromPedal`, Bluetooth), inbound live model notifies MUST update that slot's model and load catalog default values, and inbound live control notifies MUST update that slot's matching control value. USB MUST NOT apply those inbound reports to the snapshot. A later current-preset dump MUST replace model and values for slots it decodes. Disconnect MUST drop model and value state.

#### Scenario: Dump loads AMP model and Gain
- **WHEN** a GP-50 session is ready and the current-preset dump loads Tweedy on AMP with Gain at 30
- **THEN** the snapshot AMP slot's model is Tweedy
- **AND** AMP Gain is 30

#### Scenario: Missing dump does not invent values
- **WHEN** a session becomes ready without a current-preset dump
- **THEN** effect slots have no loaded model that can be written
- **AND** the session does not send a model or control write solely because dump was missing

#### Scenario: Unknown wire identity stays unwritable
- **WHEN** a session is ready and a dump carries an AMP identity that is not in the factory catalog
- **THEN** the snapshot does not treat that AMP identity as a writable factory model
- **AND** the session does not send an AMP model write solely because that identity was unknown

#### Scenario: Sole NR model loads without a matching wire id
- **WHEN** a GP-50 session is ready and the current-preset dump has NR THRE at 18 and an NR identity that is not GATE
- **THEN** the snapshot NR slot's model is GATE
- **AND** NR THRE is 18

#### Scenario: Bluetooth on/off keeps AMP values
- **WHEN** a Bluetooth session is showing AMP on with Tweedy and Gain at 30 and the pedal reports AMP off
- **THEN** the snapshot shows AMP off
- **AND** AMP's model is still Tweedy
- **AND** AMP Gain is still 30

#### Scenario: USB ignores live module reports including values
- **WHEN** a USB session is showing AMP on with Tweedy and Gain at 30 and a live-module report for AMP off arrives
- **THEN** the snapshot still shows AMP on
- **AND** AMP's model is still Tweedy
- **AND** AMP Gain is still 30

#### Scenario: Bluetooth live AMP Gain follows the pedal
- **WHEN** a Bluetooth session is showing AMP on Tweedy with Gain at 30 and the pedal reports AMP Gain 45
- **THEN** the snapshot AMP Gain is 45
- **AND** AMP stays on Tweedy

#### Scenario: Bluetooth live AMP model follows the pedal
- **WHEN** a Bluetooth session is showing AMP on Tweedy and the pedal reports Bellman 59N on AMP
- **THEN** the snapshot AMP model is Bellman 59N
- **AND** AMP's controls are Bellman 59N's catalog controls

### Requirement: Connected session writes slot model and control changes

After a USB or Bluetooth session is ready, changing an effect slot's loaded model MUST update the snapshot on-change, MUST load that model's catalog controls, and MUST send a model write for the current patch through the open link. Changing a known control value MUST update the snapshot on-change. Slider drags MUST coalesce control writes (throttle, flush on release) so Bluetooth is not flooded with one SET per intermediate value. Toggles MUST send on-change. Both writes MUST use the parameter-write SET family (path `01 01 04`, CRC-8 + nibble-expand), not live notify path `01 02 04`. The session MUST NOT send extra patch recall or an audio-chain dump solely because a model or control changed. Model and control writes MUST NOT change slot order or on/off by themselves. The session MUST NOT write a model that is not in the factory catalog for that slot kind and connected pedal. The session MUST NOT write a control when that slot's model and values are unknown. GP-5 MUST NOT expose EXP model or control writes. When the link can apply live pedal module state (`liveFromPedal`, Bluetooth), inbound live model and live control reports MUST update the snapshot without sending a SET, recall, or dump. USB MUST NOT apply unsolicited inbound parameter reports to the snapshot. Disconnect MUST drop that state.

#### Scenario: USB AMP Gain write
- **WHEN** a USB session is ready with AMP on Tweedy and Gain at 30 and the user sets Gain to 45
- **THEN** the snapshot AMP Gain is 45
- **AND** a control write is sent on the USB link
- **AND** no patch recall or chain dump is sent solely because Gain changed
- **AND** AMP stays on Tweedy
- **AND** slot order does not change

#### Scenario: Bluetooth slider drag coalesces control writes
- **WHEN** a Bluetooth session is ready with AMP Gain at 30 and the user drags Gain toward 80 without releasing
- **THEN** the snapshot AMP Gain follows the drag
- **AND** the session does not send a control write for every intermediate Gain

#### Scenario: Bluetooth AMP model write
- **WHEN** a Bluetooth session is ready with AMP on Tweedy and the user selects Bellman 59N
- **THEN** the snapshot AMP model is Bellman 59N
- **AND** AMP's controls are Bellman 59N's catalog controls
- **AND** a model write is sent on the Bluetooth link
- **AND** no patch recall or chain dump is sent solely because the model changed
- **AND** AMP on/off does not change from that write alone

#### Scenario: Unknown slot cannot be written
- **WHEN** a session is ready without AMP model and values and the user would change AMP Gain
- **THEN** the snapshot AMP values do not change
- **AND** no control write is sent

#### Scenario: USB ignores inbound live parameter reports
- **WHEN** a USB session is ready with AMP Gain at 30 and an unsolicited live parameter report for AMP Gain 45 arrives
- **THEN** the snapshot AMP Gain stays 30

### Requirement: Connected session stores, duplicates, and downloads the current patch

After a USB or Bluetooth session is ready and the current patch is not syncing, Save MUST store the current working patch on the pedal in the current slot through the open link. Rename MUST store that working patch in the current slot with the new onboard name (at most 10 characters) and MUST update the snapshot name list for that slot. Duplicate onto a different 00–99 slot MUST store the current working patch in that destination slot, MUST update the snapshot name list for the destination, and MUST NOT change the current patch index. Duplicate MUST NOT send patch recall of the destination solely because duplicate ran. A blank name MUST NOT be stored.

Those store writes MUST use the parameter-write SET family (path `01 01 04`, CRC-8 + nibble-expand), not live notify path `01 02 04`. The session MUST NOT send extra patch recall or an audio-chain dump solely because Save, rename, or duplicate ran. While the current patch is syncing, Save, rename, and duplicate MUST leave the snapshot unchanged and MUST NOT send a store write.

Download MUST produce a Valeton `.prst` of the current patch for the connected pedal from the current-preset dump the session already holds or re-requests (GP-50 session → GP-50 `.prst`; GP-5 session → GP-5 `.prst`). Download MUST NOT convert the dump to the other model's `.prst`. Download MUST NOT send extra patch recall solely to obtain that file. If no current-preset dump is available, the session MUST NOT invent a file.

Upload MUST apply a Valeton `.prst` of the connected pedal onto the current working patch through the open link (GP-50 session → GP-50 `.prst`; GP-5 session → GP-5 `.prst`). Upload MUST NOT send a store write. Upload MUST NOT change the current patch index. Upload MUST NOT update the snapshot name list. Upload MUST NOT convert a file from the other model. A file whose model does not match the connected pedal, or that is not a valid Valeton `.prst`, MUST NOT send a write. Upload MUST NOT send extra patch recall solely because upload ran. After a successful upload, the session MUST refresh the current-preset dump for the current patch so the snapshot matches the working buffer. While the current patch is syncing, upload MUST leave the snapshot unchanged and MUST NOT send a write. Disconnect MUST drop working store state.

#### Scenario: USB Save stores the current slot
- **WHEN** a USB session is ready, the current patch is `42` and synced, and the user Saves
- **THEN** a store write for slot `42` is sent on the USB link
- **AND** the snapshot current patch stays `42`
- **AND** no extra patch recall or chain dump is sent solely because Save ran

#### Scenario: Bluetooth rename updates the name list
- **WHEN** a Bluetooth session is ready, the current patch is `42` named `Old Name` and synced, and the user renames it to `New Name`
- **THEN** a store write for slot `42` is sent on the Bluetooth link
- **AND** the snapshot name for `42` is `New Name`
- **AND** the snapshot current patch stays `42`
- **AND** no extra patch recall is sent solely because rename ran

#### Scenario: Duplicate stores another slot without recalling it
- **WHEN** a session is ready, the current patch is `05` and synced, and the user duplicates onto slot `80`
- **THEN** a store write for slot `80` is sent on the open link
- **AND** the snapshot current patch stays `05`
- **AND** no patch recall of `80` is sent solely because duplicate ran

#### Scenario: Duplicate copies the current name onto the destination
- **WHEN** a session is ready, the current patch is `05` named `Flow` and synced, and the user duplicates onto slot `80`
- **THEN** the snapshot name for `80` is `Flow`
- **AND** the snapshot name for `05` stays `Flow`

#### Scenario: Syncing blocks store writes
- **WHEN** the session is ready, the current patch is syncing, and the user would Save, rename, or duplicate
- **THEN** the snapshot does not change
- **AND** no store write is sent

#### Scenario: GP-50 download writes a GP-50 preset file
- **WHEN** a GP-50 session is ready, the current patch is synced with a current-preset dump, and the user downloads
- **THEN** a Valeton `.prst` for GP-50 is produced
- **AND** no extra patch recall is sent solely because download ran

#### Scenario: GP-5 download writes a GP-5 preset file
- **WHEN** a GP-5 session is ready, the current patch is synced with a current-preset dump, and the user downloads
- **THEN** a Valeton `.prst` for GP-5 is produced
- **AND** no extra patch recall is sent solely because download ran

#### Scenario: Missing dump does not invent a download
- **WHEN** a session is ready without a current-preset dump and the user would download
- **THEN** no local patch file is produced

#### Scenario: GP-50 upload loads the working patch
- **WHEN** a GP-50 session is ready, the current patch is `05` named `Flow` and synced, and the user uploads a valid GP-50 `.prst` named `TOB`
- **THEN** that file is applied onto the working patch through the open link
- **AND** no store write is sent solely because upload ran
- **AND** the snapshot name for `05` stays `Flow`
- **AND** the snapshot current patch stays `05`
- **AND** no extra patch recall is sent solely because upload ran

#### Scenario: GP-5 upload loads the working patch
- **WHEN** a GP-5 session is ready, the current patch is synced, and the user uploads a valid GP-5 `.prst`
- **THEN** that file is applied onto the working patch through the open link
- **AND** no store write is sent solely because upload ran
- **AND** the snapshot current patch does not change

#### Scenario: Wrong-model upload does not write
- **WHEN** a GP-50 session is ready and the user would upload a GP-5 `.prst`
- **THEN** the snapshot does not change
- **AND** no upload write is sent

#### Scenario: Invalid upload does not write
- **WHEN** a session is ready and the user would upload bytes that are not a valid Valeton `.prst`
- **THEN** the snapshot does not change
- **AND** no upload write is sent

#### Scenario: Syncing blocks upload
- **WHEN** the session is ready, the current patch is syncing, and the user would upload
- **THEN** the snapshot does not change
- **AND** no upload write is sent

### Requirement: Connected session tracks whether the working patch is modified

After a USB or Bluetooth session is ready, the connected snapshot MUST report whether the current working chain (module order, on/off, factory model, and control values) differs from a baseline kept for the selected patch. The session MUST capture that baseline from the current-preset dump that lands for a newly selected patch (connect, user recall, or pedal-initiated patch change) and MUST report not modified then. The session MUST recapture that baseline from the current working chain after a successful Save or rename of the current slot and MUST report not modified then.

Any later working-chain change that still differs from the baseline (module on/off, reorder, model, control, Bluetooth live follow of those fields, or a successful upload whose dump does not match the baseline) MUST report modified. A later working-chain change that matches the baseline again MUST report not modified. Duplicate onto another slot MUST NOT recapture the current-slot baseline. A dump refresh that is not a newly selected patch (download, upload) MUST NOT recapture the baseline as the stored patch. While the current patch is syncing, or when no dump has been captured for the selected patch, the snapshot MUST report not modified. Changing patch MUST drop the baseline. Disconnect MUST drop that working state.

#### Scenario: Dump of the selected patch starts clean
- **WHEN** a USB or Bluetooth session is ready and a current-preset dump for the selected patch is decoded
- **THEN** the snapshot reports not modified

#### Scenario: A working edit is modified
- **WHEN** the snapshot has a baseline from that dump and the user turns DST off
- **THEN** the snapshot reports modified
- **AND** no extra patch recall is sent solely because the module was toggled

#### Scenario: Restoring the dumped values clears modified
- **WHEN** the snapshot is modified because DST was turned off and the user turns DST on again so the working chain matches the baseline
- **THEN** the snapshot reports not modified

#### Scenario: A knob that returns to the dumped value clears modified
- **WHEN** the snapshot has a baseline AMP Gain of 30, the user drags that control to 45, then drags it back to 30
- **THEN** the snapshot reports not modified

#### Scenario: Bluetooth live follow can mark modified
- **WHEN** a Bluetooth session has a baseline from the current dump and the pedal reports DST off
- **THEN** the snapshot reports modified
- **AND** no extra patch recall is sent solely because that inbound report arrived

#### Scenario: USB live reports do not mark modified
- **WHEN** a USB session has a baseline from the current dump and a live-module report arrives
- **THEN** the snapshot modified flag does not change from that inbound report

#### Scenario: Save recaptures the baseline
- **WHEN** the snapshot is modified and the user Saves the current slot
- **THEN** the snapshot reports not modified
- **AND** no extra patch recall or chain dump is sent solely because Save ran

#### Scenario: Rename of the current slot recaptures the baseline
- **WHEN** the snapshot is modified and the user renames the current patch
- **THEN** the snapshot reports not modified
- **AND** the snapshot name for that slot is the new name

#### Scenario: Duplicate does not recapture the current baseline
- **WHEN** the snapshot is modified and the user duplicates onto another slot
- **THEN** the snapshot still reports modified
- **AND** the current patch index does not change

#### Scenario: Download dump does not recapture as stored
- **WHEN** the snapshot is modified and the user downloads the current patch
- **THEN** the snapshot still reports modified after that dump refresh

#### Scenario: Upload dump does not recapture as stored
- **WHEN** the snapshot has a baseline from the current dump and a successful upload of a different Valeton `.prst` refreshes the current-preset dump
- **THEN** the snapshot reports modified
- **AND** no store write is sent solely because upload ran

#### Scenario: Changing patch drops the baseline
- **WHEN** the snapshot is modified, the user selects another patch, and a dump for that patch is decoded
- **THEN** the snapshot reports not modified

#### Scenario: Missing dump is not modified
- **WHEN** the session is ready without a current-preset dump for the selected patch
- **THEN** the snapshot reports not modified

#### Scenario: Disconnect drops modified state
- **WHEN** the user disconnects while the snapshot reports modified
- **THEN** that working modified state is dropped

### Requirement: Connect reports status with a toast

When the user connects a USB or Bluetooth pedal through the device session, the shell MUST show an English toast with a loading spinner while the link is opening, then a success toast when the session is connected or an error toast if connect fails. A failed connect MUST leave the session disconnected. The Connect modal MUST still close after a successful connect. Discovery errors on the USB or Bluetooth tab MUST keep using the modal's English error and MUST NOT by themselves emit a connect toast. The same toast behavior MUST be used on USB and Bluetooth.

#### Scenario: USB connect shows loading then success
- **WHEN** the user picks a USB device whose label suggests GP-5 or GP-50
- **THEN** a toast shows a loading spinner while the link opens
- **AND** a success toast appears when the session is connected
- **AND** the connected session link mode is USB
- **AND** the Connect modal closes

#### Scenario: Bluetooth connect shows loading then success
- **WHEN** the user picks a Bluetooth device whose label suggests GP-5 or GP-50
- **THEN** a toast shows a loading spinner while the link opens
- **AND** a success toast appears when the session is connected
- **AND** the connected session link mode is Bluetooth
- **AND** the Connect modal closes

#### Scenario: Failed connect shows an error toast
- **WHEN** the user picks a device and opening the link fails
- **THEN** the loading toast becomes an English error toast
- **AND** the session stays disconnected
- **AND** the Connect modal stays open so the user can retry

### Requirement: Disconnect reports status and closes the Connect modal

When a connected session becomes disconnected, the shell MUST show an English toast that the pedal disconnected, and the Connect modal MUST close if it is open. That MUST happen when the user disconnects from the modal and when the open USB or Bluetooth link is lost. After disconnect the chrome control MUST read Connect. Disconnect MUST still close the active link through the device session. The same behavior MUST be used on USB and Bluetooth.

#### Scenario: User disconnect closes the modal
- **WHEN** the user disconnects a connected USB or Bluetooth session from the connection modal
- **THEN** the USB-MIDI or Bluetooth link is closed
- **AND** an English toast reports that the pedal disconnected
- **AND** the Connect modal closes
- **AND** the chrome control reads Connect

#### Scenario: Lost link closes the modal
- **WHEN** a session is connected, the Connect modal is open, and the open USB or Bluetooth link is gone
- **THEN** the session becomes disconnected
- **AND** an English toast reports that the pedal disconnected
- **AND** the Connect modal closes
- **AND** the chrome control reads Connect

#### Scenario: Lost link toasts when the modal is closed
- **WHEN** a session is connected, the Connect modal is closed, and the open USB or Bluetooth link is gone
- **THEN** the session becomes disconnected
- **AND** an English toast reports that the pedal disconnected
- **AND** the chrome control reads Connect
