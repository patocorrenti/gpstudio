import type { ChainSlotId } from "@/device/session";
import { CHAIN_SLOT_ICONS } from "@/features/controller/chain-slot-icons";
import { cn } from "@/lib/utils";

export type SlotGlyphBody = "standard" | "tall" | "wide-top" | "wide";

const GLYPH_SIZE_STYLE = {
  icon: "relative text-[1.1rem] tracking-tight",
  "icon-sm": "px-0.5 text-[0.95rem] tracking-tight",
} as const;

/** Chassis size — discrete shapes, not free dimensions. */
const GLYPH_BODY = {
  icon: {
    standard: "h-[48px] w-9",
    tall: "h-[56px] w-9",
    "wide-top": "h-[56px] w-9",
    /** Same height as pedals, a bit wider — AMP/CAB blocks (+ handle above). */
    wide: "w-[42px] flex-col items-center",
  },
  "icon-sm": {
    standard: "size-7",
    tall: "h-8 w-7",
    "wide-top": "h-8 w-7",
    wide: "size-7",
  },
} as const;

/** Chassis outline — rect with radius, or slight top-wide trapezoid. */
const GLYPH_CHASSIS = {
  standard: "rounded-[3px]",
  tall: "rounded-[3px]",
  "wide-top":
    "[clip-path:polygon(0%_0%,100%_0%,92%_100%,8%_100%)]",
  wide: "rounded-[3px]",
} as const;

const PEDAL_BODIES: ReadonlySet<SlotGlyphBody> = new Set([
  "standard",
  "tall",
  "wide-top",
]);

/** Shared AMP / CAB handle fill (same as AMP chassis). */
const AMP_HANDLE_COLOR = "#e59f3d";

function AmpCabHandle({ color }: { color: string }) {
  return (
    <span
      className="h-[7px] w-[72%] rounded-t-[3px] border border-b-0 bg-transparent"
      style={{ borderColor: color }}
    />
  );
}

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

/** Pedal / module face detail — discrete layouts. */
export type SlotGlyphFace =
  | "blank"
  | "knobs-1"
  | "knobs-2"
  | "knobs-3"
  | "knobs-6"
  | "sliders-4"
  | "lines-7"
  | "amp-panel"
  | "cab-speaker";

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

/** Horizontal tread lines above the label (expression pedal). */
function FaceLines7() {
  return (
    <span className="absolute top-1.5 inset-x-1.5 flex flex-col gap-[3px]">
      <span className="h-px w-full bg-black/25" />
      <span className="h-px w-full bg-black/25" />
      <span className="h-px w-full bg-black/25" />
      <span className="h-px w-full bg-black/25" />
      <span className="h-px w-full bg-black/25" />
      <span className="h-px w-full bg-black/25" />
      <span className="h-px w-full bg-black/25" />
    </span>
  );
}

const AMP_PANEL_COLOR = "#7a5520";
const CAB_BG_COLOR = "#d2712a";
const CAB_DETAIL_COLOR = "#755121";
const CAB_FRAME_COLOR = "#755121";

/** Amp head control strip — darker brown panel with five knobs. */
function FaceAmpPanel() {
  return (
    <span
      className="absolute top-1 inset-x-1 flex h-3.5 items-center justify-evenly rounded-[3px] px-0.5"
      style={{ backgroundColor: AMP_PANEL_COLOR }}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className="size-[3.5px] rounded-full bg-zinc-300" />
      ))}
    </span>
  );
}

/** Cab baffle — inset frame + speaker circle. */
function FaceCabSpeaker() {
  return (
    <>
      <span
        className="absolute inset-[3px] rounded-[2px] border-2"
        style={{ borderColor: CAB_FRAME_COLOR }}
      />
      <span
        className="absolute top-1/2 left-1/2 size-[30px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ backgroundColor: CAB_DETAIL_COLOR }}
      />
    </>
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
    case "blank":
      return null;
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
    case "lines-7":
      return <FaceLines7 />;
    case "amp-panel":
      return <FaceAmpPanel />;
    case "cab-speaker":
      return <FaceCabSpeaker />;
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
  body = "standard",
  face = "knobs-2",
  knobTone = "light",
  handleColor = AMP_HANDLE_COLOR,
  className,
}: {
  label: string;
  backgroundColor: string;
  textTone?: SlotGlyphTextTone;
  variant?: keyof typeof GLYPH_SIZE_STYLE;
  body?: SlotGlyphBody;
  face?: SlotGlyphFace;
  knobTone?: SlotGlyphKnobTone;
  handleColor?: string;
  className?: string;
}) {
  const showJacks = variant === "icon" && PEDAL_BODIES.has(body);
  const showFace = variant === "icon" && face !== "blank";
  const showHandle = body === "wide" && variant === "icon";
  const alignBottom = showJacks || (variant === "icon" && face === "amp-panel");
  const pedalAlign = alignBottom ? "items-end pb-0.9" : "items-center";
  const boxSize = showHandle ? "h-[42px] w-full" : "size-full";

  return (
    <span
      className={cn("relative inline-flex", GLYPH_BODY[variant][body], className)}
      aria-hidden
    >
      {showHandle ? <AmpCabHandle color={handleColor} /> : null}
      {showJacks ? (
        <>
          <GlyphJack side="left" />
          <GlyphJack side="right" />
        </>
      ) : null}
      <span
        className={cn(
          "relative flex justify-center font-slot-glyph font-semibold leading-none tracking-wide",
          boxSize,
          pedalAlign,
          GLYPH_SIZE_STYLE[variant],
          GLYPH_CHASSIS[body],
        )}
        style={{ backgroundColor, color: TEXT_TONE[textTone] }}
      >
        {showFace ? <GlyphFace face={face} knobTone={knobTone} /> : null}
        <span className="relative z-10">{label}</span>
      </span>
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
} as const satisfies Record<"md" | "sm", keyof typeof GLYPH_SIZE_STYLE>;

const SLOT_GLYPHS: Partial<
  Record<
    ChainSlotId,
    {
      label: string;
      backgroundColor: string;
      textTone?: SlotGlyphTextTone;
      body?: SlotGlyphBody;
      face?: SlotGlyphFace;
      knobTone?: SlotGlyphKnobTone;
      handleColor?: string;
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
  exp: {
    label: "EXP",
    backgroundColor: "#48c4dc",
    body: "wide-top",
    face: "lines-7",
    textTone: "dark",
  },
  amp: {
    label: "AMP",
    backgroundColor: AMP_HANDLE_COLOR,
    body: "wide",
    face: "amp-panel",
    textTone: "dark",
  },
  cab: {
    label: "CAB",
    backgroundColor: CAB_BG_COLOR,
    body: "wide",
    face: "cab-speaker",
    handleColor: CAB_BG_COLOR,
  },
};

export function ChainSlotIcon({
  id,
  size = "md",
  enabled = true,
  className,
}: {
  id: ChainSlotId;
  size?: "md" | "sm";
  enabled?: boolean;
  className?: string;
}) {
  const glyph = SLOT_GLYPHS[id];
  if (glyph) {
    return (
      <span
        className={cn(
          GLYPH_FRAME[size],
          "relative grid place-items-center [perspective:180px]",
          className,
        )}
      >
        <span
          className={cn(
            "col-start-1 row-start-1 flex h-[48px] w-9 translate-y-px items-center justify-center rounded-[3px] bg-foreground/5 font-slot-glyph font-semibold tracking-tight text-muted-foreground/50",
            size === "sm" ? "h-7 w-7 text-[0.9rem]" : "text-[1.15rem]",
          )}
          aria-hidden
        >
          {glyph.label}
        </span>
        <span
          className={cn(
            "col-start-1 row-start-1 z-10 origin-center transition-[transform,opacity] duration-[220ms] ease-out",
            glyph.body === "wide" && "relative -top-2",
            enabled
              ? "opacity-100 [transform:translateZ(0)_scale(1)]"
              : "pointer-events-none opacity-0 [transform:translateZ(-28px)_scale(0.78)]",
          )}
        >
          <SlotGlyph
            label={glyph.label}
            backgroundColor={glyph.backgroundColor}
            textTone={glyph.textTone}
            body={glyph.body}
            face={glyph.face}
            knobTone={glyph.knobTone}
            handleColor={glyph.handleColor}
            variant={GLYPH_SIZE[size]}
          />
        </span>
      </span>
    );
  }

  return (
    <img
      src={CHAIN_SLOT_ICONS[id]}
      alt=""
      className={cn(
        "object-contain transition-[transform,opacity] duration-[220ms] ease-out",
        IMAGE_SIZE[size],
        enabled
          ? "scale-100 opacity-100"
          : "scale-[0.78] opacity-20",
        className,
      )}
    />
  );
}
