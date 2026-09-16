import { gp5Cc } from "@/device/cc";
import type { LinkMode } from "@/device/link";

export function encodePatch(_linkMode: LinkMode, patch: number): Uint8Array {
  return new Uint8Array([0xb0, gp5Cc.patch, patch]);
}
