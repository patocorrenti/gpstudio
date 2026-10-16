## ADDED Requirements

### Requirement: Controller offers patch A/B setup

After the patch bar is shown, Controller SHALL offer an A/B control at the left of that bar, before previous. Its tooltip MUST read `A/B Test - Patches`. Activating it MUST open A/B setup on the same bar and MUST NOT send patch recall. While A/B setup is open and the cycle is not running, the bar MUST show, from left to right: an X that closes the setup, previous, the current-patch selector, next, a seconds input, a comparison-patch selector, and Play. The tooltip on X MUST read `Close A/B test`.

While that setup is open, Controller MUST NOT show Save, Options, Reload, P-Vol, or BPM, and MUST NOT offer rename, duplicate, download, or upload. Previous, the current-patch selector, and next MUST keep their existing recall, wrap, unsaved-changes tooltip, and chain-sync lock. The seconds input MUST show an integer dwell from 2 through 200 and MUST show 5 when the setup opens. Clearing the field while editing MUST be allowed; blur or Play MUST resolve an empty value to 5 and clamp out-of-range values into that range. The comparison selector MUST list patches `00`–`99` with the same index and onboard-name labeling as the current-patch selector, and MUST show the next slot after the current patch when the setup opens, wrapping from `99` to `00`. Changing the comparison slot or the seconds input MUST NOT change the selected patch and MUST NOT send patch recall. Choosing the comparison slot equal to the current patch MUST leave Play unusable. Closing with X MUST restore the normal patch bar and MUST NOT send patch recall. Disconnecting MUST hide the bar and leave A/B setup closed. The same setup MUST be used on USB and Bluetooth. Controller MUST NOT send raw MIDI.

#### Scenario: A/B control sits at the left of the bar

- **WHEN** the patch bar is shown and A/B setup is closed
- **THEN** an A/B control is shown before previous
- **AND** its tooltip reads `A/B Test - Patches`
- **AND** Save, Options, Reload, P-Vol, and BPM stay on the bar

#### Scenario: Opening setup replaces the action cluster

- **WHEN** the current patch is `10` and the user activates A/B
- **THEN** the bar shows X, previous, the current-patch selector, next, a seconds input reading 5, a comparison selector reading `11`, and Play
- **AND** Save, Options, Reload, P-Vol, and BPM are not shown
- **AND** no patch recall is sent solely because the setup opened

#### Scenario: Comparison slot wraps from 99

- **WHEN** the current patch is `99` and the user activates A/B
- **THEN** the comparison selector reads `00`
- **AND** the current patch stays `99`

#### Scenario: Current-patch navigation still recalls

- **WHEN** A/B setup is open, the cycle is not running, the chain is idle, and the user selects patch `42` from the current-patch selector
- **THEN** the current-patch selector reads `42`
- **AND** the pedal is sent patch 42 through the device session
- **AND** the comparison selector does not change

#### Scenario: Comparison selector does not recall

- **WHEN** A/B setup is open on patch `10` with comparison slot `11` and the user selects comparison slot `20`
- **THEN** the comparison selector reads `20`
- **AND** the current patch stays `10`
- **AND** no patch recall is sent

#### Scenario: Same slot disables Play

- **WHEN** A/B setup is open and the comparison slot is the same index as the current patch
- **THEN** Play is not usable
- **AND** no patch recall is sent

#### Scenario: Close restores the normal bar

- **WHEN** A/B setup is open and the user activates X
- **THEN** the normal patch bar is shown, including Save, Options, and the level controls for the connected model
- **AND** the A/B tooltip reads `A/B Test - Patches`
- **AND** no patch recall is sent solely because the setup closed

#### Scenario: USB and Bluetooth share A/B setup

- **WHEN** a USB session and a Bluetooth session are each showing the patch bar
- **THEN** both offer the same A/B control, setup layout, and tooltips

### Requirement: A/B play alternates two patches

While A/B setup is open and Play is usable, activating Play MUST start a cycle and show Stop in place of Play. The cycle MUST capture the current patch as A and the comparison slot as B at that moment. It MUST NOT send patch recall for A when Play starts. After the chain is idle, it MUST wait the captured dwell in seconds, then recall B through the device session. After that recall's chain is idle, it MUST wait the same dwell, then recall A, and MUST repeat that alternation. A chain sync that starts during a dwell MUST cancel that dwell; the next dwell MUST start only once the chain is idle again. The cycle MUST NOT send patch recall while the chain is syncing.

While the cycle is running, previous, next, both selectors, and the seconds input MUST NOT be usable. Stop and X MUST stay usable, including while the chain is syncing, and MUST NOT send patch recall by themselves. Stop MUST end the cycle, leave the pedal on the patch that is loaded, and return the bar to A/B setup with Play. X MUST end the cycle and restore the normal patch bar. Disconnecting MUST end the cycle and hide the bar. Each recall MUST follow the existing patch-change chain refresh. Unsaved working edits MUST be discarded by those recalls the same way as manual navigation, without an extra confirm. The same cycle MUST be used on USB and Bluetooth. Controller MUST NOT send raw MIDI.

#### Scenario: Play dwells on the loaded patch before the first switch

- **WHEN** A/B setup is open, the chain is idle, the current patch is `10`, the comparison slot is `11`, the seconds input is 5, and the user activates Play
- **THEN** Play is replaced by Stop
- **AND** the current patch stays `10` when the cycle starts
- **AND** no patch recall is sent until 5 seconds have passed with the chain idle
- **AND** the pedal is then sent patch 11 through the device session

#### Scenario: The cycle returns to A and continues

- **WHEN** a cycle captured A as `10` and B as `11` with a 5 second dwell, patch `11` is loaded, and that patch's chain is idle
- **THEN** the pedal is sent patch 10 through the device session after 5 idle seconds
- **AND** after patch `10` is idle for 5 seconds the pedal is sent patch 11 again

#### Scenario: Sync delays the next recall

- **WHEN** a cycle is waiting to recall the other slot and the chain is syncing
- **THEN** no patch recall is sent while the chain is syncing
- **AND** the dwell starts once the chain is idle
- **AND** the other slot is recalled only after that full dwell

#### Scenario: Stop leaves the sounding patch

- **WHEN** a cycle is running, patch `11` is loaded, and the user activates Stop
- **THEN** the cycle ends
- **AND** the current patch stays `11`
- **AND** the bar stays in A/B setup and shows Play
- **AND** no patch recall is sent solely because Stop ran

#### Scenario: Close during the cycle restores the normal bar

- **WHEN** a cycle is running and the user activates X
- **THEN** the cycle ends
- **AND** the normal patch bar is shown
- **AND** no patch recall is sent solely because the setup closed

#### Scenario: Stop and close stay usable while the chain syncs

- **WHEN** a cycle recall is in progress and the chain is syncing
- **THEN** previous, next, both selectors, and the seconds input are not usable
- **AND** Stop and X remain usable
- **AND** activating either one does not send another patch recall

#### Scenario: Disconnect ends the cycle

- **WHEN** the user disconnects while a cycle is running
- **THEN** the cycle ends
- **AND** the patch bar is hidden
- **AND** no further patch recall is sent for that cycle

#### Scenario: USB and Bluetooth share the cycle

- **WHEN** a USB session and a Bluetooth session each start a cycle from patch `10` to comparison slot `11`
- **THEN** both alternate those slots through the device session
- **AND** neither sends raw MIDI from Controller
