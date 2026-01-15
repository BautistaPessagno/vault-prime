"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ResendVerificationForm } from "../_components/resend-verification-form";

const errorCopy: Record<string, { title: string; body: string }> = {
  missing_token: {
    title: "Missing link",
    body: "That verification link is missing a token. Please request a new one.",
  },
  expired: {
    title: "Link expired",
    body: "That verification link has expired. Request a fresh one below.",
  },
  invalid_token: {
    title: "Invalid link",
    body: "That verification link isn’t valid. Request a fresh one below.",
  },
  db: {
    title: "Server error",
    body: "We couldn’t verify right now. Please try resending the email.",
  },
  unexpected: {
    title: "Something went wrong",
    body: "Please try again or resend a new verification email.",
  },
};

export default function VerifyEmailErrorPage() {
  return (
    <Suspense fallback={<ErrorFallback />}>
      <ErrorContent />
    </Suspense>
  );
}

function ErrorFallback() {
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

function ErrorContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason") ?? "unexpected";
  const email = searchParams.get("email") ?? "";
  const copy = errorCopy[reason] ?? errorCopy.unexpected;

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
        <header className="mb-8 space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[color:var(--muted-foreground)]">
            Vault Prime
          </p>
          <h1 className="text-3xl font-semibold">{copy.title}</h1>
          <p className="text-sm text-[color:var(--muted-foreground)]">
            {copy.body}
          </p>
        </header>

        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
          <div className="space-y-4">
            <div className="rounded-xl border border-[color:var(--danger)] bg-[color:var(--muted)] px-4 py-3 text-sm text-[color:var(--danger)]">
              Verification failed.
            </div>

            <p className="text-sm text-[color:var(--muted-foreground)]">
              You can also go back to{" "}
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

