"use client";

import { useMemo, useState } from "react";

type Props = {
  initialEmail?: string;
};

export function ResendVerificationForm({ initialEmail = "" }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return status !== "sending" && email.trim().length > 3;
  }, [email, status]);

  const onResend = async () => {
    if (!canSubmit) return;
    setStatus("sending");
    setMessage(null);

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

      setStatus("sent");
      setMessage(
        "If an account exists for that email, we just sent a new verification link.",
      );
    } catch {
      setStatus("error");
      setMessage("We couldn’t resend right now. Please try again.");
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
      <div className="mb-5 space-y-2">
        <h2 className="text-xl font-semibold">Resend verification email</h2>
        <p className="text-sm text-[color:var(--muted-foreground)]">
          Enter your email and we’ll send a fresh link.
        </p>
      </div>

      {message && (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
            status === "error"
              ? "border-[color:var(--danger)] text-[color:var(--danger)]"
              : "border-[color:var(--success)] text-[color:var(--success)]"
          }`}
        >
          {message}
        </div>
      )}

      <div className="space-y-3">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
            Email
          </label>
          <input
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (status !== "idle") setStatus("idle");
              setMessage(null);
            }}
            type="email"
            placeholder="you@vaultprime.com"
            autoComplete="email"
            className="w-full rounded-xl border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
          />
        </div>

        <button
          type="button"
          onClick={onResend}
          disabled={!canSubmit}
          className="w-full rounded-xl bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-[color:var(--accent-foreground)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "sending" ? "Sending..." : "Resend email"}
        </button>
      </div>
    </div>
  );
}

