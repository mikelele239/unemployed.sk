import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../contexts';

const SideNav = () => {
  const { t } = useI18n();
  const navigate = useNavigate();

  const navItems = [
    { id: 'dashboard', path: '/dashboard', label: t('navDash'), icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
    )},
    { id: 'listings', path: '/listings', label: t('navListings'), icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
    )},
    { id: 'candidates', path: '/candidates', label: t('navCand'), icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
    )},
    { id: 'profile', path: '/profile', label: t('navProfile'), icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    )}
  ];

  return (
    <aside className="side-nav" style={{
      background: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      zIndex: 100,
      position: 'relative'
    }}>
      {/* Mobile Top Bar */}
      <div className="mobile-only" style={{ 
        padding: '16px 20px', 
        borderBottom: '1px solid var(--border)', 
        background: 'var(--sidebar-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '60px',
        zIndex: 101
      }}>
        <span style={{ 
          fontFamily: 'var(--font-display)', 
          fontSize: '1.2rem', 
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
      </div>
      {/* Brand Section */}
      <div className="desktop-only" style={{ padding: '32px 24px', borderBottom: '1px solid var(--border)' }}>
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <span style={{ 
            fontFamily: 'var(--font-display)', 
            fontSize: '1.3rem', 
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
      </div>

      {/* Main Nav */}
      <nav className="mobile-nav-container">
        {navItems.map(item => (
          <NavLink 
            key={item.id} 
            to={item.path}
            className={(navData) => `sidebar-link mobile-sidebar-link ${navData && navData.isActive ? 'active' : ''}`}
          >
            <div className="nav-icon-wrap" style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {item.icon}
            </div>
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}

        {/* Create Button */}
        <div className="desktop-only" style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
          <button 
            onClick={() => navigate('/create-listing')}
            className="btn-main"
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', 
              fontSize: '14px', padding: '12px', background: 'linear-gradient(135deg, #FF8C32 0%, #FF5C00 100%)' 
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>{t('newListing')}</span>
          </button>
        </div>
      </nav>

      {/* Bottom Context */}
      <div className="desktop-only" style={{ padding: '24px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #333, #111)', border: '1px solid var(--border)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
          <span style={{ fontSize: '13px', fontWeight: '600' }}>Executive Account</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Pro Plan</span>
        </div>
        <button 
          onClick={() => {
            localStorage.clear();
            window.location.href = '/employer-demo';
          }}
          title="Odhlásiť sa"
          style={{
            background: 'none', border: 'none', color: '#ff4747',
            padding: '8px', cursor: 'pointer', borderRadius: '6px',
            display: 'flex', alignItems: 'center', transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 71, 71, 0.1)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'none'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
        </button>
      </div>
    </aside>
  );
};

export default SideNav;
