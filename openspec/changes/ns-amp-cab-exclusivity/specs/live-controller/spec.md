## ADDED Requirements

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
