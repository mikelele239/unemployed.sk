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
    total_views: 0, total_likes: 0, total_applications: 0, active_jobs: 0,
    pipeline_stats: { Pending: 0, Viewed: 0, Interview: 0, Hired: 0, Rejected: 0 },
    recent_candidates: [], recent_apps_trend: [0,0,0,0,0,0,0]
  });
  const [liveViewers, setLiveViewers] = useState({});  // { jobId: count }

  // ── Fetch employer profile + listings + analytics ──────────────────────────
  const loadAll = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const uid = session.user.id;

      // 1. Employer profile via direct Supabase query
      try {
        const { data: empData, error: profErr } = await supabase
          .from('employers')
          .select('*')
          .eq('id', uid)
          .maybeSingle();

        if (empData) {
          setCompanyProfile({
            name: empData.name || '',
            industry: empData.description || '',
            website: empData.website || '',
            logo_url: empData.logo_url || '',
            cover_url: empData.cover_url || '',
          });
        }
      } catch (err) {
        console.error('[AppState] Error fetching profile:', err);
      }

      // 2. Employer's jobs
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('*')
        .eq('employer_id', uid)
        .order('created_at', { ascending: false });
      if (jobsData) setListings(jobsData);

      const jobIds = (jobsData || []).map(j => j.id);

      // 3. Real analytics from jobs + applications
      // Total views — sum total_views column (maintained by Postgres trigger)
      const totalViews = (jobsData || []).reduce((sum, j) => sum + (j.total_views || 0), 0);
      // Total likes — sum total_likes column (maintained by Postgres trigger)
      const totalLikes = (jobsData || []).reduce((sum, j) => sum + (j.total_likes || 0), 0);

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

        // Compute real 7-day trend from application created_at
        const now = new Date();
        const trend = [0, 0, 0, 0, 0, 0, 0]; // index 0 = 6 days ago, index 6 = today
        allApps.forEach(a => {
          if (!a.created_at) return;
          const appDate = new Date(a.created_at);
          const diffMs = now.getTime() - appDate.getTime();
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          if (diffDays >= 0 && diffDays < 7) {
            trend[6 - diffDays]++;
          }
        });

        setAnalytics({
          total_views: totalViews,
          total_likes: totalLikes,
          total_applications: allApps.length,
          active_jobs: jobIds.length,
          pipeline_stats: pipeline,
          recent_candidates: allApps.slice(0, 5),
          recent_apps_trend: trend,
        });
      } else {
        setAnalytics({
          total_views: 0,
          total_likes: 0,
          total_applications: 0,
          active_jobs: 0,
          pipeline_stats: { Pending: 0, Viewed: 0, Interview: 0, Hired: 0, Rejected: 0 },
          recent_candidates: [],
          recent_apps_trend: [0, 0, 0, 0, 0, 0, 0],
        });
      }
    } catch (err) {
      console.error('[AppState] loadAll error:', err);
    }
  };

  useEffect(() => {
    // Initial load
    loadAll();

    // Listen for auth state changes so we fetch immediately after login
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
        loadAll();
      }
    });

    // ── Realtime: listen for changes to the jobs table ──
    // When total_views or total_likes change via triggers, update listings in place
    const realtimeChannel = supabase
      .channel('employer-jobs-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'jobs' },
        (payload) => {
          const updated = payload.new;
          if (!updated) return;
          // Update the specific listing in state
          setListings(prev => prev.map(l => l.id === updated.id ? { ...l, ...updated } : l));
          // Re-derive analytics from current listings with the update applied
          setAnalytics(prev => {
            // We recalculate totals inline for speed
            return prev; // loadAll will pick it up on next refresh
          });
          // Trigger a full refresh to recalculate analytics correctly
          loadAll();
        }
      )
      .subscribe();

    return () => {
      if (subscription) subscription.unsubscribe();
      supabase.removeChannel(realtimeChannel);
    };
  }, []);

  // ── Presence: subscribe to job rooms for live viewer counts ──
  useEffect(() => {
    if (!listings || listings.length === 0) return;

    const channels = [];
    listings.forEach(job => {
      const channel = supabase.channel(`job_room:${job.id}`);
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const count = Object.keys(state).length;
        setLiveViewers(prev => ({ ...prev, [job.id]: count }));
      });
      channel.subscribe();
      channels.push(channel);
    });

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [listings.length]); // Re-subscribe when listing count changes

  useEffect(() => { localStorage.setItem('employer_invited', JSON.stringify(invitedIds)); }, [invitedIds]);
  useEffect(() => { localStorage.setItem('employer_accepted', JSON.stringify(acceptedIds)); }, [acceptedIds]);

  return (
    <AppStateContext.Provider value={{
      invitedIds, setInvitedIds,
      acceptedIds, setAcceptedIds,
      listings, setListings,
      companyProfile, setCompanyProfile,
      analytics,
      liveViewers,
      refreshAnalytics: loadAll,
    }}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => useContext(AppStateContext);
