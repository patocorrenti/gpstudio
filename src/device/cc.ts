import { EFFECT_IDS, type EffectId } from "@/device/chain";

/**
 * Official MIDI CC maps from the Valeton GP-5 and GP-50 manuals.
 */
export const gp5Cc = {
  patch: 0,
  volume: 7,
  bankDown: 22,
  bankUp: 23,
  patchDown: 24,
  patchUp: 25,
  nr: 48,
  pre: 49,
  dst: 50,
  ns: 51,
  amp: 52,
  cab: 53,
  eq: 54,
  mod: 55,
  dly: 56,
  rvb: 57,
  tuner: 58,
  ctl: 69,
} as const;

export const gp50Cc = {
  ...gp5Cc,
  masterVolume: 1,
  exp: 11,
  expOnOff: 13,
  /** Relative master step. Unused; the patch bar does not send it. */
  masterStep: 17,
  /** Relative BPM step. Unused; absolute tempo is tempoMsb then tempoLsb. */
  bpmStep: 19,
  /** Relative patch-volume step. Unused; absolute patch volume is CC 7. */
  volumeStep: 21,
  patchStompMode: 28,
  tempoMsb: 73,
  tempoLsb: 74,
  /** CTRL 2 / stomp B. CTRL 1 / stomp A is the inherited `ctl` (CC 69). */
  ctrl2: 70,
} as const;

/** Official module switches: NR…RVB are CC 48–57. */
export const MODULE_CC: Record<EffectId, number> = {
  nr: gp5Cc.nr,
  pre: gp5Cc.pre,
  dst: gp5Cc.dst,
  ns: gp5Cc.ns,
  amp: gp5Cc.amp,
  cab: gp5Cc.cab,
  eq: gp5Cc.eq,
  mod: gp5Cc.mod,
  dly: gp5Cc.dly,
  rvb: gp5Cc.rvb,
};

const MODULE_BY_CC = new Map<number, EffectId>(
  EFFECT_IDS.map((id) => [MODULE_CC[id], id]),
);

/** Valeton MIDI list: 0–63 off, 64–127 on. Writes use 0 / 127. */
export const MODULE_CC_OFF = 0;
export const MODULE_CC_ON = 127;
export const MODULE_CC_ON_MIN = 64;

export function effectIdForModuleCc(controller: number): EffectId | null {
  return MODULE_BY_CC.get(controller) ?? null;
}

export function encodeModuleCcValue(enabled: boolean): number {
  return enabled ? MODULE_CC_ON : MODULE_CC_OFF;
}

export function moduleEnabledFromCc(value: number): boolean {
  return value >= MODULE_CC_ON_MIN;
}
