const AUTHORIZE_URL = "https://www.tone3000.com/api/v1/oauth/authorize";

export const TONE3000_TOKEN_URL = "https://www.tone3000.com/api/v1/oauth/token";

export type AuthorizeKind = "sign-in" | "catalog";

/** Select-catalog `gears` query: All → amp + amp-cab; otherwise one gear. */
/** `cab` is the cabinet-IR catalog: it selects `format=ir` and no NAM architecture. */
export type CatalogGears = "amp" | "amp-cab" | "amp_amp-cab" | "cab";

export function catalogGearsForFilter(gear: "all" | "amp" | "amp-cab"): CatalogGears {
  if (gear === "amp") {
    return "amp";
  }
  if (gear === "amp-cab") {
    return "amp-cab";
  }
  return "amp_amp-cab";
}

export function publishableKey(): string {
  const value = import.meta.env.VITE_TONE3000_CLIENT_ID;
  return typeof value === "string" ? value.trim() : "";
}

export function requireClientId(value: string): string {
  const clientId = value.trim();
  if (!clientId) {
    throw new Error("Missing TONE3000 client_id");
  }
  return clientId;
}

export function tone3000RedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}/`;
}

export function acceptOAuthState(returnedState: string | null, storedState: string | null): boolean {
  return (
    returnedState !== null &&
    storedState !== null &&
    returnedState.length > 0 &&
    returnedState === storedState
  );
}

export function buildAuthorizeUrl(input: {
  kind: AuthorizeKind;
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
  gears?: CatalogGears;
}): string {
  const clientId = requireClientId(input.clientId);
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("code_challenge", input.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", input.state);
  if (input.kind === "catalog") {
    url.searchParams.set("prompt", "select_tone");
    if (input.gears === "cab") {
      url.searchParams.set("format", "ir");
    } else {
      url.searchParams.set("format", "nam");
      url.searchParams.set("architecture", "2");
    }
    url.searchParams.set("gears", input.gears ?? "amp_amp-cab");
    url.searchParams.set("menubar", "true");
  }
  return url.toString();
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function randomVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

function assertOAuth(): void {
  const redirectUri = tone3000RedirectUri("https://gpstudio.patocorrenti.com");
  const catalog = new URL(
    buildAuthorizeUrl({
      kind: "catalog",
      clientId: "pub_key",
      redirectUri,
      state: "state1",
      challenge: "challenge1",
    }),
  );
  const params = catalog.searchParams;
  if (
    catalog.origin + catalog.pathname !== AUTHORIZE_URL ||
    params.get("prompt") !== "select_tone" ||
    params.get("format") !== "nam" ||
    params.get("architecture") !== "2" ||
    params.get("gears") !== "amp_amp-cab" ||
    params.get("menubar") !== "true" ||
    params.get("redirect_uri") !== "https://gpstudio.patocorrenti.com/" ||
    params.get("code_challenge_method") !== "S256" ||
    params.get("response_type") !== "code" ||
    params.get("client_id") !== "pub_key" ||
    params.has("client_secret") ||
    catalog.href.includes("/tones/search") ||
    catalog.href.includes("t3k_cs_")
  ) {
    throw new Error("Catalog authorize URL must carry the select-tone query and no secret");
  }
  const signIn = new URL(
    buildAuthorizeUrl({
      kind: "sign-in",
      clientId: "pub_key",
      redirectUri,
      state: "state1",
      challenge: "challenge1",
    }),
  );
  if (signIn.searchParams.has("prompt")) {
    throw new Error("Header sign-in must omit prompt");
  }
  const ampOnly = new URL(
    buildAuthorizeUrl({
      kind: "catalog",
      clientId: "pub_key",
      redirectUri,
      state: "state1",
      challenge: "challenge1",
      gears: "amp",
    }),
  );
  if (ampOnly.searchParams.get("gears") !== "amp" || catalogGearsForFilter("all") !== "amp_amp-cab") {
    throw new Error("Catalog gears must follow the Amp / Amp + Cab / All filter");
  }
  const irCatalog = new URL(
    buildAuthorizeUrl({
      kind: "catalog",
      clientId: "pub_key",
      redirectUri,
      state: "state1",
      challenge: "challenge1",
      gears: "cab",
    }),
  );
  if (
    irCatalog.searchParams.get("format") !== "ir" ||
    irCatalog.searchParams.get("gears") !== "cab" ||
    irCatalog.searchParams.has("architecture") ||
    irCatalog.searchParams.get("prompt") !== "select_tone"
  ) {
    throw new Error("The IR catalog must select format=ir, gears=cab, and no architecture");
  }
  let missing = false;
  try {
    buildAuthorizeUrl({
      kind: "catalog",
      clientId: "  ",
      redirectUri,
      state: "state1",
      challenge: "challenge1",
    });
  } catch {
    missing = true;
  }
  if (!missing) {
    throw new Error("A missing client_id must be rejected");
  }
  if (acceptOAuthState("returned", "stored") || acceptOAuthState(null, "stored")) {
    throw new Error("A state that does not match the stored one must be rejected");
  }
  if (!acceptOAuthState("stored", "stored")) {
    throw new Error("A matching state must be accepted");
  }
}

assertOAuth();
