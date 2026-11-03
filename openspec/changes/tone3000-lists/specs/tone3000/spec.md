## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Slot modal lists the signed-in user's tones

While signed in, the catalog modal SHALL offer five English lists: Favorites, Created, Downloaded, Trending, and Latest. The modal MUST open on Favorites. Favorites, Created, and Downloaded MUST be that user's lists and MUST offer the next page when more tones exist. Trending and Latest MUST show at most ten tones and MUST NOT offer another page. Each row MUST show the tone image when the list provides one, the title, the gear, the format, and the creator username. The list view MUST name TONE3000 and MUST show the signed-in username. A failed list MUST show an English error and MUST NOT download a model or send a SnapTone file. An empty list MUST say so in English and MUST NOT send.

#### Scenario: Favorites opens first

- **WHEN** the user opens the catalog modal while signed in
- **THEN** the modal shows the Favorites list
- **AND** the view names TONE3000 and shows the signed-in username

#### Scenario: Created can show the next page

- **WHEN** the user selects Created and more created tones exist than the current page
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

Favorites, Created, and Downloaded SHALL offer a gear filter of All, Amp, and Amp + Cab, and a title search. Trending SHALL offer that gear filter and MUST NOT offer a title search. Latest MUST NOT offer a gear filter or a title search. The modal MUST open with All and an empty title search. Changing the gear or the title MUST reload the current list. Amp MUST show only Amp tones. Amp + Cab MUST show only Amp + Cab tones. All MUST include every gear that list returns. A title search MUST keep tones whose title contains that text.

#### Scenario: Amp filter on favorites

- **WHEN** the user sets the gear filter to Amp on Favorites
- **THEN** the list shows only Amp tones from the user's favorites

#### Scenario: Title search on downloads

- **WHEN** the user searches Downloaded for `plexi`
- **THEN** the list shows downloaded tones whose title contains `plexi`

#### Scenario: Latest has no filters

- **WHEN** the user selects Latest
- **THEN** the modal does not offer a gear filter or a title search

#### Scenario: Trending has gear and no title search

- **WHEN** the user selects Trending
- **THEN** the modal offers the gear filter
- **AND** it does not offer a title search

### Requirement: Browse TONE3000 stays available

While the lists are showing, the modal SHALL offer an English Browse TONE3000 action. Activating it MUST show TONE3000's select catalog inside the same modal, limited to NAM tones of gear amp or amp-plus-cab. Back MUST return to the lists without sending a SnapTone file. Choosing a tone from that catalog MUST use the same A2 model list and send path as a tone chosen from the lists.

#### Scenario: Browse opens the select catalog

- **WHEN** the user activates Browse TONE3000 from the lists
- **THEN** TONE3000's select catalog is shown inside the same modal

#### Scenario: Back returns to the lists

- **WHEN** the select catalog is showing and the user goes back
- **THEN** the lists are shown again
- **AND** no SnapTone file is sent

### Requirement: Signed-out catalog signs in first

Opening the catalog modal while signed out SHALL show the existing partnership screen before any list. Continuing MUST use the existing TONE3000 sign-in. Cancel MUST leave the user signed out and MUST NOT download or send. A completed sign-in MUST show the Favorites list.

#### Scenario: Signed out sees the partnership first

- **WHEN** the user opens the catalog modal while signed out of TONE3000
- **THEN** the modal shows the partnership screen
- **AND** no tone list is shown

#### Scenario: Cancel stays signed out

- **WHEN** that partnership screen is open and the user cancels
- **THEN** the modal closes
- **AND** the user stays signed out
- **AND** no SnapTone file is sent

#### Scenario: Sign-in then lists

- **WHEN** the user finishes sign-in from that modal
- **THEN** the modal shows the Favorites list
