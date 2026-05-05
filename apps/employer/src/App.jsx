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
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEmployer, setIsEmployer] = useState(false);

  useEffect(() => {
    const checkRole = async (sess) => {
      if (!sess) return false;
      const role = sess.user.user_metadata?.role || sess.user.app_metadata?.role;
      
      // If it's a student account trying to access employer portal, clear it.
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
      } else {
        setSession(null);
        setIsEmployer(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{ 
        height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
        background: 'radial-gradient(circle at top right, #ff5c0008, transparent), #050505', color: '#fff', gap: 20 
      }}>
        <div style={{ width: 44, height: 44, border: '3px solid rgba(255,255,255,0.05)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!session || !isEmployer) {
    return (
      <BrowserRouter basename="/employer">
        <Routes>
          <Route path="inquiry" element={<Inquiry />} />
          <Route path="*" element={<EmployerAuth onLoginSuccess={(sess) => {
            setSession(sess);
            setIsEmployer(true);
          }} />} />
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
