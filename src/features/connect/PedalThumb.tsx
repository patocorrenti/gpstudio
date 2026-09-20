import gp5Thumb from "@/assets/img/gp5-thumb.png";
import gp50Thumb from "@/assets/img/gp50-thumb.png";
import type { DeviceModel } from "@/device/models";

function pedalThumbSrc(model: DeviceModel | undefined): string | undefined {
  if (model === "gp5") {
    return gp5Thumb;
  }
  if (model === "gp50") {
    return gp50Thumb;
  }
  return undefined;
}

export function PedalThumb({ model }: { model?: DeviceModel }) {
  const src = pedalThumbSrc(model);
  return (
    <span
      aria-hidden
      className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted ring-foreground/10"
    >
      {src ? (
        <img src={src} alt="" className="size-full object-contain p-1" />
      ) : null}
    </span>
  );
}
