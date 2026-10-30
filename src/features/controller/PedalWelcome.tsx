import { useEffect, useRef, useState, type PointerEvent } from "react";
import logoDark from "@/assets/img/gp-studio-logo-dark.png";
import logoLight from "@/assets/img/gp-studio-logo-light.png";
import lineBlack from "@/assets/img/gp5-50-line-black.png";
import lineWhite from "@/assets/img/gp5-50-line-white.png";
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
  const tiltTargetRef = useRef<HTMLButtonElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const [pointerY, setPointerY] = useState(0);
  const [plugIn, setPlugIn] = useState(0);

  function updatePointer(event: PointerEvent<HTMLDivElement>) {
    if (
      reducedMotion ||
      window.matchMedia("(max-width: 767px)").matches
    ) {
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
      className="group flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 overflow-x-clip pb-16 text-muted-foreground"
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
          v1.0.0
        </span>
      </div>
      <div className="mt-2 flex w-full min-w-0 flex-col items-center gap-5 md:mt-[-24px] md:gap-3">
        <button
          type="button"
          ref={tiltTargetRef}
          className="inline-flex w-full max-w-[240px] cursor-pointer appearance-none border-0 bg-transparent p-0 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:w-[450px] md:max-w-none md:[perspective:900px]"
          aria-haspopup="dialog"
          aria-label="Connect a Multi-Effects"
          onClick={openConnect}
        >
          <div className="relative hidden w-full md:block">
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
          <div className="w-full md:hidden">
            <img
              src={lineBlack}
              alt=""
              aria-hidden
              className="h-auto w-full dark:hidden"
            />
            <img
              src={lineWhite}
              alt=""
              aria-hidden
              className="hidden h-auto w-full dark:block"
            />
          </div>
        </button>
        <div ref={ctaRef} className="flex w-full max-w-[240px] flex-col items-center gap-2.5 md:w-auto md:max-w-none">
          <Button
            type="button"
            size="lg"
            className="relative h-10 w-full overflow-hidden border-lime-400 bg-lime-400 px-4 text-sm whitespace-normal text-black/80 shadow-none hover:bg-lime-400 hover:text-black/80 hover:shadow-none md:w-auto md:transition-[color,background-color,box-shadow] md:hover:bg-lime-300 md:hover:shadow-[0_0_10px_1px] md:hover:shadow-lime-400/30 dark:border-lime-400 dark:bg-transparent dark:text-lime-400 dark:hover:bg-transparent dark:hover:text-lime-400 dark:hover:shadow-none md:dark:hover:bg-lime-400/10 md:dark:hover:text-lime-300 md:dark:hover:shadow-[0_0_12px_1px] md:dark:hover:shadow-lime-400/25"
            onClick={openConnect}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-linear-to-r from-transparent via-white/30 to-transparent motion-safe:animate-button-shine md:group-hover/button:invisible dark:via-lime-200/22"
            />
            <span className="relative">Connect a Multi-Effects</span>
          </Button>
          <p className="text-sm text-muted-foreground">Valeton GP5 or GP50</p>
        </div>
      </div>
    </div>
  );
}
