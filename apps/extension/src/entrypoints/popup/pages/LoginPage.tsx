import { useState } from "react";
import type { LoginResponse } from "@/lib/messages";

const errorMessages: Record<string, string> = {
  invalid: "Invalid email or password.",
  locked: "Account locked. Try again later.",
  unverified: "Please verify your email first.",
  rate_limited: "Too many attempts. Try again later.",
  missing: "Enter both email and password.",
};

type Props = {
  onSuccess: () => void;
};

export default function LoginPage({ onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError(errorMessages.missing);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = (await browser.runtime.sendMessage({
        action: "login",
        email: email.trim().toLowerCase(),
        password,
      })) as LoginResponse;

      if (res.ok) {
        onSuccess();
      } else {
        setError(errorMessages[res.error] ?? "Login failed. Please try again.");
      }
    } catch {
      setError("Connection error. Is the server running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="vp-header">
        <span className="vp-header-title">Vault Prime</span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 20px" }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Sign in</h2>
        <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 20 }}>
          Use your Vault Prime credentials.
        </p>
        {error && <div className="vp-error">{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label className="vp-label">Email</label>
            <input
              className="vp-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="vp-label">Master Password</label>
            <input
              className="vp-input"
              type="password"
              placeholder="Enter your master password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="vp-btn vp-btn-primary" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
