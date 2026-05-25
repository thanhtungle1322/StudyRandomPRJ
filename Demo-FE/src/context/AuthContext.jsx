import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

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
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
