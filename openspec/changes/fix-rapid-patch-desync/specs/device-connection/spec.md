## MODIFIED Requirements

### Requirement: Connected session syncs the current audio chain

After a USB or Bluetooth session is marked connected, the device session SHALL request the current patch's audio-chain dump on the open link after patch identity (names and current index) or when that identity step times out. The connected snapshot MUST carry the current chain (module order and on/off) when a dump is decoded. If the dump times out or SysEx is unavailable, the session MUST still become ready after patch identity and MUST NOT send patch recall solely because the dump was missing. The chain request MAY continue in the background after the session is ready. After the session is ready, choosing a patch or a pedal-initiated patch report MUST refresh the chain for that patch without sending extra patch recall solely to obtain the dump. A decoded dump for that newly selected patch MUST be applied even when its chain equals the chain already shown. The session MUST NOT discard that dump because of that equality.

While a pedal-initiated patch load is in flight (a newer current-patch index has been accepted and its chain dump has not finished applying), a later pedal current-patch report for a different slot MUST retarget that load: the connected snapshot MUST show the latest reported index, the session MUST abandon the previous dump assembly for that load, and the session MUST request one chain dump for the latest slot. The session MUST NOT leave the shown index frozen on an intermediate slot solely because an earlier dump is still outstanding. While an app-initiated patch recall is in flight, a current-patch report for a different slot MUST NOT revert the selected index.

Applying the first dump of a user or pedal patch change MUST arm one confirmation dump of the current patch and MUST NOT send patch recall for it. On USB and on Bluetooth, that first apply MUST keep the patch syncing until the confirmation dump is applied or the refresh times out. Connect, Reload, download, and upload MUST NOT start a confirmation. A confirmation that decodes to the same chain already shown MUST be discarded and MUST leave the shown chain and the held dump unchanged, and MUST end syncing. A confirmation that decodes to a different chain MUST replace the shown chain and the held dump when the working patch is not modified, MUST end syncing, and MUST NOT request another confirmation. A confirmation that arrives after the user has edited the working patch MUST be discarded and MUST end syncing when the overlay was held for confirmation. Disconnect MUST drop chain state.

#### Scenario: USB connect requests the chain
- **WHEN** a USB session becomes connected and SysEx is available
- **THEN** the session requests the current patch audio-chain dump on the USB link
- **AND** no patch recall is sent solely because the session connected

#### Scenario: Bluetooth connect requests the chain
- **WHEN** a Bluetooth session becomes connected
- **THEN** the session requests the current patch audio-chain dump on the Bluetooth link
- **AND** no patch recall is sent solely because the session connected

#### Scenario: Chain dump timeout still becomes ready
- **WHEN** initial sync ends without an audio-chain dump
- **THEN** the session is ready
- **AND** no patch recall is sent solely because the dump was missing

#### Scenario: User patch change refreshes the chain
- **WHEN** the session is ready and the user selects another patch
- **THEN** that patch is sent through the device session
- **AND** the session requests or applies a chain dump for the new patch
- **AND** no extra patch recall is sent solely to obtain that dump

#### Scenario: Identical patch dump is applied
- **WHEN** the session is ready, the user selects another patch, and the dump for that patch decodes to the same chain already shown
- **THEN** the session applies that dump
- **AND** the patch stays syncing until the confirmation dump is applied or the refresh times out
- **AND** download can use that dump once syncing ends
- **AND** no extra patch recall is sent solely to obtain that dump

#### Scenario: Rapid pedal patch reports retarget the load
- **WHEN** the session is ready on USB or Bluetooth, the pedal reports current patch `11`, then `12`, then `13` before the dump for `11` finishes applying
- **THEN** the connected snapshot shows patch `13`
- **AND** the session requests a chain dump for patch `13`
- **AND** no dump for an abandoned intermediate slot is applied as the selected patch after `13` was reported

#### Scenario: App recall ignores a stale current-patch index
- **WHEN** the session is ready, the user selects patch `42`, and a current-patch report for a different slot arrives before that recall dump finishes
- **THEN** the connected snapshot stays on patch `42`
- **AND** the session does not retarget the load to that other slot

#### Scenario: Matching confirmation is discarded
- **WHEN** a user or pedal patch change has applied its dump and the confirmation dump decodes to the same chain already shown
- **THEN** the shown chain stays as it is
- **AND** the patch is no longer syncing
- **AND** no further confirmation dump is requested
- **AND** no patch recall is sent solely because that confirmation arrived

#### Scenario: Mismatched confirmation replaces the chain
- **WHEN** a user or pedal patch change has applied its dump, the working patch is not modified, and the confirmation dump decodes to a different chain
- **THEN** the snapshot shows that confirmation's chain
- **AND** download uses that confirmation dump
- **AND** the patch is no longer syncing
- **AND** no further confirmation dump is requested

#### Scenario: An edit keeps the chain ahead of a confirmation
- **WHEN** a user or pedal patch change has applied its dump, the user edits the working chain, and a confirmation dump then arrives
- **THEN** the edited chain stays on screen
- **AND** the patch is no longer syncing
- **AND** no patch recall is sent solely because that confirmation arrived

#### Scenario: USB and Bluetooth hold syncing through confirmation
- **WHEN** a user or pedal patch change has applied its first dump on USB or on Bluetooth and the confirmation dump has not arrived yet
- **THEN** the patch stays syncing
- **AND** no further confirmation dump is requested until that one completes or the refresh times out

#### Scenario: Reload does not start a confirmation
- **WHEN** the user reloads the selected patch and that reload dump is applied
- **THEN** no confirmation dump is requested solely because Reload ran

#### Scenario: Pedal identical patch dump is applied
- **WHEN** the session is ready, the pedal reports a new current patch, and the dump for that patch decodes to the same chain already shown
- **THEN** the session applies that dump
- **AND** the patch stays syncing until the confirmation dump is applied or the refresh times out
- **AND** no patch recall is sent solely because that inbound report arrived

#### Scenario: Pedal patch change refreshes the chain
- **WHEN** the session is ready and the pedal reports a new current patch
- **THEN** the session requests or applies a chain dump for that patch
- **AND** no patch recall is sent solely because that inbound report arrived

#### Scenario: Lost link during a patch change disconnects
- **WHEN** the session is ready, the user selects another patch, and the open USB or Bluetooth link is gone
- **THEN** the session becomes disconnected
- **AND** the chrome control reads Connect
