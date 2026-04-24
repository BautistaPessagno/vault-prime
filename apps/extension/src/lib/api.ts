import type { EncryptedEntry } from "./types";

const rawApiUrl = import.meta.env.VITE_API_URL;
if (!rawApiUrl) {
  throw new Error(
    "VITE_API_URL is required. Set it (e.g. https://vault-prime.com) before building the extension.",
  );
}
if (import.meta.env.PROD && !rawApiUrl.startsWith("https://")) {
  throw new Error(
    "VITE_API_URL must use https:// in production builds. Got: " + rawApiUrl,
  );
}
const API_BASE: string = rawApiUrl;

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
