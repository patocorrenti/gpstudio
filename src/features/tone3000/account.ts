import { fetchTone3000User } from "@/features/tone3000/api";
import { disconnectTone3000, ensureAccessToken } from "@/features/tone3000/tokens";

export type Tone3000Account =
  | { status: "unknown" }
  | { status: "signed-out" }
  | { status: "signed-in"; username: string; avatarUrl: string | null };

let account: Tone3000Account = { status: "unknown" };
const listeners = new Set<() => void>();
let restoring: Promise<void> | null = null;

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function getTone3000Account(): Tone3000Account {
  return account;
}

export function subscribeTone3000Account(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function disconnectTone3000Account(): void {
  disconnectTone3000(window.localStorage);
  account = { status: "signed-out" };
  emit();
}

export async function completeTone3000SignIn(): Promise<string | null> {
  const access = await ensureAccessToken();
  if (!access) {
    account = { status: "signed-out" };
    emit();
    return null;
  }
  try {
    const user = await fetchTone3000User(access);
    account = {
      status: "signed-in",
      username: user.username,
      avatarUrl: user.avatarUrl,
    };
    emit();
    return user.username;
  } catch {
    account = { status: "signed-out" };
    emit();
    return null;
  }
}

export function restoreTone3000Account(): Promise<void> {
  if (!restoring) {
    restoring = completeTone3000SignIn().then(() => undefined).finally(() => {
      restoring = null;
    });
  }
  return restoring;
}
