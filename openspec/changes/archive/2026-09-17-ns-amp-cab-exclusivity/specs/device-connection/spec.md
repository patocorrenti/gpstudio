## ADDED Requirements

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
