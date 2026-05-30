import { useEffect, useState } from "react";
import {
  clearAuthSession,
  getValidAuthSession,
} from "../utils/authSession";

// Listen for changes to the auth session across tabs and login/logout events
// dispatched from this same tab via window.dispatchEvent(new Event("auth:changed")).
function subscribeToSession(handler) {
  if (typeof window === "undefined") return () => {};
  const storage = (e) => {
    if (!e || e.key === "evegahAuthSession" || e.key === null) handler();
  };
  const custom = () => handler();
  window.addEventListener("storage", storage);
  window.addEventListener("auth:changed", custom);
  return () => {
    window.removeEventListener("storage", storage);
    window.removeEventListener("auth:changed", custom);
  };
}

export default function useAuth() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const refresh = () => {
      const session = getValidAuthSession();
      if (!session) {
        if (!cancelled) {
          setUser(null);
          setRole(null);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setUser({
          uid: session.uid || null,
          email: session.email || null,
          displayName: session.displayName || null,
        });
        setRole(session.role || null);
        setLoading(false);
      }
    };

    refresh();
    const unsub = subscribeToSession(refresh);

    // If the session has an expiry, schedule a sign-out at that time so the UI
    // reacts immediately instead of waiting for the next API call to fail.
    let timer = null;
    const session = getValidAuthSession();
    if (session?.expiresAt) {
      const ms = Math.max(0, session.expiresAt - Date.now());
      timer = setTimeout(() => {
        clearAuthSession();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("auth:changed"));
        }
      }, ms);
    }

    return () => {
      cancelled = true;
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, []);

  return { user, role, loading };
}
