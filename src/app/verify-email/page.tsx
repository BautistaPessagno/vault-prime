"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, FormEvent } from "react";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailFallback />}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailFallback() {
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

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resend state
  const [resendStatus, setResendStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate code format
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setError("Please enter the verification code");
      return;
    }
    if (!/^\d{6}$/.test(trimmedCode)) {
      setError("Code must be 6 digits");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ code: trimmedCode }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!res.ok) {
        const errorCode = payload.error ?? "invalid_code";

        if (errorCode === "missing_code") {
          setError("Please enter the verification code");
        } else if (errorCode === "invalid_code") {
          setError("Invalid code. Please check and try again.");
        } else if (errorCode === "expired") {
          setError("This code has expired. Please request a new one.");
        } else {
          setError("An error occurred. Please try again.");
        }
        setIsLoading(false);
        return;
      }

      router.replace("/verify-email/success");
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email || resendStatus === "sending") return;

    setResendStatus("sending");
    setResendMessage(null);

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) throw new Error("network");

      setResendStatus("sent");
      setResendMessage("A new verification code has been sent to your email.");
    } catch {
      setResendStatus("error");
      setResendMessage("We couldn't resend right now. Please try again.");
    }
  };

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
        <header className="mb-8 space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[color:var(--muted-foreground)]">
            Vault Prime
          </p>
          <h1 className="text-3xl font-semibold">Verify your email</h1>
          <p className="text-sm text-[color:var(--muted-foreground)]">
            {email
              ? `We sent a code to ${email}`
              : "Enter the 6-digit code from your email"}
          </p>
        </header>

        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="code"
                className="mb-2 block text-sm font-medium text-[color:var(--foreground)]"
              >
                Verification Code
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  // Only allow digits
                  const value = e.target.value.replace(/\D/g, "");
                  setCode(value);
                  setError(null);
                }}
                placeholder="000000"
                autoFocus
                disabled={isLoading}
                className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] text-[color:var(--foreground)] transition-colors placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-500">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || code.length !== 6}
              className="w-full rounded-lg bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-[color:var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Verifying..." : "Verify Email"}
            </button>
          </form>

          <div className="mt-6 border-t border-[color:var(--border)] pt-4">
            {resendMessage && (
              <div
                className={`mb-4 rounded-lg px-4 py-3 text-sm ${
                  resendStatus === "error"
                    ? "bg-red-500/10 text-red-500"
                    : "bg-green-500/10 text-green-500"
                }`}
              >
                {resendMessage}
              </div>
            )}

            <p className="text-center text-sm text-[color:var(--muted-foreground)]">
              Didn't receive the code?{" "}
              {email ? (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendStatus === "sending"}
                  className="text-[color:var(--accent)] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {resendStatus === "sending" ? "Sending..." : "Resend code"}
                </button>
              ) : (
                <span className="text-[color:var(--muted-foreground)]">
                  Go back to sign up
                </span>
              )}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
