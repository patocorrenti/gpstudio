import type { DeviceModel } from "@/device/models";
import type { LinkEndpoint } from "@/device/endpoint";

const PREFERENCES_KEY = "gpstudio-preferences";
const THEME_KEY = "gpstudio-theme";
const LEGACY_PREFERENCES_KEY = "patone-preferences";
const PANEL_KEY = "gpstudio.slot-controls.expanded";
const VERSION = 1;

export type PreferenceLink = "usb" | "bluetooth";

export type RememberedPedal = {
  link: PreferenceLink;
  id: string;
  label: string;
  model?: DeviceModel;
};

export type StartupPedal = {
  link: "usb";
  id: string;
};

export type PreferencesDocument = {
  pedals: RememberedPedal[];
  startup: StartupPedal | null;
  dismissed: string[];
};

export type ListedPedal = LinkEndpoint & {
  remembered: boolean;
};

type KeyValueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function browserStore(): KeyValueStore {
  if (typeof localStorage === "undefined") {
    throw new Error("Preferences require localStorage.");
  }
  return localStorage;
}

function emptyDocument(): PreferencesDocument {
  return { pedals: [], startup: null, dismissed: [] };
}

function isLink(value: unknown): value is PreferenceLink {
  return value === "usb" || value === "bluetooth";
}

function isModel(value: unknown): value is DeviceModel {
  return value === "gp5" || value === "gp50";
}

function parsePedal(value: unknown): RememberedPedal | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as {
    link?: unknown;
    id?: unknown;
    label?: unknown;
    model?: unknown;
  };
  if (!isLink(record.link) || typeof record.id !== "string" || record.id.length === 0) {
    return null;
  }
  if (typeof record.label !== "string" || record.label.length === 0) {
    return null;
  }
  const pedal: RememberedPedal = {
    link: record.link,
    id: record.id,
    label: record.label,
  };
  if (record.model !== undefined) {
    if (!isModel(record.model)) {
      return null;
    }
    pedal.model = record.model;
  }
  return pedal;
}

function parseStartup(value: unknown): StartupPedal | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as { link?: unknown; id?: unknown };
  if (record.link !== "usb" || typeof record.id !== "string" || record.id.length === 0) {
    return null;
  }
  return { link: "usb", id: record.id };
}

function parseDismissed(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function parseDocument(raw: string | null): PreferencesDocument {
  if (!raw) {
    return emptyDocument();
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") {
      return emptyDocument();
    }
    const record = value as {
      version?: unknown;
      pedals?: unknown;
      startup?: unknown;
      dismissed?: unknown;
    };
    if (record.version !== VERSION) {
      return emptyDocument();
    }
    const pedals: RememberedPedal[] = [];
    if (Array.isArray(record.pedals)) {
      for (const item of record.pedals) {
        const pedal = parsePedal(item);
        if (pedal && !pedals.some((existing) => existing.id === pedal.id)) {
          pedals.push(pedal);
        }
      }
    }
    return {
      pedals,
      startup: parseStartup(record.startup),
      dismissed: parseDismissed(record.dismissed),
    };
  } catch {
    return emptyDocument();
  }
}

function read(store: KeyValueStore): PreferencesDocument {
  let raw = store.getItem(PREFERENCES_KEY);
  if (!raw) {
    const legacy = store.getItem(LEGACY_PREFERENCES_KEY);
    if (legacy) {
      store.setItem(PREFERENCES_KEY, legacy);
      raw = legacy;
    }
  }
  return parseDocument(raw);
}

function write(store: KeyValueStore, document: PreferencesDocument): void {
  store.setItem(
    PREFERENCES_KEY,
    JSON.stringify({
      version: VERSION,
      pedals: document.pedals,
      startup: document.startup,
      dismissed: document.dismissed,
    }),
  );
}

export function readPreferences(store: KeyValueStore = browserStore()): PreferencesDocument {
  const document = read(store);
  return {
    pedals: document.pedals.map((pedal) => ({ ...pedal })),
    startup: document.startup ? { ...document.startup } : null,
    dismissed: [...document.dismissed],
  };
}

function rewriteStartup(
  startup: StartupPedal | null,
  link: PreferenceLink,
  previousId: string,
  nextId: string,
): StartupPedal | null {
  if (!startup || link !== "usb" || startup.id !== previousId) {
    return startup;
  }
  return { link: "usb", id: nextId };
}

export function rememberPedal(
  pedal: RememberedPedal,
  store: KeyValueStore = browserStore(),
): void {
  const document = read(store);
  const byId = document.pedals.findIndex((item) => item.id === pedal.id);
  const byLabel = document.pedals.findIndex(
    (item) => item.link === pedal.link && item.label === pedal.label,
  );
  const index = byId >= 0 ? byId : byLabel;
  if (index < 0) {
    document.pedals.push({ ...pedal });
    write(store, document);
    return;
  }
  const existing = document.pedals[index];
  const next: RememberedPedal = {
    link: pedal.link,
    id: pedal.id,
    label: pedal.label,
    model: pedal.model ?? existing.model,
  };
  document.pedals[index] = next;
  document.startup = rewriteStartup(document.startup, existing.link, existing.id, pedal.id);
  write(store, document);
}

export function syncRememberedId(
  link: PreferenceLink,
  id: string,
  label: string,
  store: KeyValueStore = browserStore(),
): void {
  const document = read(store);
  if (document.pedals.some((pedal) => pedal.id === id)) {
    return;
  }
  const index = document.pedals.findIndex(
    (pedal) => pedal.link === link && pedal.label === label,
  );
  if (index < 0) {
    return;
  }
  const existing = document.pedals[index];
  document.pedals[index] = { ...existing, id };
  document.startup = rewriteStartup(document.startup, link, existing.id, id);
  write(store, document);
}

export function forgetPedal(id: string, store: KeyValueStore = browserStore()): void {
  const document = read(store);
  const kept = document.pedals.filter((pedal) => pedal.id !== id);
  const removed = kept.length !== document.pedals.length;
  const clearStartup = document.startup?.id === id;
  if (!removed && !clearStartup) {
    return;
  }
  document.pedals = kept;
  if (clearStartup) {
    document.startup = null;
  }
  write(store, document);
}

export function setStartup(
  startup: { link: PreferenceLink; id: string },
  store: KeyValueStore = browserStore(),
): void {
  if (startup.link !== "usb") {
    return;
  }
  const document = read(store);
  document.startup = { link: "usb", id: startup.id };
  write(store, document);
}

export function clearStartup(store: KeyValueStore = browserStore()): void {
  const document = read(store);
  if (!document.startup) {
    return;
  }
  document.startup = null;
  write(store, document);
}

export function dismissBluetooth(id: string, store: KeyValueStore = browserStore()): void {
  const document = read(store);
  if (document.dismissed.includes(id)) {
    return;
  }
  document.dismissed.push(id);
  write(store, document);
}

export function undismissBluetooth(id: string, store: KeyValueStore = browserStore()): void {
  const document = read(store);
  if (!document.dismissed.includes(id)) {
    return;
  }
  document.dismissed = document.dismissed.filter((item) => item !== id);
  write(store, document);
}

export function dismissedBluetoothIds(
  store: KeyValueStore = browserStore(),
): ReadonlySet<string> {
  return new Set(read(store).dismissed);
}

function endpointKind(link: PreferenceLink): LinkEndpoint["kind"] {
  return link === "bluetooth" ? "bluetooth" : "usb-midi";
}

export function mergeListedPedals(
  link: PreferenceLink,
  live: readonly LinkEndpoint[],
  pedals: readonly RememberedPedal[],
  omittedIds: ReadonlySet<string>,
): ListedPedal[] {
  const kind = endpointKind(link);
  const remembered = pedals.filter(
    (pedal) => pedal.link === link && !omittedIds.has(pedal.id),
  );
  const liveIds = new Set(
    live.filter((endpoint) => endpoint.kind === kind).map((endpoint) => endpoint.id),
  );
  const used = new Set<string>();
  const rows: ListedPedal[] = [];

  for (const endpoint of live) {
    if (endpoint.kind !== kind || omittedIds.has(endpoint.id)) {
      continue;
    }
    const byId = remembered.find((pedal) => pedal.id === endpoint.id);
    if (byId) {
      used.add(byId.id);
      rows.push({ ...endpoint, remembered: true });
      continue;
    }
    const byLabel = remembered.find(
      (pedal) =>
        pedal.label === endpoint.label && !liveIds.has(pedal.id) && !used.has(pedal.id),
    );
    if (byLabel) {
      used.add(byLabel.id);
      rows.push({ ...endpoint, remembered: true });
      continue;
    }
    rows.push({ ...endpoint, remembered: false });
  }

  for (const pedal of remembered) {
    if (used.has(pedal.id)) {
      continue;
    }
    rows.push({
      id: pedal.id,
      label: pedal.label,
      kind,
      ...(pedal.model ? { suggestedModel: pedal.model } : {}),
      remembered: true,
    });
  }
  return rows;
}

function memoryStore(seed: Record<string, string> = {}): KeyValueStore & {
  snapshot(): Record<string, string>;
} {
  const data = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
    snapshot() {
      return Object.fromEntries(data);
    },
  };
}

function assertPreferences(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertPreferencesDocument(): void {
  const missing = memoryStore();
  const empty = readPreferences(missing);
  assertPreferences(empty.pedals.length === 0, "Missing preferences read as no pedals");
  assertPreferences(empty.startup === null, "Missing preferences read as no startup");

  const invalid = memoryStore({ [PREFERENCES_KEY]: "{" });
  const invalidRead = readPreferences(invalid);
  assertPreferences(invalidRead.pedals.length === 0, "Invalid JSON reads as no pedals");
  assertPreferences(invalidRead.startup === null, "Invalid JSON reads as no startup");

  const unknown = memoryStore({
    [PREFERENCES_KEY]: JSON.stringify({
      version: 2,
      pedals: [{ link: "usb", id: "0::GP-5", label: "GP-5", model: "gp5" }],
      startup: { link: "usb", id: "0::GP-5" },
    }),
  });
  const unknownRead = readPreferences(unknown);
  assertPreferences(unknownRead.pedals.length === 0, "Unknown version reads as no pedals");
  assertPreferences(unknownRead.startup === null, "Unknown version reads as no startup");

  const themed = memoryStore({
    [THEME_KEY]: "dark",
    [PANEL_KEY]: '["nr"]',
  });
  rememberPedal(
    { link: "usb", id: "0::GP-50", label: "GP-50", model: "gp50" },
    themed,
  );
  setStartup({ link: "usb", id: "0::GP-50" }, themed);
  const kept = themed.snapshot();
  assertPreferences(kept[THEME_KEY] === "dark", "Preferences must leave gpstudio-theme untouched");
  assertPreferences(
    kept[PANEL_KEY] === '["nr"]',
    "Preferences must leave the Controller panel key untouched",
  );

  forgetPedal("0::GP-50", themed);
  const forgotten = readPreferences(themed);
  assertPreferences(forgotten.pedals.length === 0, "Forget removes the pedal");
  assertPreferences(forgotten.startup === null, "Forget clears startup when that pedal was startup");
  assertPreferences(themed.snapshot()[THEME_KEY] === "dark", "Forget must leave gpstudio-theme untouched");

  const rewrite = memoryStore();
  rememberPedal(
    { link: "usb", id: "0::GP-50", label: "GP-50", model: "gp50" },
    rewrite,
  );
  setStartup({ link: "usb", id: "0::GP-50" }, rewrite);
  rememberPedal(
    { link: "usb", id: "3::GP-50", label: "GP-50", model: "gp50" },
    rewrite,
  );
  const rewritten = readPreferences(rewrite);
  assertPreferences(rewritten.pedals.length === 1, "Label match keeps one pedal");
  assertPreferences(
    rewritten.pedals[0]?.id === "3::GP-50",
    "Label match rewrites a desktop-style {index}::{label} id",
  );
  assertPreferences(
    rewritten.startup?.id === "3::GP-50",
    "Label match rewrites the startup id",
  );

  clearStartup(rewrite);
  assertPreferences(readPreferences(rewrite).startup === null, "Clear startup drops only startup");
  assertPreferences(readPreferences(rewrite).pedals.length === 1, "Clear startup keeps remembered pedals");

  const bluetoothStartup = memoryStore({
    [PREFERENCES_KEY]: JSON.stringify({
      version: 1,
      pedals: [{ link: "bluetooth", id: "aa:bb", label: "GP-50", model: "gp50" }],
      startup: { link: "bluetooth", id: "aa:bb" },
      dismissed: [],
    }),
  });
  assertPreferences(
    readPreferences(bluetoothStartup).startup === null,
    "Bluetooth startup reads as no startup",
  );
  setStartup({ link: "bluetooth", id: "aa:bb" }, bluetoothStartup);
  assertPreferences(
    readPreferences(bluetoothStartup).startup === null,
    "setStartup ignores a non-USB link",
  );

  const legacy = memoryStore({
    [LEGACY_PREFERENCES_KEY]: JSON.stringify({
      version: 1,
      pedals: [{ link: "usb", id: "0::GP-5", label: "GP-5", model: "gp5" }],
      startup: { link: "usb", id: "0::GP-5" },
      dismissed: [],
    }),
  });
  const fromLegacy = readPreferences(legacy);
  assertPreferences(fromLegacy.pedals.length === 1, "Legacy preferences key still reads");
  assertPreferences(
    legacy.snapshot()[PREFERENCES_KEY] !== undefined,
    "Legacy preferences migrate to gpstudio-preferences",
  );
}

function assertListedMerge(): void {
  const live: LinkEndpoint[] = [
    { id: "1::GP-5", label: "GP-5", kind: "usb-midi", suggestedModel: "gp5" },
  ];
  const pedals: RememberedPedal[] = [
    { link: "usb", id: "1::GP-5", label: "GP-5", model: "gp5" },
    { link: "usb", id: "0::GP-50", label: "GP-50", model: "gp50" },
    { link: "bluetooth", id: "aa:bb", label: "GP-50 BT", model: "gp50" },
  ];
  const merged = mergeListedPedals("usb", live, pedals, new Set());
  assertPreferences(merged.length === 2, "Live and remembered pedals share one list");
  assertPreferences(
    merged.filter((row) => row.id === "1::GP-5").length === 1,
    "The same pedal is not listed twice",
  );
  assertPreferences(
    merged.find((row) => row.id === "1::GP-5")?.remembered === true,
    "A live pedal that is remembered stays marked remembered",
  );
  assertPreferences(
    merged.some((row) => row.id === "0::GP-50" && row.remembered),
    "A remembered pedal absent from the live scan still appears",
  );
  assertPreferences(
    merged.every((row) => row.kind === "usb-midi"),
    "The other link's pedals stay out",
  );

  const omitted = mergeListedPedals("usb", live, pedals, new Set(["1::GP-5"]));
  assertPreferences(
    !omitted.some((row) => row.id === "1::GP-5"),
    "A just-forgotten pedal is omitted",
  );
  assertPreferences(
    omitted.some((row) => row.id === "0::GP-50"),
    "Forgetting one pedal leaves the others listed",
  );
  const chosenAgain = mergeListedPedals("usb", live, pedals, new Set());
  assertPreferences(
    chosenAgain.some((row) => row.id === "1::GP-5"),
    "A forgotten pedal can be listed again once it is no longer omitted",
  );

  const relabeled = mergeListedPedals(
    "usb",
    [{ id: "4::GP-50", label: "GP-50", kind: "usb-midi" }],
    [{ link: "usb", id: "0::GP-50", label: "GP-50", model: "gp50" }],
    new Set(),
  );
  assertPreferences(relabeled.length === 1, "A new id with the same label is one row");
  assertPreferences(relabeled[0]?.id === "4::GP-50", "Label match uses the live id");
  assertPreferences(relabeled[0]?.remembered === true, "Label match stays remembered");

  const bothIds = mergeListedPedals(
    "usb",
    [
      { id: "0::GP-50", label: "GP-50", kind: "usb-midi" },
      { id: "4::GP-50", label: "GP-50", kind: "usb-midi" },
    ],
    [{ link: "usb", id: "0::GP-50", label: "GP-50", model: "gp50" }],
    new Set(),
  );
  assertPreferences(bothIds.length === 2, "Id match wins when both ids are present");
  assertPreferences(
    bothIds.find((row) => row.id === "0::GP-50")?.remembered === true,
    "The stored id stays the remembered row",
  );
  assertPreferences(
    bothIds.find((row) => row.id === "4::GP-50")?.remembered === false,
    "A second live id with the same label is not collapsed",
  );
}

assertPreferencesDocument();
assertListedMerge();
