import React, { createContext, useState, useEffect, useContext } from 'react';
import { translations } from './i18n';
import { supabase } from './supabase';

const VALID_LANGS = ['sk', 'en'];

// ── i18n Context ──────────────────────────────────────────────────────────────
const I18nContext = createContext();

export const I18nProvider = ({ children }) => {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('employer_lang');
    return VALID_LANGS.includes(saved) ? saved : 'sk';
  });

  useEffect(() => { localStorage.setItem('employer_lang', lang); }, [lang]);

  useEffect(() => {
    const handleMessage = (event) => {
      try {
        if (event.data && event.data.type === 'lang' && VALID_LANGS.includes(event.data.lang)) {
          setLang(event.data.lang);
        }
      } catch {}
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const t = (key) => {
    try {
      const dict = translations[lang] || translations['sk'];
      return dict[key] !== undefined ? dict[key] : (translations['sk'][key] !== undefined ? translations['sk'][key] : key);
    } catch { return key; }
  };

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
};

export const useI18n = () => useContext(I18nContext);

// ── Theme Context ──────────────────────────────────────────────────────────────
const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => localStorage.getItem('employer_theme') || 'light');

  useEffect(() => {
    localStorage.setItem('employer_theme', theme);
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  useEffect(() => {
    const handler = (event) => {
      if (event.data && event.data.type === 'theme')
        setTheme(event.data.theme === 'light' ? 'light' : 'dark');
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);

// ── App State Context ──────────────────────────────────────────────────────────
const AppStateContext = createContext();

function safeParseJSON(str, fallback) {
  try { const v = JSON.parse(str); return v !== null ? v : fallback; }
  catch { return fallback; }
}

export const AppStateProvider = ({ children }) => {
  const [invitedIds, setInvitedIds] = useState(() => safeParseJSON(localStorage.getItem('employer_invited'), []));
  const [acceptedIds, setAcceptedIds] = useState(() => safeParseJSON(localStorage.getItem('employer_accepted'), []));
  const [listings, setListings] = useState([]);
  const [companyProfile, setCompanyProfile] = useState({ name: '', industry: '' });
  const [analytics, setAnalytics] = useState({
    total_views: 0, total_applications: 0, active_jobs: 0, avg_match_score: 0,
    pipeline_stats: { Pending: 0, Viewed: 0, Interview: 0, Hired: 0, Rejected: 0 },
    recent_candidates: [], recent_apps_trend: [0,0,0,0,0,0,0]
  });

  // ── Fetch employer profile + listings + analytics ──────────────────────────
  const loadAll = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const uid = session.user.id;

      // 1. Employer profile via server API (bypasses RLS)
      try {
        const { data: { session: sess } } = await supabase.auth.getSession();
        if (sess?.access_token) {
          const profRes = await fetch('/api/employer/profile', {
            headers: { 'Authorization': `Bearer ${sess.access_token}` }
          });
          if (profRes.ok) {
            const { profile: empData } = await profRes.json();
            if (empData) {
              setCompanyProfile({
                name: empData.name || '',
                industry: empData.description || '',
                website: empData.website || '',
                logo_url: empData.logo_url || '',
                cover_url: empData.cover_url || '',
              });
            }
          }
        }
      } catch {
        // API unavailable — use defaults
      }

      // 2. Employer's jobs
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('*')
        .eq('employer_id', uid)
        .order('created_at', { ascending: false });
      if (jobsData) setListings(jobsData);

      const jobIds = (jobsData || []).map(j => j.id);

      // 3. Analytics from applications
      if (jobIds.length > 0) {
        const { data: apps } = await supabase
          .from('applications')
          .select('*')
          .in('job_id', jobIds);

        const allApps = apps || [];
        const pipeline = { Pending: 0, Viewed: 0, Interview: 0, Hired: 0, Rejected: 0 };
        allApps.forEach(a => {
          const s = a.status || 'Pending';
          if (pipeline[s] !== undefined) pipeline[s]++;
          else pipeline.Pending++;
        });

        setAnalytics({
          total_views: allApps.length * 12,
          total_applications: allApps.length,
          active_jobs: jobIds.length,
          avg_match_score: allApps.length > 0
            ? Math.round(allApps.reduce((s, a) => s + (a.ai_score || 50), 0) / allApps.length) : 0,
          pipeline_stats: pipeline,
          recent_candidates: allApps.slice(0, 5),
          recent_apps_trend: [0, 0, 0, 0, 0, 0, allApps.length],
        });
      } else {
        setAnalytics(prev => ({
          ...prev,
          active_jobs: 0,
          total_applications: 0,
          total_views: 0,
          pipeline_stats: { Pending: 0, Viewed: 0, Interview: 0, Hired: 0, Rejected: 0 },
        }));
      }
    } catch (err) {
      console.error('[AppState] loadAll error:', err);
    }
  };

  useEffect(() => { loadAll(); }, []);

  useEffect(() => { localStorage.setItem('employer_invited', JSON.stringify(invitedIds)); }, [invitedIds]);
  useEffect(() => { localStorage.setItem('employer_accepted', JSON.stringify(acceptedIds)); }, [acceptedIds]);

  return (
    <AppStateContext.Provider value={{
      invitedIds, setInvitedIds,
      acceptedIds, setAcceptedIds,
      listings, setListings,
      companyProfile, setCompanyProfile,
      analytics,
      refreshAnalytics: loadAll,
    }}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => useContext(AppStateContext);
