"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

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
            Verifying...
          </p>
        </div>
      </div>
    </main>
  );
}

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [detail, setDetail] = useState<string>("Verifying your email…");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      router.replace("/verify-email/error?reason=missing_token");
      return;
    }

    const run = async () => {
      try {
        setDetail("Verifying your email…");
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ token }),
        });

        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };

        if (!res.ok) {
          const reason = encodeURIComponent(payload.error ?? "invalid_token");
          router.replace(`/verify-email/error?reason=${reason}`);
          return;
        }

        router.replace("/verify-email/success");
      } catch {
        router.replace("/verify-email/error?reason=unexpected");
      }
    };

    void run();
  }, [router, searchParams]);

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
        <header className="mb-8 space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[color:var(--muted-foreground)]">
            Vault Prime
          </p>
          <h1 className="text-3xl font-semibold">Email verification</h1>
          <p className="text-sm text-[color:var(--muted-foreground)]">{detail}</p>
        </header>

        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[color:var(--accent)] border-t-transparent"></div>
            <div>
              <p className="text-sm font-semibold">Hang tight</p>
              <p className="text-sm text-[color:var(--muted-foreground)]">
                This should only take a second.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

