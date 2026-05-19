import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';
import { getTranslation, formatCurrency, formatDate } from '../lib/i18n';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('shg_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('shg_lang') || 'hi';
  });
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    if (user) {
      // Use user's preferred language
      const userLang = user.language || 'hi';
      if (!localStorage.getItem('shg_lang')) {
        setLanguage(userLang);
      }
    }
    api.get('/settings').then((r) => setSettings(r.data)).catch(() => {});
  }, [user]);

  const login = async (mobile, password) => {
    const res = await api.post('/auth/login', { mobile, password });
    localStorage.setItem('shg_token', res.data.token);
    localStorage.setItem('shg_user', JSON.stringify(res.data.member));
    setUser(res.data.member);
    return res.data.member;
  };

  const logout = () => {
    localStorage.removeItem('shg_token');
    localStorage.removeItem('shg_user');
    setUser(null);
  };

  const changeLanguage = (lang) => {
    setLanguage(lang);
    localStorage.setItem('shg_lang', lang);
  };

  const refreshUser = async () => {
    if (!user) return;
    const res = await api.get('/members');
    const updated = res.data.find((m) => m.id === user.id);
    if (updated) {
      setUser(updated);
      localStorage.setItem('shg_user', JSON.stringify(updated));
    }
  };

  const t = (key) => getTranslation(language, key);
  const fc = (amount) => formatCurrency(amount, language);
  const fd = (dateStr) => formatDate(dateStr, language);

  return (
    <AppContext.Provider value={{ user, login, logout, language, changeLanguage, settings, setSettings, refreshUser, t, fc, fd }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
