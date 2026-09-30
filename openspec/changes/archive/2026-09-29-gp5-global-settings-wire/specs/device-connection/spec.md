## MODIFIED Requirements

### Requirement: Connected session reads device global settings

After a USB or Bluetooth session is marked connected, the device session SHALL request the globals dump on the open link for GP-50 and for GP-5. The request MUST NOT block session readiness, MUST NOT wait to finish identity or chain sync, and MUST NOT send patch recall solely to obtain globals. Reload and a newly selected patch MUST NOT re-request the globals dump solely because the patch changed.

When the dump is decoded, the connected snapshot MUST carry the global values that dump provides for the connected model. A missing dump or a timeout MUST leave those values unknown and MUST NOT invent a value that is written to the pedal. Global values are device-wide: a later current-preset dump MUST NOT clear them. Disconnect MUST drop them. The same request shape MUST be used on USB and Bluetooth. UI MUST NOT send raw MIDI.

A GP-50 dump MUST be able to supply input level, No CAB, REC level, BT REC, monitor level, REC mode left, REC mode right, footswitch mode, and master volume. A GP-5 dump MUST be able to supply input level, No CAB, REC level, BT REC, monitor level, screen brightness, and footswitch mode. A GP-5 dump MAY also carry a global-volume byte for codec fidelity, but a GP-5 session MUST NOT expose global volume or master volume as a reachable Global settings field. A GP-5 session MUST NOT expose REC mode left or REC mode right. A GP-5 session MUST NOT expose Patch or Stomp as its footswitch mode. A GP-5 session MUST NOT expose input level, No CAB, REC level, BT REC, monitor level, screen brightness, or footswitch mode by treating a GP-50 globals payload as a GP-5 value. A GP-50 session MUST NOT decode a GP-5 globals payload as GP-50 values.

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

- **WHEN** a GP-5 session becomes connected and the globals dump decodes input level 0, No CAB off, and footswitch mode `0-99`
- **THEN** the snapshot carries input level 0, No CAB off, and footswitch mode `0-99`
- **AND** the session sent the globals request on the open link
- **AND** no patch recall is sent solely because that dump arrived
- **AND** the session does not expose master volume or global volume as a reachable Global settings field

#### Scenario: GP-5 does not inherit GP-50-only globals

- **WHEN** a GP-5 session decodes a globals dump
- **THEN** the snapshot does not expose master volume or REC mode
- **AND** the snapshot does not expose Patch or Stomp as the footswitch mode
- **AND** the snapshot does not expose global volume as a reachable Global settings field

#### Scenario: A GP-50 payload is not a GP-5 globals dump

- **WHEN** a GP-5 session receives a globals payload that only a GP-50 session decodes
- **THEN** that payload does not set GP-5 global values

#### Scenario: Disconnect drops globals

- **WHEN** the user disconnects after global values were loaded
- **THEN** the session no longer carries those global values

### Requirement: Connected session writes global settings immediately

After a USB or Bluetooth session is ready, changing a known global setting MUST update the snapshot on-change and MUST send that write on the open link. The session MUST NOT send patch recall or an audio-chain dump solely because a global changed. A global write MUST NOT mark the working patch modified and MUST NOT change the patch baseline. Slider drags for an exposed level, for master volume (GP-50 only), and for screen brightness MUST coalesce writes (throttle, flush on release). No CAB, REC mode, and footswitch mode MUST send on-change.

GP-50 master volume MUST be official CC 1 with value 0–100, not the relative master step (CC 17). GP-50 footswitch mode MUST be official CC 28, Patch as 0 and Stomp as 127. GP-50 input level, No CAB, REC level, BT REC, monitor level, and REC mode left/right MUST use the parameter-write SET family (path `01 01 04`, CRC-8 + nibble-expand), not live-notify path `01 02 04`, and MUST NOT be sent as a GP-5 write. The session MUST NOT write a global the connected model does not expose.

GP-5 input level, No CAB, REC level, BT REC, monitor level, and screen brightness MUST use that same parameter-write SET family. A GP-5 session MUST NOT write master volume or global volume through Global settings, and MUST NOT send official CC 1 for a GP-5 global edit. GP-5 footswitch mode MUST use that same framing and MUST NOT be official CC 28. A GP-5 BT REC write and a GP-5 monitor-level write MUST NOT reuse the GP-50 effect and flag pair for that row. A GP-5 write MUST NOT be sent on a GP-50 session.

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

#### Scenario: GP-5 input level write is not CC 1

- **WHEN** a GP-5 session has input level 0 and the user sets it to 6
- **THEN** the snapshot input level is 6
- **AND** that change is sent on the open link as a parameter-write SET
- **AND** the pedal is not sent official CC 1 for that edit
- **AND** the working patch is not marked modified

#### Scenario: GP-5 global volume is not CC 1

- **WHEN** a GP-5 session is ready
- **THEN** Global settings does not expose a global-volume or master-volume write
- **AND** no official CC 1 is sent solely as a GP-5 Global settings edit
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

- **WHEN** a GP-5 USB session has input level 0 and an inbound input-level report arrives
- **THEN** the snapshot input level stays 0
