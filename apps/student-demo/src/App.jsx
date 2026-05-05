import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Onboarding from './pages/Onboarding';
import MainLayout from './components/MainLayout';
import ForYou from './pages/ForYou';
import Search from './pages/Search';
import Applications from './pages/Applications';
import Profile from './pages/Profile';
import CandidateAuth from './pages/CandidateAuth';
import './index.css';

import { supabase, getAccessToken } from './supabase';
import { isDemoMode } from './demoMode';

function App() {
  const demo = isDemoMode();
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(!demo); // skip loading in demo

  const [profileStarted, setProfileStarted] = useState(() => {
    if (demo) return false; // Always show onboarding in demo
    return localStorage.getItem('unemployed_profile_started') === 'true';
  });

  // Supabase Auth Listener — only in live mode
  useEffect(() => {
    if (demo) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Smart Onboarding: Check if profile already exists in DB — only in live mode
  useEffect(() => {
    if (demo) return;
    if (session && !profileStarted) {
      const checkProfile = async () => {
        try {
          const token = getAccessToken();
          if (!token) return;
          
          console.log('[AUTH] Checking for existing profile in DB...');
          const res = await fetch('/api/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (res.ok) {
            const profile = await res.json();
            // If we get a valid profile back with a name, mark onboarding as complete
            if (profile && profile.first_name) {
              console.log('[AUTH] Profile found, skipping onboarding.');
              completeOnboarding();
            } else {
               console.log('[AUTH] No profile found in DB, proceeding to onboarding.');
            }
          }
        } catch (e) {
          console.error('Smart onboarding check failed:', e);
        }
      };
      checkProfile();
    }
  }, [session, profileStarted]);

  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data && e.data.type === 'reset') {
        localStorage.removeItem('unemployed_profile_started');
        localStorage.removeItem('unemployed_profile');
        setProfileStarted(false);
        // If reset includes a lang, re-broadcast it so I18nContext picks it up
        if (e.data.lang) {
          window.dispatchEvent(new MessageEvent('message', { data: { type: 'lang', lang: e.data.lang } }));
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const completeOnboarding = () => {
    if (!demo) localStorage.setItem('unemployed_profile_started', 'true');
    setProfileStarted(true);
  };

  // ── Demo Mode: No auth, straight to app ──
  if (demo) {
    return (
      <BrowserRouter basename="/student-demo">
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
              <Route path="*" element={<Navigate to="/foryou" replace />} />
            </Route>
          )}
        </Routes>
      </BrowserRouter>
    );
  }

  // ── Live Mode: Full Supabase auth ──
  if (loadingSession) return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Overujem prihlásenie...</div>;

  if (!session) {
    return (
      <BrowserRouter basename="/student-demo">
        <Routes>
          <Route path="*" element={<CandidateAuth onLoginSuccess={(newSession) => setSession(newSession)} />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter basename="/student-demo">
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
            <Route path="*" element={<Navigate to="/foryou" replace />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
