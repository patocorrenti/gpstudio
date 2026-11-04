/** USB SnapTone file send. Framing lives in `src/device/snaptone-table.ts`. */

export const SNAP_LEAD_MS = 300;
export const SNAP_FRAME_GAP_MS = 20;
export const SNAP_ACK_MS = 3_000;
export const SNAP_RESEND_LIMIT = 9;

export type SnapSendStatus =
  | { status: "sent" }
  | { status: "cancelled"; sent: boolean }
  | { status: "closed"; sent: boolean }
  | { status: "port"; sent: boolean }
  | { status: "verify"; sent: boolean };

export async function sendSnapFrames(args: {
  frames: Uint8Array[];
  send: (frame: Uint8Array) => Promise<"ok" | "port" | "closed">;
  waitAck: () => Promise<boolean>;
  delay: (ms: number) => Promise<void>;
  aborted: () => boolean;
  stillOpen: () => boolean;
  leadMs: number;
  gapMs: number;
}): Promise<SnapSendStatus> {
  let sent = false;
  if (args.aborted()) {
    return { status: "cancelled", sent };
  }
  await args.delay(args.leadMs);
  if (args.aborted()) {
    return { status: "cancelled", sent };
  }
  if (!args.stillOpen()) {
    return { status: "closed", sent };
  }
  for (const frame of args.frames) {
    let resends = 0;
    for (;;) {
      if (args.aborted()) {
        return { status: "cancelled", sent };
      }
      if (!args.stillOpen()) {
        return { status: "closed", sent };
      }
      const pending = args.waitAck();
      const wrote = await args.send(frame);
      if (wrote !== "ok") {
        return { status: wrote, sent };
      }
      sent = true;
      const accepted = await pending;
      if (accepted) {
        break;
      }
      if (args.aborted()) {
        return { status: "cancelled", sent };
      }
      if (!args.stillOpen()) {
        return { status: "closed", sent };
      }
      if (resends >= SNAP_RESEND_LIMIT) {
        return { status: "verify", sent };
      }
      resends += 1;
    }
    await args.delay(args.gapMs);
  }
  return { status: "sent" };
}
