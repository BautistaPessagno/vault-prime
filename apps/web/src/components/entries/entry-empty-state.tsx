"use client";

type EntryEmptyStateProps = {
  onCreate: () => void;
};

export default function EntryEmptyState({ onCreate }: EntryEmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center text-[color:var(--muted-foreground)]">
      <div className="rounded-full border border-[color:var(--border)] p-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-[color:var(--foreground)]">
        Select an entry
      </h3>
      <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
        Choose an entry from the panel or create a new one.
      </p>
      <button
        onClick={onCreate}
        className="mt-5 rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-[color:var(--accent-foreground)] transition hover:brightness-95"
      >
        Create Entry
      </button>
    </div>
  );
}
