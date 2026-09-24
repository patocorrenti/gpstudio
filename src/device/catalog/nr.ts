import { BOTH_PEDALS } from "@/device/catalog/shared";
import type { FxModel } from "@/device/catalog/types";

export const NR_MODELS: readonly FxModel[] = [
  {
    id: "nr-gate",
    kind: "nr",
    label: "GATE",
    description: "Based on famous ISP® Decimator™* noise gate pedal. The Decimator features improvements in the expander tracking with their new Linearized Time Vector Processing™. This novel improvement provides a more linear release time-constant response for the exponential release curve of the downward expander.",
    basedOn: "Based on ISP® Decimator™*",
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
