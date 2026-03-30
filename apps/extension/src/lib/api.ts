import type { EncryptedEntry } from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type LoginApiResponse = {
  token: string;
  encryptedEncryptionKey: string;
  masterKeyHash: string;
  email: string;
};

type EntriesApiResponse = {
  entries: EncryptedEntry[];
};

type ErrorResponse = {
  error: string;
};

export async function apiLogin(
  email: string,
  password: string,
): Promise<LoginApiResponse> {
  const res = await fetch(`${API_BASE}/api/extension/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as ErrorResponse;
    throw new Error(data.error ?? "login_failed");
  }

  return (await res.json()) as LoginApiResponse;
}

export async function apiGetEntries(
  token: string,
): Promise<EncryptedEntry[]> {
  const res = await fetch(`${API_BASE}/api/extension/entries`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as ErrorResponse;
    throw new Error(data.error ?? "fetch_failed");
  }

  const data = (await res.json()) as EntriesApiResponse;
  return data.entries;
}
