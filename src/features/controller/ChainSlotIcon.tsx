import type { ChainSlotId } from "@/device/session";
import { CHAIN_SLOT_ICONS } from "@/features/controller/chain-slot-icons";
import { cn } from "@/lib/utils";

const GLYPH_VARIANT = {
  icon: "relative h-[48px] w-9 items-end rounded-[3px] pb-0.9 text-[1.1rem] tracking-tight",
  "icon-sm": "size-7 px-0.5 text-[0.95rem] tracking-tight",
} as const;

function GlyphKnob() {
  return (
    <span className="relative size-2.5 rounded-full bg-zinc-300">
      <span className="absolute top-[3px] left-1/2 h-1.5 w-px -translate-x-1/2 rounded-full bg-zinc-500/70" />
    </span>
  );
}

function GlyphJack({ side }: { side: "left" | "right" }) {
  return (
    <span
      className={cn(
        "absolute top-[calc(50%+2px)] h-2.5 w-1 -translate-y-1/2 bg-zinc-500",
        side === "left" && "-left-1 rounded-l-[3px]",
        side === "right" && "-right-1 rounded-r-[3px]",
      )}
    />
  );
}

export function SlotGlyph({
  label,
  backgroundColor,
  textColor = "#ffffff",
  variant = "icon",
  className,
}: {
  label: string;
  backgroundColor: string;
  textColor?: string;
  variant?: keyof typeof GLYPH_VARIANT;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-slot-glyph font-semibold leading-none tracking-wide",
        GLYPH_VARIANT[variant],
        className,
      )}
      style={{ backgroundColor, color: textColor }}
      aria-hidden
    >
      {variant === "icon" ? (
        <>
          <GlyphJack side="left" />
          <GlyphJack side="right" />
          <span className="absolute top-1.5 inset-x-0 flex justify-center gap-1.5">
            <GlyphKnob />
            <GlyphKnob />
          </span>
        </>
      ) : null}
      {label}
    </span>
  );
}

const IMAGE_SIZE = {
  md: "size-14",
  sm: "size-6",
} as const;

/** Chain keeps a size-14 box so the cable still crosses the glyph center. */
const GLYPH_FRAME = {
  md: "flex size-14 items-center justify-center",
  sm: "inline-flex",
} as const;

const GLYPH_SIZE = {
  md: "icon",
  sm: "icon-sm",
} as const satisfies Record<"md" | "sm", keyof typeof GLYPH_VARIANT>;

export function ChainSlotIcon({
  id,
  size = "md",
  className,
}: {
  id: ChainSlotId;
  size?: "md" | "sm";
  className?: string;
}) {
  if (id === "dst") {
    return (
      <span className={cn(GLYPH_FRAME[size], className)}>
        <SlotGlyph
          label="DST"
          backgroundColor="#e4415c"
          variant={GLYPH_SIZE[size]}
        />
      </span>
    );
  }

  return (
    <img
      src={CHAIN_SLOT_ICONS[id]}
      alt=""
      className={cn("object-contain", IMAGE_SIZE[size], className)}
    />
  );
}
