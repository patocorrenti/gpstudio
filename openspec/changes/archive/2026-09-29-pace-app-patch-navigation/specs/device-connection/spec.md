## ADDED Requirements

### Requirement: App patch recall waits for chain sync

While a USB or Bluetooth session is ready and the current patch chain is syncing (including while a patch-change confirmation dump is outstanding), an app-initiated patch recall (previous, next, or 00–99 select through the device session) MUST leave the selected index and outbound traffic unchanged: it MUST NOT send patch recall and MUST NOT start another chain-dump request solely because that recall was attempted. Pedal-initiated current-patch reports MAY still update the shown index and retarget the in-flight dump path. When chain sync returns to idle (confirmation applied or refresh timed out), later app recalls MUST send again as usual.

#### Scenario: Select ignored while syncing
- **WHEN** the session is ready, chain sync is syncing after an app recall, and the user selects another patch through the device session
- **THEN** no additional patch recall is sent
- **AND** no additional chain-dump request is started solely because that select ran

#### Scenario: Next ignored while syncing
- **WHEN** the session is ready, chain sync is syncing, and the user activates patch next through the device session
- **THEN** no patch recall is sent solely because next was activated

#### Scenario: Pedal retarget still allowed while syncing
- **WHEN** the session is ready, chain sync is syncing for a pedal load, and the pedal reports a newer current patch
- **THEN** the snapshot shows that newer index
- **AND** the session retargets the in-flight dump path for that index without requiring app recall

## MODIFIED Requirements

### Requirement: Bluetooth session sends patch recall

While a session is connected over Bluetooth and initial patch identity sync has completed or timed out, Controller MUST offer working patch previous, patch next, and patch select (00–99), the same controls as a USB session. Choosing a patch or stepping previous/next MUST update the session patch and MUST send that patch to the pedal through the device session as a parameter-write SET of packed family `1143` (path `01 01 04`, CRC-8 + nibble-expand; not live notify path `01 02 04` and not official CC 0), except when app patch recall is blocked because chain sync is syncing. After a `1143` SET is sent for an allowed recall, the session MUST wait for the pedal's command-received ACK for that write (or a short timeout if the ACK does not arrive) before requesting the current-preset dump for that patch. The confirmation dump after the first dump applies MUST still run as specified for patch changes. Connecting MUST NOT send a patch recall message by itself. USB sessions MUST keep sending patch recall through the device session using official CC 0 and MUST NOT wait for that Bluetooth ACK before their dump request.

#### Scenario: Bluetooth connected shows working patch send
- **WHEN** the user is connected over Bluetooth, initial sync has completed or timed out, and opens Controller
- **THEN** patch previous, patch next, and patch select are offered as working controls
- **AND** no patch recall is sent solely because the session connected or Controller opened

#### Scenario: Select a patch over Bluetooth
- **WHEN** the user is connected over Bluetooth, chain sync is idle, and selects patch `42` from the center selector
- **THEN** the label reads `42`
- **AND** the pedal is sent patch 42 through the device session as packed family `1143`
- **AND** that send is not official CC 0

#### Scenario: Bluetooth dump waits for recall ACK
- **WHEN** the user is connected over Bluetooth, chain sync is idle, and selects another patch
- **THEN** the `1143` SET is sent
- **AND** no current-preset dump request is sent for that recall until the command-received ACK arrives or the ACK wait times out
- **AND** after that ACK or timeout, the session still requests the chain dump and still arms the confirmation dump as for other patch changes

#### Scenario: USB patch send unchanged
- **WHEN** the user is connected over USB, chain sync is idle, and selects a patch
- **THEN** that patch is still sent through the device session using official CC 0
- **AND** the session does not wait for a Bluetooth `1143` ACK before requesting the dump
