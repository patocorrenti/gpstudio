# tone3000 Specification

## Purpose

Lets a signed-in TONE3000 user pick one NAM A2 model from the TONE3000 catalog and hand that file to the existing SnapTone upload, without a GP Studio account or a GP Studio server.

## Requirements

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

While a pedal session is connected over USB and the shell is showing Pedal as a navigation link, the shell SHALL show an English TONE3000 control in the same desktop header cluster as the connection-status and pedal foot controls. Signed out, the control MUST use a muted dot and the label `Tone3000`. Signed in, the control MUST use a yellow dot and MUST keep the label `Tone3000`. The control MUST NOT appear when the pedal is disconnected, when the link is Bluetooth, inside the narrow-screen menu, or in the native desktop window. Activating it MUST NOT change the current section and MUST NOT send MIDI. When the app has no TONE3000 publishable key, the control MUST NOT appear.

#### Scenario: USB desktop nav shows signed out

- **WHEN** a USB pedal session is connected, Pedal is shown as a navigation link, and the user is signed out of TONE3000
- **THEN** a control labeled `Tone3000` with a muted dot sits in the connection cluster

#### Scenario: Signed in keeps the Tone3000 label

- **WHEN** a USB pedal session is connected, Pedal is shown as a navigation link, and the user is signed in to TONE3000 as `ampuser`
- **THEN** the control uses a yellow dot and shows `Tone3000`

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

### Requirement: Sign-in opens the connector

Activating the signed-out TONE3000 control SHALL open TONE3000 sign-in without a partnership screen. Cancel MUST leave the user signed out. A completed sign-in MUST show the signed-in control. The controller MUST stay mounted. Sign-in MUST NOT send MIDI.

#### Scenario: Signed out opens sign-in

- **WHEN** the user activates the signed-out TONE3000 control
- **THEN** TONE3000 sign-in starts
- **AND** no partnership screen is shown
- **AND** the current section does not change

#### Scenario: Cancel leaves the user signed out

- **WHEN** the user cancels during sign-in
- **THEN** the TONE3000 control stays signed out

#### Scenario: Completed sign-in updates the control

- **WHEN** the user finishes TONE3000 sign-in
- **THEN** the TONE3000 control shows the signed-in state

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

A TONE3000 catalog modal opened for a user SnapTone slot SHALL open on the free-tier tone lists inside the modal. Choosing a tone MUST list that tone's A2 models and MUST show the tone title, gear, the format NAM, and the creator username. Choosing a model MUST download that model and MUST hand the bytes to the same inspection, name, replace, convert, and send path a local `.nam` uses for that slot. The name field MUST start from the model name, keeping at most 10 ASCII letters and digits, or `X` when none remain. The send MUST NOT change which patch is selected. When the tone has no A2 model, the modal MUST say so in English and MUST NOT send. An A1 or otherwise unsupported file MUST show the session's English reason and MUST NOT send. Cancel before a send MUST NOT send. The modal MUST NOT send MIDI except through that existing SnapTone send.

#### Scenario: Catalog stays in the modal

- **WHEN** the user opens TONE3000 for protocol index 62 while signed in
- **THEN** the tone lists are shown inside a modal for slot 62
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

### Requirement: Slot modal lists the signed-in user's tones

While signed in, the catalog modal SHALL offer five English lists in this order: Trending, Latest, My Favorites, Downloaded by Me, and Created by Me. My Favorites, Created by Me, and Downloaded by Me MUST be that user's lists and MUST offer the next page when more tones exist. Trending and Latest MUST show at most ten tones and MUST NOT offer another page. Each row MUST show the tone image when the list provides one, the title, the gear, the format, and the creator username. The list view MUST name TONE3000 and MUST show the signed-in username. A failed list MUST show an English error and MUST NOT download a model or send a SnapTone file. An empty list MUST say so in English and MUST NOT send.

#### Scenario: Trending opens first when nothing is stored

- **WHEN** the user opens the catalog modal while signed in and no list choice is stored
- **THEN** the modal shows the Trending list
- **AND** the view names TONE3000 and shows the signed-in username

#### Scenario: Remembered list returns on reopen

- **WHEN** the user selects My Favorites, closes the modal, and opens it again while signed in
- **THEN** the modal shows My Favorites

#### Scenario: Created by Me can show the next page

- **WHEN** the user selects Created by Me and more created tones exist than the current page
- **THEN** the modal can show the next page
- **AND** that page is still the user's created tones

#### Scenario: Trending stops at ten

- **WHEN** the user selects Trending
- **THEN** the modal shows at most ten tones
- **AND** it does not offer another page

#### Scenario: Empty list explains

- **WHEN** the selected list has no tones
- **THEN** the modal says so in English
- **AND** no SnapTone file is sent

#### Scenario: Failed list does not send

- **WHEN** the selected list cannot be loaded
- **THEN** the modal shows an English error
- **AND** no model is downloaded
- **AND** no SnapTone file is sent

### Requirement: List filters follow the list

My Favorites, Created by Me, and Downloaded by Me SHALL offer a gear filter of All, Amp, and Amp + Cab, and a title search. Trending SHALL offer that gear filter and MUST NOT offer a title search. Latest MUST NOT offer a gear filter or a title search. The modal MUST open with All and an empty title search. Changing the gear or the title MUST reload the current list. Amp MUST show only Amp tones. Amp + Cab MUST show only Amp + Cab tones. All MUST include every gear that list returns. A title search MUST keep tones whose title contains that text.

#### Scenario: Amp filter on favorites

- **WHEN** the user sets the gear filter to Amp on My Favorites
- **THEN** the list shows only Amp tones from the user's favorites

#### Scenario: Title search on downloads

- **WHEN** the user searches Downloaded by Me for `plexi`
- **THEN** the list shows downloaded tones whose title contains `plexi`

#### Scenario: Latest has no filters

- **WHEN** the user selects Latest
- **THEN** the modal does not offer a gear filter or a title search

#### Scenario: Trending has gear and no title search

- **WHEN** the user selects Trending
- **THEN** the modal offers the gear filter
- **AND** it does not offer a title search

### Requirement: Browse all catalog opens a popup

While the lists are showing, the modal SHALL offer a highlighted English Browse all catalog action to the left of the list tabs. Activating it MUST open TONE3000's select catalog in a popup window, limited to NAM tones of gear amp or amp-plus-cab, and MUST NOT embed that catalog in an iframe. The modal MUST stay open on the lists while that window is used. Choosing a tone from that catalog MUST use the same A2 model list and send path as a tone chosen from the lists. Closing the modal MUST close that popup without sending a SnapTone file.

#### Scenario: Browse opens the select catalog in a popup

- **WHEN** the user activates Browse all catalog from the lists
- **THEN** TONE3000's select catalog opens in a popup window
- **AND** the modal stays on the lists

#### Scenario: Closing the modal closes the popup

- **WHEN** the select catalog popup is open and the user closes the catalog modal
- **THEN** that popup is closed
- **AND** no SnapTone file is sent

### Requirement: Signed-out catalog signs in first

Opening the catalog modal while signed out SHALL start the existing TONE3000 sign-in with no partnership screen and MUST NOT show a tone list until sign-in finishes. Cancel MUST leave the user signed out and MUST NOT download or send. A completed sign-in MUST show the remembered list, or Trending when none is stored.

#### Scenario: Signed out opens sign-in

- **WHEN** the user opens the catalog modal while signed out of TONE3000
- **THEN** TONE3000 sign-in starts
- **AND** no partnership screen is shown
- **AND** no tone list is shown

#### Scenario: Cancel stays signed out

- **WHEN** the user cancels during that sign-in
- **THEN** the modal closes
- **AND** the user stays signed out
- **AND** no SnapTone file is sent

#### Scenario: Sign-in then lists

- **WHEN** the user finishes sign-in from that modal and no list choice is stored
- **THEN** the modal shows the Trending list
