import { useState } from "react";
import type { UnlockResponse } from "@/lib/messages";

type Props = {
  email: string | null;
  onSuccess: () => void;
  onLogout: () => void;
};

export default function UnlockPage({ email, onSuccess, onLogout }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setError(null);
    setLoading(true);
    try {
      const res = (await browser.runtime.sendMessage({
        action: "unlock",
        password,
      })) as UnlockResponse;

      if (res.ok) {
        onSuccess();
      } else {
        setError("Incorrect password.");
        setPassword("");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="vp-header">
        <span className="vp-header-title">Vault Prime</span>
        <button
          onClick={onLogout}
          style={{
            background: "none",
            border: "none",
            color: "var(--muted-foreground)",
            fontSize: 12,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Log out
        </button>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 20px" }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Vault locked</h2>
        <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 20 }}>
          {email ?? "Enter your master password to unlock."}
        </p>
        {error && <div className="vp-error">{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label className="vp-label">Master Password</label>
            <input
              className="vp-input"
              type="password"
              placeholder="Enter your master password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>
          <button className="vp-btn vp-btn-primary" type="submit" disabled={loading}>
            {loading ? "Unlocking..." : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
