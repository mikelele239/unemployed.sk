import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Onboarding from './pages/Onboarding';
import MainLayout from './components/MainLayout';
import ForYou from './pages/ForYou';
import Search from './pages/Search';
import Applications from './pages/Applications';
import Profile from './pages/Profile';
import './index.css';

function App() {
  const [profileStarted, setProfileStarted] = useState(() => {
    return localStorage.getItem('unemployed_profile_started') === 'true';
  });

  // Listen for reset messages from the parent landing page iframe host
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
    localStorage.setItem('unemployed_profile_started', 'true');
    setProfileStarted(true);
  };

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
