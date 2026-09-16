## REMOVED Requirements

### Requirement: Bluetooth session does not send control messages

**Reason**: This change adds the Bluetooth control encoder so a Bluetooth session can recall patches the same way USB already does.

**Migration**: Use the added requirement “Bluetooth session sends patch recall”. USB patch recall is unchanged.

## ADDED Requirements

### Requirement: Bluetooth session sends patch recall

While a session is connected over Bluetooth, Controller MUST offer working patch previous, patch next, and patch select (00–99), the same controls as a USB session. Choosing a patch or stepping previous/next MUST update the session patch and send that patch to the pedal through the device session. Connecting MUST NOT send a patch message by itself. USB sessions MUST keep sending patch recall through the device session using official CC 0.

#### Scenario: Bluetooth connected shows working patch send
- **WHEN** the user is connected over Bluetooth and opens Controller
- **THEN** patch previous, patch next, and patch select are offered as working controls
- **AND** no patch is sent solely because the session connected or Controller opened

#### Scenario: Select a patch over Bluetooth
- **WHEN** the user is connected over Bluetooth and selects patch `42` from the center selector
- **THEN** the label reads `42`
- **AND** the pedal is sent patch 42 through the device session

#### Scenario: USB patch send unchanged
- **WHEN** the user is connected over USB and selects a patch
- **THEN** that patch is still sent through the device session using official CC 0
