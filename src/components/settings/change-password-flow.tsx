"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export default function ChangePasswordFlow() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCurrentVisible, setIsCurrentVisible] = useState(false);
  const [isNewVisible, setIsNewVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError("Ingresa tu contraseña actual.");
      return;
    }
    if (!newPassword) {
      setError("Ingresa tu nueva contraseña.");
      return;
    }
    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
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
          setError("La contraseña actual es incorrecta.");
        } else if (errorCode === "unauthorized") {
          setError("Debes iniciar sesión para cambiar tu contraseña.");
        } else if (errorCode === "missing_fields") {
          setError("Completa todos los campos requeridos.");
        } else {
          setError("Ocurrió un error. Intenta nuevamente.");
        }
        setIsLoading(false);
        return;
      }

      router.replace("/login?message=password_changed");
    } catch {
      setError("Ocurrió un error inesperado. Intenta nuevamente.");
      setIsLoading(false);
    }
  };

  const isSubmitDisabled =
    isLoading || !currentPassword || !newPassword || !confirmPassword;

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
        <header className="mb-8 space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[color:var(--muted-foreground)]">
            Vault Prime
          </p>
          <h1 className="text-3xl font-semibold">Cambiar contraseña</h1>
          <p className="text-sm text-[color:var(--muted-foreground)]">
            Actualiza tu contraseña de forma segura.
          </p>
        </header>

        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="currentPassword"
                className="mb-2 block text-sm font-medium text-[color:var(--foreground)]"
              >
                Contraseña actual
              </label>
              <div className="relative">
                <input
                  id="currentPassword"
                  type={isCurrentVisible ? "text" : "password"}
                  value={currentPassword}
                  onChange={(event) => {
                    setCurrentPassword(event.target.value);
                    setError(null);
                  }}
                  placeholder="Ingresa tu contraseña actual"
                  autoFocus
                  disabled={isLoading}
                  className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 pr-12 text-[color:var(--foreground)] transition-colors placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setIsCurrentVisible((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)] transition hover:text-[color:var(--foreground)]"
                  aria-label={
                    isCurrentVisible ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                >
                  {isCurrentVisible ? (
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

            <div>
              <label
                htmlFor="newPassword"
                className="mb-2 block text-sm font-medium text-[color:var(--foreground)]"
              >
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={isNewVisible ? "text" : "password"}
                  value={newPassword}
                  onChange={(event) => {
                    setNewPassword(event.target.value);
                    setError(null);
                  }}
                  placeholder="Mínimo 8 caracteres"
                  disabled={isLoading}
                  className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 pr-12 text-[color:var(--foreground)] transition-colors placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setIsNewVisible((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)] transition hover:text-[color:var(--foreground)]"
                  aria-label={
                    isNewVisible ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                >
                  {isNewVisible ? (
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

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-2 block text-sm font-medium text-[color:var(--foreground)]"
              >
                Confirmar nueva contraseña
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={isConfirmVisible ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setError(null);
                  }}
                  placeholder="Repite tu nueva contraseña"
                  disabled={isLoading}
                  className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 pr-12 text-[color:var(--foreground)] transition-colors placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setIsConfirmVisible((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)] transition hover:text-[color:var(--foreground)]"
                  aria-label={
                    isConfirmVisible ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                >
                  {isConfirmVisible ? (
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

            {error && (
              <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-500">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="w-full rounded-lg bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-[color:var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Cambiando..." : "Cambiar contraseña"}
            </button>
          </form>
        </section>

        <p className="mt-6 text-center text-sm text-[color:var(--muted-foreground)]">
          <Link
            href="/settings"
            className="text-[color:var(--accent)] hover:underline"
          >
            Volver a configuración
          </Link>
        </p>
      </div>
    </main>
  );
}
