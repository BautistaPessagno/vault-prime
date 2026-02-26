"use client";

import Link from "next/link";

type EntriesHeaderProps = {
  onCreate: () => void;
  onLogout: () => void;
  isLoggingOut: boolean;
};

export default function EntriesHeader({
  onCreate,
  onLogout,
  isLoggingOut,
}: EntriesHeaderProps) {
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
      <div className="flex flex-wrap gap-3">
        <Link
          href="/settings"
          className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--accent)]"
        >
          Settings
        </Link>
        <button
          onClick={onCreate}
          className="rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-[color:var(--accent-foreground)] transition hover:brightness-95"
        >
          New Entry
        </button>
        <button
          onClick={onLogout}
          disabled={isLoggingOut}
          className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoggingOut ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </header>
  );
}
