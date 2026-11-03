## ADDED Requirements

### Requirement: User SnapTone row opens TONE3000 for that slot

In the SnapTone modal, a user row (protocol indices 50–79) SHALL offer an English TONE3000 action beside the disk upload when the session reports that the open link can accept a SnapTone file and the shell is showing the TONE3000 control. Activating it MUST open the TONE3000 catalog modal for that protocol index. Factory rows MUST NOT offer it. The native desktop window MUST NOT offer it. When the session reports that the open link cannot accept a SnapTone file, the row MUST NOT offer it, and the modal MUST keep the existing English explanation and MUST NOT start a TONE3000 download or a send. A TONE3000 send MUST follow the SnapTone file modal's replace ask, progress, cancel, and success rules for that slot. Disk upload, delete, and rename on the row MUST stay available as they are today. Controller MUST NOT send raw MIDI.

#### Scenario: User row offers TONE3000 on USB

- **WHEN** a USB session can accept a SnapTone file and the SnapTone modal lists protocol index 62
- **THEN** that row offers TONE3000 beside the disk upload

#### Scenario: Factory row has no TONE3000 action

- **WHEN** the SnapTone modal lists factory index 10
- **THEN** that row does not offer TONE3000

#### Scenario: Native window does not offer TONE3000

- **WHEN** the SnapTone modal is open in the native desktop window on a USB link that can accept a SnapTone file
- **THEN** no row offers TONE3000

#### Scenario: Bluetooth explains and does not offer TONE3000

- **WHEN** the session reports that the open link cannot accept a SnapTone file and the user opens the SnapTone modal
- **THEN** the modal explains that in English
- **AND** no row offers TONE3000
- **AND** no TONE3000 download or SnapTone file is sent

#### Scenario: TONE3000 send asks before replacing a capture

- **WHEN** protocol index 62 holds a capture named `MyAmp` and the user confirms a TONE3000 model for that slot
- **THEN** the modal asks to replace index 62, `MyAmp`, before the send
- **AND** the ask does not list patches

#### Scenario: Disconnect closes the TONE3000 catalog

- **WHEN** the user disconnects while the TONE3000 catalog modal is open from a SnapTone row
- **THEN** that modal closes
