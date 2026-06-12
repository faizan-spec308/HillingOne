import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/client";

const AuthContext = createContext(null);

const TOKEN_KEY       = "hillingone_token";
const USER_KEY        = "hillingone_user";
const LAST_ACTIVE_KEY = "hillingone_last_active";
const SESSION_MS      = 60 * 60 * 1000; // 1 hour since last activity

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(LAST_ACTIVE_KEY);
}

function isExpired() {
  const ts = localStorage.getItem(LAST_ACTIVE_KEY);
  if (!ts) return false; // no timestamp = fresh install, let them in
  return Date.now() - Number(ts) > SESSION_MS;
}

export function AuthProvider({ children }) {
  // Remove stale keys from the previous "atrium" build
  localStorage.removeItem("atrium_token");
  localStorage.removeItem("atrium_user");

  const [token, setToken] = useState(() => {
    if (isExpired()) { clearSession(); return null; }
    return localStorage.getItem(TOKEN_KEY);
  });

  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
  });

  // Heartbeat: keep last_active fresh while the tab is open
  useEffect(() => {
    if (!token) return;
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
    const id = setInterval(
      () => localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now())),
      60_000,
    );
    return () => clearInterval(id);
  }, [token]);

  const login = (newToken, newUser) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = async () => {
    try { await api.logout(); } catch { /* token may already be invalid — still clear locally */ }
    clearSession();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isStaff: user?.role === "staff" || user?.role === "councillor" }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
