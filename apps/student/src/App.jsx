import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabase';
import Onboarding from './pages/Onboarding';
import MainLayout from './components/MainLayout';
import ForYou from './pages/ForYou';
import Search from './pages/Search';
import Applications from './pages/Applications';
import Profile from './pages/Profile';
import CompanyProfile from './pages/CompanyProfile';
import CandidateAuth from './pages/CandidateAuth';
import './index.css';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileStarted, setProfileStarted] = useState(false);

  // ── Auth Session ─────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (!s) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setProfileStarted(false);
        localStorage.removeItem('unemployed_onboarding_complete');
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Check if profile exists via direct Supabase query ────────────────────
  useEffect(() => {
    if (!session) return;

    const checkProfile = async () => {
      try {
        // Check localStorage first for instant load (prevents flash of onboarding)
        const onboardingDone = localStorage.getItem('unemployed_onboarding_complete');
        if (onboardingDone === session.user.id) {
          setProfileStarted(true);
          setLoading(false);
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, cv_id, skills')
          .eq('user_id', session.user.id)
          .maybeSingle();

        // Consider onboarding complete if ANY of these exist:
        // - has a name (from manual entry or CV parse)
        // - has a cv_id (uploaded a CV)
        // - has skills filled in
        if (profile && (profile.first_name || profile.last_name || profile.cv_id || (profile.skills && profile.skills.length > 0))) {
          setProfileStarted(true);
          localStorage.setItem('unemployed_onboarding_complete', session.user.id);
        } else if (onboardingDone === session.user.id) {
          // localStorage says done but DB disagrees — trust localStorage
          // (the profile save may have been deferred)
          setProfileStarted(true);
        }
      } catch (err) {
        console.error('[App] Profile check error:', err);
        // On error, check localStorage fallback
        const onboardingDone = localStorage.getItem('unemployed_onboarding_complete');
        if (onboardingDone === session.user.id) {
          setProfileStarted(true);
        }
      } finally {
        setLoading(false);
      }
    };

    checkProfile();
  }, [session]);

  const completeOnboarding = () => {
    // Persist to localStorage so page refreshes don't re-trigger onboarding
    if (session?.user?.id) {
      localStorage.setItem('unemployed_onboarding_complete', session.user.id);
    }
    setProfileStarted(true);
  };

  if (loading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#0a0a0a', color: '#fff', gap: 20
      }}>
        <div style={{
          width: 40, height: 40,
          border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em' }}>
          NAČÍTAVAM...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Auth Gate ────────────────────────────────────────────────────────────
  if (!session) {
    return (
      <BrowserRouter basename="/app">
        <Routes>
          <Route path="*" element={<CandidateAuth onLoginSuccess={(s) => setSession(s)} />} />
        </Routes>
      </BrowserRouter>
    );
  }

  // ── Main App ─────────────────────────────────────────────────────────────
  return (
    <BrowserRouter basename="/app">
      <Routes>
        {!profileStarted ? (
          <>
            <Route path="/onboarding" element={<Onboarding onComplete={completeOnboarding} />} />
            <Route path="*" element={<Navigate to="/onboarding" replace />} />
          </>
        ) : (
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/foryou" replace />} />
            <Route path="foryou" element={<ForYou />} />
            <Route path="search" element={<Search />} />
            <Route path="applications" element={<Applications />} />
            <Route path="profile" element={<Profile />} />
            <Route path="company/:companyName" element={<CompanyProfile />} />
            <Route path="*" element={<Navigate to="/foryou" replace />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
