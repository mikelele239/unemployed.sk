import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAppState, useI18n } from './contexts';

import SideNav from './components/SideNav';
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
