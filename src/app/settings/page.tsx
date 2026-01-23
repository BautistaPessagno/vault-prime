"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ProfileResponse = {
  email: string;
  createdAt: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const loadProfile = async () => {
      try {
        const response = await fetch("/api/auth/profile", {
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          if (!isActive) {
            return;
          }
          setError(
            response.status === 401
              ? "Debes iniciar sesión para ver tu perfil."
              : "No pudimos cargar tu perfil. Intenta nuevamente.",
          );
          setIsLoading(false);
          return;
        }

        const payload = (await response.json()) as ProfileResponse;
        if (!isActive) {
          return;
        }
        setProfile(payload);
        setIsLoading(false);
      } catch {
        if (!isActive) {
          return;
        }
        setError("Ocurrió un error inesperado. Intenta nuevamente.");
        setIsLoading(false);
      }
    };

    loadProfile();

    return () => {
      isActive = false;
    };
  }, []);

  const createdAtLabel =
    profile?.createdAt && !Number.isNaN(Date.parse(profile.createdAt))
      ? dateFormatter.format(new Date(profile.createdAt))
      : "—";

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
        <header className="mb-8 space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[color:var(--muted-foreground)]">
            Vault Prime
          </p>
          <h1 className="text-3xl font-semibold">Configuración</h1>
          <p className="text-sm text-[color:var(--muted-foreground)]">
            Administra tu perfil y seguridad.
          </p>
        </header>

        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
          <div className="mb-6 space-y-2">
            <h2 className="text-2xl font-semibold">Perfil</h2>
            <p className="text-sm text-[color:var(--muted-foreground)]">
              Estos datos se usan para identificar tu cuenta.
            </p>
          </div>

          {isLoading && (
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-4 text-sm text-[color:var(--muted-foreground)]">
              Cargando tu información...
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-[color:var(--danger)] px-4 py-3 text-sm text-[color:var(--danger)]">
              {error}
            </div>
          )}

          {!isLoading && !error && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
                  Email
                </p>
                <p className="mt-2 text-sm font-medium">{profile?.email}</p>
              </div>

              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
                  Fecha de creación
                </p>
                <p className="mt-2 text-sm font-medium">{createdAtLabel}</p>
              </div>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <Link
              href="/settings/password"
              className="block rounded-xl bg-[color:var(--accent)] px-4 py-3 text-center text-sm font-semibold text-[color:var(--accent-foreground)] transition hover:brightness-95"
            >
              Cambiar contraseña
            </Link>
            <Link
              href="/"
              className="block rounded-xl border border-[color:var(--border)] px-4 py-3 text-center text-sm font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--accent)]"
            >
              Volver al vault
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
