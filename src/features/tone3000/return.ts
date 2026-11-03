import { acceptOAuthState } from "@/features/tone3000/oauth";
import {
  STATE_KEY,
  exchangeAuthorizationCode,
  memoryStore,
  type KeyValueStore,
} from "@/features/tone3000/tokens";

export type OAuthReturnFields = {
  code: string | null;
  state: string | null;
  tone_id: string | null;
};

export type OAuthReturnPlan =
  | { kind: "none" }
  | { kind: "frame"; payload: OAuthReturnFields }
  | { kind: "exchange"; payload: OAuthReturnFields }
  | { kind: "mismatch"; payload: OAuthReturnFields };

export function readOAuthReturn(search: string): OAuthReturnFields | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (!params.has("code") && !params.has("state") && !params.has("tone_id")) {
    return null;
  }
  return {
    code: params.get("code"),
    state: params.get("state"),
    tone_id: params.get("tone_id"),
  };
}

export function isOAuthReturnMessage(data: unknown): data is OAuthReturnFields {
  if (!data || typeof data !== "object") {
    return false;
  }
  const record = data as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 3 || !keys.includes("code") || !keys.includes("state") || !keys.includes("tone_id")) {
    return false;
  }
  return nullableString(record.code) && nullableString(record.state) && nullableString(record.tone_id);
}

function nullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

export function planOAuthReturn(input: {
  search: string;
  framed: boolean;
  storedState: string | null;
}): OAuthReturnPlan {
  const payload = readOAuthReturn(input.search);
  if (!payload) {
    return { kind: "none" };
  }
  if (input.framed) {
    return { kind: "frame", payload };
  }
  if (!payload.code || !acceptOAuthState(payload.state, input.storedState)) {
    return { kind: "mismatch", payload };
  }
  return { kind: "exchange", payload };
}

export async function applyTopLevelReturn(input: {
  search: string;
  storedState: string | null;
  exchange: (code: string) => Promise<boolean>;
}): Promise<{ kind: "none" | "exchanged" | "mismatch"; nextUrl: "/#/" | null }> {
  const plan = planOAuthReturn({
    search: input.search,
    framed: false,
    storedState: input.storedState,
  });
  if (plan.kind === "none") {
    return { kind: "none", nextUrl: null };
  }
  if (plan.kind !== "exchange" || !plan.payload.code) {
    return { kind: "mismatch", nextUrl: null };
  }
  const stored = await input.exchange(plan.payload.code);
  if (!stored) {
    return { kind: "mismatch", nextUrl: null };
  }
  return { kind: "exchanged", nextUrl: "/#/" };
}

type ReturnHandler = (payload: OAuthReturnFields) => void;

let returnHandler: ReturnHandler | null = null;
let listening = false;

export function setOAuthReturnHandler(handler: ReturnHandler | null): void {
  returnHandler = handler;
  if (handler && !listening && typeof window !== "undefined") {
    listening = true;
    window.addEventListener("message", (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !isOAuthReturnMessage(event.data)) {
        return;
      }
      returnHandler?.(event.data);
    });
  }
}

export function bootTone3000Return(): "blank" | "ready" | Promise<void> {
  if (typeof window === "undefined") {
    return "ready";
  }
  const plan = planOAuthReturn({
    search: window.location.search,
    framed: window.parent !== window,
    storedState: window.sessionStorage.getItem(STATE_KEY),
  });
  if (plan.kind === "none" || plan.kind === "mismatch") {
    return "ready";
  }
  if (plan.kind === "frame") {
    window.parent.postMessage(plan.payload, window.location.origin);
    return "blank";
  }
  return exchangeAuthorizationCode(plan.payload.code ?? "").then((ok) => {
    if (ok) {
      window.history.replaceState(null, "", "/#/");
    }
  });
}

void assertOAuthReturn().catch((error: unknown) => {
  console.error(error);
  throw error;
});

async function assertOAuthReturn(): Promise<void> {
  const framed = planOAuthReturn({
    search: "?code=abc&state=match&tone_id=42",
    framed: true,
    storedState: "match",
  });
  if (
    framed.kind !== "frame" ||
    framed.payload.code !== "abc" ||
    framed.payload.state !== "match" ||
    framed.payload.tone_id !== "42"
  ) {
    throw new Error("A framed return must post code, state, and tone_id");
  }

  const tokens: KeyValueStore = memoryStore();
  let exchanged = false;
  const matched = await applyTopLevelReturn({
    search: "?code=abc&state=match&tone_id=7",
    storedState: "match",
    exchange: async (code) => {
      exchanged = code === "abc";
      tokens.setItem("access", "stored");
      return true;
    },
  });
  if (!exchanged || matched.kind !== "exchanged" || matched.nextUrl !== "/#/" || tokens.getItem("access") !== "stored") {
    throw new Error("A matching top-level return must exchange, store tokens, and replace with /#/");
  }

  const kept = memoryStore({ access: "keep" });
  let called = false;
  const mismatched = await applyTopLevelReturn({
    search: "?code=abc&state=nope&tone_id=7",
    storedState: "match",
    exchange: async () => {
      called = true;
      kept.setItem("access", "replaced");
      return true;
    },
  });
  if (called || mismatched.kind !== "mismatch" || mismatched.nextUrl !== null || kept.getItem("access") !== "keep") {
    throw new Error("A mismatched state must store nothing");
  }
}
