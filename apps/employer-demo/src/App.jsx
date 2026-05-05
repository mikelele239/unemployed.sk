import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAppState } from './contexts';

import SideNav from './components/SideNav';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Listings from './pages/Listings';
import CreateListing from './pages/CreateListing';
import Candidates from './pages/Candidates';
import Profile from './pages/Profile';
import EmployerAuth from './pages/EmployerAuth';
import Inquiry from './pages/Inquiry';

import { supabase } from './supabase';
import { isDemoMode } from './demoMode';

const AppLayout = () => {
  const location = useLocation();
  const isSetup = location.pathname === '/setup';

  return (
    <div className="main-app">
      {!isSetup && <SideNav />}
      <main className="app-content">
        <Routes>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="listings" element={<Listings />} />
          <Route path="create-listing" element={<CreateListing />} />
          <Route path="candidates" element={<Candidates />} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
};

function App() {
  const demo = isDemoMode();
  const { companyProfile } = useAppState();
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(!demo);

  // Supabase Auth — only in live mode
  useEffect(() => {
    if (demo) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const role = session.user.user_metadata?.role || session.user.app_metadata?.role;
        if (role === 'candidate') {
           console.warn('Student detected in Employer portal. Redirecting...');
           setSession(null);
           localStorage.removeItem('employer_token');
           return;
        }
        setSession(session);
        localStorage.setItem('employer_token', session.access_token);
      }
      setLoadingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        const role = session.user.user_metadata?.role || session.user.app_metadata?.role;
        if (role === 'candidate') {
           setSession(null);
           localStorage.removeItem('employer_token');
           return;
        }
        setSession(session);
        localStorage.setItem('employer_token', session.access_token);
      } else {
        setSession(null);
        localStorage.removeItem('employer_token');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Demo Mode: No auth, straight to dashboard ──
  if (demo) {
    return (
      <BrowserRouter basename="/employer-demo">
        <Routes>
          <Route path="/*" element={<AppLayout />} />
        </Routes>
      </BrowserRouter>
    );
  }

  // ── Live Mode: Full Supabase auth ──
  if (loadingSession) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text)' }}>
        Overujem prístup...
      </div>
    );
  }

  if (!session) {
    return (
      <BrowserRouter basename="/employer-demo">
        <Routes>
          <Route path="inquiry" element={<Inquiry />} />
          <Route path="*" element={<EmployerAuth onLoginSuccess={() => window.location.href = '/employer-demo/dashboard'} />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter basename="/employer-demo">
      <Routes>
        <Route path="/*" element={<AppLayout />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
