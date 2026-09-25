# device-connection Specification

## Purpose

Lets the user connect a Valeton GP-5 or GP-50 over USB-MIDI or Bluetooth from the global Connect control, keep that session across sections, and see the connected device name and link mode.

## Requirements

### Requirement: Connect modal lists USB devices then resolves the model

Activating the disconnected Connect control SHALL open a modal (not a route) with USB and Bluetooth method tabs. The USB tab MUST start USB-MIDI discovery and MUST list discovered USB-MIDI devices for the user to pick. The USB tab MUST describe a one-way connection that is super fast. The Bluetooth tab MUST start Bluetooth discovery. On the desktop app, the Bluetooth tab MUST list discovered Bluetooth pedals for the user to pick. On the web app, when the browser Bluetooth picker returns a chosen pedal, the system MUST treat that choice as the pick and MUST NOT require a second click in the modal list; if the picker is cancelled, the modal MUST still list already-authorized Bluetooth pedals when any are available. If the chosen device has a suggested model, the system MUST use that model and MUST NOT ask. If it has none, the system MUST ask GP-5 vs GP-50 before opening the link. The model MUST be known before the session is marked connected. Opening the modal MUST default to the USB tab. Switching tabs MUST NOT by itself connect a device.

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

While the Bluetooth tab is selected, the modal MUST scan for Bluetooth pedals. It MUST keep the two-way / slower tradeoff copy. It MUST NOT list USB-MIDI devices. If the chosen Bluetooth device has a suggested model, the system MUST use that model and MUST NOT ask. Connecting MUST mark the session connected with Bluetooth link mode. The user MUST be able to retry the scan.

On the desktop app, the modal MUST list discovered Bluetooth pedals for the user to pick, and the session MUST stay disconnected until the user picks a device from that list.

On the web app, an interactive scan MUST open the browser Bluetooth picker. When the user chooses a pedal there, the system MUST proceed with that device as the pick without requiring another click in the modal list. When the user cancels the picker, the modal MUST list already-authorized Bluetooth pedals when any remain available, and the session MUST stay disconnected until the user picks one from that list or runs another scan.

#### Scenario: Desktop Bluetooth scan then pick
- **WHEN** the user selects the Bluetooth tab while disconnected in the desktop app
- **THEN** the modal lists nearby Bluetooth pedals
- **AND** it does not list USB-MIDI devices
- **AND** the modal states that Bluetooth is a two-way connection and slower
- **AND** the session stays disconnected until the user picks a device

#### Scenario: Web Bluetooth picker connects without a second click
- **WHEN** the user runs an interactive Bluetooth scan in the web app and chooses a pedal in the browser picker
- **THEN** the system treats that pedal as the chosen device without requiring another click in the modal list
- **AND** if the label suggests GP-5 or GP-50, the system connects using that model without asking
- **AND** the connected session link mode is Bluetooth

#### Scenario: Web Bluetooth picker cancelled keeps authorized list
- **WHEN** the user runs an interactive Bluetooth scan in the web app, cancels the browser picker, and at least one already-authorized Bluetooth pedal is available
- **THEN** the modal lists those authorized pedals
- **AND** the session stays disconnected until the user picks a device from that list or scans again

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

After a USB or Bluetooth session is marked connected, the device session SHALL request the current patch's audio-chain dump on the open link after patch identity (names and current index) or when that identity step times out. The connected snapshot MUST carry the current chain (module order and on/off) when a dump is decoded. If the dump times out or SysEx is unavailable, the session MUST still become ready after patch identity and MUST NOT send patch recall solely because the dump was missing. The chain request MAY continue in the background after the session is ready. After the session is ready, choosing a patch or a pedal-initiated patch report MUST refresh the chain for that patch without sending extra patch recall solely to obtain the dump. A decoded dump for that newly selected patch MUST be applied even when its chain equals the chain already shown. The session MUST NOT discard that dump because of that equality.

While a pedal-initiated patch load is in flight (a newer current-patch index has been accepted and its chain dump has not finished applying), a later pedal current-patch report for a different slot MUST retarget that load: the connected snapshot MUST show the latest reported index, the session MUST abandon the previous dump assembly for that load, and the session MUST request one chain dump for the latest slot. The session MUST NOT leave the shown index frozen on an intermediate slot solely because an earlier dump is still outstanding. While an app-initiated patch recall is in flight, a current-patch report for a different slot MUST NOT revert the selected index.

Applying the first dump of a user or pedal patch change MUST arm one confirmation dump of the current patch and MUST NOT send patch recall for it. On USB and on Bluetooth, that first apply MUST keep the patch syncing until the confirmation dump is applied or the refresh times out. Connect, Reload, download, and upload MUST NOT start a confirmation. A confirmation that decodes to the same chain already shown MUST be discarded and MUST leave the shown chain and the held dump unchanged, and MUST end syncing. A confirmation that decodes to a different chain MUST replace the shown chain and the held dump when the working patch is not modified, MUST end syncing, and MUST NOT request another confirmation. A confirmation that arrives after the user has edited the working patch MUST be discarded and MUST end syncing when the overlay was held for confirmation. Disconnect MUST drop chain state.

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

#### Scenario: Identical patch dump is applied
- **WHEN** the session is ready, the user selects another patch, and the dump for that patch decodes to the same chain already shown
- **THEN** the session applies that dump
- **AND** the patch stays syncing until the confirmation dump is applied or the refresh times out
- **AND** download can use that dump once syncing ends
- **AND** no extra patch recall is sent solely to obtain that dump

#### Scenario: Rapid pedal patch reports retarget the load
- **WHEN** the session is ready on USB or Bluetooth, the pedal reports current patch `11`, then `12`, then `13` before the dump for `11` finishes applying
- **THEN** the connected snapshot shows patch `13`
- **AND** the session requests a chain dump for patch `13`
- **AND** no dump for an abandoned intermediate slot is applied as the selected patch after `13` was reported

#### Scenario: App recall ignores a stale current-patch index
- **WHEN** the session is ready, the user selects patch `42`, and a current-patch report for a different slot arrives before that recall dump finishes
- **THEN** the connected snapshot stays on patch `42`
- **AND** the session does not retarget the load to that other slot

#### Scenario: Matching confirmation is discarded
- **WHEN** a user or pedal patch change has applied its dump and the confirmation dump decodes to the same chain already shown
- **THEN** the shown chain stays as it is
- **AND** the patch is no longer syncing
- **AND** no further confirmation dump is requested
- **AND** no patch recall is sent solely because that confirmation arrived

#### Scenario: Mismatched confirmation replaces the chain
- **WHEN** a user or pedal patch change has applied its dump, the working patch is not modified, and the confirmation dump decodes to a different chain
- **THEN** the snapshot shows that confirmation's chain
- **AND** download uses that confirmation dump
- **AND** the patch is no longer syncing
- **AND** no further confirmation dump is requested

#### Scenario: An edit keeps the chain ahead of a confirmation
- **WHEN** a user or pedal patch change has applied its dump, the user edits the working chain, and a confirmation dump then arrives
- **THEN** the edited chain stays on screen
- **AND** the patch is no longer syncing
- **AND** no patch recall is sent solely because that confirmation arrived

#### Scenario: USB and Bluetooth hold syncing through confirmation
- **WHEN** a user or pedal patch change has applied its first dump on USB or on Bluetooth and the confirmation dump has not arrived yet
- **THEN** the patch stays syncing
- **AND** no further confirmation dump is requested until that one completes or the refresh times out

#### Scenario: Reload does not start a confirmation
- **WHEN** the user reloads the selected patch and that reload dump is applied
- **THEN** no confirmation dump is requested solely because Reload ran

#### Scenario: Pedal identical patch dump is applied
- **WHEN** the session is ready, the pedal reports a new current patch, and the dump for that patch decodes to the same chain already shown
- **THEN** the session applies that dump
- **AND** the patch stays syncing until the confirmation dump is applied or the refresh times out
- **AND** no patch recall is sent solely because that inbound report arrived

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

### Requirement: Connected session reads onboard IR names

After a USB or Bluetooth session is marked connected, the device session SHALL request the pedal's IR-name dump on the open link. That request MUST NOT block session readiness, MUST NOT wait to finish identity or chain sync, and MUST NOT send patch recall solely to obtain IR names. Reload and a newly selected patch MUST NOT re-request the IR-name dump solely because the patch changed.

When the dump is decoded, the connected snapshot MUST carry up to twenty onboard IR names (one per user IR CAB slot). A missing dump, a timeout, or a blank slot name MUST leave that slot unnamed and MUST NOT invent a name that is written to the pedal. IR names are device-global: a later current-preset dump MUST NOT clear them. Disconnect MUST drop IR names. The same request MUST be used on USB and Bluetooth. UI MUST NOT send raw MIDI.

#### Scenario: IR names load after connect
- **WHEN** a session becomes connected and the IR-name dump loads `Greenback 412` for user IR slot 03
- **THEN** the snapshot name for that slot is `Greenback 412`
- **AND** no patch recall is sent solely because that dump arrived

#### Scenario: Missing IR dump does not invent names
- **WHEN** a session becomes ready without an IR-name dump
- **THEN** user IR slots have no dumped names
- **AND** the session does not send an IR write solely because names were missing

#### Scenario: Readiness does not wait for IR names
- **WHEN** a session has received patch identity and the IR-name dump has not arrived yet
- **THEN** the session is still allowed to become ready
- **AND** no patch recall is sent solely to wait for IR names

#### Scenario: Patch change does not re-request IR names
- **WHEN** a ready session selects another patch
- **THEN** the session does not re-request the IR-name dump solely because the patch changed
- **AND** already loaded IR names stay on the snapshot

#### Scenario: Disconnect drops IR names
- **WHEN** the user disconnects after IR names were loaded
- **THEN** the session no longer carries those IR names

### Requirement: Connected session applies slot models and control values

After a USB or Bluetooth session is ready, the connected snapshot MUST carry each effect slot's loaded catalog model and control values when those fields are decoded from the same current-preset dump already used for chain order and on/off. GP-5 and GP-50 MUST only expose catalog models and controls that exist on that pedal. PRE C-Wah, PRE AC Sim, and CAB AC exist on GP-50 only. Sync controls, including Sweep Echo S-Sync and D-Sync, exist on GP-50 only. B-Boost exposes Gain, VOL, Bass, and Treble on both pedals. The CAB catalog MUST include the twenty onboard user IR slots on both pedals. EXP MUST NOT carry a model or control values. If a dump is missing, a slot's wire identity is unknown, a wire identity is not in that pedal's catalog, or a control value cannot be decoded, the session MUST leave that slot's model and values unknown and MUST NOT invent values that are written to the pedal.

Live module on/off reports and live chain-order reports MUST preserve each slot's last known model and control values. When the link can apply live pedal module state (`liveFromPedal`, Bluetooth), inbound live model notifies MUST update that slot's model and load catalog default values for the connected pedal, and inbound live control notifies MUST update that slot's matching control value. USB MUST NOT apply those inbound reports to the snapshot. A later current-preset dump MUST replace model and values for slots it decodes. Disconnect MUST drop model and value state.

#### Scenario: Dump loads AMP model and Gain
- **WHEN** a GP-50 session is ready and the current-preset dump loads Tweedy on AMP with Gain at 30
- **THEN** the snapshot AMP slot's model is Tweedy
- **AND** AMP Gain is 30

#### Scenario: Dump loads a user IR CAB slot
- **WHEN** a session is ready and the current-preset dump loads User IR 03 on CAB with VOL at 50
- **THEN** the snapshot CAB slot's model is User IR 03
- **AND** CAB VOL is 50
- **AND** that CAB model can be written

#### Scenario: Missing dump does not invent values
- **WHEN** a session becomes ready without a current-preset dump
- **THEN** effect slots have no loaded model that can be written
- **AND** the session does not send a model or control write solely because dump was missing

#### Scenario: Unknown wire identity stays unwritable
- **WHEN** a session is ready and a dump carries an AMP identity that is not in the factory catalog
- **THEN** the snapshot does not treat that AMP identity as a writable factory model
- **AND** the session does not send an AMP model write solely because that identity was unknown

#### Scenario: GP-5 does not expose GP-50-only models
- **WHEN** a GP-5 session is ready
- **THEN** PRE does not expose C-Wah or AC Sim
- **AND** CAB does not expose AC
- **AND** the session does not treat those models as writable on that session

#### Scenario: GP-50 exposes its extra models
- **WHEN** a GP-50 session is ready
- **THEN** PRE exposes C-Wah and AC Sim
- **AND** CAB exposes AC

#### Scenario: B-Boost controls match on both pedals
- **WHEN** a session is ready and PRE is loaded as B-Boost
- **THEN** the exposed B-Boost controls are Gain, VOL, Bass, and Treble
- **AND** Tone is not exposed

#### Scenario: GP-5 does not expose Sync
- **WHEN** a GP-5 session is ready and a slot is loaded with a model that has Sync on GP-50
- **THEN** Sync is not exposed
- **AND** S-Sync and D-Sync are not exposed

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

#### Scenario: Bluetooth live CAB user IR follows the pedal
- **WHEN** a Bluetooth session is showing CAB on a factory cab and the pedal reports User IR 03 on CAB
- **THEN** the snapshot CAB model is User IR 03

### Requirement: Connected session writes slot model and control changes

After a USB or Bluetooth session is ready, changing an effect slot's loaded model MUST update the snapshot on-change, MUST load that model's catalog controls for the connected pedal, and MUST send a model write for the current patch through the open link. Changing a known control value MUST update the snapshot on-change. Slider drags MUST coalesce control writes (throttle, flush on release) so Bluetooth is not flooded with one SET per intermediate value. Toggles MUST send on-change. Both writes MUST use the parameter-write SET family (path `01 01 04`, CRC-8 + nibble-expand), not live notify path `01 02 04`. The session MUST NOT send extra patch recall or an audio-chain dump solely because a model or control changed. Model and control writes MUST NOT change slot order or on/off by themselves. The session MUST NOT write a model that is not in the catalog for that slot kind and connected pedal. The session MUST NOT write a control that is not in the catalog for that model and connected pedal. User IR CAB slots that are in that catalog MUST be writable the same way as factory CAB models. The session MUST NOT write a control when that slot's model and values are unknown. GP-5 MUST NOT expose EXP model or control writes. GP-5 MUST NOT write C-Wah, AC Sim, CAB AC, Sync, S-Sync, or D-Sync. When the link can apply live pedal module state (`liveFromPedal`, Bluetooth), inbound live model and live control reports MUST update the snapshot without sending a SET, recall, or dump. USB MUST NOT apply unsolicited inbound parameter reports to the snapshot. Disconnect MUST drop that state.

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

#### Scenario: USB user IR CAB model write
- **WHEN** a USB session is ready with CAB on a factory cab and the user selects User IR 03
- **THEN** the snapshot CAB model is User IR 03
- **AND** a model write is sent on the USB link
- **AND** no patch recall or chain dump is sent solely because the model changed
- **AND** no IR file is uploaded solely because that slot was selected

#### Scenario: GP-5 cannot write a GP-50-only model
- **WHEN** a GP-5 session is ready and the user would select PRE C-Wah, PRE AC Sim, or CAB AC
- **THEN** the snapshot model does not change to that model
- **AND** no model write is sent

#### Scenario: GP-5 cannot write Sync
- **WHEN** a GP-5 session is ready with a model that has Sync on GP-50 and the user would change Sync
- **THEN** the snapshot does not change that Sync value from the user action
- **AND** no Sync control write is sent

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

### Requirement: Connected session writes patch volume and patch BPM

After a USB or Bluetooth session is ready and a current-preset dump has supplied the value, the connected snapshot MUST carry patch volume for GP-5 and GP-50 (integer 0–100) and patch BPM for GP-50 (integer 40–260). GP-5 MUST NOT carry an editable patch BPM and MUST NOT send a tempo write.

Changing patch volume MUST update the snapshot on-change and MUST send official MIDI CC 7 with that value (0–100) through the open link. Changing GP-50 patch BPM MUST update the snapshot on-change and MUST send official tempo as CC 73 then CC 74: BPM 40–127 is CC 73 = 0 and CC 74 = BPM; BPM 128–255 is CC 73 = 1 and CC 74 = BPM − 128; BPM 256–260 is CC 73 = 2 and CC 74 = BPM − 256. Slider drags MUST coalesce those writes (throttle, flush on release) so Bluetooth is not flooded. The session MUST NOT send a value outside those ranges. The session MUST NOT send the GP-50 relative step controllers (CC 17, CC 19, or CC 21) for these edits. The session MUST NOT send extra patch recall or an audio-chain dump solely because volume or BPM changed.

A current-preset dump for a newly selected patch, a user reload, or a dump applied while the working patch is not modified MUST set the snapshot volume and, on GP-50, BPM from that dump. A dump discarded because the user already edited MUST leave the edited volume and BPM on the snapshot. Download of a patch the user has edited MUST carry that edited patch volume and, on GP-50, that edited patch BPM. Inbound CC 7, CC 73, and CC 74 MUST NOT update snapshot volume, BPM, or the chain while the selected patch stays the same, on USB and on Bluetooth. On Bluetooth, an inbound live patch-volume SysEx notify (identity-family, size `0x07`, path `01 02 04`, preset-volume body) MUST update snapshot patch volume and MUST update `modified` when that value differs from the baseline. USB MUST NOT apply that notify to the snapshot. Disconnect MUST drop those values.

#### Scenario: USB volume sends CC 7
- **WHEN** a USB session is ready with dumped patch volume 80 and the user sets patch volume to 60
- **THEN** the snapshot patch volume is 60
- **AND** CC 7 value 60 is sent on the USB link
- **AND** no patch recall or chain dump is sent solely because volume changed

#### Scenario: Bluetooth volume sends CC 7
- **WHEN** a Bluetooth session is ready with a dumped patch volume and the user sets patch volume to 60
- **THEN** the snapshot patch volume is 60
- **AND** CC 7 value 60 is sent on the Bluetooth link

#### Scenario: GP-50 BPM 120 sends tempo CC
- **WHEN** a GP-50 session is ready with dumped patch BPM 100 and the user sets patch BPM to 120
- **THEN** the snapshot patch BPM is 120
- **AND** CC 73 value 0 is sent, then CC 74 value 120
- **AND** no patch recall or chain dump is sent solely because BPM changed

#### Scenario: GP-50 BPM 140 uses the second tempo range
- **WHEN** a GP-50 session is ready and the user sets patch BPM to 140
- **THEN** CC 73 value 1 is sent, then CC 74 value 12

#### Scenario: GP-50 BPM 260 uses the third tempo range
- **WHEN** a GP-50 session is ready and the user sets patch BPM to 260
- **THEN** CC 73 value 2 is sent, then CC 74 value 4

#### Scenario: GP-5 does not send tempo
- **WHEN** a GP-5 session is ready
- **THEN** the snapshot has no editable patch BPM
- **AND** no CC 73 or CC 74 write is sent

#### Scenario: Out-of-range volume is not sent
- **WHEN** a session is ready and a patch volume outside 0–100 would be written
- **THEN** the snapshot patch volume does not change
- **AND** no CC 7 is sent

#### Scenario: Dump fills volume and BPM
- **WHEN** a GP-50 session decodes a current-preset dump for the selected patch with patch volume 80 and patch BPM 120, and the working patch is not modified
- **THEN** the snapshot patch volume is 80
- **AND** the snapshot patch BPM is 120

#### Scenario: Edited volume survives a discarded dump
- **WHEN** the user has set patch volume away from the dump and a later dump is discarded because the working patch is already edited
- **THEN** the snapshot keeps that edited patch volume

#### Scenario: Download carries the edited volume
- **WHEN** a session is ready, the user sets patch volume to 60, and the user downloads the current patch
- **THEN** the Valeton `.prst` carries patch volume 60
- **AND** the snapshot patch volume stays 60

#### Scenario: Download carries the edited GP-50 BPM
- **WHEN** a GP-50 session is ready, the user sets patch BPM to 140, and the user downloads the current patch
- **THEN** the Valeton `.prst` carries patch BPM 140

#### Scenario: Inbound volume CC does not move the snapshot
- **WHEN** a session is ready with patch volume 80 and inbound CC 7 value 40 arrives while the selected patch stays the same
- **THEN** the snapshot patch volume stays 80
- **AND** the snapshot chain does not change from that CC

#### Scenario: Bluetooth live volume SysEx updates the snapshot
- **WHEN** a Bluetooth session is ready with patch volume 50 and an inbound live patch-volume SysEx for 51 arrives while the selected patch stays the same
- **THEN** the snapshot patch volume is 51
- **AND** no patch recall or chain dump is sent solely because that notify arrived

#### Scenario: USB ignores live volume SysEx
- **WHEN** a USB session is ready with patch volume 50 and an inbound live patch-volume SysEx for 51 arrives
- **THEN** the snapshot patch volume stays 50

#### Scenario: Disconnect drops volume and BPM
- **WHEN** the user disconnects while the snapshot has a patch volume
- **THEN** that patch volume and patch BPM are dropped

### Requirement: Connected session tracks whether the working patch is modified

After a USB or Bluetooth session is ready, the connected snapshot MUST report whether the current working patch differs from a baseline kept for the selected patch. That comparison MUST include the working chain (module order, on/off, factory model, and control values), patch volume on GP-5 and GP-50, and patch BPM on GP-50. GP-5 MUST NOT include BPM in that comparison. The session MUST capture that baseline from the current-preset dump that lands for a newly selected patch (connect, user recall, or pedal-initiated patch change) and MUST report not modified then. A dump that matches the chain already shown MUST still capture that baseline and MUST still report not modified. A matching confirmation dump MUST NOT recapture the baseline and MUST leave modified unchanged. A mismatched confirmation that replaces the chain MUST recapture the baseline and MUST report not modified. A confirmation discarded because the user already edited MUST leave modified as it was. A user reload of the selected patch MUST re-request that patch's current-preset dump, MUST NOT send patch recall, MUST capture the baseline from the dump that lands, and MUST report not modified then. The session MUST recapture that baseline from the current working patch after a successful Save or rename of the current slot and MUST report not modified then.

Any later working-patch change that still differs from the baseline (module on/off, reorder, model, control, patch volume, GP-50 patch BPM, Bluetooth live follow of chain fields, or a successful upload whose dump does not match the baseline) MUST report modified. A later working-patch change that matches the baseline again MUST report not modified. Duplicate onto another slot MUST NOT recapture the current-slot baseline. A dump refresh that is not a newly selected patch (download, upload) MUST NOT recapture the baseline as the stored patch. While the current patch is syncing, or when no dump has been captured for the selected patch, the snapshot MUST report not modified. Changing patch MUST drop the baseline. Disconnect MUST drop that working state. Inbound patch-volume or tempo CC MUST NOT by itself report modified while the selected patch stays the same. A Bluetooth live patch-volume SysEx that leaves the baseline MUST report modified.

#### Scenario: Dump of the selected patch starts clean
- **WHEN** a USB or Bluetooth session is ready and a current-preset dump for the selected patch is decoded
- **THEN** the snapshot reports not modified

#### Scenario: Identical patch dump starts clean
- **WHEN** the session is ready, the user selects another patch, and the dump for that patch decodes to the same chain already shown
- **THEN** the snapshot reports not modified
- **AND** a later edit that turns DST off reports modified

#### Scenario: Matching confirmation leaves modified unchanged
- **WHEN** a patch-change dump has been applied and a confirmation dump matches that chain
- **THEN** the snapshot reports not modified
- **AND** the baseline stays the chain from the patch-change dump

#### Scenario: Mismatched confirmation starts clean
- **WHEN** a patch-change dump has been applied, the working patch is not modified, and a confirmation dump has a different chain
- **THEN** the snapshot reports not modified
- **AND** the baseline is that confirmation's chain

#### Scenario: Reload of the selected patch starts clean
- **WHEN** the session is ready on the selected patch and the user reloads that patch
- **THEN** the session re-requests the current-preset dump
- **AND** the snapshot reports not modified after that dump lands
- **AND** the selected patch does not change
- **AND** no patch recall is sent solely because reload ran

#### Scenario: A working edit is modified
- **WHEN** the snapshot has a baseline from that dump and the user turns DST off
- **THEN** the snapshot reports modified
- **AND** no extra patch recall is sent solely because the module was toggled

#### Scenario: A volume edit is modified
- **WHEN** the snapshot has a baseline patch volume of 80 and the user sets patch volume to 60
- **THEN** the snapshot reports modified
- **AND** no extra patch recall is sent solely because volume changed

#### Scenario: A GP-50 BPM edit is modified
- **WHEN** a GP-50 snapshot has a baseline patch BPM of 120 and the user sets patch BPM to 140
- **THEN** the snapshot reports modified

#### Scenario: Restoring the dumped values clears modified
- **WHEN** the snapshot is modified because DST was turned off and the user turns DST on again so the working chain matches the baseline
- **THEN** the snapshot reports not modified

#### Scenario: Restoring patch volume clears modified
- **WHEN** the snapshot is modified only because patch volume left the baseline and the user sets that volume back to the baseline
- **THEN** the snapshot reports not modified

#### Scenario: Restoring GP-50 patch BPM clears modified
- **WHEN** the snapshot is modified only because patch BPM left the baseline and the user sets that BPM back to the baseline
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

#### Scenario: Inbound volume CC does not mark modified
- **WHEN** a session has a baseline patch volume of 80 and inbound CC 7 value 40 arrives while the selected patch stays the same
- **THEN** the snapshot reports not modified

#### Scenario: Bluetooth live volume SysEx can mark modified
- **WHEN** a Bluetooth session has a baseline patch volume of 50 and an inbound live patch-volume SysEx for 51 arrives
- **THEN** the snapshot reports modified

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


### Requirement: Connected session reads device global settings

After a USB or Bluetooth session is marked connected, the device session SHALL request the globals dump on the open link for GP-50 and for GP-5. The request MUST NOT block session readiness, MUST NOT wait to finish identity or chain sync, and MUST NOT send patch recall solely to obtain globals. Reload and a newly selected patch MUST NOT re-request the globals dump solely because the patch changed.

When the dump is decoded, the connected snapshot MUST carry the global values that dump provides for the connected model. A missing dump or a timeout MUST leave those values unknown and MUST NOT invent a value that is written to the pedal. Global values are device-wide: a later current-preset dump MUST NOT clear them. Disconnect MUST drop them. The same request shape MUST be used on USB and Bluetooth. UI MUST NOT send raw MIDI.

A GP-50 dump MUST be able to supply input level, No CAB, REC level, BT REC, monitor level, REC mode left, REC mode right, footswitch mode, and master volume. A GP-5 dump MUST be able to supply global volume, input level, No CAB, REC level, BT REC, monitor level, screen brightness, and footswitch mode. A GP-5 session MUST NOT expose master volume, REC mode left, or REC mode right. A GP-5 session MUST NOT expose Patch or Stomp as its footswitch mode. A GP-5 session MUST NOT expose input level, No CAB, REC level, BT REC, monitor level, global volume, screen brightness, or footswitch mode by treating a GP-50 globals payload as a GP-5 value. A GP-50 session MUST NOT decode a GP-5 globals payload as GP-50 values.

#### Scenario: Globals load after connect
- **WHEN** a GP-50 session becomes connected and the globals dump decodes input level 0 and master volume 63
- **THEN** the snapshot carries input level 0 and master volume 63
- **AND** no patch recall is sent solely because that dump arrived

#### Scenario: Readiness does not wait for globals
- **WHEN** a session has received patch identity and the globals dump has not arrived yet
- **THEN** the session is still allowed to become ready
- **AND** no patch recall is sent solely to wait for globals

#### Scenario: A missing dump does not invent values
- **WHEN** a session becomes ready without a globals dump
- **THEN** global values stay unknown
- **AND** the session does not send a global write solely because the dump was missing

#### Scenario: Patch change does not clear globals
- **WHEN** a ready session has input level 6 and the user selects another patch
- **THEN** the session does not re-request the globals dump solely because the patch changed
- **AND** input level stays 6

#### Scenario: GP-5 does not send the GP-50 globals request
- **WHEN** a GP-5 session becomes connected
- **THEN** the session sends the one shared globals request
- **AND** it does not send a second globals request
- **AND** a GP-50 globals payload does not set GP-5 values

#### Scenario: GP-5 loads its globals after connect
- **WHEN** a GP-5 session becomes connected and the globals dump decodes input level 0 and global volume 40
- **THEN** the snapshot carries input level 0 and global volume 40
- **AND** the session sent the globals request on the open link
- **AND** no patch recall is sent solely because that dump arrived

#### Scenario: GP-5 does not inherit GP-50-only globals
- **WHEN** a GP-5 session decodes a globals dump
- **THEN** the snapshot does not expose master volume or REC mode
- **AND** the snapshot does not expose Patch or Stomp as the footswitch mode

#### Scenario: A GP-50 payload is not a GP-5 globals dump
- **WHEN** a GP-5 session receives a globals payload that only a GP-50 session decodes
- **THEN** that payload does not set GP-5 global values

#### Scenario: Disconnect drops globals
- **WHEN** the user disconnects after global values were loaded
- **THEN** the session no longer carries those global values

### Requirement: Connected session writes global settings immediately

After a USB or Bluetooth session is ready, changing a known global setting MUST update the snapshot on-change and MUST send that write on the open link. The session MUST NOT send patch recall or an audio-chain dump solely because a global changed. A global write MUST NOT mark the working patch modified and MUST NOT change the patch baseline. Slider drags for an exposed level, for master volume, for global volume, and for screen brightness MUST coalesce writes (throttle, flush on release). No CAB, REC mode, and footswitch mode MUST send on-change.

GP-50 master volume MUST be official CC 1 with value 0–100, not the relative master step (CC 17). GP-50 footswitch mode MUST be official CC 28, Patch as 0 and Stomp as 127. GP-50 input level, No CAB, REC level, BT REC, monitor level, and REC mode left/right MUST use the parameter-write SET family (path `01 01 04`, CRC-8 + nibble-expand), not live-notify path `01 02 04`, and MUST NOT be sent as a GP-5 write. The session MUST NOT write a global the connected model does not expose.

GP-5 global volume, input level, No CAB, REC level, BT REC, monitor level, and screen brightness MUST use that same parameter-write SET family. GP-5 global volume MUST NOT be official CC 1. GP-5 footswitch mode MUST use that same framing and MUST NOT be official CC 28. A GP-5 BT REC write and a GP-5 monitor-level write MUST NOT reuse the GP-50 effect and flag pair for that row. A GP-5 write MUST NOT be sent on a GP-50 session.

When the link can apply live pedal state (`liveFromPedal`, Bluetooth), an inbound report for an exposed global MUST update that snapshot value and MUST NOT mark the working patch modified. A GP-5 live report MUST be applied with the GP-5 row mapping, so a GP-5 monitor report MUST NOT change BT REC and a GP-5 BT REC report MUST NOT change REC mode. USB MUST NOT apply those inbound reports. Inbound CC 1 and CC 28 MUST NOT update the audio chain. Inbound CC 1 and CC 28 MUST NOT change GP-5 global values.

#### Scenario: Master volume is sent as CC 1
- **WHEN** a GP-50 session has master volume 63 and the user sets it to 80
- **THEN** the snapshot master volume is 80
- **AND** the pedal is sent official CC 1 with value 80
- **AND** the working patch is not marked modified
- **AND** no patch recall is sent solely because master volume changed

#### Scenario: Footswitch mode is sent as CC 28
- **WHEN** a GP-50 session is in Patch mode and the user selects Stomp
- **THEN** the snapshot footswitch mode is Stomp
- **AND** the pedal is sent official CC 28 with value 127
- **AND** the working patch is not marked modified

#### Scenario: No CAB is sent without Save
- **WHEN** a GP-50 session has No CAB off and the user turns it on
- **THEN** the snapshot No CAB is on
- **AND** that change is sent on the open link
- **AND** the working patch is not marked modified

#### Scenario: A global edit does not dirty the patch
- **WHEN** the working patch is not modified and the user changes input level
- **THEN** the snapshot still reports the working patch as not modified

#### Scenario: Bluetooth follows a global report
- **WHEN** a GP-50 Bluetooth session has master volume 63 and the pedal reports master volume 70
- **THEN** the snapshot master volume is 70
- **AND** the working patch is not marked modified

#### Scenario: USB ignores a live global report
- **WHEN** a GP-50 USB session has master volume 63 and an inbound master-volume report arrives
- **THEN** the snapshot master volume stays 63

#### Scenario: GP-5 global volume is not CC 1
- **WHEN** a GP-5 session has global volume 40 and the user sets it to 55
- **THEN** the snapshot global volume is 55
- **AND** the pedal is not sent official CC 1 for that edit
- **AND** the working patch is not marked modified

#### Scenario: GP-5 footswitch mode is not CC 28
- **WHEN** a GP-5 session is in `0-99` and the user selects `CTL`
- **THEN** the snapshot footswitch mode is `CTL`
- **AND** the pedal is not sent official CC 28 for that edit
- **AND** the working patch is not marked modified

#### Scenario: Bluetooth follows a GP-5 monitor report
- **WHEN** a GP-5 Bluetooth session has monitor level 0 and BT REC 3 and the pedal reports monitor level −6
- **THEN** the snapshot monitor level is −6
- **AND** BT REC stays 3
- **AND** the working patch is not marked modified

#### Scenario: USB ignores a GP-5 live global report
- **WHEN** a GP-5 USB session has global volume 40 and an inbound global-volume report arrives
- **THEN** the snapshot global volume stays 40

### Requirement: Connected session reads and writes stomp assignment

After a USB or Bluetooth session is ready, stomp assignment for the current patch MUST come from the same current-preset dump already requested after connect and when the patch changes. GP-5 MUST expose one stomp. GP-50 MUST expose two stomps. Each stomp's assignment is the set of effect modules it toggles (NR, PRE, DST, NS, AMP, CAB, EQ, MOD, DLY, RVB). EXP MUST NOT be part of any stomp assignment. If that dump is missing, the session MUST NOT invent an assignment that is written to the pedal.

When the user changes a stomp's assigned modules, the session MUST update the snapshot on-change and MUST send that assignment through the open link as a parameter-write SET (family `114d`; not a full preset dump and not an echo of a live notify). The session MUST NOT send extra patch recall or an audio-chain dump solely because assignment changed. Assignment MUST NOT change module order or on/off by itself. An assignment edit MUST mark the working patch modified when it differs from the baseline. USB MUST NOT apply unsolicited inbound assignment reports to the snapshot. On Bluetooth, when `liveFromPedal` is true, the session MAY apply a live stomp-assignment notify after a write path is known to work; until then, dumps remain the source of truth. Disconnect MUST drop assignment state.

#### Scenario: Dump fills GP-50 stomps
- **WHEN** a GP-50 session is ready and the current-preset dump assigns PRE to stomp 1 and MOD plus DLY to stomp 2
- **THEN** the snapshot has two stomps
- **AND** stomp 1 includes PRE
- **AND** stomp 2 includes MOD and DLY

#### Scenario: Dump fills the GP-5 stomp
- **WHEN** a GP-5 session is ready and the current-preset dump assigns AMP to the only stomp
- **THEN** the snapshot has one stomp
- **AND** that stomp includes AMP

#### Scenario: User edit sends assignment
- **WHEN** a USB or Bluetooth session is ready and the user assigns DST to stomp 1
- **THEN** the snapshot stomp 1 includes DST
- **AND** an assignment write is sent on the open link
- **AND** no patch recall or chain dump is sent solely because that assignment changed

#### Scenario: Missing dump does not write invented assignment
- **WHEN** a session becomes ready without a current-preset dump
- **THEN** the session does not send a stomp assignment write solely because dump was missing

#### Scenario: USB ignores unsolicited assignment reports
- **WHEN** a USB session is ready and an unsolicited live stomp-assignment report arrives
- **THEN** the snapshot assignment does not change from that inbound report

### Requirement: Connected session presses a stomp

After a USB or Bluetooth session is ready and the current chain is shown, a stomp press MUST send one official MIDI CC on the open link and MUST update that chain on-change. GP-5 MUST send CC 69 with value 127. GP-50 stomp A MUST send CC 69 with value 127. GP-50 stomp B MUST send CC 70 with value 127. The session MUST NOT send module on/off CC 48–57, a stomp-assignment write, patch recall, or a chain-dump request solely because of that press.

Each effect assigned to that stomp MUST toggle on/off. Effects not assigned to it MUST keep their on/off. EXP MUST NOT change. Module order, models, controls, stomp assignment, patch index, patch volume, and patch BPM MUST NOT change solely because of the press. The working patch MUST be marked modified when the resulting on/off differs from the baseline, and MUST NOT stay marked modified when the press restores the baseline. An empty assignment MUST still send the CC and MUST leave on/off unchanged. A press for a stomp the connected model does not expose MUST NOT send. While the chain is syncing, or while no session is connected, a press MUST NOT send.

USB MUST NOT apply an unsolicited live stomp report to the snapshot. On Bluetooth, when live pedal state is applied, an inbound stomp mask MAY replace the on-change on/off with the reported mask and MUST NOT be treated as a patch change. The press MUST NOT change GP-50 Patch or Stomp mode and MUST NOT change the GP-5 footswitch mode.

#### Scenario: GP-5 press sends CC 69 and toggles the assigned effect
- **WHEN** a ready GP-5 session has AMP on and assigned to the only stomp, and the user presses that stomp
- **THEN** the session sends CC 69 with value 127
- **AND** the snapshot shows AMP off
- **AND** no patch recall is sent solely because of that press
- **AND** no chain dump is requested solely because of that press

#### Scenario: GP-50 stomp A and stomp B use CC 69 and CC 70
- **WHEN** a ready GP-50 session presses stomp A and then stomp B
- **THEN** the first press sends CC 69 with value 127
- **AND** the second press sends CC 70 with value 127

#### Scenario: Each assigned effect toggles
- **WHEN** a ready session has MOD on and DLY off, both assigned to stomp A, and PRE on and not assigned to stomp A, and the user presses stomp A
- **THEN** the snapshot shows MOD off and DLY on
- **AND** PRE stays on
- **AND** the stomp assignment is unchanged

#### Scenario: EXP is not toggled
- **WHEN** a ready GP-50 session has EXP on and the user presses stomp A
- **THEN** EXP stays on

#### Scenario: Empty assignment still sends the CC
- **WHEN** a ready GP-50 session has no effects assigned to stomp B and the user presses stomp B
- **THEN** the session sends CC 70 with value 127
- **AND** every module on/off stays as it was

#### Scenario: GP-5 does not send a second stomp
- **WHEN** a ready GP-5 session is asked to press a second stomp
- **THEN** the session does not send a stomp CC

#### Scenario: Press marks the working patch modified
- **WHEN** a ready session's chain matches the baseline and the user presses a stomp that toggles an assigned effect
- **THEN** the working patch is marked modified

#### Scenario: A restoring press clears modified
- **WHEN** the only difference from the baseline is an on/off bit that a stomp press set, and the user presses that stomp again
- **THEN** the working patch is not marked modified

#### Scenario: USB ignores a live stomp report after the press
- **WHEN** a USB session has pressed a stomp and an unsolicited live stomp report arrives
- **THEN** the snapshot keeps the on/off from the press
- **AND** that report is not treated as a patch change

#### Scenario: Bluetooth stomp mask may replace the on-change state
- **WHEN** a Bluetooth session has pressed a stomp and a live stomp mask reports the resulting on/off
- **THEN** the snapshot chain matches that mask
- **AND** no patch recall is sent solely because that mask arrived

#### Scenario: Syncing or disconnected does not send
- **WHEN** the chain is syncing, or no session is connected, and a stomp press is requested
- **THEN** the session does not send a stomp CC

### Requirement: Connected session toggles the tuner

After a USB or Bluetooth session is ready and the current chain is shown, toggling the tuner MUST send official MIDI CC 58 on the open link. Turning the tuner on MUST send value 127. Turning it off MUST send value 0. The session MUST keep an on/off state for the last app-written tuner value so the UI can show it. That state MUST start off when the session becomes connected and MUST drop on disconnect.

The session MUST NOT apply inbound CC 58 to the snapshot. The session MUST NOT mark the working patch modified solely because of a tuner write. The session MUST NOT send patch recall or a chain-dump request solely because of a tuner write. Module on/off, order, models, controls, stomp assignment, patch index, patch volume, and patch BPM MUST NOT change solely because of a tuner write. While the chain is syncing, or while no session is connected, a tuner toggle MUST NOT send.

When the selected patch changes — whether the user recalled a patch or the pedal reported a different current patch — and the session had the tuner on, the session MUST turn the tuner off (CC 58 value 0) and MUST show the tuner off. That turn-off MUST happen before an app-initiated patch recall is sent.

#### Scenario: Turning the tuner on sends CC 58 value 127

- **WHEN** a ready session has the tuner off and the user turns the tuner on
- **THEN** the session sends CC 58 with value 127
- **AND** the snapshot shows the tuner on
- **AND** no patch recall is sent solely because of that write
- **AND** no chain dump is requested solely because of that write
- **AND** the working patch is not marked modified solely because of that write

#### Scenario: Turning the tuner off sends CC 58 value 0

- **WHEN** a ready session has the tuner on and the user turns the tuner off
- **THEN** the session sends CC 58 with value 0
- **AND** the snapshot shows the tuner off

#### Scenario: App patch change turns the tuner off

- **WHEN** a ready session has the tuner on and the user selects another patch
- **THEN** the session sends CC 58 with value 0
- **AND** the snapshot shows the tuner off
- **AND** that CC 58 off is sent before the patch recall for the new slot

#### Scenario: Pedal patch change turns the tuner off

- **WHEN** a ready session has the tuner on and the pedal reports a different current patch
- **THEN** the session sends CC 58 with value 0
- **AND** the snapshot shows the tuner off

#### Scenario: Inbound CC 58 is ignored

- **WHEN** a USB or Bluetooth session has the tuner off and an inbound CC 58 with value 127 arrives
- **THEN** the snapshot still shows the tuner off

#### Scenario: Syncing or disconnected does not send

- **WHEN** the chain is syncing, or no session is connected, and a tuner toggle is requested
- **THEN** the session does not send CC 58
