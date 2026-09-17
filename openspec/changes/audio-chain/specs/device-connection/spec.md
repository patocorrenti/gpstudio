## ADDED Requirements

### Requirement: Connected session syncs the current audio chain

After a USB or Bluetooth session is marked connected, the device session SHALL request the current patch's audio-chain dump on the open link after patch identity (names and current index) or when that identity step times out. The connected snapshot MUST carry the current chain (module order and on/off) when a dump is decoded. If the dump times out or SysEx is unavailable, the session MUST still become ready after patch identity and MUST NOT send patch recall solely because the dump was missing. The chain request MAY continue in the background after the session is ready. After the session is ready, choosing a patch or a pedal-initiated patch report MUST refresh the chain for that patch without sending extra patch recall solely to obtain the dump. Disconnect MUST drop chain state.

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

#### Scenario: Pedal patch change refreshes the chain
- **WHEN** the session is ready and the pedal reports a new current patch
- **THEN** the session requests or applies a chain dump for that patch
- **AND** no patch recall is sent solely because that inbound report arrived

## MODIFIED Requirements

### Requirement: Connected chrome stays up during patch sync

After a USB or Bluetooth session is marked connected, the chrome connection control MUST keep showing the connected endpoint's label while initial patch identity and audio-chain sync is in progress. Activating it SHALL still reopen the connection modal. Disconnect MUST remain available during sync. Sync MUST NOT by itself send patch recall.

#### Scenario: USB chrome during sync
- **WHEN** a USB session is connected and Controller is still syncing patch identity
- **THEN** the chrome control displays the connected endpoint's label
- **AND** the user can open the connection modal and disconnect

#### Scenario: Bluetooth chrome during sync
- **WHEN** a Bluetooth session is connected and Controller is still syncing patch identity
- **THEN** the chrome control displays the connected endpoint's label
- **AND** the user can open the connection modal and disconnect

#### Scenario: USB chrome during chain dump
- **WHEN** a USB session is connected and Controller is still waiting for the audio-chain dump
- **THEN** the chrome control displays the connected endpoint's label
- **AND** the user can open the connection modal and disconnect
