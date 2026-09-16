## Purpose

Reads the current GP-5/GP-50 preset from the USB SysEx dump the pedal sends when a patch is loaded, applies it to the device session, and shows that state on Controller.

## ADDED Requirements

### Requirement: A complete dump updates the current preset

When a connected session receives a complete USB SysEx preset dump, the system SHALL decode it and update the current preset snapshot (patch slot 00–99, and name and module on/off once those fields are mapped). An incomplete or interrupted dump MUST NOT replace a previous complete snapshot. Toggling an effect on the pedal without a new dump MUST NOT change the snapshot. The UI MUST apply dumps through the device session, never by parsing MIDI in React.

#### Scenario: Pedal load fills the slot
- **WHEN** the user loads a patch on the pedal and a complete dump arrives
- **THEN** the session patch slot matches that preset
- **AND** Controller shows that two-digit slot

#### Scenario: Incomplete dump is ignored
- **WHEN** inbound SysEx stops before the dump is complete
- **THEN** the session keeps the previous preset snapshot

#### Scenario: In-patch hardware edits do not stream
- **WHEN** the user toggles an effect on the pedal and no dump arrives
- **THEN** the session snapshot does not change

### Requirement: Connect requests a dump without guessing CC 0

Connecting MUST NOT send CC 0 solely to guess the current patch. Once a dump-request SysEx is identified from Patone captures, connecting MUST send that request. Until it is identified, the snapshot stays unknown until the first complete dump (hardware load or an app patch change that triggers a dump).

#### Scenario: Connect does not stomp the pedal
- **WHEN** a session becomes connected
- **THEN** no patch CC is sent just because the session connected

#### Scenario: Known request on connect
- **WHEN** a dump-request SysEx is known and the user connects
- **THEN** the system requests a dump
- **AND** a complete reply updates the snapshot as in the dump requirement

### Requirement: Controller shows dump-derived state

While connected, after the first complete dump, Controller MUST show the dump-derived patch slot. When the name field is mapped, Controller MUST show that name in the patch selector. When module on/off fields are mapped, Controller MUST show those module states. Until a dump has been applied, Controller MAY show that the preset is not yet read rather than a fake `00`.

#### Scenario: Slot after dump
- **WHEN** a complete dump for patch `42` has been applied
- **THEN** the Controller patch label reads `42`

#### Scenario: Unknown before first dump
- **WHEN** the user is connected and no complete dump has been applied yet
- **THEN** Controller does not present `00` as if it were the pedal's current patch
