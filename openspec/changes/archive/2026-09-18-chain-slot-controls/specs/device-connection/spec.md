## ADDED Requirements

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
