## ADDED Requirements

### Requirement: Connect reports status with a toast

When the user connects a USB or Bluetooth pedal through the device session, the shell MUST show an English toast with a loading spinner while the link is opening, then a success toast when the session is connected or an error toast if connect fails. A failed connect MUST leave the session disconnected. The Connect modal MUST still close after a successful connect. Discovery errors on the USB or Bluetooth tab MUST keep using the modal's English error and MUST NOT by themselves emit a connect toast. The same toast behavior MUST be used on USB and Bluetooth.

#### Scenario: USB connect shows loading then success
- **WHEN** the user picks a USB device whose label suggests GP-5 or GP-50
- **THEN** a toast shows a loading spinner while the link opens
- **AND** a success toast appears when the session is connected
- **AND** the connected session link mode is USB
- **AND** the Connect modal closes

#### Scenario: Bluetooth connect shows loading then success
- **WHEN** the user picks a Bluetooth device whose label suggests GP-5 or GP-50
- **THEN** a toast shows a loading spinner while the link opens
- **AND** a success toast appears when the session is connected
- **AND** the connected session link mode is Bluetooth
- **AND** the Connect modal closes

#### Scenario: Failed connect shows an error toast
- **WHEN** the user picks a device and opening the link fails
- **THEN** the loading toast becomes an English error toast
- **AND** the session stays disconnected
- **AND** the Connect modal stays open so the user can retry

### Requirement: Disconnect reports status and closes the Connect modal

When a connected session becomes disconnected, the shell MUST show an English toast that the pedal disconnected, and the Connect modal MUST close if it is open. That MUST happen when the user disconnects from the modal and when the open USB or Bluetooth link is lost. After disconnect the chrome control MUST read Connect. Disconnect MUST still close the active link through the device session. The same behavior MUST be used on USB and Bluetooth.

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
