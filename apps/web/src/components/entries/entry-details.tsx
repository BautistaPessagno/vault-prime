"use client";

import type { Entry } from "@/src/types/entries";
import SiteIcon from "@/src/components/entries/site-icon";

type EntryDetailsProps = {
  entry: Entry;
  showPassword: boolean;
  onTogglePassword: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: (text: string, label: string, entryId: Entry["id"]) => void;
  formatLastCopied: (value: string | null) => string;
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

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="relative rounded-xl border border-[color:var(--border)] bg-transparent">
      <legend className="ml-3 px-1.5 text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </legend>
      <div className="flex items-center gap-2 px-3 pb-2.5 pt-0">{children}</div>
    </fieldset>
  );
}

function IconButton({
  onClick,
  title,
  disabled,
  children,
}: {
  onClick?: () => void;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="rounded-full p-1.5 text-[color:var(--muted-foreground)] transition hover:bg-[color:var(--muted)] hover:text-[color:var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function CopyIcon() {
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
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
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

export default function EntryDetails({
  entry,
  showPassword,
  onTogglePassword,
  onEdit,
  onDelete,
  onCopy,
  formatLastCopied,
}: EntryDetailsProps) {
  const href = entry.url
    ? entry.url.startsWith("http")
      ? entry.url
      : `https://${entry.url}`
    : null;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <SiteIcon url={entry.url || null} name={entry.name} size={56} />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
              Entry
            </p>
            <h2 className="truncate text-2xl font-semibold md:text-3xl">
              {entry.name}
            </h2>
            <p className="truncate text-sm text-[color:var(--muted-foreground)]">
              {entry.url || "No link"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onEdit}
            className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold transition hover:border-[color:var(--accent)]"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="rounded-full border border-[color:var(--danger)] px-4 py-2 text-sm font-semibold text-[color:var(--danger)] transition hover:brightness-95"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <section>
          <SectionHeader>Item details</SectionHeader>
          <SectionCard>
            <FieldRow label="Item name">
              <span className="flex-1 truncate px-1 text-sm font-medium">
                {entry.name || "—"}
              </span>
            </FieldRow>
          </SectionCard>
        </section>

        <section>
          <SectionHeader>Login credentials</SectionHeader>
          <SectionCard>
            <div className="space-y-3">
              <FieldRow label="Username">
                <span className="flex-1 truncate px-1 text-sm">
                  {entry.username || (
                    <span className="text-[color:var(--muted-foreground)]">
                      No username
                    </span>
                  )}
                </span>
                <IconButton
                  onClick={() => onCopy(entry.username, "Username", entry.id)}
                  title="Copy username"
                  disabled={!entry.username}
                >
                  <CopyIcon />
                </IconButton>
              </FieldRow>

              <FieldRow label="Password">
                <span className="flex-1 truncate px-1 font-mono text-sm">
                  {showPassword ? entry.password : "••••••••••••••••"}
                </span>
                <IconButton
                  onClick={onTogglePassword}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon open={showPassword} />
                </IconButton>
                <IconButton
                  onClick={() => onCopy(entry.password, "Password", entry.id)}
                  title="Copy password"
                >
                  <CopyIcon />
                </IconButton>
              </FieldRow>
            </div>
          </SectionCard>
        </section>

        <section>
          <SectionHeader>Website</SectionHeader>
          <SectionCard>
            <FieldRow label="Website (URL)">
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 truncate px-1 text-sm font-medium text-[color:var(--link)] hover:underline"
                >
                  {entry.url}
                </a>
              ) : (
                <span className="flex-1 truncate px-1 text-sm text-[color:var(--muted-foreground)]">
                  No link
                </span>
              )}
              <IconButton
                onClick={() => onCopy(entry.url, "Link", entry.id)}
                title="Copy link"
                disabled={!entry.url}
              >
                <CopyIcon />
              </IconButton>
            </FieldRow>
          </SectionCard>
        </section>

        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
                Last copied
              </p>
              <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                {formatLastCopied(entry.last_copied)}
              </p>
            </div>
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
                Last edited
              </p>
              <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                {entry.last_edited
                  ? new Date(entry.last_edited).toLocaleString()
                  : "Never"}
              </p>
            </div>
          </div>
          <p className="px-4 text-xs text-[color:var(--muted-foreground)]">
            Created{" "}
            {entry.created_at
              ? new Date(entry.created_at).toLocaleString()
              : "Unknown"}
          </p>
        </div>
      </div>
    </div>
  );
}
