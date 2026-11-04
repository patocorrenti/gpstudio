# SnapTone hardware checklist

Pato runs this on a pedal. There is no in-browser pass.

- Make a backup before, from Valeton Suite or from GP Studio.
- Upload a NAM capture to an empty user slot and verify the sound and the name.
- Overwrite a user slot.
- Cancel mid-upload and confirm the pedal still works.
- Unplug USB mid-upload.
- Repeat on GP-5 and GP-50.
- Delete a user slot over USB and confirm its name becomes Empty.
- Rename an occupied user slot over USB. The table returns the sanitized name, the selected patch does not change, and a chain label that points at that slot updates. Repeat on the other model only as this check.

## TONE3000

Pato runs this on the production or staging web app, with the publishable key set and a USB pedal. There is no in-browser pass.

- Sign in to Tone3000 once.
- Reopen GP Studio and confirm the yellow dot and the Tone3000 label without the email code. Open the control and confirm the username.
- Open TONE3000 from a user slot and confirm one A2 model takes the existing upload path.
- Bluetooth and the native window do not show the control.
