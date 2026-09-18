import { BOTH_PEDALS } from "@/device/catalog/shared";
import type { FxModel } from "@/device/catalog/types";

export const NR_MODELS: readonly FxModel[] = [
  {
    id: "nr-gate",
    kind: "nr",
    label: "GATE",
    devices: BOTH_PEDALS,
    wire: [0x00, 0x00, 0x00, 0x00],
    controls: [
      {
        index: 0,
        label: "THRE",
        min: 0,
        max: 100,
        step: 1,
        default: 20,
        display: "percent",
      },
    ],
  },
];
