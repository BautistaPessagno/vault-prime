"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

const signupMessages: Record<string, string> = {
  missing: "Enter an email and password to create your account.",
  password_mismatch: "Passwords do not match.",
  exists: "That email already has an account.",
  db: "We could not reach the database. Try again soon.",
  insert: "We could not create your account. Try again.",
  unexpected: "Something went wrong. Please try again.",
};

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupFallback />}>
      <SignupContent />
    </Suspense>
  );
}

function SignupFallback() {
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

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);

  const errorFromUrl = searchParams.get("error");
  const resolvedError =
    errorMessage ?? (errorFromUrl ? signupMessages[errorFromUrl] : null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (!email || !password || !confirmPassword) {
      setErrorMessage(signupMessages.missing);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(signupMessages.password_mismatch);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
          passwordConfirmation: confirmPassword,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        emailSent?: boolean;
      };

      if (!response.ok) {
        setErrorMessage(
          signupMessages[payload.error ?? "unexpected"] ??
            signupMessages.unexpected,
        );
        return;
      }

      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch {
      setErrorMessage(signupMessages.unexpected);
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
          <h1 className="text-3xl font-semibold">Create Your Account</h1>
          <p className="text-sm text-[color:var(--muted-foreground)]">
            Set up your vault in seconds.
          </p>
        </header>

        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
          {resolvedError && (
            <div className="mb-6 rounded-xl border border-[color:var(--danger)] px-4 py-3 text-sm text-[color:var(--danger)]">
              {resolvedError}
            </div>
          )}
          <div className="mb-6 space-y-2">
            <h2 className="text-2xl font-semibold">Create account</h2>
            <p className="text-sm text-[color:var(--muted-foreground)]">
              Add your email and a secure password.
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
                placeholder="alex@vaultprime.com"
                autoComplete="email"
                className="w-full rounded-xl border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
                Password
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={isPasswordVisible ? "text" : "password"}
                  placeholder="Create a password"
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-[color:var(--border)] bg-transparent px-4 py-3 pr-12 text-sm outline-none transition focus:border-[color:var(--accent)]"
                />
                <button
                  type="button"
                  onClick={() => setIsPasswordVisible((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)] transition hover:text-[color:var(--foreground)]"
                  aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                >
                  {isPasswordVisible ? (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
                      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                      <path d="M14.1 9.9a3 3 0 0 0-4.2 4.2" />
                      <path d="M4 4l16 16" />
                    </svg>
                  ) : (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
                      <path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  name="confirmPassword"
                  type={isConfirmPasswordVisible ? "text" : "password"}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-[color:var(--border)] bg-transparent px-4 py-3 pr-12 text-sm outline-none transition focus:border-[color:var(--accent)]"
                />
                <button
                  type="button"
                  onClick={() => setIsConfirmPasswordVisible((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)] transition hover:text-[color:var(--foreground)]"
                  aria-label={
                    isConfirmPasswordVisible ? "Hide password" : "Show password"
                  }
                >
                  {isConfirmPasswordVisible ? (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
                      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                      <path d="M14.1 9.9a3 3 0 0 0-4.2 4.2" />
                      <path d="M4 4l16 16" />
                    </svg>
                  ) : (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
                      <path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-[color:var(--accent-foreground)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Creating..." : "Create account"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-[color:var(--muted-foreground)]">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-[color:var(--foreground)] transition hover:text-[color:var(--accent)]"
            >
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
