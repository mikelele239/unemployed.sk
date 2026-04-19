import React, { useRef, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../contexts';

const BottomNav = () => {
  const { t } = useI18n();
  const location = useLocation();
  const indicatorRef = useRef(null);
  
  const tabs = [
    { id: 'dashboard', path: '/dashboard', label: t('navDash'), icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
    { id: 'listings', path: '/listings', label: t('navListings'), icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> },
    { id: 'candidates', path: '/candidates', label: t('navCand'), icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
    { id: 'profile', path: '/profile', label: t('navProfile'), icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> }
  ];

  const updateIndicator = () => {
    const activeTab = document.querySelector('.nav-tab.active');
    if (activeTab && indicatorRef.current) {
      const navRect = activeTab.parentElement.getBoundingClientRect();
      const tabRect = activeTab.getBoundingClientRect();
      const pad = Math.round(tabRect.width * 0.2);
      indicatorRef.current.style.width = `${tabRect.width - pad * 2}px`;
      indicatorRef.current.style.transform = `translateX(${tabRect.left - navRect.left + pad}px)`;
    }
  };

  useEffect(() => {
    setTimeout(updateIndicator, 50);
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [location.pathname]);

  return (
    <div className="bottom-nav" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, height: '58px',
      background: 'var(--bg)', borderTop: '1px solid var(--border)', display: 'flex', zIndex: 50
    }}>
      {tabs.map(tab => {
        const isActive = location.pathname.startsWith(tab.path);
        return (
          <Link 
            to={tab.path} 
            key={tab.id} 
            className={`nav-tab ${isActive ? 'active' : ''}`}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '2px', textDecoration: 'none', color: isActive ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: '9px', fontWeight: '500', position: 'relative'
            }}
          >
            <div style={{ width: '20px', height: '20px' }}>{tab.icon}</div>
            <span>{tab.label}</span>
          </Link>
        );
      })}
      <div 
        ref={indicatorRef} 
        className="nav-indicator" 
        style={{
          position: 'absolute', bottom: 0, height: '3px', borderRadius: '3px 3px 0 0',
          background: 'var(--accent)', transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.15, 1), width 0.35s cubic-bezier(0.4, 0, 0.15, 1)'
        }} 
      />
    </div>
  );
};

export default BottomNav;
