import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api.js';

const AuthContext = createContext(null);

/**
 * Session state for the whole SPA. The session itself is an httpOnly cookie
 * set by the server - this context only mirrors "who is logged in".
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    api.me({ signal: controller.signal })
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, []);

  const login = useCallback(async (email, password) => {
    const u = await api.login({ email, password });
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (form) => {
    const u = await api.register(form);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, checking, login, register, logout, setUser }), [user, checking, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
