import React, { createContext, useState, useEffect, useContext } from 'react';
import { translations } from './i18n';
import { INITIAL_LISTINGS, CHART_DATA } from './mockData';
import { supabase } from './supabase';

const VALID_LANGS = ['sk', 'en'];

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

// Mock analytics for demo mode
const DEMO_ANALYTICS = {
  total_views: 1842,
  total_applications: 47,
  active_jobs: 3,
  avg_match_score: 89,
  pipeline_stats: { Pending: 12, Viewed: 18, Interview: 8, Hired: 5, Rejected: 4 },
  recent_candidates: [],
  recent_apps_trend: CHART_DATA
};

export const AppStateProvider = ({ children }) => {
  const [invitedIds, setInvitedIds] = useState(() => {
    return safeParseJSON(localStorage.getItem('employer_invited'), []);
  });

  const [acceptedIds, setAcceptedIds] = useState(() => {
    return safeParseJSON(localStorage.getItem('employer_accepted'), []);
  });

  const [listings, setListings] = useState([]);
  const [companyProfile, setCompanyProfile] = useState({ name: 'Vaša Firma', industry: 'Hľadáme talenty' });
  const [analytics, setAnalytics] = useState({ 
    total_views: 0, 
    total_applications: 0, 
    active_jobs: 0, 
    recent_views_trend: [0,0,0,0,0,0,0],
    pipeline_stats: { Pending: 0, Viewed: 0, Interview: 0, Hired: 0, Rejected: 0 }
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

  const fetchAnalytics = async (token) => {
    try {
      const res = await fetch('/api/employer/analytics', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error('Analytics fetch error:', err);
    }
  };

  // Fetch employer profile
  useEffect(() => {
    const fetchEmployerProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      try {
        const res = await fetch('/api/auth/employer/profile', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setCompanyProfile(data && data.name ? data : { name: 'Vaša Firma', industry: 'Hľadáme talenty' });
        } else {
          setCompanyProfile({ name: 'Vaša Firma', industry: 'Hľadáme talenty' });
        }
        
        // Also fetch analytics
        fetchAnalytics(token);
      } catch (err) {
        console.error('Employer profile fetch error:', err);
        setCompanyProfile({ name: 'Vaša Firma', industry: 'Hľadáme talenty' });
      }
    };
    fetchEmployerProfile();
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
      companyProfile, setCompanyProfile,
      analytics, refreshAnalytics: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) fetchAnalytics(session.access_token);
      }
    }}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => useContext(AppStateContext);
