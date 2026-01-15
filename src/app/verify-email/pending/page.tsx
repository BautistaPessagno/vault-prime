"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ResendVerificationForm } from "../_components/resend-verification-form";

export default function VerifyEmailPendingPage() {
  return (
    <Suspense fallback={<PendingFallback />}>
      <PendingContent />
    </Suspense>
  );
}

function PendingFallback() {
  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] px-8 py-6 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--accent)] border-t-transparent"></div>
          <p className="mt-4 text-sm text-[color:var(--muted-foreground)]">
            Loading...
          </p>
        </div>
      </div>
    </main>
  );
}

function PendingContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
        <header className="mb-8 space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[color:var(--muted-foreground)]">
            Vault Prime
          </p>
          <h1 className="text-3xl font-semibold">Check your inbox</h1>
          <p className="text-sm text-[color:var(--muted-foreground)]">
            We sent you a verification link. You must verify your email before
            you can sign in.
          </p>
        </header>

        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
          <div className="space-y-3">
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)] px-4 py-3">
              <p className="text-sm font-semibold">Tips</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[color:var(--muted-foreground)]">
                <li>Check spam / promotions.</li>
                <li>The link expires in 15 minutes.</li>
              </ul>
            </div>

            <p className="text-sm text-[color:var(--muted-foreground)]">
              Once verified, go back to{" "}
              <Link
                href="/login"
                className="font-semibold text-[color:var(--foreground)] transition hover:text-[color:var(--accent)]"
              >
                sign in
              </Link>
              .
            </p>
          </div>
        </section>

        <ResendVerificationForm initialEmail={email} />
      </div>
    </main>
  );
}

