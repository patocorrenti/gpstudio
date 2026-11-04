import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AudioLines, AudioWaveform, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSessionSnapshot } from "@/features/connect/DeviceSessionProvider";
import { requestOpenSnapTones } from "@/features/controller/snap-tones-bridge";
import {
  completeTone3000SignIn,
  disconnectTone3000Account,
  getTone3000Account,
  restoreTone3000Account,
  subscribeTone3000Account,
} from "@/features/tone3000/account";
import { acceptOAuthState, publishableKey } from "@/features/tone3000/oauth";
import { closeTone3000Popup, navigateTone3000Popup, openTone3000Popup } from "@/features/tone3000/popup";
import { setOAuthReturnHandler, type OAuthReturnFields } from "@/features/tone3000/return";
import { STATE_KEY, beginAuthorize, exchangeAuthorizationCode } from "@/features/tone3000/tokens";
import { isNativeDesktop, isTone3000ControlVisible } from "@/features/tone3000/visibility";

export function Tone3000Control() {
  const snapshot = useSessionSnapshot();
  const account = useSyncExternalStore(
    subscribeTone3000Account,
    getTone3000Account,
    getTone3000Account,
  );
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");
  const popupRef = useRef<Window | null>(null);
  const finishingRef = useRef(false);
  const visible = isTone3000ControlVisible({
    connected: snapshot.status === "connected",
    usb: snapshot.status === "connected" && snapshot.linkMode === "usb",
    publishableKey: publishableKey(),
    tauri: isNativeDesktop(),
  });

  useEffect(() => {
    void restoreTone3000Account();
  }, []);

  useEffect(() => {
    if (!open || !signingIn) {
      return;
    }
    setOAuthReturnHandler((payload) => {
      void finishSignIn(payload);
    });
    return () => setOAuthReturnHandler(null);
  }, [open, signingIn]);

  async function finishSignIn(payload: OAuthReturnFields): Promise<void> {
    if (finishingRef.current) {
      return;
    }
    if (!acceptOAuthState(payload.state, sessionStorage.getItem(STATE_KEY)) || !payload.code) {
      return;
    }
    finishingRef.current = true;
    const exchanged = await exchangeAuthorizationCode(payload.code);
    if (!exchanged) {
      finishingRef.current = false;
      setError("TONE3000 sign-in did not finish.");
      return;
    }
    const username = await completeTone3000SignIn();
    if (!username) {
      finishingRef.current = false;
      setError("TONE3000 sign-in did not finish.");
      return;
    }
    setSigningIn(false);
    setOpen(false);
  }

  function startSignIn(): void {
    setError("");
    const popup = openTone3000Popup();
    if (!popup) {
      setError("The TONE3000 window was blocked. Allow popups for GP Studio and try again.");
      setSigningIn(true);
      openRef.current = true;
      setOpen(true);
      return;
    }
    popupRef.current = popup;
    setSigningIn(true);
    openRef.current = true;
    setOpen(true);
    void beginAuthorize("sign-in")
      .then((url) => {
        if (!openRef.current || popup.closed) {
          closeTone3000Popup(popup);
          return;
        }
        navigateTone3000Popup(popup, url);
      })
      .catch(() => {
        closeTone3000Popup(popup);
        setError("TONE3000 sign-in did not finish.");
      });
  }

  function close(): void {
    openRef.current = false;
    finishingRef.current = false;
    closeTone3000Popup(popupRef.current);
    popupRef.current = null;
    setOpen(false);
    setSigningIn(false);
    setError("");
  }

  if (!visible) {
    return null;
  }

  const signedIn = account.status === "signed-in";
  const tip = signedIn
    ? `Connected to TONE3000 as ${account.username}`
    : "Connect with TONE3000";

  return (
    <div className="hidden md:block">
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-2 px-2.5 text-xs md:h-7 md:px-2 md:text-[0.72rem]"
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-label={tip}
              onClick={() => {
                if (account.status === "unknown") {
                  return;
                }
                if (signedIn) {
                  setSigningIn(false);
                  setError("");
                  openRef.current = true;
                  setOpen(true);
                  return;
                }
                startSignIn();
              }}
            >
              <span
                aria-hidden
                className={
                  signedIn
                    ? "size-2 shrink-0 rounded-full bg-yellow-400 shadow-[0_0_8px_2px] shadow-yellow-400/70"
                    : "size-2 shrink-0 rounded-full bg-muted-foreground/50"
                }
              />
              <span>T3K</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{tip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            close();
            return;
          }
          setOpen(true);
        }}
      >
        <DialogContent
          aria-describedby={undefined}
          className="sm:max-w-md"
        >
          {signedIn && !signingIn ? (
            <>
              <DialogHeader>
                <DialogTitle>TONE3000</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">{`Connected as ${account.username}`}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    close();
                    requestOpenSnapTones();
                  }}
                >
                  <AudioLines className="size-3.5 text-muted-foreground" />
                  SnapTones
                </Button>
                <Button type="button" variant="outline" className="gap-2" disabled aria-disabled>
                  <AudioWaveform className="size-3.5 text-muted-foreground" />
                  IR
                  <span className="text-xs font-normal text-muted-foreground">(coming soon)</span>
                </Button>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    disconnectTone3000Account();
                    close();
                  }}
                >
                  <LogOut className="size-3 text-muted-foreground" />
                  Disconnect
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>TONE3000</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Finish signing in in the TONE3000 window. This page stays open.
              </p>
              {error ? <p className="text-sm">{error}</p> : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={close}>
                  Cancel
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
