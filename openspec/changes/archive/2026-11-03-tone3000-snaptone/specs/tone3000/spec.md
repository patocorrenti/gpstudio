## Purpose

Lets a signed-in TONE3000 user pick one NAM A2 model from the TONE3000 catalog and hand that file to the existing SnapTone upload, without a GP Studio account or a GP Studio server.

## ADDED Requirements

### Requirement: TONE3000 session survives leaving the app

GP Studio SHALL keep a TONE3000 session for the browser profile after the user signs in. The session MUST still be signed in after the user closes and reopens GP Studio, after they move between sections, and after the pedal disconnects. The session MUST be refreshed when its access has expired so the user is not asked to sign in again on that reopen. A failed refresh MUST leave the user signed out. Disconnect on the status modal MUST sign the user out and MUST keep them signed out on the next launch. Signing out MUST NOT disconnect the pedal. The session MUST be the user's own TONE3000 account. GP Studio MUST NOT send MIDI because a TONE3000 session changed.

#### Scenario: Reopen stays signed in

- **WHEN** the user has signed in to TONE3000, closes GP Studio, and opens it again with a USB pedal connected
- **THEN** the TONE3000 control shows the signed-in state
- **AND** the user is not asked for the TONE3000 email code solely because the app was reopened

#### Scenario: Pedal disconnect keeps the session

- **WHEN** the user is signed in to TONE3000 and then disconnects the pedal
- **THEN** a later USB connection still shows the signed-in state
- **AND** the pedal disconnect did not sign them out

#### Scenario: Disconnect signs out

- **WHEN** the user activates Disconnect on the TONE3000 status modal
- **THEN** the TONE3000 control shows the signed-out state
- **AND** the pedal stays connected
- **AND** a later launch with a USB pedal connected is still signed out

#### Scenario: Expired session returns to signed out

- **WHEN** a stored TONE3000 session can no longer be refreshed
- **THEN** the TONE3000 control shows the signed-out state
- **AND** no SnapTone file is sent

### Requirement: Shell control shows TONE3000 only on USB

While a pedal session is connected over USB and the shell is showing Pedal as a navigation link, the shell SHALL show an English TONE3000 control immediately before Pedal. Signed out, the control MUST use a muted dot and the label TONE3000. Signed in, the control MUST use a lime dot and the TONE3000 username. The control MUST NOT appear when the pedal is disconnected, when the link is Bluetooth, inside the narrow-screen menu, or in the native desktop window. Activating it MUST NOT change the current section and MUST NOT send MIDI. When the app has no TONE3000 publishable key, the control MUST NOT appear.

#### Scenario: USB desktop nav shows signed out

- **WHEN** a USB pedal session is connected, Pedal is shown as a navigation link, and the user is signed out of TONE3000
- **THEN** a TONE3000 control with a muted dot sits immediately before Pedal

#### Scenario: Signed in shows the username

- **WHEN** a USB pedal session is connected, Pedal is shown as a navigation link, and the user is signed in to TONE3000 as `ampuser`
- **THEN** the TONE3000 control uses a lime dot and shows `ampuser`

#### Scenario: Bluetooth hides the control

- **WHEN** a Bluetooth pedal session is connected
- **THEN** the shell does not show the TONE3000 control

#### Scenario: Disconnected hides the control

- **WHEN** no pedal session is connected
- **THEN** the shell does not show the TONE3000 control

#### Scenario: Narrow menu omits the control

- **WHEN** the shell shows Pedal inside the menu button rather than as a navigation link, and a USB pedal session is connected
- **THEN** that menu does not include TONE3000

#### Scenario: Native window omits the control

- **WHEN** GP Studio is open in the native desktop window and a USB pedal session is connected
- **THEN** the shell does not show the TONE3000 control

### Requirement: Sign-in stays inside a modal

Activating the signed-out TONE3000 control SHALL open a modal on the current section. The modal MUST first show an English partnership screen that names GP Studio and TONE3000. Continuing MUST show TONE3000's own sign-in inside that modal. Cancel MUST close the modal and leave the user signed out. A completed sign-in MUST close the modal and show the signed-in control. The controller MUST stay mounted. The modal MUST NOT send MIDI.

#### Scenario: Partnership screen before sign-in

- **WHEN** the user activates the signed-out TONE3000 control
- **THEN** a modal opens on the current section
- **AND** the modal names the GP Studio and TONE3000 partnership in English
- **AND** the current section does not change

#### Scenario: Cancel leaves the user signed out

- **WHEN** the sign-in modal is open and the user cancels
- **THEN** the modal closes
- **AND** the TONE3000 control stays signed out

#### Scenario: Completed sign-in updates the control

- **WHEN** the user finishes TONE3000 sign-in inside the modal
- **THEN** the modal closes
- **AND** the TONE3000 control shows the signed-in username

### Requirement: Signed-in control opens status

Activating the signed-in TONE3000 control SHALL open a modal that shows the TONE3000 username and an English Disconnect action. The modal MUST NOT open the catalog. Cancel MUST leave the session signed in.

#### Scenario: Status shows the username

- **WHEN** the user is signed in as `ampuser` and activates the TONE3000 control
- **THEN** a modal shows `ampuser` and Disconnect
- **AND** the catalog is not shown

#### Scenario: Cancel keeps the session

- **WHEN** the status modal is open and the user closes it without Disconnect
- **THEN** the TONE3000 control stays signed in

### Requirement: Catalog modal returns one A2 model

A TONE3000 catalog modal opened for a user SnapTone slot SHALL show TONE3000's catalog inside the modal, limited to NAM tones of gear amp or amp-plus-cab that have an A2 model. Choosing a tone MUST list that tone's A2 models and MUST show the tone title, gear, the format NAM, and the creator username. Choosing a model MUST download that model and MUST hand the bytes to the same inspection, name, replace, convert, and send path a local `.nam` uses for that slot. The name field MUST start from the model name, keeping at most 10 ASCII letters and digits, or `X` when none remain. The send MUST NOT change which patch is selected. When the tone has no A2 model, the modal MUST say so in English and MUST NOT send. An A1 or otherwise unsupported file MUST show the session's English reason and MUST NOT send. Cancel before a send MUST NOT send. The modal MUST NOT send MIDI except through that existing SnapTone send.

#### Scenario: Catalog stays in the modal

- **WHEN** the user opens the TONE3000 catalog for protocol index 62
- **THEN** the catalog is shown inside a modal for slot 62
- **AND** the controller section stays mounted

#### Scenario: Chosen tone lists A2 models

- **WHEN** the user chooses a NAM amp tone that has A2 models
- **THEN** the modal lists those A2 models
- **AND** the modal shows the tone title, the gear, NAM, and the creator username

#### Scenario: Chosen model uses the SnapTone send

- **WHEN** the user chooses an A2 model for protocol index 62 and confirms the send under the SnapTone file rules for that slot
- **THEN** the modal runs the same convert and send path as a local `.nam` for index 62
- **AND** the selected patch does not change

#### Scenario: Tone with no A2 model does not send

- **WHEN** the user chooses a tone that has no A2 model
- **THEN** the modal explains that in English
- **AND** no SnapTone file is sent

#### Scenario: Unsupported model does not send

- **WHEN** a downloaded model is A1 or otherwise unsupported
- **THEN** the modal shows the session's English reason
- **AND** no SnapTone file is sent

#### Scenario: Cancel before send sends nothing

- **WHEN** the user closes the catalog modal before confirming a send
- **THEN** no SnapTone file is sent
