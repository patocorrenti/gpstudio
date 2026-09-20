import iconAmp from "@/assets/img/icon-AMP.png";
import iconCab from "@/assets/img/icon-CAB.png";
import iconDly from "@/assets/img/icon-DLY.png";
import iconDst from "@/assets/img/icon-DST.png";
import iconEq from "@/assets/img/icon-EQ.png";
import iconExp from "@/assets/img/icon-EXP.png";
import iconMod from "@/assets/img/icon-MOD.png";
import iconNr from "@/assets/img/icon-NR.png";
import iconNs from "@/assets/img/icon-NS.png";
import iconPre from "@/assets/img/icon-PRE.png";
import iconRvb from "@/assets/img/icon-RVB.png";
import type { ChainSlotId } from "@/device/session";

export const CHAIN_SLOT_ICONS: Record<ChainSlotId, string> = {
  nr: iconNr,
  pre: iconPre,
  dst: iconDst,
  ns: iconNs,
  amp: iconAmp,
  cab: iconCab,
  eq: iconEq,
  mod: iconMod,
  dly: iconDly,
  rvb: iconRvb,
  exp: iconExp,
};
