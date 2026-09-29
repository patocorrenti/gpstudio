## MODIFIED Requirements

### Requirement: Bluetooth session sends patch recall

While a session is connected over Bluetooth and initial patch identity sync has completed or timed out, Controller MUST offer working patch previous, patch next, and patch select (00–99), the same controls as a USB session. Choosing a patch or stepping previous/next MUST update the session patch and MUST send that patch to the pedal through the device session as a parameter-write SET of packed family `1143` (path `01 01 04`, CRC-8 + nibble-expand; not live notify path `01 02 04` and not official CC 0). After that SET is sent, the session MUST wait for the pedal's command-received ACK for that write (or a short timeout if the ACK does not arrive) before requesting the current-preset dump for that patch. The confirmation dump after the first dump applies MUST still run as specified for patch changes. Connecting MUST NOT send a patch recall message by itself. USB sessions MUST keep sending patch recall through the device session using official CC 0 and MUST NOT wait for that Bluetooth ACK before their dump request.

#### Scenario: Bluetooth connected shows working patch send
- **WHEN** the user is connected over Bluetooth, initial sync has completed or timed out, and opens Controller
- **THEN** patch previous, patch next, and patch select are offered as working controls
- **AND** no patch recall is sent solely because the session connected or Controller opened

#### Scenario: Select a patch over Bluetooth
- **WHEN** the user is connected over Bluetooth and selects patch `42` from the center selector
- **THEN** the label reads `42`
- **AND** the pedal is sent patch 42 through the device session as packed family `1143`
- **AND** that send is not official CC 0

#### Scenario: Bluetooth dump waits for recall ACK
- **WHEN** the user is connected over Bluetooth and selects another patch
- **THEN** the `1143` SET is sent
- **AND** no current-preset dump request is sent for that recall until the command-received ACK arrives or the ACK wait times out
- **AND** after that ACK or timeout, the session still requests the chain dump and still arms the confirmation dump as for other patch changes

#### Scenario: USB patch send unchanged
- **WHEN** the user is connected over USB and selects a patch
- **THEN** that patch is still sent through the device session using official CC 0
- **AND** the session does not wait for a Bluetooth `1143` ACK before requesting the dump
