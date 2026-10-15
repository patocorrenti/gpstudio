import { useEffect, useRef, useState, type PointerEvent } from "react";
import logoDark from "@/assets/img/gp-studio-logo-dark.png";
import logoLight from "@/assets/img/gp-studio-logo-light.png";
import pedalsConnectPedalsDark from "@/assets/img/pedal-connect-pedals-dark.png";
import pedalsConnectPedalsLight from "@/assets/img/pedal-connect-pedals-light.png";
import pedalsConnectWiresDark from "@/assets/img/pedal-connect-wires-dark.png";
import pedalsConnectWiresLight from "@/assets/img/pedal-connect-wires-light.png";
import { Button } from "@/components/ui/button";
import { useConnectDialog } from "@/features/connect/ConnectDialogProvider";

/**
 * Optical depth: wires move less (further back in parallax) but render larger
 * so they still read as being in front of the pedals. Near the connect CTA they
 * scale down toward the jacks (plug-in cue).
 */
const PEDAL_TILT_DEG = 3.5;
const WIRE_TILT_DEG = 1;
const WIRE_SHIFT_PX = 1;
const WIRE_SCALE_REST = 1.08;
const WIRE_SCALE_PLUG = 0.97;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    const onChange = () => setReduced(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function PedalWelcome() {
  const { openConnect } = useConnectDialog();
  const reducedMotion = usePrefersReducedMotion();
  const tiltTargetRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const [pointerY, setPointerY] = useState(0);
  const [plugIn, setPlugIn] = useState(0);

  function updatePointer(event: PointerEvent<HTMLDivElement>) {
    if (reducedMotion) {
      return;
    }
    const target = tiltTargetRef.current;
    if (target) {
      const rect = target.getBoundingClientRect();
      setPointerY((event.clientY - rect.top) / rect.height - 0.5);
    }
    const cta = ctaRef.current;
    if (cta) {
      const rect = cta.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const vertical = Math.abs(event.clientY - cy) / 140;
      const horizontal = Math.abs(event.clientX - cx) / 220;
      setPlugIn(clamp01(1 - Math.max(vertical, horizontal * 0.65)));
    }
  }

  function resetPointer() {
    setPointerY(0);
    setPlugIn(0);
  }

  const wireScale =
    WIRE_SCALE_REST + (WIRE_SCALE_PLUG - WIRE_SCALE_REST) * plugIn;

  const pedalTiltStyle = reducedMotion
    ? undefined
    : {
        transform: `rotateX(${-(pointerY * 2) * PEDAL_TILT_DEG}deg)`,
      };

  const wireTiltStyle = reducedMotion
    ? { transform: `scale(${WIRE_SCALE_REST})` }
    : {
        transform: `translate3d(0, ${pointerY * 2 * WIRE_SHIFT_PX}px, 0) rotateX(${-(pointerY * 2) * WIRE_TILT_DEG}deg) scale(${wireScale})`,
      };

  return (
    <div
      role="button"
      tabIndex={0}
      className="group flex flex-1 cursor-pointer flex-col items-center justify-center gap-4 pb-16 text-muted-foreground transition-colors hover:text-foreground"
      aria-haspopup="dialog"
      aria-label="Connect a pedal"
      onClick={openConnect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openConnect();
        }
      }}
      onPointerMove={updatePointer}
      onPointerLeave={resetPointer}
    >
      <div className="flex w-fit flex-col items-end gap-1.5">
        <img
          src={logoLight}
          alt="GP Studio"
          className="h-[30px] w-auto dark:hidden"
        />
        <img
          src={logoDark}
          alt="GP Studio"
          className="hidden h-[30px] w-auto dark:block"
        />
        <span className="text-[10px] leading-none tracking-wide text-muted-foreground/70">
          v1.0.0-beta.3
        </span>
      </div>
      <div className="mt-[-24px] flex flex-col items-center gap-3">
        <div ref={tiltTargetRef} className="[perspective:900px]">
          <div className="relative w-[450px]">
            <img
              src={pedalsConnectPedalsDark}
              alt=""
              aria-hidden
              className="relative z-0 h-auto w-full origin-center opacity-70 will-change-transform transition-[opacity,transform] duration-300 ease-out group-hover:opacity-100 dark:hidden"
              style={pedalTiltStyle}
            />
            <img
              src={pedalsConnectPedalsLight}
              alt=""
              aria-hidden
              className="relative z-0 hidden h-auto w-full origin-center opacity-70 will-change-transform transition-[opacity,transform] duration-300 ease-out group-hover:opacity-100 dark:block"
              style={pedalTiltStyle}
            />
            <img
              src={pedalsConnectWiresDark}
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-0 z-10 h-auto w-full origin-center opacity-70 will-change-transform transition-[opacity,transform] duration-300 ease-out group-hover:opacity-100 dark:hidden"
              style={wireTiltStyle}
            />
            <img
              src={pedalsConnectWiresLight}
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-0 z-10 hidden h-auto w-full origin-center opacity-70 will-change-transform transition-[opacity,transform] duration-300 ease-out group-hover:opacity-100 dark:block"
              style={wireTiltStyle}
            />
          </div>
        </div>
        <div ref={ctaRef} className="flex flex-col items-center gap-2.5">
          <Button
            type="button"
            size="lg"
            className="relative h-10 overflow-hidden border-lime-400 bg-lime-400 px-4 text-sm whitespace-normal text-black/80 shadow-none transition-[color,background-color,box-shadow] hover:bg-lime-300 hover:text-black/80 hover:shadow-[0_0_10px_1px] hover:shadow-lime-400/30 dark:border-lime-400 dark:bg-transparent dark:text-lime-400 dark:hover:bg-lime-400/10 dark:hover:text-lime-300 dark:hover:shadow-[0_0_12px_1px] dark:hover:shadow-lime-400/25"
            onClick={(event) => {
              event.stopPropagation();
              openConnect();
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-linear-to-r from-transparent via-white/30 to-transparent motion-safe:animate-button-shine group-hover/button:invisible dark:via-lime-200/22"
            />
            <span className="relative">Connect a Multi-Effects</span>
          </Button>
          <p className="text-sm text-muted-foreground">Valeton GP5 or GP50</p>
        </div>
      </div>
    </div>
  );
}
