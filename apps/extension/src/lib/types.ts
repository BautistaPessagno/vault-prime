export type EncryptedEntry = {
  id: string;
  name: string;
  username: string;
  password: string;
  url: string;
  created_at: string | null;
  last_edited: string | null;
  last_copied: string | null;
};

export type DecryptedEntry = {
  id: string;
  name: string;
  username: string;
  password: string;
  url: string;
  created_at: string | null;
  last_edited: string | null;
  last_copied: string | null;
};

export type SessionState = "logged_out" | "locked" | "unlocked";

export type StoredSession = {
  token: string;
  encryptedEncryptionKey: string;
  masterKeyHash: string;
  email: string;
};
