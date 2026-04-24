"use client";

import { useState, useEffect } from "react";
import type { ZXCVBNResult } from "zxcvbn";
import type { EntryDraft } from "@/src/types/entries";
import PasswordStrengthMeter from "@/src/components/password-strength-meter";
import FloatingField from "@/src/components/ui/floating-field";
import SiteIcon from "@/src/components/entries/site-icon";

type EntryEditorFormProps = {
  draft: EntryDraft;
  isCreating: boolean;
  onDraftChange: (draft: EntryDraft) => void;
  onGeneratePassword: () => void;
  onCancel: () => void;
  onSubmit: (event: React.FormEvent) => void;
};

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-sm font-semibold text-[color:var(--foreground)]">
      {children}
    </h3>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 md:p-5">
      {children}
    </div>
  );
}

function IconButton({
  onClick,
  title,
  children,
  type = "button",
}: {
  onClick?: () => void;
  title: string;
  children: React.ReactNode;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      title={title}
      aria-label={title}
      className="rounded-full p-1.5 text-[color:var(--muted-foreground)] transition hover:bg-[color:var(--muted)] hover:text-[color:var(--foreground)]"
    >
      {children}
    </button>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
      <line x1="1" y1="1" x2="23" y2="23"></line>
    </svg>
  ) : (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  );
}

function RegenerateIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <polyline points="21 4 21 10 15 10" />
    </svg>
  );
}

export default function EntryEditorForm({
  draft,
  isCreating,
  onDraftChange,
  onGeneratePassword,
  onCancel,
  onSubmit,
}: EntryEditorFormProps) {
  const [passwordStrength, setPasswordStrength] = useState<ZXCVBNResult | null>(
    null,
  );
  const [showPassword, setShowPassword] = useState(false);

  const nameError =
    draft.name.length > 255 ? "Name is too long (max 255 characters)." : "";
  const usernameError =
    draft.username.length > 255
      ? "Username is too long (max 255 characters)."
      : "";

  const urlValue = draft.url.trim();
  let urlError = "";
  if (urlValue) {
    if (urlValue.length > 2048) {
      urlError = "URL is too long (max 2048 characters).";
    } else {
      try {
        const parsed = new URL(urlValue);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          urlError = "Only http and https links are allowed.";
        }
      } catch {
        urlError = "Enter a valid URL starting with https://";
      }
    }
  }

  useEffect(() => {
    if (!draft.password) {
      setPasswordStrength(null);
      return;
    }
    import("zxcvbn").then((zxcvbn) => {
      const userInputs = [draft.name, draft.username, draft.url].filter(Boolean);
      const result = zxcvbn.default(draft.password, userInputs);
      setPasswordStrength(result);
    });
  }, [draft.password, draft.name, draft.username, draft.url]);

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <SiteIcon url={urlValue && !urlError ? urlValue : null} name={draft.name || "?"} size={48} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
            Editor
          </p>
          <h2 className="text-2xl font-semibold">
            {isCreating ? "New Entry" : "Edit Entry"}
          </h2>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <section>
          <SectionHeader>Item details</SectionHeader>
          <SectionCard>
            <FloatingField
              label={
                <>
                  Item name{" "}
                  <span className="text-[color:var(--muted-foreground)]/70">
                    (required)
                  </span>
                </>
              }
              type="text"
              value={draft.name}
              onChange={(e) =>
                onDraftChange({ ...draft, name: e.target.value })
              }
              placeholder="Site name"
              error={nameError}
              autoComplete="off"
            />
          </SectionCard>
        </section>

        <section>
          <SectionHeader>Login credentials</SectionHeader>
          <SectionCard>
            <div className="space-y-3">
              <FloatingField
                label="Username"
                type="text"
                value={draft.username}
                onChange={(e) =>
                  onDraftChange({ ...draft, username: e.target.value })
                }
                placeholder="user@email.com"
                error={usernameError}
                autoComplete="off"
              />
              <FloatingField
                label="Password"
                type={showPassword ? "text" : "password"}
                value={draft.password}
                onChange={(e) =>
                  onDraftChange({ ...draft, password: e.target.value })
                }
                autoComplete="new-password"
                hint="Use the generator to create a strong unique password"
                rightSlot={
                  <>
                    <IconButton
                      onClick={() => setShowPassword((v) => !v)}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      <EyeIcon open={showPassword} />
                    </IconButton>
                    <IconButton
                      onClick={onGeneratePassword}
                      title="Generate password"
                    >
                      <RegenerateIcon />
                    </IconButton>
                  </>
                }
              />
              {draft.password && passwordStrength && (
                <PasswordStrengthMeter
                  strength={passwordStrength}
                  password={draft.password}
                  showRequirements={false}
                />
              )}
            </div>
          </SectionCard>
        </section>

        <section>
          <SectionHeader>Website</SectionHeader>
          <SectionCard>
            <FloatingField
              label="Website (URL)"
              type="text"
              value={draft.url}
              onChange={(e) => onDraftChange({ ...draft, url: e.target.value })}
              placeholder="https://example.com"
              error={urlError}
              autoComplete="off"
              inputMode="url"
            />
          </SectionCard>
        </section>

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
