"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

const loginMessages: Record<string, string> = {
  missing: "Enter both email and password to continue.",
  invalid: "We could not verify those credentials.",
  unexpected: "Something went wrong. Please try again.",
};

const loginSuccess: Record<string, string> = {
  created: "Account created. Sign in to continue.",
  ok: "You are signed in.",
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe,_transparent_55%),_radial-gradient(circle_at_bottom,_#fef3c7,_transparent_45%)] font-sans text-foreground">
      <div className="relative mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-10 px-6 py-12 md:py-20">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-t-transparent"></div>
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe,_transparent_55%),_radial-gradient(circle_at_bottom,_#fef3c7,_transparent_45%)] font-sans text-foreground">
      <div className="relative mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-10 px-6 py-12 md:py-20">
        <header className="space-y-3 text-center">
          <div className="mx-auto inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground shadow-sm">
            Vault Prime
          </div>
          <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Sign in to keep your vault synced across every device.
          </p>
        </header>

        <section className="rounded-3xl border border-border bg-card/90 p-6 shadow-xl shadow-blue-100/40 backdrop-blur">
          {(resolvedError || resolvedSuccess) && (
            <div
              className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
                resolvedError
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {resolvedError ?? resolvedSuccess}
            </div>
          )}
          <div className="mb-6 space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">Sign in</h2>
            <p className="text-sm text-muted-foreground">
              Enter your email and password to continue.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Email
              </label>
              <input
                name="email"
                type="email"
                placeholder="you@vaultprime.com"
                autoComplete="email"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Password
              </label>
              <input
                name="password"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-sky-500 focus:ring-sky-200"
                />
                Remember me
              </label>
              <button
                type="button"
                className="text-sky-600 transition hover:text-sky-700"
              >
                Forgot password?
              </button>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-200/60 transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Signing in..." : "Continue"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            New here?{" "}
            <Link
              href="/signup"
              className="font-semibold text-sky-600 transition hover:text-sky-700"
            >
              Create an account
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
