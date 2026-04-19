import React, { createContext, useState, useEffect, useContext } from 'react';
import { translations } from './i18n';

const VALID_LANGS = ['sk', 'en'];
const DEMO_PROFILE = { name: 'Compx', industry: 'IT', locations: ['Bratislava'], hiring: ['Stáž', 'Brigáda'] };

// ── i18n Context ──────────────────────────────────────────────────────────────
const I18nContext = createContext();

export const I18nProvider = ({ children }) => {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('employer_lang');
    return VALID_LANGS.includes(saved) ? saved : 'sk';
  });

  useEffect(() => {
    localStorage.setItem('employer_lang', lang);
  }, [lang]);

  // Listen for language sync messages from the parent landing page
  useEffect(() => {
    const handleMessage = (event) => {
      try {
        if (event.data && event.data.type === 'lang' && VALID_LANGS.includes(event.data.lang)) {
          setLang(event.data.lang);
        }
      } catch (e) {
        // ignore
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const t = (key) => {
    try {
      const dict = translations[lang] || translations['sk'];
      return dict[key] !== undefined ? dict[key] : (translations['sk'][key] !== undefined ? translations['sk'][key] : key);
    } catch (e) {
      return key;
    }
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);

// ── Theme Context ──────────────────────────────────────────────────────────────
const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('employer_theme') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('employer_theme', theme);
    const html = document.documentElement;
    if (theme === 'light') {
      html.classList.add('light');
    } else {
      html.classList.remove('light');
    }
  }, [theme]);

  // Listen for theme sync messages from the parent landing page
  useEffect(() => {
    const handleThemeMessage = (event) => {
      if (event.data && event.data.type === 'theme') {
        setTheme(event.data.theme === 'light' ? 'light' : 'dark');
      }
    };
    window.addEventListener('message', handleThemeMessage);
    return () => window.removeEventListener('message', handleThemeMessage);
  }, []);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

// ── App State Context ──────────────────────────────────────────────────────────
const AppStateContext = createContext();

function safeParseJSON(str, fallback) {
  try {
    const val = JSON.parse(str);
    // Treat JSON null as missing
    return val !== null ? val : fallback;
  } catch {
    return fallback;
  }
}

export const AppStateProvider = ({ children }) => {
  const [invitedIds, setInvitedIds] = useState(() => {
    return safeParseJSON(localStorage.getItem('employer_invited'), []);
  });

  const [acceptedIds, setAcceptedIds] = useState(() => {
    return safeParseJSON(localStorage.getItem('employer_accepted'), []);
  });

  const [listings, setListings] = useState([]);

  const [companyProfile, setCompanyProfile] = useState(() => {
    const saved = safeParseJSON(localStorage.getItem('employer_profile'), null);
    if (saved && typeof saved === 'object' && saved.name) return saved;
    // Pre-seed demo profile so employer demo always shows the dashboard
    localStorage.setItem('employer_profile', JSON.stringify(DEMO_PROFILE));
    return DEMO_PROFILE;
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
  useEffect(() => {
    if (companyProfile) localStorage.setItem('employer_profile', JSON.stringify(companyProfile));
  }, [companyProfile]);

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
