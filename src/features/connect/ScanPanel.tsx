import { type ReactNode } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  Bluetooth,
  RefreshCw,
  TriangleAlert,
  Turtle,
  Usb,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LinkMode } from "@/device/link";
import type { ListedPedal } from "@/app/preferences";
import { EndpointList } from "@/features/connect/EndpointList";

function ModeNotes({
  notes,
}: {
  notes: { icon: typeof Zap; text: ReactNode }[];
}) {
  return (
    <ul className="flex flex-col gap-1.5 px-1 py-3 text-sm text-muted-foreground">
      {notes.map(({ icon: Icon, text }, index) => (
        <li key={index} className="flex gap-2">
          <Icon
            className="mt-0.5 size-3.5 shrink-0 text-foreground"
            aria-hidden
          />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

export function ScanPanel({
  linkTab,
  onLinkTabChange,
  usbEndpoints,
  bleEndpoints,
  error,
  busy,
  startupChecked,
  startupDisabled,
  onStartupChecked,
  onPickDevice,
  onForget,
  onClearFavorite,
  onRefresh,
}: {
  linkTab: LinkMode;
  onLinkTabChange: (value: LinkMode) => void;
  usbEndpoints: Array<ListedPedal & { favorite: boolean }>;
  bleEndpoints: Array<ListedPedal & { favorite: boolean }>;
  error: string | null;
  busy: boolean;
  startupChecked: boolean;
  startupDisabled: boolean;
  onStartupChecked: (checked: boolean) => void;
  onPickDevice: (endpoint: ListedPedal) => void;
  onForget: (endpoint: ListedPedal) => void;
  onClearFavorite: () => void;
  onRefresh: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Connect</DialogTitle>
      </DialogHeader>
      <Tabs
        value={linkTab}
        onValueChange={(value) => {
          if (value !== "usb" && value !== "bluetooth") {
            return;
          }
          onLinkTabChange(value);
        }}
        className="gap-4"
      >
        <TabsList className="mt-2 grid h-12 w-full grid-cols-2 group-data-horizontal/tabs:h-12">
          <TabsTrigger value="usb" className="gap-1.5 px-2 dark:data-active:bg-background">
            <Usb />
            USB
          </TabsTrigger>
          <TabsTrigger value="bluetooth" className="gap-1.5 px-2 dark:data-active:bg-background">
            <Bluetooth />
            Bluetooth
          </TabsTrigger>
        </TabsList>
        <TabsContent value="usb" className="flex flex-col gap-4">
          <ModeNotes
            notes={[
              {
                icon: Zap,
                text: (
                  <span className="text-foreground">
                    <span className="font-bold">Super responsive</span>
                    {" "}—{" "}Fast, stable connection.
                  </span>
                ),
              },
              {
                icon: ArrowRight,
                text: "Only the computer can talk to the pedal.",
              },
            ]}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {busy && usbEndpoints.length === 0 && !error ? (
            <p className="text-sm text-muted-foreground">
              Looking for USB devices…
            </p>
          ) : null}
          {!busy && usbEndpoints.length === 0 && !error ? (
            <div
              role="status"
              className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
            >
              <TriangleAlert
                className="mt-0.5 size-4 shrink-0"
                aria-hidden
              />
              <p>
                No pedals found on USB.<br />
                Connect a Valeton GP5 or GP50 and scan again.
              </p>
            </div>
          ) : null}
          <EndpointList
            endpoints={usbEndpoints}
            busy={busy}
            onPick={onPickDevice}
            onForget={onForget}
            onClearFavorite={onClearFavorite}
          />
        </TabsContent>
        <TabsContent value="bluetooth" className="flex flex-col gap-4">
          <ModeNotes
            notes={[
              {
                icon: ArrowLeftRight,
                text: (
                  <span className="text-foreground">
                    <span className="font-bold">Fully interactive</span>
                    {" "}—{" "}Pedal and computer talk to each other.
                  </span>
                ),
              },
              {
                icon: Turtle,
                text: "Slower connection",
              },
            ]}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {busy && bleEndpoints.length === 0 && !error ? (
            <p className="text-sm text-muted-foreground">
              Looking for Bluetooth pedals…
            </p>
          ) : null}
          {!busy && bleEndpoints.length === 0 && !error ? (
            <div
              role="status"
              className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
            >
              <TriangleAlert
                className="mt-0.5 size-4 shrink-0"
                aria-hidden
              />
              <p>
                No pedals found on Bluetooth.<br />
                Put a Valeton GP5 or GP50 in pairing mode and scan again.
              </p>
            </div>
          ) : null}
          <EndpointList
            endpoints={bleEndpoints}
            busy={busy}
            onPick={onPickDevice}
            onForget={onForget}
            onClearFavorite={onClearFavorite}
          />
        </TabsContent>
      </Tabs>
      <div className="flex items-center justify-center gap-2">
        <Checkbox
          id="always-use-pedal"
          checked={startupChecked}
          disabled={startupDisabled}
          onCheckedChange={(value) => onStartupChecked(value === true)}
        />
        <label
          htmlFor="always-use-pedal"
          className={
            startupDisabled
              ? "text-sm text-muted-foreground"
              : "text-sm leading-snug"
          }
        >
          Always connect this way, don't ask again
        </label>
      </div>
      {linkTab === "usb" || linkTab === "bluetooth" ? (
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onRefresh}
          >
            <RefreshCw className="size-3 text-muted-foreground" />
            Scan again
          </Button>
        </DialogFooter>
      ) : null}
    </>
  );
}
