"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

const loginMessages: Record<string, string> = {
  missing: "Enter both email and password to continue.",
  invalid: "We could not verify those credentials.",
  unverified: "Please verify your email to continue.",
  unexpected: "Something went wrong. Please try again.",
};

const loginSuccess: Record<string, string> = {
  created: "Account created. Sign in to continue.",
  ok: "You are signed in.",
  password_changed: "Password changed successfully. Sign in with your new password.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginFallback() {
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

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const errorFromUrl = searchParams.get("error");
  const successFromUrl = searchParams.get("success");
  const resolvedError =
    errorMessage ?? (errorFromUrl ? loginMessages[errorFromUrl] : null);
  const resolvedSuccess =
    successMessage ?? (successFromUrl ? loginSuccess[successFromUrl] : null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        if (payload.error === "unverified") {
          router.push(`/verify-email?email=${encodeURIComponent(email)}`);
          return;
        }
        setErrorMessage(
          loginMessages[payload.error ?? "unexpected"] ??
            loginMessages.unexpected,
        );
        return;
      }

      router.push("/");
    } catch {
      setErrorMessage(loginMessages.unexpected);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
        <header className="mb-8 space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[color:var(--muted-foreground)]">
            Vault Prime
          </p>
          <h1 className="text-3xl font-semibold">Welcome</h1>
          <p className="text-sm text-[color:var(--muted-foreground)]">
            Sign in to access your vault.
          </p>
        </header>

        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
          {(resolvedError || resolvedSuccess) && (
            <div
              className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
                resolvedError
                  ? "border-[color:var(--danger)] text-[color:var(--danger)]"
                  : "border-[color:var(--success)] text-[color:var(--success)]"
              }`}
            >
              {resolvedError ?? resolvedSuccess}
            </div>
          )}
          <div className="mb-6 space-y-2">
            <h2 className="text-2xl font-semibold">Sign in</h2>
            <p className="text-sm text-[color:var(--muted-foreground)]">
              Use your email and password to continue.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
                Email
              </label>
              <input
                name="email"
                type="email"
                placeholder="you@vaultprime.com"
                autoComplete="email"
                className="w-full rounded-xl border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
                Password
              </label>
              <input
                name="password"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                className="w-full rounded-xl border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-[color:var(--accent-foreground)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Signing in..." : "Continue"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-[color:var(--muted-foreground)]">
            New here?{" "}
            <Link
              href="/signup"
              className="font-semibold text-[color:var(--foreground)] transition hover:text-[color:var(--accent)]"
            >
              Create an account
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
