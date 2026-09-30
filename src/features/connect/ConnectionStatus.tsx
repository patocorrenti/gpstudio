import { useEffect, useRef, useState } from "react";
import { Bluetooth, Usb } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { BluetoothEndpoint } from "@/bluetooth/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { LinkEndpoint } from "@/device/endpoint";
import type { LinkMode } from "@/device/link";
import { displayModelName, type DeviceModel } from "@/device/models";
import type { MidiEndpoint } from "@/midi/types";
import {
  clearStartup,
  forgetPedal,
  mergeListedPedals,
  readPreferences,
  rememberPedal,
  setStartup,
  syncRememberedId,
  type ListedPedal,
  type PreferenceLink,
  type PreferencesDocument,
  type RememberedPedal,
  type StartupPedal,
} from "@/app/preferences";
import { ConnectedPanel } from "@/features/connect/ConnectedPanel";
import {
  useDeviceSession,
  useSessionSnapshot,
} from "@/features/connect/DeviceSessionProvider";
import { useConnectDialog } from "@/features/connect/ConnectDialogProvider";
import { ScanPanel } from "@/features/connect/ScanPanel";
import { SelectModelPanel } from "@/features/connect/SelectModelPanel";

const FAVORITE_CONNECT_ERROR = "Your favorite pedal failed or is not connected.";

/**
 * One launch attempt shared across StrictMode's extra mount. UI updates subscribe
 * after the fact so a discarded mount cannot start a second connect.
 */
let startupAttempt: Promise<{
  ok: boolean;
  link: PreferenceLink;
  usb?: MidiEndpoint[];
  ble?: BluetoothEndpoint[];
}> | null = null;

/** Covers the launch attempt's connect-then-fail path, including after a remount. */
let suppressStartupDisconnect = false;

function linkOf(endpoint: LinkEndpoint): PreferenceLink {
  return endpoint.kind === "bluetooth" ? "bluetooth" : "usb";
}

function omitKey(link: PreferenceLink, id: string): string {
  return `${link}:${id}`;
}

function omittedIdsFor(
  link: PreferenceLink,
  keys: readonly string[],
): ReadonlySet<string> {
  const prefix = `${link}:`;
  const ids = new Set<string>();
  for (const key of keys) {
    if (key.startsWith(prefix)) {
      ids.add(key.slice(prefix.length));
    }
  }
  return ids;
}

function isFavorite(
  link: PreferenceLink,
  row: ListedPedal,
  preferences: PreferencesDocument,
): boolean {
  const startup = preferences.startup;
  if (!startup || startup.link !== link) {
    return false;
  }
  if (row.id === startup.id) {
    return true;
  }
  const saved = preferences.pedals.find(
    (pedal) => pedal.link === link && pedal.id === startup.id,
  );
  return saved?.label === row.label;
}

export function ConnectionStatus() {
  const navigate = useNavigate();
  const session = useDeviceSession();
  const snapshot = useSessionSnapshot();
  const { open, setOpen } = useConnectDialog();
  const [linkTab, setLinkTab] = useState<LinkMode>("usb");
  const [usbEndpoints, setUsbEndpoints] = useState<MidiEndpoint[]>([]);
  const [bleEndpoints, setBleEndpoints] = useState<BluetoothEndpoint[]>([]);
  const [preferences, setPreferences] = useState(readPreferences);
  const [omittedKeys, setOmittedKeys] = useState<string[]>([]);
  const [armStartup, setArmStartup] = useState(false);
  const [pending, setPending] = useState<LinkEndpoint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const openOnTab = useRef<LinkMode>("usb");
  const dialogOpen = useRef(open);
  dialogOpen.current = open;
  const connected = snapshot.status === "connected";
  const askingModel = pending !== null && !connected;
  const previousStatus = useRef(snapshot.status);
  /** Suppress disconnect toast/modal-close when connect opens then fails (e.g. silent name-list). */
  const suppressDisconnectFeedback = useRef(false);
  const startupChecked = armStartup || preferences.startup !== null;

  function refreshPreferences() {
    setPreferences(readPreferences());
  }

  function absorbLive(link: PreferenceLink, list: readonly LinkEndpoint[]) {
    for (const endpoint of list) {
      if (linkOf(endpoint) !== link) {
        continue;
      }
      syncRememberedId(link, endpoint.id, endpoint.label);
    }
    refreshPreferences();
  }

  useEffect(() => {
    const previous = previousStatus.current;
    previousStatus.current = snapshot.status;
    if (previous !== "connected" || snapshot.status !== "disconnected") {
      return;
    }
    if (suppressDisconnectFeedback.current || suppressStartupDisconnect) {
      suppressDisconnectFeedback.current = false;
      suppressStartupDisconnect = false;
      return;
    }
    setOpen(false);
    setPending(null);
    setError(null);
    toast("Pedal disconnected");
  }, [snapshot.status, setOpen]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setLinkTab(openOnTab.current);
    openOnTab.current = "usb";
  }, [open]);

  useEffect(() => {
    if (session.getSnapshot().status !== "disconnected") {
      return;
    }
    const prefs = readPreferences();
    const startup = prefs.startup;
    if (!startup) {
      return;
    }
    const pedal = prefs.pedals.find(
      (item) => item.link === startup.link && item.id === startup.id,
    );
    if (!pedal?.model) {
      return;
    }
    const model = pedal.model;
    if (!startupAttempt) {
      const result = { label: pedal.label };
      const found: { usb?: MidiEndpoint[]; ble?: BluetoothEndpoint[] } = {};
      startupAttempt = (async () => {
        try {
          await toast
            .promise(
              (async () => {
                const endpoint = await resolveStartupEndpoint(startup, pedal, found);
                if (!endpoint) {
                  throw new Error(FAVORITE_CONNECT_ERROR);
                }
                result.label = endpoint.label;
                if (endpoint.id !== pedal.id) {
                  rememberPedal({
                    link: pedal.link,
                    id: endpoint.id,
                    label: endpoint.label,
                    model,
                  });
                  setStartup({ link: pedal.link, id: endpoint.id });
                }
                suppressStartupDisconnect = true;
                await session.connect(endpoint, model);
              })(),
              {
                loading: "Connecting…",
                success: () => `Connected to ${result.label}`,
                error: FAVORITE_CONNECT_ERROR,
              },
            )
            .unwrap();
          return { ok: true, link: startup.link, ...found };
        } catch {
          return { ok: false, link: startup.link, ...found };
        }
      })();
    }
    const attempt = startupAttempt;
    let cancelled = false;
    setBusy(true);
    void attempt
      .then((outcome) => {
        if (cancelled) {
          return;
        }
        if (outcome.usb) {
          setUsbEndpoints(outcome.usb);
        }
        if (outcome.ble) {
          setBleEndpoints(outcome.ble);
        }
        refreshPreferences();
        if (outcome.ok) {
          suppressStartupDisconnect = false;
          suppressDisconnectFeedback.current = false;
          return;
        }
        setLinkTab(outcome.link);
        if (dialogOpen.current) {
          openOnTab.current = "usb";
        } else {
          openOnTab.current = outcome.link;
          setOpen(true);
        }
        window.setTimeout(() => {
          if (
            suppressStartupDisconnect &&
            session.getSnapshot().status === "disconnected"
          ) {
            suppressStartupDisconnect = false;
          }
        }, 0);
      })
      .finally(() => {
        if (!cancelled) {
          setBusy(false);
        }
      });
    return () => {
      cancelled = true;
    };

    async function resolveStartupEndpoint(
      choice: StartupPedal,
      saved: RememberedPedal,
      found: { usb?: MidiEndpoint[]; ble?: BluetoothEndpoint[] },
    ): Promise<LinkEndpoint | null> {
      if (choice.link === "usb") {
        const list = await session.discover();
        for (const endpoint of list) {
          syncRememberedId("usb", endpoint.id, endpoint.label);
        }
        found.usb = list;
        return matchSaved(list, saved);
      }
      const { endpoints } = await session.discoverBluetooth({
        interactive: false,
      });
      for (const endpoint of endpoints) {
        syncRememberedId("bluetooth", endpoint.id, endpoint.label);
      }
      found.ble = endpoints;
      return matchSaved(endpoints, saved);
    }
  }, [session, setOpen]);

  function matchSaved(
    list: readonly LinkEndpoint[],
    saved: RememberedPedal,
  ): LinkEndpoint | null {
    const byId = list.find((endpoint) => endpoint.id === saved.id);
    if (byId) {
      return byId;
    }
    return list.find((endpoint) => endpoint.label === saved.label) ?? null;
  }

  async function scanUsb() {
    setBusy(true);
    setError(null);
    try {
      const list = await session.discover();
      absorbLive("usb", list);
      setUsbEndpoints(list);
    } catch (cause) {
      setUsbEndpoints([]);
      setError(
        cause instanceof Error ? cause.message : "Could not list USB devices.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function scanBluetooth(interactive: boolean) {
    setBusy(true);
    setError(null);
    try {
      const { endpoints, selectedId } = await session.discoverBluetooth({
        interactive,
      });
      absorbLive("bluetooth", endpoints);
      const selected = selectedId
        ? endpoints.find((endpoint) => endpoint.id === selectedId)
        : undefined;
      if (selected) {
        rememberPedal({
          link: "bluetooth",
          id: selected.id,
          label: selected.label,
          ...(selected.suggestedModel ? { model: selected.suggestedModel } : {}),
        });
        setOmittedKeys((current) =>
          current.filter((key) => key !== omitKey("bluetooth", selected.id)),
        );
        refreshPreferences();
      }
      setBleEndpoints(endpoints);
    } catch (cause) {
      setBleEndpoints([]);
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not list Bluetooth pedals.",
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!open || connected || linkTab !== "usb") {
      return;
    }
    let cancelled = false;
    setBusy(true);
    setError(null);
    void session
      .discover()
      .then((list) => {
        if (!cancelled) {
          absorbLive("usb", list);
          setUsbEndpoints(list);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setUsbEndpoints([]);
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not list USB devices.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBusy(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, connected, linkTab, session]);

  function listed(link: PreferenceLink, live: readonly LinkEndpoint[]) {
    return mergeListedPedals(
      link,
      live,
      preferences.pedals,
      omittedIdsFor(link, omittedKeys),
    ).map((row) => ({
      ...row,
      favorite: isFavorite(link, row, preferences),
    }));
  }

  const usbListed = listed("usb", usbEndpoints);
  const bleListed = listed("bluetooth", bleEndpoints);

  async function connectWith(endpoint: LinkEndpoint, model: DeviceModel) {
    const link = linkOf(endpoint);
    rememberPedal({
      link,
      id: endpoint.id,
      label: endpoint.label,
      model,
    });
    if (armStartup || readPreferences().startup) {
      setStartup({ link, id: endpoint.id });
    }
    setArmStartup(false);
    refreshPreferences();
    setBusy(true);
    setError(null);
    setPending(null);
    setOpen(false);
    suppressDisconnectFeedback.current = true;
    try {
      await toast
        .promise(session.connect(endpoint, model), {
          loading: "Connecting…",
          success: `Connected to ${endpoint.label}`,
          error: (cause) =>
            cause instanceof Error ? cause.message : "Could not connect.",
        })
        .unwrap();
      suppressDisconnectFeedback.current = false;
    } catch {
      // Error toast from toast.promise; modal already closed so the user can reopen Connect.
    } finally {
      setBusy(false);
    }
  }

  function pickDevice(endpoint: LinkEndpoint) {
    if (endpoint.suggestedModel) {
      void connectWith(endpoint, endpoint.suggestedModel);
      return;
    }
    setPending(endpoint);
  }

  function forgetListed(endpoint: ListedPedal) {
    const link = linkOf(endpoint);
    const prefs = readPreferences();
    const match = prefs.pedals.find(
      (pedal) =>
        pedal.link === link &&
        (pedal.id === endpoint.id || pedal.label === endpoint.label),
    );
    const ids = new Set<string>([endpoint.id]);
    if (match) {
      ids.add(match.id);
    }
    const wasStartup =
      prefs.startup?.link === link &&
      (prefs.startup.id === endpoint.id || prefs.startup.id === match?.id);
    for (const id of ids) {
      forgetPedal(id);
    }
    if (wasStartup) {
      setArmStartup(false);
    }
    setOmittedKeys((current) => {
      const next = new Set(current);
      for (const id of ids) {
        next.add(omitKey(link, id));
      }
      return [...next];
    });
    refreshPreferences();
    if (link === "bluetooth") {
      void session.forgetBluetooth(endpoint.id);
    }
  }

  function onStartupChecked(checked: boolean) {
    if (checked) {
      setArmStartup(true);
      return;
    }
    setArmStartup(false);
    clearStartup();
    refreshPreferences();
  }

  function clearFavorite() {
    setArmStartup(false);
    clearStartup();
    refreshPreferences();
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      await session.disconnect();
      setPending(null);
      setLinkTab("usb");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not disconnect.",
      );
    } finally {
      setBusy(false);
    }
  }

  const label = connected ? snapshot.endpoint.label : "Disconnected";
  const modelLabel = connected ? displayModelName(snapshot.model) : "Disconnected";

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={connected ? `Connected to ${label}` : "Connect a pedal"}
        onClick={() => {
          navigate("/");
          openOnTab.current = "usb";
          setLinkTab("usb");
          setOpen(true);
        }}
        className={connected ? "gap-2.5" : undefined}
      >
        <span
          aria-hidden
          className={
            connected
              ? "size-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_8px_2px] shadow-emerald-400"
              : "size-2 shrink-0 rounded-full bg-muted-foreground/50"
          }
        />
        <span className="md:hidden">{modelLabel}</span>
        <span className="hidden md:inline">{label}</span>
        {connected ? (
          snapshot.linkMode === "bluetooth" ? (
            <Bluetooth className="hidden text-muted-foreground md:inline" />
          ) : (
            <Usb className="hidden text-muted-foreground md:inline" />
          )
        ) : null}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setPending(null);
            setError(null);
          }
          setOpen(next);
        }}
      >
        <DialogContent className="sm:max-w-md">
          {snapshot.status === "connected" ? (
            <ConnectedPanel
              linkMode={snapshot.linkMode}
              endpointLabel={snapshot.endpoint.label}
              model={snapshot.model}
              error={error}
              busy={busy}
              onDisconnect={() => void disconnect()}
            />
          ) : askingModel && pending ? (
            <SelectModelPanel
              pendingLabel={pending.label}
              error={error}
              busy={busy}
              onConnect={(model) => void connectWith(pending, model)}
              onBack={() => setPending(null)}
            />
          ) : (
            <ScanPanel
              linkTab={linkTab}
              onLinkTabChange={(value) => {
                setError(null);
                setLinkTab(value);
                if (value !== "bluetooth") {
                  return;
                }
                const hasListed =
                  mergeListedPedals(
                    "bluetooth",
                    bleEndpoints,
                    preferences.pedals,
                    omittedIdsFor("bluetooth", omittedKeys),
                  ).length > 0;
                void scanBluetooth(!hasListed);
              }}
              usbEndpoints={usbListed}
              bleEndpoints={bleListed}
              error={error}
              busy={busy}
              startupChecked={startupChecked}
              startupDisabled={
                (linkTab === "usb" ? usbListed : bleListed).length === 0
              }
              onStartupChecked={onStartupChecked}
              onPickDevice={pickDevice}
              onForget={forgetListed}
              onClearFavorite={clearFavorite}
              onRefresh={() => {
                setOmittedKeys((current) =>
                  current.filter((key) => !key.startsWith(`${linkTab}:`)),
                );
                void (linkTab === "usb" ? scanUsb() : scanBluetooth(true));
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
