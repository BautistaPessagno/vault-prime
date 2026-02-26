import Link from "next/link";

export default function VerifyEmailSuccessPage() {
  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
        <header className="mb-8 space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[color:var(--muted-foreground)]">
            Vault Prime
          </p>
          <h1 className="text-3xl font-semibold">Email verified</h1>
          <p className="text-sm text-[color:var(--muted-foreground)]">
            Your account is ready. You can sign in now.
          </p>
        </header>

        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
          <div className="space-y-4">
            <div className="rounded-xl border border-[color:var(--success)] bg-[color:var(--muted)] px-4 py-3 text-sm text-[color:var(--success)]">
              Verification successful.
            </div>

            <Link
              href="/login"
              className="block w-full rounded-xl bg-[color:var(--accent)] px-4 py-3 text-center text-sm font-semibold text-[color:var(--accent-foreground)] transition hover:brightness-95"
            >
              Continue to sign in
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

