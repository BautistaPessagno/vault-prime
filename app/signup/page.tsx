"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

const signupMessages: Record<string, string> = {
  missing: "Enter an email and password to create your account.",
  exists: "That email already has an account.",
  db: "We could not reach the database. Try again soon.",
  insert: "We could not create your account. Try again.",
  unexpected: "Something went wrong. Please try again.",
};

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const errorFromUrl = searchParams.get("error");
  const resolvedError =
    errorMessage ?? (errorFromUrl ? signupMessages[errorFromUrl] : null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      const response = await fetch("/api/auth/signup", {
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
          signupMessages[payload.error ?? "unexpected"] ??
            signupMessages.unexpected,
        );
        return;
      }

      // Signup now automatically logs the user in with the session
      router.push("/");
    } catch {
      setErrorMessage(signupMessages.unexpected);
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
            Create your account
          </h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Start storing your secrets with end-to-end encryption.
          </p>
        </header>

        <section className="rounded-3xl border border-border bg-card/90 p-6 shadow-xl shadow-amber-100/50 backdrop-blur">
          {resolvedError && (
            <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {resolvedError}
            </div>
          )}
          <div className="mb-6 space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">
              Create account
            </h2>
            <p className="text-sm text-muted-foreground">
              Set up your credentials in a few quick steps.
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
                placeholder="alex@vaultprime.com"
                autoComplete="email"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Password
              </label>
              <input
                name="password"
                type="password"
                placeholder="Create a password"
                autoComplete="new-password"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-amber-950 shadow-lg shadow-amber-200/60 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Creating..." : "Create account"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-amber-600 transition hover:text-amber-700"
            >
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
