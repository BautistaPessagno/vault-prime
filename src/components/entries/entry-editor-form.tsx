"use client";

import { useState, useEffect } from "react";
import type { ZXCVBNResult } from "zxcvbn";
import type { EntryDraft } from "@/src/types/entries";
import PasswordStrengthMeter from "@/src/components/password-strength-meter";

type EntryEditorFormProps = {
  draft: EntryDraft;
  isCreating: boolean;
  onDraftChange: (draft: EntryDraft) => void;
  onGeneratePassword: () => void;
  onCancel: () => void;
  onSubmit: (event: React.FormEvent) => void;
};

export default function EntryEditorForm({
  draft,
  isCreating,
  onDraftChange,
  onGeneratePassword,
  onCancel,
  onSubmit,
}: EntryEditorFormProps) {
  const [passwordStrength, setPasswordStrength] = useState<ZXCVBNResult | null>(
    null
  );

  // Check password strength as user types
  useEffect(() => {
    if (!draft.password) {
      setPasswordStrength(null);
      return;
    }

    // Dynamic import to avoid SSR issues
    import("zxcvbn").then((zxcvbn) => {
      const userInputs = [draft.name, draft.username, draft.url].filter(
        Boolean
      );
      const result = zxcvbn.default(draft.password, userInputs);
      setPasswordStrength(result);
    });
  }, [draft.password, draft.name, draft.username, draft.url]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
            Editor
          </p>
          <h2 className="text-2xl font-semibold">
            {isCreating ? "New Entry" : "Edit Entry"}
          </h2>
          <p className="text-sm text-[color:var(--muted-foreground)]">
            Save credentials clearly.
          </p>
        </div>
      </div>
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
              Name
            </label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) =>
                onDraftChange({ ...draft, name: e.target.value })
              }
              className="w-full rounded-xl border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
              placeholder="Site name"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
              Link
            </label>
            <input
              type="text"
              value={draft.url}
              onChange={(e) => onDraftChange({ ...draft, url: e.target.value })}
              className="w-full rounded-xl border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
              placeholder="https://example.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
              Username
            </label>
            <input
              type="text"
              value={draft.username}
              onChange={(e) =>
                onDraftChange({ ...draft, username: e.target.value })
              }
              className="w-full rounded-xl border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
              placeholder="user@email.com"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
              Password
            </label>
            <div className="relative">
              <input
                type="text"
                value={draft.password}
                onChange={(e) =>
                  onDraftChange({ ...draft, password: e.target.value })
                }
                className="w-full rounded-xl border border-[color:var(--border)] bg-transparent px-4 py-3 pr-24 text-sm outline-none transition focus:border-[color:var(--accent)]"
              />
              <button
                type="button"
                onClick={onGeneratePassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted-foreground)] transition hover:border-[color:var(--accent)]"
              >
                Generate
              </button>
            </div>
            {draft.password && passwordStrength && (
              <PasswordStrengthMeter
                strength={passwordStrength}
                password={draft.password}
                showRequirements={false}
              />
            )}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold transition hover:border-[color:var(--accent)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-[color:var(--accent-foreground)] transition hover:brightness-95"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
