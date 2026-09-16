/**
 * Official MIDI CC maps from the Valeton GP-5 and GP-50 manuals.
 * Stored with the device layer; live-controller sends these later.
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
  extra13: 13,
  extra17: 17,
  extra19: 19,
  bpm: 21,
  patchStompMode: 28,
} as const;
