import { useEffect, useState } from "react";
import type { SessionState } from "@/lib/types";
import LoginPage from "./pages/LoginPage";
import UnlockPage from "./pages/UnlockPage";
import VaultListPage from "./pages/VaultListPage";
import EntryDetailPage from "./pages/EntryDetailPage";
import type { DecryptedEntry } from "@/lib/types";

export default function App() {
  const [state, setState] = useState<SessionState | "loading">("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<DecryptedEntry | null>(null);

  useEffect(() => {
    browser.runtime.sendMessage({ action: "getState" }).then((res) => {
      const response = res as { state: SessionState; email: string | null };
      setState(response.state);
      setEmail(response.email);
    });
  }, []);

  const handleLoginSuccess = () => {
    setState("unlocked");
  };

  const handleUnlockSuccess = () => {
    setState("unlocked");
  };

  const handleLock = () => {
    browser.runtime.sendMessage({ action: "lock" });
    setState("locked");
    setSelectedEntry(null);
  };

  const handleLogout = () => {
    browser.runtime.sendMessage({ action: "logout" });
    setState("logged_out");
    setEmail(null);
    setSelectedEntry(null);
  };

  if (state === "loading") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <p style={{ color: "var(--muted-foreground)", fontSize: 13 }}>Loading...</p>
      </div>
    );
  }

  if (state === "logged_out") {
    return <LoginPage onSuccess={handleLoginSuccess} />;
  }

  if (state === "locked") {
    return <UnlockPage email={email} onSuccess={handleUnlockSuccess} onLogout={handleLogout} />;
  }

  if (selectedEntry) {
    return (
      <EntryDetailPage
        entry={selectedEntry}
        onBack={() => setSelectedEntry(null)}
        onLock={handleLock}
      />
    );
  }

  return (
    <VaultListPage
      onSelectEntry={setSelectedEntry}
      onLock={handleLock}
      onLogout={handleLogout}
    />
  );
}
