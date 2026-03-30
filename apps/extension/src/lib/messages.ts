import type { DecryptedEntry, SessionState } from "./types";

// Popup -> Background messages
export type LoginMessage = {
  action: "login";
  email: string;
  password: string;
};

export type UnlockMessage = {
  action: "unlock";
  password: string;
};

export type LockMessage = {
  action: "lock";
};

export type LogoutMessage = {
  action: "logout";
};

export type GetStateMessage = {
  action: "getState";
};

export type GetEntriesMessage = {
  action: "getEntries";
};

export type BackgroundMessage =
  | LoginMessage
  | UnlockMessage
  | LockMessage
  | LogoutMessage
  | GetStateMessage
  | GetEntriesMessage;

// Background -> Popup responses
export type StateResponse = {
  state: SessionState;
  email: string | null;
};

export type LoginResponse =
  | { ok: true }
  | { ok: false; error: string };

export type UnlockResponse =
  | { ok: true }
  | { ok: false; error: string };

export type EntriesResponse =
  | { ok: true; entries: DecryptedEntry[] }
  | { ok: false; error: string };

// Content script -> Background messages
export type CheckAutofillMessage = {
  action: "checkAutofill";
  url: string;
};

export type AutofillResponse = {
  entries: Array<{ id: string; name: string; username: string; password: string }>;
};
