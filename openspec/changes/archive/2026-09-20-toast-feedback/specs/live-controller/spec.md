## ADDED Requirements

### Requirement: Patch store and upload report status with toasts

After the patch bar is shown, Save, rename, duplicate, and a confirmed upload MUST each show an English toast with a loading spinner while that action runs through the device session, then a success toast when it completes or an error toast if it fails. Labels MUST be in English. Those toasts MUST NOT send raw MIDI from React. The same toast behavior MUST be used on USB and Bluetooth.

After a successful upload, the success toast MUST offer an English Save action for the current slot. Activating that Save MUST store the current working patch on the pedal in the current slot through the device session. The toast MUST NOT store the patch solely because upload succeeded. Dismissing the toast without activating Save MUST NOT send a store write. Rename, duplicate, and upload confirm Dialogs, and the English error Dialog for an invalid or wrong-model file, MUST stay as Dialogs. Download MUST NOT emit a toast.

If the session becomes disconnected while Save, rename, duplicate, or upload is in progress, that action's toast MUST become an error toast. The disconnect toast defined by device-connection MUST still appear, and the Connect modal MUST still close.

#### Scenario: Save shows loading then success
- **WHEN** the session is ready, the current patch is synced, Save is usable, and the user activates Save
- **THEN** a toast shows a loading spinner while the store runs
- **AND** a success toast appears when the current working patch is stored on the pedal in the current slot through the device session
- **AND** the selected patch does not change

#### Scenario: Rename shows loading then success
- **WHEN** the session is ready, the current patch is synced, and the user confirms a rename
- **THEN** a toast shows a loading spinner while the rename runs
- **AND** a success toast appears when that name change is sent through the device session

#### Scenario: Duplicate shows loading then success
- **WHEN** the session is ready, the current patch is synced, and the user confirms duplicate onto another slot
- **THEN** a toast shows a loading spinner while the duplicate runs
- **AND** a success toast appears when the current working patch is stored on the destination slot through the device session
- **AND** the selected patch does not change

#### Scenario: Failed store shows an error toast
- **WHEN** the user activates Save, rename, or duplicate and that store fails
- **THEN** the loading toast becomes an English error toast

#### Scenario: Confirmed upload shows loading then success with Save
- **WHEN** the session is ready, the current patch is synced, and the user confirms upload of a valid Valeton `.prst` for the connected model
- **THEN** a toast shows a loading spinner while the file is applied onto the working patch through the device session
- **AND** a success toast appears when that apply completes
- **AND** that success toast offers Save
- **AND** no store write is sent solely because upload ran
- **AND** the selected patch does not change

#### Scenario: User Saves from the upload toast
- **WHEN** a successful upload toast is showing Save and the user activates Save on that toast
- **THEN** the current working patch is stored on the pedal in the current slot through the device session
- **AND** a toast reports that Save

#### Scenario: User dismisses the upload toast without Save
- **WHEN** a successful upload toast is showing Save and the user dismisses it without activating Save
- **THEN** no store write is sent solely because the toast was dismissed

#### Scenario: Failed upload shows an error toast
- **WHEN** the user confirms upload and applying the file fails
- **THEN** the loading toast becomes an English error toast
- **AND** that toast does not offer Save

#### Scenario: Invalid file still uses the error Dialog
- **WHEN** the session is ready and the user picks a file that is not a valid Valeton `.prst`
- **THEN** Controller shows an English error Dialog
- **AND** no upload toast is shown
- **AND** no upload write is sent

#### Scenario: Download does not toast
- **WHEN** the session is ready with a current-preset dump and the user activates download
- **THEN** a Valeton `.prst` is produced through the device session
- **AND** no toast is shown solely because download ran
