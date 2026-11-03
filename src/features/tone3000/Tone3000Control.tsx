import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSessionSnapshot } from "@/features/connect/DeviceSessionProvider";
import {
  completeTone3000SignIn,
  disconnectTone3000Account,
  getTone3000Account,
  restoreTone3000Account,
  subscribeTone3000Account,
} from "@/features/tone3000/account";
import { acceptOAuthState, publishableKey } from "@/features/tone3000/oauth";
import { setOAuthReturnHandler, type OAuthReturnFields } from "@/features/tone3000/return";
import { STATE_KEY, beginAuthorize, exchangeAuthorizationCode } from "@/features/tone3000/tokens";
import { isNativeDesktop, isTone3000ControlVisible } from "@/features/tone3000/visibility";

type SignInStep = "partnership" | "signin";

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
  const [step, setStep] = useState<SignInStep>("partnership");
  const [frameUrl, setFrameUrl] = useState("");
  const [error, setError] = useState("");
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
    if (!open || step !== "signin") {
      return;
    }
    setOAuthReturnHandler((payload) => {
      void finishSignIn(payload);
    });
    return () => setOAuthReturnHandler(null);
  }, [open, step]);

  async function finishSignIn(payload: OAuthReturnFields): Promise<void> {
    if (!acceptOAuthState(payload.state, sessionStorage.getItem(STATE_KEY)) || !payload.code) {
      return;
    }
    const exchanged = await exchangeAuthorizationCode(payload.code);
    if (!exchanged) {
      setError("TONE3000 sign-in did not finish.");
      return;
    }
    const username = await completeTone3000SignIn();
    if (!username) {
      setError("TONE3000 sign-in did not finish.");
      return;
    }
    setOpen(false);
  }

  async function continueSignIn(): Promise<void> {
    setError("");
    try {
      const url = await beginAuthorize("sign-in");
      if (!openRef.current) {
        return;
      }
      setFrameUrl(url);
      setStep("signin");
    } catch {
      setError("TONE3000 sign-in did not finish.");
    }
  }

  function close(): void {
    openRef.current = false;
    setOpen(false);
    setStep("partnership");
    setFrameUrl("");
    setError("");
  }

  if (!visible) {
    return null;
  }

  const signedIn = account.status === "signed-in";
  const label = signedIn ? account.username : "TONE3000";

  return (
    <div className="hidden md:block">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-2.5 px-3 text-sm md:h-7 md:px-2.5 md:text-[0.8rem]"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={signedIn ? `TONE3000 ${account.username}` : "TONE3000"}
        onClick={() => {
          if (account.status === "unknown") {
            return;
          }
          setStep("partnership");
          setFrameUrl("");
          setError("");
          openRef.current = true;
          setOpen(true);
        }}
      >
        <span
          aria-hidden
          className={
            signedIn
              ? "size-2 shrink-0 rounded-full bg-lime-400 shadow-[0_0_8px_2px] shadow-lime-400/70"
              : "size-2 shrink-0 rounded-full bg-muted-foreground/50"
          }
        />
        <span className="max-w-32 truncate">{label}</span>
      </Button>
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
          className={step === "signin" && !signedIn ? "sm:max-w-3xl" : "sm:max-w-md"}
        >
          {signedIn ? (
            <>
              <DialogHeader>
                <DialogTitle>TONE3000</DialogTitle>
              </DialogHeader>
              <p className="text-sm">{account.username}</p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={close}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    disconnectTone3000Account();
                    close();
                  }}
                >
                  Disconnect
                </Button>
              </DialogFooter>
            </>
          ) : step === "partnership" ? (
            <>
              <DialogHeader>
                <DialogTitle>TONE3000</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                GP Studio and TONE3000 work together so you can choose a NAM capture for a SnapTone slot.
                TONE3000 handles sign-in. GP Studio keeps that session in this browser.
              </p>
              {error ? <p className="text-sm">{error}</p> : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={close}>
                  Cancel
                </Button>
                <Button type="button" onClick={() => void continueSignIn()}>
                  Continue
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>TONE3000</DialogTitle>
              </DialogHeader>
              {frameUrl ? (
                <iframe
                  title="TONE3000 sign-in"
                  src={frameUrl}
                  className="h-[70vh] w-full rounded-md border"
                />
              ) : null}
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
