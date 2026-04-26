"use client";

import Link from "next/link";

type EntriesHeaderProps = {
  onCreate: () => void;
  onLogout: () => void;
  isLoggingOut: boolean;
};

function GearIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
      <polyline points="16 17 21 12 16 7"></polyline>
      <line x1="21" y1="12" x2="9" y2="12"></line>
    </svg>
  );
}

export default function EntriesHeader({
  onCreate,
  onLogout,
  isLoggingOut,
}: EntriesHeaderProps) {
  const signOutLabel = isLoggingOut ? "Signing out..." : "Sign out";
  const iconButtonClass =
    "inline-flex items-center justify-center rounded-full p-2.5 text-[color:var(--muted-foreground)] transition hover:bg-[color:var(--muted)] hover:text-[color:var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent";

  return (
    <header className="flex flex-col gap-4 border-b border-[color:var(--border)] pb-6 md:flex-row md:items-center md:justify-between">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[color:var(--muted-foreground)]">
          Vault Prime
        </p>
        <h1 className="text-3xl font-semibold">My Entries</h1>
        <p className="text-sm text-[color:var(--muted-foreground)]">
          Everything in one place. Quick search, direct copy.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/settings"
          title="Settings"
          aria-label="Settings"
          className={iconButtonClass}
        >
          <GearIcon />
        </Link>
        <button
          type="button"
          onClick={onLogout}
          disabled={isLoggingOut}
          title={signOutLabel}
          aria-label={signOutLabel}
          className={iconButtonClass}
        >
          <SignOutIcon />
        </button>
        <button
          type="button"
          onClick={onCreate}
          className="ml-1 rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-[color:var(--accent-foreground)] transition hover:brightness-95"
        >
          New Entry
        </button>
      </div>
    </header>
  );
}
