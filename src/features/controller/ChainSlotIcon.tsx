import type { ChainSlotId } from "@/device/session";
import { CHAIN_SLOT_ICONS } from "@/features/controller/chain-slot-icons";
import { cn } from "@/lib/utils";

const GLYPH_VARIANT = {
  icon: "relative h-[48px] w-9 items-end rounded-[3px] pb-0.9 text-[1.1rem] tracking-tight",
  "icon-sm": "size-7 rounded-[3px] px-0.5 text-[0.95rem] tracking-tight",
} as const;

export type SlotGlyphKnobTone = "light" | "dark";

const KNOB_TONE = {
  light: {
    body: "bg-zinc-300",
    mark: "bg-zinc-500/70",
  },
  dark: {
    body: "bg-zinc-700",
    mark: "bg-zinc-400/80",
  },
} as const;

function GlyphKnob({
  className,
  tone = "light",
}: {
  className?: string;
  tone?: SlotGlyphKnobTone;
}) {
  const colors = KNOB_TONE[tone];
  return (
    <span className={cn("relative size-2.5 rounded-full", colors.body, className)}>
      <span
        className={cn(
          "absolute top-[3px] left-1/2 h-1.5 w-px -translate-x-1/2 rounded-full",
          colors.mark,
        )}
      />
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

/** Pedal face detail — discrete layouts, not a free knob count. */
export type SlotGlyphFace = "knobs-1" | "knobs-2" | "knobs-3" | "knobs-6" | "sliders-4";

function Knobs3Row({ tone }: { tone: SlotGlyphKnobTone }) {
  return (
    <span className="flex justify-center gap-0.5">
      <GlyphKnob className="size-2" tone={tone} />
      <GlyphKnob className="size-2" tone={tone} />
      <GlyphKnob className="size-2" tone={tone} />
    </span>
  );
}

/** Four vertical EQ-style faders. */
function EqSliders() {
  return (
    <span className="absolute top-1.5 inset-x-0 flex h-4 items-end justify-center gap-[3px]">
      <span className="h-2 w-[3px] rounded-full bg-zinc-700" />
      <span className="h-3.5 w-[3px] rounded-full bg-zinc-700" />
      <span className="h-2.5 w-[3px] rounded-full bg-zinc-700" />
      <span className="h-3 w-[3px] rounded-full bg-zinc-700" />
    </span>
  );
}

function GlyphFace({
  face,
  knobTone,
}: {
  face: SlotGlyphFace;
  knobTone: SlotGlyphKnobTone;
}) {
  switch (face) {
    case "knobs-1":
      return (
        <span className="absolute top-1.5 inset-x-0 flex justify-center">
          <GlyphKnob tone={knobTone} />
        </span>
      );
    case "knobs-2":
      return (
        <span className="absolute top-1.5 inset-x-0 flex justify-center gap-1.5">
          <GlyphKnob tone={knobTone} />
          <GlyphKnob tone={knobTone} />
        </span>
      );
    case "knobs-3":
      return (
        <span className="absolute top-1.5 inset-x-0">
          <Knobs3Row tone={knobTone} />
        </span>
      );
    case "knobs-6":
      return (
        <span className="absolute top-1 inset-x-0 flex flex-col gap-0.5">
          <Knobs3Row tone={knobTone} />
          <Knobs3Row tone={knobTone} />
        </span>
      );
    case "sliders-4":
      return <EqSliders />;
  }
}

export type SlotGlyphTextTone = "light" | "dark";

const TEXT_TONE = {
  light: "#ffffff",
  dark: "#1a1a1a",
} as const;

export function SlotGlyph({
  label,
  backgroundColor,
  textTone = "light",
  variant = "icon",
  face = "knobs-2",
  knobTone = "light",
  className,
}: {
  label: string;
  backgroundColor: string;
  textTone?: SlotGlyphTextTone;
  variant?: keyof typeof GLYPH_VARIANT;
  face?: SlotGlyphFace;
  knobTone?: SlotGlyphKnobTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-slot-glyph font-semibold leading-none tracking-wide",
        GLYPH_VARIANT[variant],
        className,
      )}
      style={{ backgroundColor, color: TEXT_TONE[textTone] }}
      aria-hidden
    >
      {variant === "icon" ? (
        <>
          <GlyphJack side="left" />
          <GlyphJack side="right" />
          <GlyphFace face={face} knobTone={knobTone} />
        </>
      ) : null}
      {label}
    </span>
  );
}

const IMAGE_SIZE = {
  md: "size-14",
  sm: "size-7 rounded-[3px]",
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

const SLOT_GLYPHS: Partial<
  Record<
    ChainSlotId,
    {
      label: string;
      backgroundColor: string;
      textTone?: SlotGlyphTextTone;
      face?: SlotGlyphFace;
      knobTone?: SlotGlyphKnobTone;
    }
  >
> = {
  nr: {
    label: "NR",
    backgroundColor: "#c1c2c7",
    face: "knobs-1",
    knobTone: "dark",
    textTone: "dark",
  },
  dst: { label: "DST", backgroundColor: "#e4415c", face: "knobs-2" },
  ns: { label: "NS", backgroundColor: "#7c43e0", face: "knobs-6" },
  pre: { label: "PRE", backgroundColor: "#bd41dd", face: "knobs-2" },
  dly: { label: "DLY", backgroundColor: "#dc4690", face: "knobs-3" },
  mod: {
    label: "MOD",
    backgroundColor: "#40c8de",
    face: "knobs-3",
    knobTone: "dark",
    textTone: "dark",
  },
  rvb: { label: "RVB", backgroundColor: "#2472d4", face: "knobs-3" },
  eq: {
    label: "EQ",
    backgroundColor: "#debc8c",
    face: "sliders-4",
    textTone: "dark",
  },
};

export function ChainSlotIcon({
  id,
  size = "md",
  className,
}: {
  id: ChainSlotId;
  size?: "md" | "sm";
  className?: string;
}) {
  const glyph = SLOT_GLYPHS[id];
  if (glyph) {
    return (
      <span className={cn(GLYPH_FRAME[size], className)}>
        <SlotGlyph
          label={glyph.label}
          backgroundColor={glyph.backgroundColor}
          textTone={glyph.textTone}
          face={glyph.face}
          knobTone={glyph.knobTone}
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
