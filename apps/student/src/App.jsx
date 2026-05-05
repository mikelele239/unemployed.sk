import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Onboarding from './pages/Onboarding';
import MainLayout from './components/MainLayout';
import ForYou from './pages/ForYou';
import Search from './pages/Search';
import Applications from './pages/Applications';
import Profile from './pages/Profile';
import CandidateAuth from './pages/CandidateAuth';
import './index.css';

import { supabase, getAccessToken } from './supabase';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileStarted, setProfileStarted] = useState(false);

  // 1. Handle Auth Session
  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setProfileStarted(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Fetch Profile from DB if session exists
  useEffect(() => {
    if (!session) return;

    const fetchProfile = async () => {
      try {
        const token = getAccessToken();
        if (!token) return;

        const res = await fetch('/api/profile', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 401 || res.status === 403) {
          await supabase.auth.signOut();
          setSession(null);
          setLoading(false);
          return;
        }

        if (res.ok) {
          const profile = await res.json();
          // If profile exists in DB (even a stub with first_name), onboarding was started
          if (profile && (profile.first_name || profile.name)) {
            setProfileStarted(true);
          }
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [session]);

  const completeOnboarding = () => {
    setProfileStarted(true);
  };

  if (loading) {
    return (
      <div style={{ 
        height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
        background: '#0a0a0a', color: '#fff', gap: 20 
      }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em' }}>NAČÍTAVAM PROFIL...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Auth Gate ──
  if (!session) {
    return (
      <BrowserRouter basename="/app">
        <Routes>
          <Route path="*" element={<CandidateAuth onLoginSuccess={(s) => setSession(s)} />} />
        </Routes>
      </BrowserRouter>
    );
  }

  // ── Main App Logic ──
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
            <Route path="*" element={<Navigate to="/foryou" replace />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
