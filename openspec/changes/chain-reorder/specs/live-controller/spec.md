## ADDED Requirements

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

### Requirement: Bluetooth pedal chain-order changes update the chain

After initial sync, when the session is on Bluetooth and the pedal reports a chain-order change for the current patch, Controller MUST update the slot order through the device session without sending patch recall or a chain dump solely because that report arrived. On/off for modules that stay in the chain MUST be preserved unless that report also carries on/off. When the session is on USB, Controller MUST keep the last known order even if a live chain-order report arrives.

#### Scenario: Pedal reorders over Bluetooth
- **WHEN** a Bluetooth session is showing RVB last among effects and the pedal reports RVB before DST
- **THEN** Controller shows RVB before DST
- **AND** no patch recall is sent solely because that report arrived

#### Scenario: USB does not follow pedal chain-order reports
- **WHEN** a USB session is showing RVB last among effects and a live chain-order report for RVB before DST arrives
- **THEN** Controller keeps RVB last among effects
