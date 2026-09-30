## ADDED Requirements

### Requirement: Connect awaits the onboard name-list

Opening a USB-MIDI or Bluetooth link MUST request the onboard patch name-list through the device session. The connect operation MUST NOT succeed until that name-list response is received. While waiting, the shell MUST keep the connect loading state (spinner toast). Current-patch identity and the audio-chain dump MUST still run after a successful name-list as today, and MUST NOT block the connect success toast.

If the name-list does not arrive within the existing name-list wait for that link mode, connect MUST fail: the session MUST disconnect, and the connect error MUST be an English message. On USB that message MUST tell the user to verify the pedal is powered on. On Bluetooth that message MUST state that the pedal did not respond with patch names. The system MUST NOT treat a missing name-list as a successful connect with empty names. USB discovery MUST still list MIDI endpoints without probing power state before open.

#### Scenario: USB connect succeeds after name-list
- **WHEN** the user connects a USB pedal and the onboard name-list arrives
- **THEN** connect succeeds
- **AND** the session remains connected with USB link mode
- **AND** current-patch identity and the chain dump may still continue afterward

#### Scenario: Bluetooth connect succeeds after name-list
- **WHEN** the user connects a Bluetooth pedal and the onboard name-list arrives
- **THEN** connect succeeds
- **AND** the session remains connected with Bluetooth link mode
- **AND** current-patch identity and the chain dump may still continue afterward

#### Scenario: USB silent name-list fails connect with power hint
- **WHEN** the user connects a USB pedal and no onboard name-list arrives before the name-list wait ends
- **THEN** connect fails with an English error telling the user to verify the pedal is powered on
- **AND** the session is disconnected

#### Scenario: Bluetooth silent name-list fails connect
- **WHEN** the user connects a Bluetooth pedal and no onboard name-list arrives before the name-list wait ends
- **THEN** connect fails with an English error that the pedal did not respond with patch names
- **AND** the session is disconnected

#### Scenario: USB scan does not probe power
- **WHEN** the USB tab lists devices
- **THEN** discovery does not open links or send identity solely to filter powered-off pedals

## MODIFIED Requirements

### Requirement: Connect reports status with a toast

When the user connects a USB or Bluetooth pedal through the device session, the shell MUST close the Connect modal as soon as that connect attempt starts, MUST show an English toast with a loading spinner while the link opens and while the session waits for the onboard name-list, then a success toast only after that name-list has arrived, or an error toast if connect fails (including a missing name-list). A failed connect MUST leave the session disconnected. Discovery errors on the USB or Bluetooth tab MUST keep using the modal's English error and MUST NOT by themselves emit a connect toast. The same toast behavior MUST be used on USB and Bluetooth for loading and success timing; the USB missing-name-list error text MAY differ from Bluetooth as required for the power-on hint.

#### Scenario: USB connect shows loading then success
- **WHEN** the user picks a USB device whose label suggests GP-5 or GP-50 and the onboard name-list arrives
- **THEN** the Connect modal closes as soon as connect starts
- **AND** a toast shows a loading spinner while the link opens and names are awaited
- **AND** a success toast appears only after that name-list arrives
- **AND** the connected session link mode is USB

#### Scenario: Bluetooth connect shows loading then success
- **WHEN** the user picks a Bluetooth device whose label suggests GP-5 or GP-50 and the onboard name-list arrives
- **THEN** the Connect modal closes as soon as connect starts
- **AND** a toast shows a loading spinner while the link opens and names are awaited
- **AND** a success toast appears only after that name-list arrives
- **AND** the connected session link mode is Bluetooth

#### Scenario: Failed connect shows an error toast
- **WHEN** the user picks a device and opening the link fails
- **THEN** the Connect modal has already closed when connect started
- **AND** the loading toast becomes an English error toast
- **AND** the session stays disconnected

#### Scenario: USB missing name-list error toast
- **WHEN** the user picks a USB device and no onboard name-list arrives before the wait ends
- **THEN** the Connect modal has already closed when connect started
- **AND** the loading toast becomes an English error toast telling the user to verify the pedal is powered on
- **AND** the session stays disconnected
- **AND** no success toast appears for that attempt

#### Scenario: Bluetooth missing name-list error toast
- **WHEN** the user picks a Bluetooth device and no onboard name-list arrives before the wait ends
- **THEN** the Connect modal has already closed when connect started
- **AND** the loading toast becomes an English error toast that the pedal did not respond with patch names
- **AND** the session stays disconnected
- **AND** no success toast appears for that attempt

### Requirement: Disconnect reports status and closes the Connect modal

When a connected session becomes disconnected after a successful connect, the shell MUST show an English toast that the pedal disconnected, and the Connect modal MUST close if it is open. That MUST happen when the user disconnects from the modal and when the open USB or Bluetooth link is lost. After disconnect the chrome control MUST read Connect. Disconnect MUST still close the active link through the device session. The same behavior MUST be used on USB and Bluetooth. A connect attempt that fails after opening the link (including a missing name-list) MUST leave the session disconnected and MUST NOT emit that pedal-disconnected toast; the connect error toast covers that failure.

#### Scenario: User disconnect closes the modal
- **WHEN** the user disconnects a connected USB or Bluetooth session from the connection modal
- **THEN** the USB-MIDI or Bluetooth link is closed
- **AND** an English toast reports that the pedal disconnected
- **AND** the Connect modal closes
- **AND** the chrome control reads Connect

#### Scenario: Lost link closes the modal
- **WHEN** a session is connected, the Connect modal is open, and the open USB or Bluetooth link is gone
- **THEN** the session becomes disconnected
- **AND** an English toast reports that the pedal disconnected
- **AND** the Connect modal closes
- **AND** the chrome control reads Connect

#### Scenario: Lost link toasts when the modal is closed
- **WHEN** a session is connected, the Connect modal is closed, and the open USB or Bluetooth link is gone
- **THEN** the session becomes disconnected
- **AND** an English toast reports that the pedal disconnected
- **AND** the chrome control reads Connect

#### Scenario: Failed connect abort does not toast disconnect
- **WHEN** a connect attempt opens the link then fails because the onboard name-list never arrives
- **THEN** the session is disconnected
- **AND** the connect error toast is shown
- **AND** no pedal-disconnected toast is shown solely because that failed attempt closed the link
