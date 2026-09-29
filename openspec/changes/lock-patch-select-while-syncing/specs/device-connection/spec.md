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
