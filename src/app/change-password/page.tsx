"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, FormEvent } from "react";

export default function ChangePasswordPage() {
  const router = useRouter();

  // Form states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate current password
    if (!currentPassword) {
      setError("Please enter your current password");
      return;
    }

    // Validate new password
    if (!newPassword) {
      setError("Please enter your new password");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!res.ok) {
        const errorCode = payload.error ?? "unknown";

        if (errorCode === "invalid_password") {
          setError("Current password is incorrect.");
        } else if (errorCode === "unauthorized") {
          setError("You must be logged in to change your password.");
        } else if (errorCode === "missing_fields") {
          setError("Please fill in all required fields.");
        } else {
          setError("An error occurred. Please try again.");
        }
        setIsLoading(false);
        return;
      }

      // Success - redirect to login
      router.replace("/login?message=password_changed");
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
        <header className="mb-8 space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[color:var(--muted-foreground)]">
            Vault Prime
          </p>
          <h1 className="text-3xl font-semibold">Change your password</h1>
          <p className="text-sm text-[color:var(--muted-foreground)]">
            Enter your current password and choose a new one
          </p>
        </header>

        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label
                htmlFor="currentPassword"
                className="mb-2 block text-sm font-medium text-[color:var(--foreground)]"
              >
                Current Password
              </label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Enter your current password"
                autoFocus
                disabled={isLoading}
                className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 text-[color:var(--foreground)] transition-colors placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div>
              <label
                htmlFor="newPassword"
                className="mb-2 block text-sm font-medium text-[color:var(--foreground)]"
              >
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Min. 8 characters"
                disabled={isLoading}
                className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 text-[color:var(--foreground)] transition-colors placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-2 block text-sm font-medium text-[color:var(--foreground)]"
              >
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Repeat your new password"
                disabled={isLoading}
                className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 text-[color:var(--foreground)] transition-colors placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-500">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={
                isLoading || !currentPassword || !newPassword || !confirmPassword
              }
              className="w-full rounded-lg bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-[color:var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Changing..." : "Change Password"}
            </button>
          </form>
        </section>

        <p className="mt-6 text-center text-sm text-[color:var(--muted-foreground)]">
          <Link href="/" className="text-[color:var(--accent)] hover:underline">
            Back to vault
          </Link>
        </p>
      </div>
    </main>
  );
}
