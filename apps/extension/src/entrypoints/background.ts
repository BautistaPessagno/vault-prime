import { deriveKey, decryptValue } from "@/lib/crypto";
import { apiLogin, apiGetEntries } from "@/lib/api";
import {
  getStoredSession,
  setStoredSession,
  clearStoredSession,
  resetAutoLockTimer,
  clearAutoLockTimer,
  isAutoLockAlarm,
  getEncryptionKey,
  setEncryptionKey,
  clearEncryptionKey,
  getState,
  setState,
} from "@/lib/session";
import type { BackgroundMessage, CheckAutofillMessage } from "@/lib/messages";
import type { DecryptedEntry } from "@/lib/types";

export default defineBackground(() => {
  // Restore state on startup
  initState();

  // Auto-lock alarm handler
  browser.alarms.onAlarm.addListener((alarm) => {
    if (isAutoLockAlarm(alarm.name)) {
      lock();
    }
  });

  // Message handler
  browser.runtime.onMessage.addListener(
    (message: BackgroundMessage | CheckAutofillMessage, _sender, sendResponse) => {
      handleMessage(message).then(sendResponse);
      return true; // async response
    },
  );
});

async function initState(): Promise<void> {
  const session = await getStoredSession();
  if (session) {
    setState("locked");
  } else {
    setState("logged_out");
  }
}

async function handleMessage(
  message: BackgroundMessage | CheckAutofillMessage,
): Promise<unknown> {
  switch (message.action) {
    case "login":
      return handleLogin(message.email, message.password);
    case "unlock":
      return handleUnlock(message.password);
    case "lock":
      lock();
      return { ok: true };
    case "logout":
      await logout();
      return { ok: true };
    case "getState":
      return {
        state: getState(),
        email: (await getStoredSession())?.email ?? null,
      };
    case "getEntries":
      return handleGetEntries();
    case "checkAutofill":
      return handleCheckAutofill(message.url);
    default:
      return { error: "unknown_action" };
  }
}

async function handleLogin(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { token, encryptedEncryptionKey, masterKeyHash } = await apiLogin(
      email,
      password,
    );

    // Derive stretched key and decrypt encryption key locally
    const stretchedKey = deriveKey(masterKeyHash, password);
    const key = decryptValue(encryptedEncryptionKey, stretchedKey);

    // Store session data (encrypted encryption key for unlock later)
    await setStoredSession({
      token,
      encryptedEncryptionKey,
      masterKeyHash,
      email,
    });

    // Keep decrypted key in memory only
    setEncryptionKey(key);
    setState("unlocked");
    resetAutoLockTimer();

    return { ok: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "login_failed";
    return { ok: false, error: msg };
  }
}

async function handleUnlock(
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getStoredSession();
  if (!session) {
    return { ok: false, error: "no_session" };
  }

  try {
    // Re-derive stretched key from stored masterKeyHash + entered password
    const stretchedKey = deriveKey(session.masterKeyHash, password);
    const key = decryptValue(session.encryptedEncryptionKey, stretchedKey);

    setEncryptionKey(key);
    setState("unlocked");
    resetAutoLockTimer();

    return { ok: true };
  } catch {
    return { ok: false, error: "invalid_password" };
  }
}

function lock(): void {
  clearEncryptionKey();
  clearAutoLockTimer();
  setState("locked");
}

async function logout(): Promise<void> {
  clearEncryptionKey();
  clearAutoLockTimer();
  await clearStoredSession();
  setState("logged_out");
}

async function handleGetEntries(): Promise<
  { ok: true; entries: DecryptedEntry[] } | { ok: false; error: string }
> {
  const key = getEncryptionKey();
  if (!key) {
    return { ok: false, error: "locked" };
  }

  const session = await getStoredSession();
  if (!session) {
    return { ok: false, error: "no_session" };
  }

  try {
    const encrypted = await apiGetEntries(session.token);

    const entries: DecryptedEntry[] = encrypted.map((entry) => ({
      id: entry.id,
      name: decryptValue(entry.name, key),
      username: decryptValue(entry.username, key),
      password: decryptValue(entry.password, key),
      url: decryptValue(entry.url, key),
      created_at: entry.created_at,
      last_edited: entry.last_edited,
      last_copied: entry.last_copied,
    }));

    resetAutoLockTimer();

    return { ok: true, entries };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "fetch_failed";
    if (msg === "unauthorized") {
      await logout();
    }
    return { ok: false, error: msg };
  }
}

async function handleCheckAutofill(
  url: string,
): Promise<{ entries: Array<{ id: string; name: string; username: string; password: string }> }> {
  const key = getEncryptionKey();
  if (!key) {
    return { entries: [] };
  }

  const session = await getStoredSession();
  if (!session) {
    return { entries: [] };
  }

  try {
    const pageHostname = new URL(url).hostname;
    const encrypted = await apiGetEntries(session.token);

    const matches = encrypted
      .map((entry) => {
        const decryptedUrl = decryptValue(entry.url, key);
        let entryHostname = "";
        try {
          entryHostname = new URL(decryptedUrl).hostname;
        } catch {
          return null;
        }
        if (entryHostname !== pageHostname) return null;
        return {
          id: entry.id,
          name: decryptValue(entry.name, key),
          username: decryptValue(entry.username, key),
          password: decryptValue(entry.password, key),
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    resetAutoLockTimer();
    return { entries: matches };
  } catch {
    return { entries: [] };
  }
}
