import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { useAppState, useI18n } from './contexts';
import SideNav from './components/SideNav';
import NotificationBell from './components/NotificationBell';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Listings from './pages/Listings';
import CreateListing from './pages/CreateListing';
import Candidates from './pages/Candidates';
import CandidateProfile from './pages/CandidateProfile';
import Profile from './pages/Profile';
import EmployerAuth from './pages/EmployerAuth';
import Inquiry from './pages/Inquiry';
import Messages from './pages/Messages';
import { supabase } from './supabase';

const AppLayout = () => {
  const location = useLocation();
  const isSetup = location.pathname === '/setup';
  const { lang } = useI18n();
  const [bellVisible, setBellVisible] = useState(true);
  const lastY = useRef(0);

  // Capture-phase scroll listener — catches scroll on ANY element
  useEffect(() => {
    const onScroll = (e) => {
      const el = e.target;
      if (!el || el === document) return;
      const y = el.scrollTop;
      if (y == null || isNaN(y)) return;

      if (y > lastY.current + 5 && y > 80) {
        setBellVisible(false);
      } else if (y < lastY.current - 5 || y <= 80) {
        setBellVisible(true);
      }
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', onScroll, { capture: true });
  }, []);

  // Reset on page change
  useEffect(() => {
    setBellVisible(true);
    lastY.current = 0;
  }, [location.pathname]);

  return (
    <div className="main-app">
      {!isSetup && (
        <div className="mobile-top-bar" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 16px',
          background: 'var(--sidebar-bg)',
          borderBottom: '1px solid var(--border)',
          height: '56px',
          flexShrink: 0,
          zIndex: 100,
          width: '100%'
        }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            <span style={{ 
              fontFamily: 'var(--font-display)', 
              fontSize: '1.15rem', 
              color: 'var(--text)', 
              position: 'relative',
              whiteSpace: 'nowrap'
            }}>
              <span style={{ position: 'relative' }}>
                un
                <span style={{ 
                  position: 'absolute', 
                  left: '-1px', 
                  right: '-1px', 
                  top: '50%', 
                  height: '2px', 
                  background: 'var(--accent)', 
                  borderRadius: '2px' 
                }} />
              </span>
              employed.sk
            </span>
          </Link>
          <NotificationBell lang={lang} />
        </div>
      )}
      {!isSetup && <SideNav />}
      <main className="app-content" style={{ position: 'relative' }}>
        <Routes>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="listings" element={<Listings />} />
          <Route path="create-listing" element={<CreateListing />} />
          <Route path="candidates" element={<Candidates />} />
          <Route path="candidates/:candidateId" element={<CandidateProfile />} />
          <Route path="messages" element={<Messages />} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
};

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEmployer, setIsEmployer] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // Restore saved theme on mount
  useEffect(() => {
    const getTheme = () => {
      const match = document.cookie.match(new RegExp('(^| )theme=([^;]+)'));
      if (match) return match[2];
      return localStorage.getItem('employer_theme') || 'dark';
    };
    const currentTheme = getTheme();
    if (currentTheme === 'dark') {
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
    }
  }, []);

  // ── Shared onboarding check — called from every auth path ─────────────
  const checkOnboarding = async (sess) => {
    if (!sess) return;
    try {
      // Fast path: if we already completed onboarding in this browser, skip DB check
      const localKey = `employer_onboarded_${sess.user.id}`;
      if (localStorage.getItem(localKey) === 'true') {
        setNeedsOnboarding(false);
        return;
      }

      // Ensure employer row exists first
      try {
        await supabase.from('employers').upsert({
          id: sess.user.id,
          name: sess.user.email?.split('@')[0] || 'Firma',
        }, { onConflict: 'id', ignoreDuplicates: true });
      } catch (e) {
        console.warn('Profile ensure non-fatal error:', e);
      }

      // Check if employer profile is complete
      const { data: emp } = await supabase.from('employers')
        .select('name, industry, description, location, onboarding_complete')
        .eq('id', sess.user.id)
        .maybeSingle();

      // Only trigger onboarding if no profile exists at all, or if the profile
      // has never been customized (all key fields are empty/null AND onboarding_complete is not set)
      if (!emp) {
        setNeedsOnboarding(true);
        return;
      }

      // If onboarding_complete flag is set, always skip onboarding
      if (emp.onboarding_complete) {
        localStorage.setItem(localKey, 'true');
        setNeedsOnboarding(false);
        return;
      }

      // Fallback: if the employer has any meaningful data filled in,
      // consider onboarding done (handles employers who completed onboarding
      // before the onboarding_complete flag existed)
      const hasIndustry = !!(emp.industry || emp.description);
      const hasLocation = !!emp.location;
      const emailPrefix = sess.user.email?.split('@')[0] || 'Firma';
      const hasCustomName = emp.name && emp.name !== emailPrefix;

      if ((hasIndustry || hasLocation) && hasCustomName) {
        // They've filled in data before — mark as complete and skip
        localStorage.setItem(localKey, 'true');
        // Also save the flag to DB for future sessions on other devices
        try {
          await supabase.from('employers')
            .update({ onboarding_complete: true })
            .eq('id', sess.user.id);
        } catch {} // Non-fatal
        setNeedsOnboarding(false);
      } else {
        setNeedsOnboarding(true);
      }
    } catch (e) {
      console.warn('Onboarding check non-fatal:', e);
      setNeedsOnboarding(false);
    }
  };

  useEffect(() => {
    const checkRole = async (sess) => {
      if (!sess) return false;
      const role = sess.user.user_metadata?.role || sess.user.app_metadata?.role;
      if (role === 'candidate') {
        await supabase.auth.signOut();
        return false;
      }
      return true;
    };

    const init = async () => {
      try {
        const { data: { session: sess } } = await supabase.auth.getSession();
        const isValid = await checkRole(sess);
        if (sess && isValid) {
          setSession(sess);
          setIsEmployer(true);
          await checkOnboarding(sess);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      const isValid = await checkRole(sess);
      if (sess && isValid) {
        setSession(sess);
        setIsEmployer(true);
        // Run onboarding check on auth state changes too
        await checkOnboarding(sess);
      } else {
        setSession(null);
        setIsEmployer(false);
        setNeedsOnboarding(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(circle at top right, #ff5c0008, transparent), #050505',
        color: '#fff', gap: 20
      }}>
        <div style={{
          width: 44, height: 44,
          border: '3px solid var(--overlay-light)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Auth gate
  if (!session || !isEmployer) {
    return (
      <BrowserRouter basename="/employer">
        <Routes>
          <Route path="inquiry" element={<Inquiry />} />
          <Route path="*" element={<EmployerAuth onLoginSuccess={async (sess) => {
            setSession(sess);
            setIsEmployer(true);
            // Always check onboarding when login completes
            await checkOnboarding(sess);
          }} />} />
        </Routes>
      </BrowserRouter>
    );
  }

  // Onboarding gate — new employers who haven't set up their profile
  if (needsOnboarding) {
    return (
      <BrowserRouter basename="/employer">
        <Routes>
          <Route path="*" element={<Onboarding onComplete={() => setNeedsOnboarding(false)} />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter basename="/employer">
      <Routes>
        <Route path="/*" element={<AppLayout />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

