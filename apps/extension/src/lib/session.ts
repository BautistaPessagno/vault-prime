import type { SessionState, StoredSession } from "./types";

const STORAGE_KEY = "vp_session";
const LOCK_ALARM = "vp_auto_lock";
const LOCK_TIMEOUT_MINUTES = 15;

export async function getStoredSession(): Promise<StoredSession | null> {
  const data = await browser.storage.session.get(STORAGE_KEY);
  return (data[STORAGE_KEY] as StoredSession) ?? null;
}

export async function setStoredSession(session: StoredSession): Promise<void> {
  await browser.storage.session.set({ [STORAGE_KEY]: session });
}

export async function clearStoredSession(): Promise<void> {
  await browser.storage.session.remove(STORAGE_KEY);
}

export function resetAutoLockTimer(): void {
  browser.alarms.create(LOCK_ALARM, { delayInMinutes: LOCK_TIMEOUT_MINUTES });
}

export function clearAutoLockTimer(): void {
  browser.alarms.clear(LOCK_ALARM);
}

export function isAutoLockAlarm(alarmName: string): boolean {
  return alarmName === LOCK_ALARM;
}

// In-memory encryption key (wiped on lock)
let encryptionKey: string | null = null;
let currentState: SessionState = "logged_out";

export function getEncryptionKey(): string | null {
  return encryptionKey;
}

export function setEncryptionKey(key: string): void {
  encryptionKey = key;
}

export function clearEncryptionKey(): void {
  encryptionKey = null;
}

export function getState(): SessionState {
  return currentState;
}

export function setState(state: SessionState): void {
  currentState = state;
}
