const API_ORIGIN = "https://www.tone3000.com";

export const NO_A2_MODEL = "This tone has no A2 model.";

export type A2Model = {
  name: string;
  modelUrl: string;
};

export type A2ToneModels =
  | {
      ok: true;
      title: string;
      gear: string;
      format: "NAM";
      username: string;
      models: A2Model[];
    }
  | { ok: false; message: string };

export function tone3000GearLabel(gear: string): string {
  if (gear === "amp") {
    return "Amp";
  }
  if (gear === "amp-cab") {
    return "Amp + Cab";
  }
  return gear;
}

function stringField(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object" || !(key in value)) {
    return null;
  }
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" && field.trim() ? field.trim() : null;
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

export async function fetchTone3000Username(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const body = await authedJson(`${API_ORIGIN}/api/v1/user`, accessToken, fetchImpl);
  const username = usernameOf(body);
  if (!username) {
    throw new Error("TONE3000 did not return a username.");
  }
  return username;
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

void assertNoA2Model().catch((error: unknown) => {
  console.error(error);
  throw error;
});

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
