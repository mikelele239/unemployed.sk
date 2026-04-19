import React, { createContext, useState, useEffect, useContext } from 'react';
import { translations } from './i18n';

// i18n Context
const I18nContext = createContext();

export const I18nProvider = ({ children }) => {
  const [lang, setLang] = useState(localStorage.getItem('employer_lang') || 'sk');

  useEffect(() => {
    localStorage.setItem('employer_lang', lang);
  }, [lang]);

  const t = (key) => {
    return translations[lang][key] || translations['sk'][key] || key;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);

// Theme Context
const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(localStorage.getItem('employer_theme') || 'dark');

  useEffect(() => {
    localStorage.setItem('employer_theme', theme);
    const html = document.documentElement;
    if (theme === 'light') {
      html.classList.add('light');
    } else {
      html.classList.remove('light');
    }
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

// App State Context (Sync with Backend)
const AppStateContext = createContext();

export const AppStateProvider = ({ children }) => {
  const [invitedIds, setInvitedIds] = useState(() => {
    const saved = localStorage.getItem('employer_invited');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [acceptedIds, setAcceptedIds] = useState(() => {
    const saved = localStorage.getItem('employer_accepted');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [listings, setListings] = useState([]);

  const [companyProfile, setCompanyProfile] = useState(() => {
    const saved = localStorage.getItem('employer_profile');
    return saved ? JSON.parse(saved) : null;
  });

  // Fetch jobs from backend on mount
  useEffect(() => {
    fetch('/api/jobs')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setListings(data);
      })
      .catch(err => console.error('Failed to fetch jobs:', err));
  }, []);

  useEffect(() => { localStorage.setItem('employer_invited', JSON.stringify(invitedIds)); }, [invitedIds]);
  useEffect(() => { localStorage.setItem('employer_accepted', JSON.stringify(acceptedIds)); }, [acceptedIds]);
  useEffect(() => { localStorage.setItem('employer_profile', JSON.stringify(companyProfile)); }, [companyProfile]);

  return (
    <AppStateContext.Provider value={{
      invitedIds, setInvitedIds,
      acceptedIds, setAcceptedIds,
      listings, setListings,
      companyProfile, setCompanyProfile
    }}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => useContext(AppStateContext);
