import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const abLabelIdleClass = "text-xs font-normal tracking-wide text-muted-foreground";
const abLabelLitClass = "text-xs font-normal tracking-wide text-foreground";

/** Centered A/B caption with a rule that spans the control under it. */
export function AbSideLabel({
  label,
  show,
  ruled = true,
  lit = false,
  railOnMobile = false,
  className,
  children,
}: {
  label: string;
  show: boolean;
  ruled?: boolean;
  lit?: boolean;
  /** Mobile: letter + vertical rule to the left of the control. Desktop keeps the banner. */
  railOnMobile?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const labelClass = lit ? abLabelLitClass : abLabelIdleClass;
  const ruleClass = lit
    ? "h-0.5 flex-1 bg-foreground/65 animate-ab-rule-settle"
    : "h-px flex-1 bg-border";
  const railClass = lit
    ? "w-0.5 self-stretch bg-foreground/65 animate-ab-rule-settle"
    : "w-0.5 self-stretch bg-border";

  return (
    <div
      className={cn(
        "relative",
        railOnMobile && show && "flex items-center gap-2 md:block",
        className,
      )}
    >
      {show && railOnMobile ? (
        <div
          aria-hidden
          className="flex shrink-0 items-center gap-1.5 self-stretch md:hidden"
        >
          <span key={lit ? "rail-lit" : "rail-idle"} className={railClass} />
          <span className={`shrink-0 ${labelClass}`}>{label}</span>
        </div>
      ) : null}
      {show ? (
        ruled ? (
          <div
            aria-hidden
            className={cn(
              "mb-2 flex items-center gap-1.5 md:pointer-events-none md:absolute md:inset-x-0 md:-top-5 md:mb-0",
              railOnMobile && "hidden md:flex",
            )}
          >
            <span key={lit ? "lit-l" : "idle-l"} className={ruleClass} />
            <span className={`shrink-0 ${labelClass}`}>{label}</span>
            <span key={lit ? "lit-r" : "idle-r"} className={ruleClass} />
          </div>
        ) : (
          <span
            aria-hidden
            className={cn(
              `mb-2 block text-center md:pointer-events-none md:absolute md:inset-x-0 md:-top-5 md:mb-0 ${labelClass}`,
              railOnMobile && "hidden md:block",
            )}
          >
            {label}
          </span>
        )
      ) : null}
      {railOnMobile && show ? (
        <div className="min-w-0 flex-1 md:contents">{children}</div>
      ) : (
        children
      )}
    </div>
  );
}
