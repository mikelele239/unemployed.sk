import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAppState, useI18n } from './contexts';

import BottomNav from './components/BottomNav';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Listings from './pages/Listings';
import CreateListing from './pages/CreateListing';
import Candidates from './pages/Candidates';
import Profile from './pages/Profile';

const AppLayout = () => {
  const location = useLocation();
  const isSetup = location.pathname === '/setup';

  return (
    <div className="main-app" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
      <div className="app-content" style={{ flex: 1, overflowY: 'auto', paddingBottom: isSetup ? '0' : '64px' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/listings" element={<Listings />} />
          <Route path="/create-listing" element={<CreateListing />} />
          <Route path="/candidates" element={<Candidates />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </div>
      {!isSetup && <BottomNav />}
    </div>
  );
};

function App() {
  const { companyProfile } = useAppState();

  return (
    <BrowserRouter basename="/employer">
      <Routes>
        <Route path="/setup" element={!companyProfile ? <Onboarding /> : <Navigate to="/dashboard" replace />} />
        <Route path="/*" element={companyProfile ? <AppLayout /> : <Navigate to="/setup" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
