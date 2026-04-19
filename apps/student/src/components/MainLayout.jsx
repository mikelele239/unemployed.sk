import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Home, Search as SearchIcon, FileText, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useTranslation } from '../I18nContext';

export default function MainLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const navItems = [
    { path: '/foryou', label: t('nav.foryou'), icon: Home },
    { path: '/search', label: t('nav.search'), icon: SearchIcon },
    { path: '/applications', label: t('nav.applications'), icon: FileText },
    { path: '/profile', label: t('nav.profile'), icon: User },
  ];

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: isDesktop ? 'row' : 'column', 
      height: '100%', 
      background: 'var(--bg)',
      overflow: 'hidden'
    }}>
      {/* Sidebar Navigation (Desktop) / Bottom Nav (Mobile) */}
      <nav style={{
        width: isDesktop ? '240px' : '100%',
        height: isDesktop ? '100%' : 'calc(60px + env(safe-area-inset-bottom, 0px))',
        background: 'var(--bg)',
        borderRight: isDesktop ? '1px solid var(--border)' : 'none',
        borderTop: isDesktop ? 'none' : '1px solid var(--border)',
        display: 'flex',
        flexDirection: isDesktop ? 'column' : 'row',
        padding: isDesktop ? '24px 12px' : '0',
        paddingBottom: isDesktop ? '24px' : 'env(safe-area-inset-bottom, 0px)',
        position: isDesktop ? 'relative' : 'fixed',
        bottom: 0,
        left: 0,
        right: isDesktop ? 'auto' : 0,
        zIndex: 100,
        flexShrink: 0
      }}>
        {isDesktop && (
          <div style={{ 
            padding: '32px 16px',
            marginBottom: '20px'
          }}>
            <div style={{ 
              fontFamily: 'var(--font-display)', 
              fontSize: '1.3rem', 
              color: 'var(--text)',
              display: 'flex',
              alignItems: 'center',
              cursor: 'default',
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
            </div>
          </div>
        )}

        <div style={{ 
          display: 'flex', 
          flexDirection: isDesktop ? 'column' : 'row', 
          flex: 1,
          gap: isDesktop ? '8px' : '0'
        }}>
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            const Icon = item.icon;
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className="nav-tab"
                style={{
                  flex: isDesktop ? 'none' : 1,
                  height: isDesktop ? '48px' : '100%',
                  display: 'flex',
                  flexDirection: isDesktop ? 'row' : 'column',
                  alignItems: 'center',
                  justifyContent: isDesktop ? 'flex-start' : 'center',
                  gap: isDesktop ? '12px' : '3px',
                  padding: isDesktop ? '0 16px' : '0',
                  borderRadius: isDesktop ? '12px' : '0',
                  background: isDesktop && isActive ? 'var(--accent-light)' : 'none',
                  color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: isDesktop ? '15px' : '9px',
                  fontWeight: isActive ? 600 : 500,
                  textDecoration: 'none',
                  position: 'relative',
                  transition: 'all 0.2s ease'
                }}
              >
                <Icon size={isDesktop ? 22 : 20} strokeWidth={isActive ? 2.5 : 2} />
                <span>{item.label}</span>
                
                {!isDesktop && isActive && (
                  <motion.div
                    layoutId="bottomNavIndicator"
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      width: '60%',
                      height: '3px',
                      background: 'var(--accent)',
                      borderRadius: '3px 3px 0 0'
                    }}
                  />
                )}
                {isDesktop && isActive && (
                  <motion.div
                    layoutId="sideNavIndicator"
                    style={{
                      position: 'absolute',
                      left: 0,
                      width: '4px',
                      height: '24px',
                      background: 'var(--accent)',
                      borderRadius: '0 4px 4px 0'
                    }}
                  />
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        paddingBottom: isDesktop ? '0' : 'calc(60px + env(safe-area-inset-bottom, 0px))',
        position: 'relative'
      }}>
        <Outlet />
      </div>
    </div>
  );
}
