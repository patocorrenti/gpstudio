const API_ORIGIN = "https://www.tone3000.com";

export const NO_A2_MODEL = "This tone has no A2 model.";
export const NO_IR_MODEL = "This tone has no IR.";

export type A2Model = {
  name: string;
  modelUrl: string;
};

export type A2ToneModels =
  | {
      ok: true;
      title: string;
      gear: string;
      format: "NAM" | "IR";
      username: string;
      userUrl: string | null;
      userAvatarUrl: string | null;
      toneUrl: string | null;
      license: string | null;
      description: string | null;
      imageUrl: string | null;
      models: A2Model[];
    }
  | { ok: false; message: string };

export type ToneListKind = "favorites" | "created" | "downloaded" | "trending" | "latest";

export type ToneListGear = "amp" | "amp-cab" | "cab";

/** What the catalog lists and loads: NAM captures for SnapTones, or cabinet IRs. */
export type ToneTarget = "snaptone" | "ir";

export type ToneListRow = {
  id: string;
  title: string;
  gear: string;
  format: string;
  username: string;
  imageUrl: string | null;
};

export type ToneListPage = {
  rows: ToneListRow[];
  page: number;
  totalPages: number;
};

export type ToneListOptions = {
  page?: number;
  pageSize?: number;
  gear?: ToneListGear;
  query?: string;
  /** `ir`: cabinet IRs only (gear `cab`, format `ir`). Lists have no format param, so this filters rows. */
  format?: "ir";
};

const LIST_PATH: Record<ToneListKind, string> = {
  favorites: "/api/v1/tones/favorited",
  created: "/api/v1/tones/created",
  downloaded: "/api/v1/tones/downloaded",
  trending: "/api/v1/tones/trending",
  latest: "/api/v1/tones/latest",
};

export function tone3000GearLabel(gear: string): string {
  if (gear === "amp") {
    return "Amp";
  }
  if (gear === "amp-cab") {
    return "Amp + Cab";
  }
  if (gear === "cab") {
    return "Cab";
  }
  return gear;
}

/** Human label for Tone.license from GET /api/v1/tones/{id}. */
export function tone3000LicenseLabel(license: string | null | undefined): string | null {
  if (!license) {
    return null;
  }
  switch (license) {
    case "t3k":
      return "T3K";
    case "cc-by":
      return "CC BY";
    case "cc-by-sa":
      return "CC BY-SA";
    case "cc-by-nc":
      return "CC BY-NC";
    case "cc-by-nc-sa":
      return "CC BY-NC-SA";
    case "cc-by-nd":
      return "CC BY-ND";
    case "cc-by-nc-nd":
      return "CC BY-NC-ND";
    case "cco":
      return "CC0";
    default:
      return license;
  }
}

/** Amp and Amp + Cab only — not pedals, IR, or other gears. */
export function isAmpFamilyGear(gear: string): boolean {
  return gear === "amp" || gear === "amp-cab";
}

export function buildToneListUrl(kind: ToneListKind, options: ToneListOptions = {}): string {
  const url = new URL(`${API_ORIGIN}${LIST_PATH[kind]}`);
  if (kind === "favorites" || kind === "created" || kind === "downloaded") {
    url.searchParams.set("page", String(Math.max(1, options.page ?? 1)));
    url.searchParams.set("page_size", String(Math.min(100, Math.max(1, options.pageSize ?? 20))));
    if (options.gear) {
      url.searchParams.set("gear", options.gear);
    }
    const query = options.query?.trim();
    if (query) {
      url.searchParams.set("query", query);
    }
  } else if (kind === "trending" && options.gear) {
    url.searchParams.set("gear", options.gear);
  }
  return url.toString();
}

function stringField(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object" || !(key in value)) {
    return null;
  }
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" && field.trim() ? field.trim() : null;
}

function idField(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("id" in value)) {
    return null;
  }
  const id = (value as { id: unknown }).id;
  if (typeof id === "number" && Number.isFinite(id)) {
    return String(id);
  }
  if (typeof id === "string" && id.trim()) {
    return id.trim();
  }
  return null;
}

function usernameOf(value: unknown): string {
  const direct = stringField(value, "username");
  if (direct) {
    return direct;
  }
  if (!value || typeof value !== "object" || !("user" in value)) {
    return "";
  }
  return stringField((value as { user: unknown }).user, "username") ?? "";
}

function userUrlOf(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("user" in value)) {
    return null;
  }
  return stringField((value as { user: unknown }).user, "url");
}

function imageUrlOf(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("images" in value)) {
    return null;
  }
  const images = (value as { images: unknown }).images;
  if (!Array.isArray(images)) {
    return null;
  }
  for (const entry of images) {
    if (typeof entry === "string" && entry.trim()) {
      return entry.trim();
    }
  }
  return null;
}

function formatOf(value: unknown): string {
  const raw = stringField(value, "format");
  if (!raw) {
    return "";
  }
  if (raw.toLowerCase() === "nam") {
    return "NAM";
  }
  if (raw.toLowerCase() === "ir") {
    return "IR";
  }
  return raw;
}

export function parseToneListPage(body: unknown): ToneListPage {
  const data =
    body && typeof body === "object" && "data" in body
      ? (body as { data: unknown }).data
      : null;
  const rows: ToneListRow[] = [];
  if (Array.isArray(data)) {
    for (const item of data) {
      const id = idField(item);
      if (!id) {
        continue;
      }
      rows.push({
        id,
        title: stringField(item, "title") ?? "Tone",
        gear: stringField(item, "gear") ?? "",
        format: formatOf(item),
        username: usernameOf(item),
        imageUrl: imageUrlOf(item),
      });
    }
  }
  const page =
    body && typeof body === "object" && "page" in body && typeof (body as { page: unknown }).page === "number"
      ? Math.max(1, (body as { page: number }).page)
      : 1;
  const totalPages =
    body &&
    typeof body === "object" &&
    "total_pages" in body &&
    typeof (body as { total_pages: unknown }).total_pages === "number"
      ? Math.max(1, (body as { total_pages: number }).total_pages)
      : 1;
  return { rows, page, totalPages };
}

async function authedJson(url: string, accessToken: string, fetchImpl: typeof fetch): Promise<unknown> {
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`TONE3000 request failed (${String(response.status)})`);
  }
  return response.json() as Promise<unknown>;
}

function a2Models(body: unknown): A2Model[] {
  const data =
    body && typeof body === "object" && "data" in body
      ? (body as { data: unknown }).data
      : body;
  if (!Array.isArray(data)) {
    return [];
  }
  const models: A2Model[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const arch =
      "architecture_version" in item
        ? (item as { architecture_version: unknown }).architecture_version
        : "2";
    if (arch !== "2" && arch !== 2) {
      continue;
    }
    const modelUrl = stringField(item, "model_url");
    if (!modelUrl) {
      continue;
    }
    models.push({ name: stringField(item, "name") ?? "Model", modelUrl });
  }
  return models;
}

export type Tone3000User = {
  username: string;
  avatarUrl: string | null;
};

function avatarUrlOf(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const direct =
    stringField(value, "avatar_url") ??
    stringField(value, "avatar") ??
    stringField(value, "image_url");
  if (direct) {
    return direct;
  }
  if ("data" in value) {
    return avatarUrlOf((value as { data: unknown }).data);
  }
  if ("user" in value) {
    return avatarUrlOf((value as { user: unknown }).user);
  }
  return null;
}

export async function fetchTone3000User(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Tone3000User> {
  const body = await authedJson(`${API_ORIGIN}/api/v1/user`, accessToken, fetchImpl);
  const root =
    body && typeof body === "object" && "data" in body
      ? (body as { data: unknown }).data
      : body;
  const username = usernameOf(root) || usernameOf(body);
  if (!username) {
    throw new Error("TONE3000 did not return a username.");
  }
  return {
    username,
    avatarUrl: avatarUrlOf(root) ?? avatarUrlOf(body),
  };
}

async function fetchToneListPage(
  kind: ToneListKind,
  accessToken: string,
  options: ToneListOptions,
  fetchImpl: typeof fetch,
): Promise<ToneListPage> {
  const url = buildToneListUrl(kind, options);
  if (url.includes("/tones/search")) {
    throw new Error("TONE3000 list reads must not use /tones/search");
  }
  const body = await authedJson(url, accessToken, fetchImpl);
  return parseToneListPage(body);
}

function filterRowsByGear(rows: ToneListRow[], gear: ToneListGear | undefined): ToneListRow[] {
  if (gear) {
    return rows.filter((row) => row.gear === gear);
  }
  return rows.filter((row) => isAmpFamilyGear(row.gear));
}

/**
 * Loads a free-tier list. Omitting `gear` means All = Amp and Amp + Cab only
 * (two gear requests when the endpoint accepts `gear`; client filter for latest).
 */
export async function loadToneList(
  kind: ToneListKind,
  accessToken: string,
  options: ToneListOptions = {},
  fetchImpl: typeof fetch = fetch,
): Promise<ToneListPage> {
  if (options.format === "ir") {
    const irOptions = { ...options, gear: "cab" as const };
    const page =
      kind === "latest"
        ? await fetchToneListPage(kind, accessToken, {}, fetchImpl)
        : await fetchToneListPage(kind, accessToken, irOptions, fetchImpl);
    return { ...page, rows: page.rows.filter((row) => row.format.toLowerCase() === "ir") };
  }
  if (kind === "latest") {
    const page = await fetchToneListPage(kind, accessToken, {}, fetchImpl);
    return { ...page, rows: filterRowsByGear(page.rows, options.gear) };
  }
  if (options.gear) {
    return fetchToneListPage(kind, accessToken, options, fetchImpl);
  }
  const [amp, cab] = await Promise.all([
    fetchToneListPage(kind, accessToken, { ...options, gear: "amp" }, fetchImpl),
    fetchToneListPage(kind, accessToken, { ...options, gear: "amp-cab" }, fetchImpl),
  ]);
  const seen = new Set<string>();
  const rows: ToneListRow[] = [];
  for (const row of [...amp.rows, ...cab.rows]) {
    if (seen.has(row.id)) {
      continue;
    }
    seen.add(row.id);
    rows.push(row);
  }
  return {
    rows,
    page: Math.max(1, options.page ?? 1),
    totalPages: Math.max(amp.totalPages, cab.totalPages, 1),
  };
}

function irModels(body: unknown): A2Model[] {
  const data =
    body && typeof body === "object" && "data" in body
      ? (body as { data: unknown }).data
      : body;
  if (!Array.isArray(data)) {
    return [];
  }
  const models: A2Model[] = [];
  for (const item of data) {
    const modelUrl = stringField(item, "model_url");
    if (!modelUrl) {
      continue;
    }
    models.push({ name: stringField(item, "name") ?? "IR", modelUrl });
  }
  return models;
}

/** An IR tone (format `ir`) and its WAV files. Same shape as the A2 result. */
export async function loadToneIrModels(
  toneId: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<A2ToneModels> {
  const toneUrl = `${API_ORIGIN}/api/v1/tones/${encodeURIComponent(toneId)}`;
  const modelsUrl = `${API_ORIGIN}/api/v1/models?tone_id=${encodeURIComponent(toneId)}&page_size=300`;
  const tone = await authedJson(toneUrl, accessToken, fetchImpl);
  const format = stringField(tone, "format");
  if (format && format.toLowerCase() !== "ir") {
    return { ok: false, message: NO_IR_MODEL };
  }
  const models = irModels(await authedJson(modelsUrl, accessToken, fetchImpl));
  if (models.length === 0) {
    return { ok: false, message: NO_IR_MODEL };
  }
  return {
    ok: true,
    title: stringField(tone, "title") ?? "Tone",
    gear: stringField(tone, "gear") ?? "",
    format: "IR",
    username: usernameOf(tone),
    userUrl: userUrlOf(tone),
    userAvatarUrl: avatarUrlOf(tone),
    toneUrl: stringField(tone, "url"),
    license: stringField(tone, "license"),
    description: stringField(tone, "description"),
    imageUrl: imageUrlOf(tone),
    models,
  };
}

export async function loadToneA2Models(
  toneId: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<A2ToneModels> {
  const toneUrl = `${API_ORIGIN}/api/v1/tones/${encodeURIComponent(toneId)}?architecture=2`;
  const modelsUrl = `${API_ORIGIN}/api/v1/models?tone_id=${encodeURIComponent(toneId)}&architecture=2&page_size=300`;
  const tone = await authedJson(toneUrl, accessToken, fetchImpl);
  const listed = await authedJson(modelsUrl, accessToken, fetchImpl);
  const models = a2Models(listed);
  if (models.length === 0) {
    return { ok: false, message: NO_A2_MODEL };
  }
  return {
    ok: true,
    title: stringField(tone, "title") ?? "Tone",
    gear: stringField(tone, "gear") ?? "",
    format: "NAM",
    username: usernameOf(tone),
    userUrl: userUrlOf(tone),
    userAvatarUrl: avatarUrlOf(tone),
    toneUrl: stringField(tone, "url"),
    license: stringField(tone, "license"),
    description: stringField(tone, "description"),
    imageUrl: imageUrlOf(tone),
    models,
  };
}

export async function downloadModelFile(
  modelUrl: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ArrayBuffer> {
  const response = await fetchImpl(modelUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error("The model could not be downloaded.");
  }
  return response.arrayBuffer();
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function assertListUrls(): void {
  const favorites = new URL(buildToneListUrl("favorites", { page: 1, pageSize: 20, gear: "amp", query: "plexi" }));
  if (
    favorites.pathname !== "/api/v1/tones/favorited" ||
    favorites.searchParams.get("gear") !== "amp" ||
    favorites.searchParams.get("query") !== "plexi" ||
    favorites.searchParams.get("page") !== "1" ||
    favorites.searchParams.get("page_size") !== "20"
  ) {
    throw new Error("Favorites list URL must carry page, page_size, gear=amp, and query=plexi");
  }
  const trending = new URL(buildToneListUrl("trending", { gear: "amp-cab", query: "ignored" }));
  if (
    trending.pathname !== "/api/v1/tones/trending" ||
    trending.searchParams.get("gear") !== "amp-cab" ||
    trending.searchParams.has("query") ||
    trending.searchParams.has("page")
  ) {
    throw new Error("Trending list URL must carry gear and must omit query and page");
  }
  const latest = new URL(buildToneListUrl("latest", { gear: "amp", query: "nope", page: 2 }));
  if (
    latest.pathname !== "/api/v1/tones/latest" ||
    latest.searchParams.has("gear") ||
    latest.searchParams.has("query") ||
    latest.searchParams.has("page")
  ) {
    throw new Error("Latest list URL must omit gear, query, and page");
  }
  if (
    favorites.href.includes("/tones/search") ||
    trending.href.includes("/tones/search") ||
    latest.href.includes("/tones/search")
  ) {
    throw new Error("List reads must not build a /tones/search URL");
  }
}

assertListUrls();

void assertListParse().catch((error: unknown) => {
  console.error(error);
  throw error;
});

void assertIrList().catch((error: unknown) => {
  console.error(error);
  throw error;
});

async function assertIrList(): Promise<void> {
  const fetched: string[] = [];
  const page = await loadToneList("favorites", "token", { page: 1, pageSize: 20, format: "ir" }, async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    fetched.push(url);
    return jsonResponse({
      data: [
        { id: 1, title: "V30 4x12", gear: "cab", format: "ir", user: { username: "a" } },
        { id: 2, title: "Cab NAM", gear: "cab", format: "nam", user: { username: "b" } },
      ],
      page: 1,
      total_pages: 2,
    });
  });
  if (
    fetched.length !== 1 ||
    new URL(fetched[0] ?? "https://x").searchParams.get("gear") !== "cab" ||
    page.rows.length !== 1 ||
    page.rows[0]?.title !== "V30 4x12" ||
    page.totalPages !== 2
  ) {
    throw new Error("IR lists must request gear=cab once and keep only format ir");
  }
  const modelUrls: string[] = [];
  const loaded = await loadToneIrModels("90730", "token", async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    modelUrls.push(url);
    if (url.includes("/models")) {
      return jsonResponse({
        data: [{ name: "SM57 Cap", model_url: "https://files.example/sm57.wav", architecture_version: null }],
      });
    }
    return jsonResponse({ title: "Orange V30", gear: "cab", format: "ir", user: { username: "irs" } });
  });
  if (
    !loaded.ok ||
    loaded.format !== "IR" ||
    loaded.models.length !== 1 ||
    modelUrls.some((url) => url.includes("architecture")) ||
    modelUrls.some((url) => url.includes("files.example"))
  ) {
    throw new Error("IR models must load without an architecture filter and without downloading");
  }
}

void assertNoA2Model().catch((error: unknown) => {
  console.error(error);
  throw error;
});

async function assertListParse(): Promise<void> {
  const fetched: string[] = [];
  const page = await loadToneList(
    "favorites",
    "token",
    { page: 1, pageSize: 10, gear: "amp", query: "plexi" },
    async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      fetched.push(url);
      return jsonResponse({
        data: [
          {
            id: 15,
            title: "Plexi Stack",
            gear: "amp",
            format: "nam",
            user: { username: "ampuser" },
            images: ["https://cdn.example/tone.jpg"],
          },
        ],
        page: 1,
        total_pages: 3,
      });
    },
  );
  if (
    page.rows.length !== 1 ||
    page.rows[0]?.id !== "15" ||
    page.rows[0]?.title !== "Plexi Stack" ||
    page.rows[0]?.gear !== "amp" ||
    page.rows[0]?.format !== "NAM" ||
    page.rows[0]?.username !== "ampuser" ||
    page.rows[0]?.imageUrl !== "https://cdn.example/tone.jpg" ||
    page.page !== 1 ||
    page.totalPages !== 3
  ) {
    throw new Error("Favorites payload must parse id, title, gear, format, username, and image URL");
  }
  if (!fetched.some((url) => url.includes("/api/v1/tones/favorited?") && url.includes("gear=amp") && url.includes("query=plexi"))) {
    throw new Error("Favorites read must request gear and query");
  }
  if (fetched.some((url) => url.includes("/tones/search") || url.includes("cdn.example") || url.includes("/models"))) {
    throw new Error("List parse must not request a model file or search");
  }

  const emptyFetched: string[] = [];
  const empty = await loadToneList("favorites", "token", { page: 1, pageSize: 10 }, async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    emptyFetched.push(url);
    return jsonResponse({ data: [], page: 1, total_pages: 1 });
  });
  if (empty.rows.length !== 0) {
    throw new Error("An empty data array must be an empty list");
  }
  const emptyGears = emptyFetched.map((url) => new URL(url).searchParams.get("gear"));
  if (!emptyGears.includes("amp") || !emptyGears.includes("amp-cab")) {
    throw new Error("All must request Amp and Amp + Cab");
  }
  if (emptyFetched.some((url) => url.includes("/models") || url.includes("cdn.example") || url.includes("/tones/search"))) {
    throw new Error("An empty list must not request a model file");
  }

  const mixedFetched: string[] = [];
  const latest = await loadToneList("latest", "token", {}, async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    mixedFetched.push(url);
    return jsonResponse({
      data: [
        { id: 1, title: "Amp One", gear: "amp", format: "nam", user: { username: "a" }, images: null },
        { id: 2, title: "Pedal", gear: "pedal", format: "nam", user: { username: "b" }, images: null },
        { id: 3, title: "Cab", gear: "amp-cab", format: "nam", user: { username: "c" }, images: null },
      ],
    });
  });
  if (
    latest.rows.length !== 2 ||
    latest.rows.some((row) => !isAmpFamilyGear(row.gear)) ||
    mixedFetched.some((url) => url.includes("/tones/search") || url.includes("gear="))
  ) {
    throw new Error("Latest All must keep only Amp and Amp + Cab without a gear query");
  }
}

async function assertNoA2Model(): Promise<void> {
  const fetched: string[] = [];
  let downloaded = false;
  const result = await loadToneA2Models("15", "token", async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    fetched.push(url);
    if (url.includes("/models")) {
      return jsonResponse({
        data: [
          {
            name: "Vintage A1",
            model_url: "https://files.example/a1.nam",
            architecture_version: "1",
          },
        ],
      });
    }
    return jsonResponse({
      title: "Only A1",
      gear: "amp",
      user: { username: "ampuser" },
    });
  });
  if (result.ok || result.message !== NO_A2_MODEL || "models" in result || "file" in result || "bytes" in result) {
    throw new Error("A tone with only A1 models must be an English no-A2 result without a file payload");
  }
  if (!fetched.some((url) => url.includes("/api/v1/tones/15?architecture=2"))) {
    throw new Error("Tone read must pass architecture=2");
  }
  if (!fetched.some((url) => url.includes("/api/v1/models?") && url.includes("architecture=2") && url.includes("page_size=300"))) {
    throw new Error("Model list must request A2 with page_size=300");
  }
  if (fetched.some((url) => url.includes("files.example") || url.includes("/tones/search"))) {
    downloaded = true;
  }
  if (downloaded) {
    throw new Error("An empty A2 list must not download a model");
  }
}
