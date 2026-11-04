## Context

See `proposal.md` for why. Upload already stores a name inside the 2696-byte import (`0x25`). Delete is one USB parameter-write, family `1127`, fxId `0x0F000000` plus the protocol slot, then the same user-slot table read (`12 24`). Both live on the session façade and `src/device/snaptone-table.ts`. The modal is `src/features/controller/SnapToneDialog.tsx`.

Windows Suite delete did not send Android's file command `0x26`. The Android binary also has a rename function, command `0x27` at `0x691010` (`src/snaptone/RESEARCH.md`). That function's body is not the Windows wire. Section 10 of that note locks the rename: one SET, header `02 00`, family `1126`, fxId `0x0F000000 + slot`, 13-byte zero-padded name. Slot 79 `Test79` is the captured wire. After its ACK, Suite sends the follow-up `02 01 03 00 00 00` and waits about 2 s for the pedal notify `12 1B` before reading the slot table. GP Studio sends that follow-up and waits for the notify. It does not send the notify or the globals ask.

## Goals / Non-Goals

**Goals:**

- Lock the host SET from one Windows USB capture, then send that SET from the session.
- Reuse the delete path: one USB frame, the existing busy flag, the existing slot-table refresh, the existing name sanitize.

**Non-Goals:**

- See `proposal.md`. This design does not add a second session, a new route, or a re-upload of the capture.

## Decisions

### 1. Capture before any encoder

**Choice:** The first implementation task records the Windows host bytes in `src/snaptone/RESEARCH.md`. No rename frame is encoded, and no button sends, until those bytes are in that note. A guessed body from the Android `0x27` function is not a stand-in.

**Why:** Delete looked like a 4-byte plus 16-byte Android command and was a short parameter-write on the wire. Sending the Android layout is how a pedal got wedged.

**Alternative:** Encode Android `0x27` and try it on hardware. Rejected.

**Capture.** Yes. It has to be Wireshark with USBPcap, on the Windows PC where Valeton Suite has the pedal open. That is the method in `src/snaptone/RESEARCH.md` (delete, bulk OUT `0x03`).

loopMIDI is not enough. Windows lets Suite own the pedal OUT, so a virtual port only sees the pedal's replies. GP Studio Log cannot see Suite's writes either. usbmon on this Linux machine does not see that Windows OUT.

Do this once, on the pedal at hand (GP-5 or GP-50):

1. Quit GP Studio. Open the pedal in Valeton Suite over USB.
2. Start USBPcap on that pedal and open the capture in Wireshark. The host writes are bulk OUT. The delete capture used endpoint `0x03`; confirm this capture's OUT is the one Suite writes, and record the endpoint.
3. Pick one occupied user row. Count the protocol index from the bottom of the list: the bottom row is slot 79. Write down the model, the index, and the name before the rename.
4. Rename only. Do not upload and do not delete in the same stretch. Leave a short gap between the three renames so the SETs split apart:
   - Letters and digits, at most 10: `RenameMe1`.
   - Punctuation and a space: `Lead Ch$`. Upload already stores that as `LeadCh`. The capture shows whether Suite strips before the SET.
   - Longer than 10 characters: `Abcdefghijkl`.
5. After Suite refreshes the list, write down the name it shows for each.
6. Save the pcap. The note needs the host SysEx for each rename (packed body and `F0`…`F7`), the ACK, and whether Suite then asks for the slot table (`12 24`, wire `F0 03 05 00 01 00 00 00 02 01 02 02 04 F7`).

Stop before encoding if any of these show up:

- The host send contains the 2696-byte file, or more than one SET for a single rename.
- The body has a model-specific field. Capture the other pedal before encoding. Upload and delete use one command for both, so a shared fxId plus a name does not need a second capture first.
- The packed command is the Android file command `0x27`, or the bytes cannot be reimplemented as a GP Studio parameter-write. Stop and ask. Do not paste Suite.

A second model, after the bytes are locked, is a hardware check: rename one occupied slot and confirm the table returns that name. It is not a second research capture unless the first body was model-specific.

### 2. Same session path as delete

**Choice:** Add the encoder next to `encodeUserSnapDelete` in `src/device/snaptone-table.ts`. Add the session method next to `deleteUserSnapTone`. Set `snapFileSend` for the duration, wait for the same style of command ACK the delete waits for, then `verifySnapSlot` against `sanitizeSnapToneName`. Do not add a session sibling and do not send the import frames.

**Why:** Rename is one USB SET in the write family delete already uses. `docs/architecture.md` keeps that on the façade. The modal already treats `snapFileSend` as the busy mask for upload and delete, and it already refreshes `userSnapSlots`, which the chain label reads.

**Alternative:** Re-upload the `.nam` under the new name. Rejected: Suite renames without the file, and GP Studio does not keep the original `.nam`.

**Alternative:** Also request globals, because Suite does that after a delete. Rejected unless this capture shows the new name does not stick without it. The refresh this change needs is the slot table.

### 3. Modal control on occupied rows only

**Choice:** An English Rename control on a user row whose occupancy flag is 0, beside Delete. The editor starts from the current name, strips to letters and digits, and stops at 10 characters, matching the upload field. Cancel sends nothing. Factory rows and `Empty` with a flag other than 0 do not offer it. Bluetooth keeps the existing explanation and does not show the control as a send. Success and the unknown-slot copy follow the delete messages. A port failure uses `The MIDI port cannot be written. Close Valeton Suite and try again.`

**Why:** Empty slots receive a name at upload. Factory names are the catalog. The chain already displays `userSnapSlots`, so a refreshed table updates a patch that points at that protocol index without recall.

## Risks / Trade-offs

- [Wrong SET wedges the pedal] → No bytes leave the app until the pcap is transcribed. Tests assert the transcribed frame and assert the Android `0x27` payload is absent.
- [Suite sanitizes differently from `sanitizeSnapToneName`] → The three renames are the check. If `Lead Ch$` is not `LeadCh` on the wire, amend the delta spec before encoding. Do not keep both rules.
- [ACK shape differs from delete] → Match the captured ACK. Do not reuse the delete waiter unchanged if the reply is a different command.
- [One pedal only] → Shared fxId-plus-name is one encoder. A model byte in the body blocks encoding until the other pedal is captured.

## Migration Plan

No stored data changes. The control ships only with the encoder. Removing the control and the session method restores the modal that can upload and delete.

## Open Questions

- The family id and the name field's offset are unknown until the pcap arrives. They do not change the session shape or the task order.
- Whether an empty typed name becomes `X` on the wire is checked by the sanitize rule. A symbols-only rename is optional in the capture; the spec already requires `X`.
