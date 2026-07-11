import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { disconnectSocket } from '../services/socket';
import { AuthContext } from './auth-context';

const STORAGE_KEY_USER = 'studyrandom_user_v2';
const STORAGE_KEY_TOKEN = 'studyrandom_token_v2';
const STORAGE_KEY_USER_OLD = 'studyrandom_user';
const STORAGE_KEY_TOKEN_OLD = 'studyrandom_token';

function loadFromStorage(key, fallbackKey) {
  try {
    let value = localStorage.getItem(key);
    if (!value && fallbackKey) {
      value = localStorage.getItem(fallbackKey);
      if (value) {
        localStorage.setItem(key, value);
        localStorage.removeItem(fallbackKey);
      }
    }
    return value ? JSON.parse(value) : null;
  } catch {
    localStorage.removeItem(key);
    if (fallbackKey) localStorage.removeItem(fallbackKey);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => loadFromStorage(STORAGE_KEY_USER, STORAGE_KEY_USER_OLD));
  const [token, setToken] = useState(() => {
    const t = localStorage.getItem(STORAGE_KEY_TOKEN);
    if (!t) {
      const old = localStorage.getItem(STORAGE_KEY_TOKEN_OLD);
      if (old) {
        localStorage.setItem(STORAGE_KEY_TOKEN, old);
        localStorage.removeItem(STORAGE_KEY_TOKEN_OLD);
        return old;
      }
    }
    return t || null;
  });
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setUser(null);
      setAuthReady(true);
      return undefined;
    }

    setAuthReady(false);
    api.get('/auth/me')
      .then((response) => {
        if (!cancelled && response.data.success) setUser(response.data.user);
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setToken(null);
        }
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true);
      });

    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_USER);
    }
  }, [user]);

  useEffect(() => {
    if (token) {
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
    } else {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
    }
  }, [token]);

  const login = useCallback((userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    setAuthReady(true);
  }, []);

  const logout = useCallback(() => {
    disconnectSocket();
    localStorage.removeItem('activeStudySession');
    window.dispatchEvent(new Event('storage'));
    setUser(null);
    setToken(null);
    setAuthReady(true);
  }, []);

  useEffect(() => {
    window.addEventListener('studyrandom:auth-expired', logout);
    const handleStorageLogout = (event) => {
      if ([STORAGE_KEY_TOKEN, STORAGE_KEY_TOKEN_OLD].includes(event.key) && !event.newValue) {
        logout();
      }
    };
    window.addEventListener('storage', handleStorageLogout);
    return () => {
      window.removeEventListener('studyrandom:auth-expired', logout);
      window.removeEventListener('storage', handleStorageLogout);
    };
  }, [logout]);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data.success) {
        setUser(res.data.user);
      }
    } catch (err) {
      console.error('Failed to refresh user stats:', err);
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      logout,
      refreshUser,
      authReady,
      isLoggedIn: authReady && Boolean(user && token),
    }}>
      {children}
    </AuthContext.Provider>
  );
}
