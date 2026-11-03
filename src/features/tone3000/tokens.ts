import {
  TONE3000_TOKEN_URL,
  type AuthorizeKind,
  buildAuthorizeUrl,
  codeChallenge,
  publishableKey,
  randomVerifier,
  requireClientId,
  tone3000RedirectUri,
} from "@/features/tone3000/oauth";

export const ACCESS_KEY = "gpstudio.tone3000.access";
export const REFRESH_KEY = "gpstudio.tone3000.refresh";
export const EXPIRES_KEY = "gpstudio.tone3000.expires";
export const VERIFIER_KEY = "gpstudio.tone3000.verifier";
export const STATE_KEY = "gpstudio.tone3000.state";

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

export type TokenPostResult =
  | { ok: true; tokens: TokenResponse }
  | { ok: false; error: string };

export type TokenPost = (refreshToken: string) => Promise<TokenPostResult>;

export type RefreshResult = "refreshed" | "signed-out" | "unchanged";

export type RefreshGate = { current: Promise<RefreshResult> | null };

const sharedGate: RefreshGate = { current: null };

export function memoryStore(seed: Record<string, string> = {}): KeyValueStore {
  const map = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return map.get(key) ?? null;
    },
    setItem(key, value) {
      map.set(key, value);
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

export function clearTone3000Tokens(store: KeyValueStore): void {
  store.removeItem(ACCESS_KEY);
  store.removeItem(REFRESH_KEY);
  store.removeItem(EXPIRES_KEY);
}

/** Clears the three token keys. Pedal disconnect does not call this, and this module does not import the device session. */
export function disconnectTone3000(store: KeyValueStore): void {
  clearTone3000Tokens(store);
}

export function writeTokens(store: KeyValueStore, tokens: TokenResponse, now: number): void {
  store.setItem(ACCESS_KEY, tokens.access_token);
  store.setItem(REFRESH_KEY, tokens.refresh_token);
  store.setItem(EXPIRES_KEY, String(now + tokens.expires_in * 1000));
}

export function refreshTokenBody(clientId: string, refreshToken: string): URLSearchParams {
  return new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });
}

function isTokenResponse(value: unknown): value is TokenResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const body = value as Record<string, unknown>;
  return (
    typeof body.access_token === "string" &&
    typeof body.refresh_token === "string" &&
    typeof body.expires_in === "number"
  );
}

export function refreshTone3000Tokens(
  store: KeyValueStore,
  post: TokenPost,
  now: () => number = Date.now,
  gate: RefreshGate = sharedGate,
): Promise<RefreshResult> {
  if (gate.current) {
    return gate.current;
  }
  const run = runRefresh(store, post, now);
  gate.current = run;
  void run.finally(() => {
    if (gate.current === run) {
      gate.current = null;
    }
  });
  return run;
}

async function runRefresh(
  store: KeyValueStore,
  post: TokenPost,
  now: () => number,
): Promise<RefreshResult> {
  const used = store.getItem(REFRESH_KEY);
  if (!used) {
    clearTone3000Tokens(store);
    return "signed-out";
  }
  const first = await post(used);
  if (first.ok) {
    writeTokens(store, first.tokens, now());
    return "refreshed";
  }
  if (first.error !== "invalid_grant") {
    return "unchanged";
  }
  const latest = store.getItem(REFRESH_KEY);
  if (latest && latest !== used) {
    const second = await post(latest);
    if (second.ok) {
      writeTokens(store, second.tokens, now());
      return "refreshed";
    }
    if (second.error !== "invalid_grant") {
      return "unchanged";
    }
  }
  clearTone3000Tokens(store);
  return "signed-out";
}

export async function exchangeAuthorizationCode(
  code: string,
  deps?: {
    local?: KeyValueStore;
    session?: KeyValueStore;
    clientId?: string;
    origin?: string;
    now?: number;
    post?: (body: URLSearchParams) => Promise<TokenPostResult>;
  },
): Promise<boolean> {
  const local = deps?.local ?? window.localStorage;
  const session = deps?.session ?? window.sessionStorage;
  const clientId = deps?.clientId ?? publishableKey();
  const verifier = session.getItem(VERIFIER_KEY);
  if (!clientId || !verifier) {
    return false;
  }
  const origin = deps?.origin ?? window.location.origin;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: tone3000RedirectUri(origin),
    client_id: clientId,
  });
  const posted = deps?.post
    ? await deps.post(body)
    : await postToken(body);
  if (!posted.ok) {
    return false;
  }
  writeTokens(local, posted.tokens, deps?.now ?? Date.now());
  session.removeItem(VERIFIER_KEY);
  session.removeItem(STATE_KEY);
  return true;
}

async function postToken(body: URLSearchParams): Promise<TokenPostResult> {
  const response = await fetch(TONE3000_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "request_failed";
    return { ok: false, error };
  }
  if (!isTokenResponse(payload)) {
    return { ok: false, error: "request_failed" };
  }
  return { ok: true, tokens: payload };
}

export function browserRefreshPost(clientId: string): TokenPost {
  return (refreshToken) => postToken(refreshTokenBody(clientId, refreshToken));
}

export async function beginAuthorize(
  kind: AuthorizeKind,
  session: KeyValueStore = window.sessionStorage,
  origin: string = window.location.origin,
): Promise<string> {
  const clientId = requireClientId(publishableKey());
  const verifier = randomVerifier();
  const state = randomVerifier();
  const challenge = await codeChallenge(verifier);
  session.setItem(VERIFIER_KEY, verifier);
  session.setItem(STATE_KEY, state);
  return buildAuthorizeUrl({
    kind,
    clientId,
    redirectUri: tone3000RedirectUri(origin),
    state,
    challenge,
  });
}

export async function ensureAccessToken(store: KeyValueStore = window.localStorage): Promise<string | null> {
  const access = store.getItem(ACCESS_KEY);
  const expires = Number(store.getItem(EXPIRES_KEY) ?? "0");
  if (access && Number.isFinite(expires) && Date.now() < expires) {
    return access;
  }
  const clientId = publishableKey();
  if (!clientId || !store.getItem(REFRESH_KEY)) {
    return access && Number.isFinite(expires) && Date.now() < expires ? access : null;
  }
  const result = await refreshTone3000Tokens(store, browserRefreshPost(clientId));
  if (result === "signed-out") {
    return null;
  }
  return store.getItem(ACCESS_KEY);
}

function assertTokens(): void {
  const body = refreshTokenBody("pub_key", "previous");
  if (body.get("grant_type") !== "refresh_token" || body.has("client_secret")) {
    throw new Error("Refresh must post grant_type=refresh_token and no secret");
  }
  const pedal = "pedal-session";
  const disconnected = memoryStore({
    [ACCESS_KEY]: "access",
    [REFRESH_KEY]: "refresh",
    [EXPIRES_KEY]: "1",
    [pedal]: "connected",
  });
  disconnectTone3000(disconnected);
  if (
    disconnected.getItem(ACCESS_KEY) !== null ||
    disconnected.getItem(REFRESH_KEY) !== null ||
    disconnected.getItem(EXPIRES_KEY) !== null ||
    disconnected.getItem(pedal) !== "connected"
  ) {
    throw new Error("Disconnect must clear only the three token keys");
  }
}

assertTokens();

void assertTokenRefresh().catch((error: unknown) => {
  console.error(error);
  throw error;
});

async function assertTokenRefresh(): Promise<void> {
  const rotated = memoryStore({
    [ACCESS_KEY]: "old-access",
    [REFRESH_KEY]: "previous",
    [EXPIRES_KEY]: "1",
  });
  const rotation = await refreshTone3000Tokens(
    rotated,
    async () => ({
      ok: true,
      tokens: { access_token: "new-access", refresh_token: "next", expires_in: 30 },
    }),
    () => 5_000,
    { current: null },
  );
  if (rotation !== "refreshed" || rotated.getItem(REFRESH_KEY) !== "next" || rotated.getItem(REFRESH_KEY) === "previous") {
    throw new Error("Refresh must store the rotated token, not the previous one");
  }

  const sibling = memoryStore({
    [ACCESS_KEY]: "sibling-access",
    [REFRESH_KEY]: "sibling",
    [EXPIRES_KEY]: "1",
  });
  let sent = "";
  await refreshTone3000Tokens(
    sibling,
    async (token) => {
      sent = token;
      return {
        ok: true,
        tokens: { access_token: "fresh", refresh_token: "rotated-sibling", expires_in: 30 },
      };
    },
    () => 5_000,
    { current: null },
  );
  if (sent !== "sibling" || sibling.getItem(REFRESH_KEY) !== "rotated-sibling") {
    throw new Error("Refresh must re-read a sibling token before posting");
  }

  const dead = memoryStore({
    [ACCESS_KEY]: "access",
    [REFRESH_KEY]: "dead",
    [EXPIRES_KEY]: "1",
  });
  const signedOut = await refreshTone3000Tokens(
    dead,
    async () => ({ ok: false, error: "invalid_grant" }),
    () => 5_000,
    { current: null },
  );
  if (signedOut !== "signed-out" || dead.getItem(ACCESS_KEY) !== null || dead.getItem(REFRESH_KEY) !== null) {
    throw new Error("invalid_grant after a re-read must clear the three token keys");
  }

  let calls = 0;
  let release: (result: TokenPostResult) => void = () => {};
  const pending = new Promise<TokenPostResult>((resolve) => {
    release = resolve;
  });
  const gate: RefreshGate = { current: null };
  const shared = memoryStore({
    [ACCESS_KEY]: "access",
    [REFRESH_KEY]: "previous",
    [EXPIRES_KEY]: "1",
  });
  const first = refreshTone3000Tokens(
    shared,
    () => {
      calls += 1;
      return pending;
    },
    () => 5_000,
    gate,
  );
  const second = refreshTone3000Tokens(
    shared,
    () => {
      calls += 1;
      return pending;
    },
    () => 5_000,
    gate,
  );
  if (calls !== 1) {
    throw new Error("One refresh runs at a time per tab");
  }
  release({
    ok: true,
    tokens: { access_token: "once", refresh_token: "once-refresh", expires_in: 10 },
  });
  const [left, right] = await Promise.all([first, second]);
  if (left !== "refreshed" || right !== "refreshed" || shared.getItem(REFRESH_KEY) !== "once-refresh") {
    throw new Error("Concurrent refresh must share one token write");
  }
}
