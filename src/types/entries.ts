export type Entry = {
  id: string;
  user_id: string | null;
  name: string;
  username: string;
  url: string;
  password: string;
  created_at: string | null;
  last_edited: string | null;
  last_copied: string | null;
};

export type EntryDraft = {
  name: string;
  username: string;
  url: string;
  password: string;
};
