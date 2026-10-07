## ADDED Requirements

### Requirement: Connected session reads onboard SnapTone names

After a USB or Bluetooth session is marked connected, the device session SHALL request the pedal's SnapTone / Nam name dump on the open link. That request MUST NOT block session readiness, MUST NOT wait to finish identity or chain sync, and MUST NOT send patch recall solely to obtain SnapTone names. Reload and a newly selected patch MUST NOT re-request the Nam dump solely because the patch changed.

When the dump is decoded, the connected snapshot MUST carry up to twenty-four onboard SnapTone names (one per user NS slot). A missing dump, a timeout, or a blank slot name MUST leave that slot unnamed and MUST NOT invent a name that is written to the pedal. SnapTone names are device-global: a later current-preset dump MUST NOT clear them. Disconnect MUST drop SnapTone names. The same request MUST be used on USB and Bluetooth. UI MUST NOT send raw MIDI.

#### Scenario: SnapTone names load after connect
- **WHEN** a session becomes connected and the Nam dump loads `My Amp` for user SnapTone slot 03
- **THEN** the snapshot name for that slot is `My Amp`
- **AND** no patch recall is sent solely because that dump arrived

#### Scenario: Missing Nam dump does not invent names
- **WHEN** a session becomes ready without a Nam dump
- **THEN** user SnapTone slots have no dumped names
- **AND** the session does not send a SnapTone write solely because names were missing

#### Scenario: Readiness does not wait for SnapTone names
- **WHEN** a session has received patch identity and the Nam dump has not arrived yet
- **THEN** the session is still allowed to become ready
- **AND** no patch recall is sent solely to wait for SnapTone names

#### Scenario: Patch change does not re-request SnapTone names
- **WHEN** a ready session selects another patch
- **THEN** the session does not re-request the Nam dump solely because the patch changed
- **AND** already loaded SnapTone names stay on the snapshot

#### Scenario: Disconnect drops SnapTone names
- **WHEN** the user disconnects after SnapTone names were loaded
- **THEN** the session no longer carries those SnapTone names

## MODIFIED Requirements

### Requirement: Connected session applies slot models and control values

After a USB or Bluetooth session is ready, the connected snapshot MUST carry each effect slot's loaded catalog model and control values when those fields are decoded from the same current-preset dump already used for chain order and on/off. GP-5 and GP-50 MUST only expose catalog models and controls that exist on that pedal. PRE C-Wah, PRE AC Sim, and CAB AC exist on GP-50 only. Sync controls, including Sweep Echo S-Sync and D-Sync, exist on GP-50 only. B-Boost exposes Gain, VOL, Bass, and Treble on both pedals. The CAB catalog MUST include the twenty onboard user IR slots on both pedals. The NS catalog MUST include the twenty-four onboard user SnapTone slots on both pedals. EXP MUST NOT carry a model or control values. If a dump is missing, a slot's wire identity is unknown, a wire identity is not in that pedal's catalog, or a control value cannot be decoded, the session MUST leave that slot's model and values unknown and MUST NOT invent values that are written to the pedal.

Live module on/off reports and live chain-order reports MUST preserve each slot's last known model and control values. When the link can apply live pedal module state (`liveFromPedal`, Bluetooth), inbound live model notifies MUST update that slot's model and load catalog default values, and inbound live control notifies MUST update that slot's matching control value. USB MUST NOT apply those inbound reports to the snapshot. A later current-preset dump MUST replace model and values for slots it decodes. Disconnect MUST drop model and value state.

#### Scenario: Dump loads AMP model and Gain
- **WHEN** a GP-50 session is ready and the current-preset dump loads Tweedy on AMP with Gain at 30
- **THEN** the snapshot AMP slot's model is Tweedy
- **AND** AMP Gain is 30

#### Scenario: Dump loads a user IR CAB slot
- **WHEN** a session is ready and the current-preset dump loads User IR 03 on CAB with VOL at 50
- **THEN** the snapshot CAB slot's model is User IR 03
- **AND** CAB VOL is 50
- **AND** that CAB model can be written

#### Scenario: Dump loads a user SnapTone NS slot
- **WHEN** a session is ready and the current-preset dump loads SnapTone 03 on NS with Gain at 40
- **THEN** the snapshot NS slot's model is SnapTone 03
- **AND** NS Gain is 40
- **AND** that NS model can be written

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

#### Scenario: Bluetooth live CAB user IR follows the pedal
- **WHEN** a Bluetooth session is showing CAB on a factory cab and the pedal reports User IR 03 on CAB
- **THEN** the snapshot CAB model is User IR 03

#### Scenario: Bluetooth live NS user SnapTone follows the pedal
- **WHEN** a Bluetooth session is showing NS on a factory SnapTone and the pedal reports SnapTone 03 on NS
- **THEN** the snapshot NS model is SnapTone 03

### Requirement: Connected session writes slot model and control changes

After a USB or Bluetooth session is ready, changing an effect slot's loaded model MUST update the snapshot on-change, MUST load that model's catalog controls for the connected pedal, and MUST send a model write for the current patch through the open link. Changing a known control value MUST update the snapshot on-change. Slider drags MUST coalesce control writes (throttle, flush on release) so Bluetooth is not flooded with one SET per intermediate value. Toggles MUST send on-change. Both writes MUST use the parameter-write SET family (path `01 01 04`, CRC-8 + nibble-expand), not live notify path `01 02 04`. The session MUST NOT send extra patch recall or an audio-chain dump solely because a model or control changed. Model and control writes MUST NOT change slot order or on/off by themselves. The session MUST NOT write a model that is not in the catalog for that slot kind and connected pedal. User IR CAB slots and user SnapTone NS slots that are in that catalog MUST be writable the same way as factory models. The session MUST NOT write a control when that slot's model and values are unknown. GP-5 MUST NOT expose EXP model or control writes. When the link can apply live pedal module state (`liveFromPedal`, Bluetooth), inbound live model and live control reports MUST update the snapshot without sending a SET, recall, or dump. USB MUST NOT apply unsolicited inbound parameter reports to the snapshot. Disconnect MUST drop that state.

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
- **AND** no IR file bytes are sent solely because that model changed

#### Scenario: USB user SnapTone NS model write
- **WHEN** a USB session is ready with NS on a factory SnapTone and the user selects SnapTone 03
- **THEN** the snapshot NS model is SnapTone 03
- **AND** a model write is sent on the USB link
- **AND** no SnapTone file bytes are sent solely because that model changed
