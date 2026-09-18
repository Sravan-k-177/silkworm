import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { selectWorkspace } from "./db";
import LanguagePicker from "./LanguagePicker";
import { t } from "./i18n";
export type Account = {
  id: string;
  username: string;
  role: "field" | "supervisor" | "admin";
  farms: string[];
};
const Context = createContext<{
  user: Account | null;
  enabled: boolean;
  signOut: () => Promise<void>;
}>({ user: null, enabled: false, signOut: async () => {} });
export const useAccount = () => useContext(Context);
const sessionKey = "silksense-offline-account";
const logoutKey = "silksense-pending-logout";
export default function AuthGate({ children }: { children: ReactNode }) {
  useTranslation();
  const [expires, setExpires] = useState(0);
  const [status, setStatus] = useState<"loading" | "login" | "ready">(
    "loading",
  );
  const [user, setUser] = useState<Account | null>(null),
    [enabled, setEnabled] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function enter(
    account: Account | null,
    accounts: boolean,
    deadline = Date.now() + 12 * 3600000,
  ) {
    await selectWorkspace(
      account
        ? `${account.id}:${account.role}:${JSON.stringify([...account.farms].sort())}`
        : null,
    );
    if (account) localStorage.removeItem(logoutKey);
    setUser(account);
    setEnabled(accounts);
    setExpires(deadline);
    if (account)
      sessionStorage.setItem(
        sessionKey,
        JSON.stringify({ user: account, expires: deadline }),
      );
    else sessionStorage.removeItem(sessionKey);
    setStatus("ready");
  }
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (localStorage.getItem(logoutKey) === "yes") {
          const logout = await fetch("/api/auth/logout", {
            method: "POST",
            signal: AbortSignal.timeout(5000),
          });
          if (!logout.ok)
            throw new Error("Sign out failed. Reconnect and try again.");
          localStorage.removeItem(logoutKey);
        }
        const r = await fetch("/api/auth/session", {
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        if (!r.ok) throw new Error("Session check failed.");
        const data = await r.json();
        if (!active) return;
        if (data.enabled === false) {
          await enter(null, false);
          return;
        }
        setEnabled(true);
        if (data.user) await enter(data.user, true, Date.parse(data.expiresAt));
        else {
          sessionStorage.removeItem(sessionKey);
          setStatus("login");
        }
      } catch {
        if (!active) return;
        let cached;
        try {
          cached = JSON.parse(sessionStorage.getItem(sessionKey) || "null");
        } catch {}
        if (
          localStorage.getItem(logoutKey) !== "yes" &&
          cached?.user &&
          cached.expires > Date.now()
        ) {
          await enter(cached.user, true, cached.expires);
          return;
        }
        // Anonymous offline demo is allowed only after this browser observed demo mode online.
        if (localStorage.getItem("silksense-demo-installed") === "yes") {
          await enter(null, false);
          return;
        }
        setError("Connect to the internet to sign in on this device.");
        setStatus("login");
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (status !== "ready" || !user) return;
    const expire = () => {
      if (Date.now() >= expires) {
        sessionStorage.removeItem(sessionKey);
        setUser(null);
        setStatus("login");
      }
    };
    const timer = setTimeout(expire, Math.max(0, expires - Date.now()));
    window.addEventListener("focus", expire);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", expire);
    };
  }, [status, user, expires]);
  useEffect(() => {
    if (status === "ready" && !enabled)
      localStorage.setItem("silksense-demo-installed", "yes");
    else if (enabled) localStorage.removeItem("silksense-demo-installed");
  }, [status, enabled]);
  useEffect(() => {
    const lock = (event: StorageEvent) => {
      if (event.key === logoutKey && event.newValue === "yes") {
        sessionStorage.removeItem(sessionKey);
        setUser(null);
        setStatus("login");
      }
    };
    window.addEventListener("storage", lock);
    return () => window.removeEventListener("storage", lock);
  }, []);
  async function signOut() {
    setError("");
    sessionStorage.removeItem(sessionKey);
    localStorage.setItem(logoutKey, "yes");
    setUser(null);
    setStatus("login");
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error();
      localStorage.removeItem(logoutKey);
    } catch {
      setError(
        "This device is locked. Reconnect to finish signing out of the server.",
      );
    }
  }
  return (
    <Context.Provider value={{ user, enabled, signOut }}>
      {status === "ready" ? (
        <>
          {children}
          {error && (
            <p className="auth-error error" role="alert">
              {t(error)}
            </p>
          )}
        </>
      ) : (
        <main className="auth-page">
          <div className="card form-card auth-card">
            <LanguagePicker />
            <h1>{t("Sign in to SilkSense")}</h1>
            {status === "loading" ? (
              <p role="status">{t("Checking your session…")}</p>
            ) : (
              <>
                <p>
                  {t(
                    "Use the account and farm access provided by your administrator.",
                  )}
                </p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    setError("");
                    const data = new FormData(e.currentTarget);
                    try {
                      const r = await fetch("/api/auth/login", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          username: data.get("username"),
                          password: data.get("password"),
                        }),
                      });
                      const result = await r.json();
                      if (!r.ok)
                        throw new Error(result.error || "Sign in failed.");
                      await enter(
                        result.user,
                        true,
                        Date.parse(result.expiresAt),
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label className="field">
                    <span>{t("Username")}</span>
                    <input
                      name="username"
                      autoComplete="username"
                      required
                      maxLength={80}
                    />
                  </label>
                  <label className="field">
                    <span>{t("Password")}</span>
                    <input
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      maxLength={200}
                    />
                  </label>
                  {error && (
                    <p className="error" role="alert">
                      {t(error)}
                    </p>
                  )}
                  <button className="button primary full" disabled={busy}>
                    {t(busy ? "Signing in…" : "Sign in")}
                  </button>
                </form>
                <p className="reference-note">
                  {t(
                    "After signing in, this tab can keep working offline for up to 12 hours. Sign out before sharing the device. Local records are not encrypted.",
                  )}
                </p>
              </>
            )}
          </div>
        </main>
      )}
    </Context.Provider>
  );
}
export function AccountControls() {
  const { user, enabled, signOut } = useAccount();
  return enabled && user ? (
    <div className="account-controls">
      <span>
        {user.username} · {t(user.role)}
      </span>
      <button className="text-button" onClick={() => void signOut()}>
        {t("Sign out")}
      </button>
    </div>
  ) : null;
}
