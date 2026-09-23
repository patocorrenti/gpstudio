## ADDED Requirements

### Requirement: Connected session reads device global settings

After a USB or Bluetooth session is marked connected, the device session SHALL request the globals dump on the open link when the connected model has a locked globals read. GP-50 has that read. GP-5 does not, until a GP-5 capture shows the same request is accepted and which shared fields it carries; until then a GP-5 session MUST NOT send the GP-50 globals request. The request MUST NOT block session readiness, MUST NOT wait to finish identity or chain sync, and MUST NOT send patch recall solely to obtain globals. Reload and a newly selected patch MUST NOT re-request the globals dump solely because the patch changed.

When the dump is decoded, the connected snapshot MUST carry the global values that dump provides for the connected model. A missing dump or a timeout MUST leave those values unknown and MUST NOT invent a value that is written to the pedal. Global values are device-wide: a later current-preset dump MUST NOT clear them. Disconnect MUST drop them. The same request shape MUST be used on USB and Bluetooth. UI MUST NOT send raw MIDI.

A GP-50 dump MUST be able to supply input level, No CAB, REC level, BT REC, monitor level, REC mode left, REC mode right, footswitch mode, and master volume. A GP-5 session MUST NOT expose master volume, REC mode left, REC mode right, or footswitch mode. A GP-5 session MUST NOT expose input level, No CAB, REC level, BT REC, or monitor level by treating a GP-50 globals payload as a GP-5 value. A GP-5 session that cannot read those shared values MUST expose no global settings.

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
- **WHEN** a GP-5 session becomes connected and no GP-5 globals read is locked
- **THEN** the session does not send the GP-50 globals request
- **AND** the snapshot exposes no global settings

#### Scenario: GP-5 does not inherit GP-50-only globals
- **WHEN** a GP-5 session decodes a globals dump
- **THEN** the snapshot does not expose master volume, REC mode, or footswitch mode

#### Scenario: Disconnect drops globals
- **WHEN** the user disconnects after global values were loaded
- **THEN** the session no longer carries those global values

### Requirement: Connected session writes global settings immediately

After a USB or Bluetooth session is ready, changing a known global setting MUST update the snapshot on-change and MUST send that write on the open link. The session MUST NOT send patch recall or an audio-chain dump solely because a global changed. A global write MUST NOT mark the working patch modified and MUST NOT change the patch baseline. Slider drags for input level, REC level, BT REC, monitor level, and master volume MUST coalesce writes (throttle, flush on release). No CAB, REC mode, and footswitch mode MUST send on-change.

GP-50 master volume MUST be official CC 1 with value 0–100, not the relative master step (CC 17). GP-50 footswitch mode MUST be official CC 28, Patch as 0 and Stomp as 127. GP-50 input level, No CAB, REC level, BT REC, monitor level, and REC mode left/right MUST use the parameter-write SET family (path `01 01 04`, CRC-8 + nibble-expand), not live-notify path `01 02 04`, and MUST NOT be sent as a GP-5 write. The session MUST NOT write a global the connected model does not expose.

When the link can apply live pedal state (`liveFromPedal`, Bluetooth), an inbound report for an exposed global MUST update that snapshot value and MUST NOT mark the working patch modified. USB MUST NOT apply those inbound reports. Inbound CC 1 and CC 28 MUST NOT update the audio chain.

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
