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
