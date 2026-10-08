## MODIFIED Requirements

### Requirement: Connect modal lists USB devices then resolves the model

Activating the disconnected Connect control SHALL open a modal (not a route) with USB and Bluetooth method tabs. The USB tab MUST start USB-MIDI discovery and MUST list discovered USB-MIDI devices and any remembered USB pedals for the user to pick. The USB tab MUST describe a one-way connection that is super responsive and instant. The Bluetooth tab MUST list discovered Bluetooth pedals and any remembered Bluetooth pedals, as specified for that tab. On the web app, choosing a pedal in the browser Bluetooth picker MUST connect when the model is known (or after the existing model ask), as specified for the Bluetooth tab. If the chosen device has a suggested model, the system MUST use that model and MUST NOT ask. If it has none, the system MUST ask GP-5 vs GP-50 before opening the link. The model MUST be known before the session is marked connected. Opening the modal MUST default to the USB tab. Switching tabs MUST NOT by itself connect a USB device.

#### Scenario: Discover then pick a USB device
- **WHEN** the user opens Connect while disconnected
- **THEN** the modal shows USB and Bluetooth tabs
- **AND** the USB tab is selected
- **AND** the USB tab lists available USB-MIDI devices
- **AND** the USB tab states that USB is super responsive and an instant, stable connection
- **AND** the current section does not change

#### Scenario: Known USB model connects without asking
- **WHEN** the user picks a USB device whose label suggests GP-5 or GP-50
- **THEN** the system connects using that model without asking which pedal it is
- **AND** the connected session link mode is USB

#### Scenario: Unknown model is asked before connect
- **WHEN** the user picks a USB or Bluetooth device with no suggested model
- **THEN** the modal asks GP-5 or GP-50
- **AND** the link is opened only after the user chooses a model

#### Scenario: No USB devices
- **WHEN** the USB tab is active, discovery succeeds, finds no USB-MIDI devices, and no USB pedal is remembered
- **THEN** the modal states that none were found
- **AND** the user can retry discovery

#### Scenario: USB discovery fails
- **WHEN** the USB tab is active and MIDI access is denied or MIDI is unavailable
- **THEN** the modal shows an English error
- **AND** the session stays disconnected

### Requirement: Bluetooth tab lists pedals then connects

While the Bluetooth tab is selected, the modal MUST keep the two-way / slower tradeoff copy. It MUST NOT list USB-MIDI devices. If the chosen Bluetooth device has a suggested model, the system MUST use that model and MUST NOT ask. Connecting MUST mark the session connected with Bluetooth link mode. The user MUST be able to retry the scan. On the desktop app, the session MUST stay disconnected until the user picks a device from the modal list.

On the desktop app, selecting the Bluetooth tab MUST scan for nearby pedals and MUST list those pedals together with any remembered Bluetooth pedals.

On the web app, selecting the Bluetooth tab MUST open the browser Bluetooth picker. An interactive scan (including Scan again) MUST open that picker. When the user chooses a pedal there and the label suggests GP-5 or GP-50, the system MUST connect using that model without requiring a second pick from the modal list. When the chosen pedal has no suggested model, the modal MUST ask GP-5 vs GP-50 before connecting. When the user cancels the picker, the modal MUST keep listing remembered Bluetooth pedals and any already-authorized Bluetooth pedals that are still available, and the session MUST stay disconnected until the user picks a device from that list or scans again. The Bluetooth tab MUST NOT offer Connect on startup.

#### Scenario: Desktop Bluetooth scan then pick
- **WHEN** the user selects the Bluetooth tab while disconnected in the desktop app
- **THEN** the modal lists nearby Bluetooth pedals
- **AND** it does not list USB-MIDI devices
- **AND** the modal states that Bluetooth is a two-way connection and slower
- **AND** the session stays disconnected until the user picks a device

#### Scenario: Web Bluetooth picker connects without a second click
- **WHEN** the user runs an interactive Bluetooth scan in the web app and chooses a pedal whose label suggests GP-50 in the browser picker
- **THEN** the system connects using that model without asking which pedal it is
- **AND** the user is not required to pick that pedal again from the modal list
- **AND** the connected session link mode is Bluetooth

#### Scenario: Web Bluetooth picker cancelled keeps authorized list
- **WHEN** the user runs an interactive Bluetooth scan in the web app, cancels the browser picker, and a remembered or already-authorized Bluetooth pedal is available
- **THEN** the modal lists that pedal
- **AND** the session stays disconnected until the user picks a device from that list or scans again

#### Scenario: Remembered Bluetooth pedal does not open the picker
- **WHEN** the user selects the Bluetooth tab in the web app and a remembered Bluetooth pedal is already listed
- **THEN** the browser picker still opens
- **AND** after the user cancels the picker, the modal lists that remembered pedal

#### Scenario: Known Bluetooth model connects without asking
- **WHEN** the user picks a Bluetooth device whose label suggests GP-5 or GP-50 from the modal list
- **THEN** the system connects using that model without asking which pedal it is
- **AND** the connected session link mode is Bluetooth

#### Scenario: No Bluetooth pedals
- **WHEN** the Bluetooth tab is active, discovery succeeds, and finds no matching pedals and none are remembered
- **THEN** the modal states that none were found
- **AND** the user can retry discovery

#### Scenario: Bluetooth discovery fails
- **WHEN** the Bluetooth tab is active and Bluetooth access is denied or Bluetooth is unavailable
- **THEN** the modal shows an English error
- **AND** the session stays disconnected

### Requirement: Connect remembers chosen pedals

The Connect modal MUST remember pedals the user has chosen and MUST show them again on the matching tab after the app is closed and opened, on the web app and on the desktop app. USB remembered pedals MUST appear only on the USB tab. Bluetooth remembered pedals MUST appear only on the Bluetooth tab. Each tab's list MUST be those remembered pedals plus the pedals the current scan found, without listing the same pedal twice. A remembered pedal MUST stay listed when the current scan does not find it.

A pedal is remembered when the user chooses it. On the web app, choosing a pedal in the browser Bluetooth picker MUST remember it when connect starts (known model) or when the user chooses a model after the unknown-model ask. On USB, and on desktop Bluetooth, picking the pedal in the list MUST remember it when the model is known and connect starts. Choosing a model after an unknown-model ask MUST remember that pedal. Leaving the model ask without choosing MUST NOT remember it.

Each remembered pedal MUST offer a remove control. Activating it MUST forget that pedal, MUST clear the startup pedal when that pedal was the startup pedal, and MUST NOT connect. The pedal MUST leave the list until a later scan lists it and the user chooses it again. A pedal that is only in the current scan, and is not remembered, MUST NOT offer that remove control.

Remembered pedals and the USB startup pedal MUST survive restarting the app on this computer. They MUST NOT be sent to a server.

#### Scenario: Web picker remembers without connecting
- **WHEN** the user chooses a pedal in the browser Bluetooth picker and connect starts with a known model
- **THEN** that pedal is remembered for the Bluetooth tab
- **AND** the session connects without requiring a second pick from the modal list

#### Scenario: Remembered pedal is listed on the next launch
- **WHEN** the user has chosen a Bluetooth pedal, closes the app, and opens it again
- **THEN** the Bluetooth tab lists that pedal before the user opens the browser picker again

#### Scenario: Remembered USB pedal stays listed while unplugged
- **WHEN** the user has chosen a USB pedal and later opens Connect while that pedal is not detected
- **THEN** the USB tab still lists that pedal
- **AND** the Bluetooth tab does not list it

#### Scenario: Scan results join the remembered list
- **WHEN** the USB tab has one remembered pedal and discovery finds a different USB pedal
- **THEN** the USB tab lists both

#### Scenario: Remove forgets the pedal
- **WHEN** the user removes a remembered pedal
- **THEN** that pedal leaves the list
- **AND** the session stays disconnected
- **AND** a later scan can list it again
- **AND** choosing it then remembers it again

#### Scenario: Removing the startup pedal clears startup
- **WHEN** the remembered USB pedal the user removes is the startup pedal
- **THEN** the next launch does not try to connect automatically

### Requirement: Optional startup pedal connects on launch

The startup pedal MUST be a USB pedal only. The disconnected Connect scan body MUST NOT show “Always connect this way, don't ask again”. The Bluetooth tab MUST NOT offer a control that sets or clears the startup pedal.

On the USB tab, each listed pedal row MUST show English “Connect on startup” beside a circular Zap toggle. The toggle MUST read as on when that pedal is the startup pedal and off otherwise. Activating an off toggle MUST set that USB pedal as the only startup pedal (with its known model when available) and MUST clear any previous startup pedal. Activating an on toggle MUST clear the startup pedal and MUST leave the remembered list unchanged. The toggle MUST NOT by itself connect. A tooltip on that control MUST explain that the app will try to connect to that pedal when the application opens. The connected panel MUST NOT show Connect on startup.

When a USB startup pedal with a known model is saved, opening the app while disconnected MUST try once to connect to that pedal over USB without opening Connect first. A successful attempt MUST use the same connect success toast as a manual connect. A failed attempt MUST show one English toast that the startup pedal failed or is not connected, MUST open Connect on the USB tab, and MUST NOT also show the manual connect error toast or the pedal-disconnected toast for that same attempt. If the startup pedal has no known model, the app MUST NOT connect automatically and MUST NOT show that failure toast. A stored startup choice for Bluetooth MUST be ignored and MUST NOT trigger a launch connect.

#### Scenario: Checkbox sits above Scan again
- **WHEN** the user opens Connect while disconnected
- **THEN** the scan body does not show “Always connect this way, don't ask again”

#### Scenario: Checking does not connect
- **WHEN** the user turns on Connect on startup for a listed USB pedal and does not pick a pedal to connect
- **THEN** the session stays disconnected

#### Scenario: Next pick becomes the startup pedal
- **WHEN** the user turns on Connect on startup for a listed USB pedal whose label suggests GP-50
- **THEN** that pedal on USB is the startup pedal
- **AND** the session stays disconnected until the user picks a pedal to connect

#### Scenario: Unchecking clears startup only
- **WHEN** a USB startup pedal is saved and the user turns off Connect on startup for that pedal
- **THEN** the next launch does not try to connect automatically
- **AND** that pedal remains in the remembered list

#### Scenario: Favorite star clears startup only
- **WHEN** a USB startup pedal is saved and the user turns off Connect on startup for that pedal via the circular Zap toggle
- **THEN** the next launch does not try to connect automatically
- **AND** that pedal remains in the remembered list

#### Scenario: Launch connects to the startup pedal
- **WHEN** a USB startup pedal with a known model is saved and the user opens the app while that pedal can be opened over USB
- **THEN** the app connects to it over USB without opening Connect first
- **AND** a connect success toast appears after the onboard name-list arrives

#### Scenario: Failed startup opens Connect
- **WHEN** a USB startup pedal is saved and the user opens the app while that pedal cannot be opened
- **THEN** an English toast says the startup pedal failed or is not connected
- **AND** Connect opens on the USB tab
- **AND** the session stays disconnected
- **AND** the browser Bluetooth picker does not open as part of that attempt

#### Scenario: Bluetooth has no Connect on startup
- **WHEN** the Bluetooth tab lists a pedal
- **THEN** that row does not offer Connect on startup

#### Scenario: Stored Bluetooth startup is ignored
- **WHEN** preferences still contain a Bluetooth startup pedal and the user opens the app while disconnected
- **THEN** the app does not try to connect automatically over Bluetooth
