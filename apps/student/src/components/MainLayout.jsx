import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, Search as SearchIcon, FileText, User, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../I18nContext';
import NotificationBell from './NotificationBell';
import { getUnreadCount, subscribeToConversations } from '../services/messagingService';

export default function MainLayout() {
  const { t, lang } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  const [bellVisible, setBellVisible] = useState(true);
  const lastY = useRef(0);
  const hideTimer = useRef(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    const updateUnread = async () => {
      const count = await getUnreadCount();
      if (active) setUnreadCount(count);
    };

    updateUnread();

    const sub = subscribeToConversations(() => {
      updateUnread();
    });

    return () => {
      active = false;
      if (sub && typeof sub.unsubscribe === 'function') sub.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Capture-phase scroll listener — catches scroll on ANY element
  useEffect(() => {
    const onScroll = (e) => {
      const el = e.target;
      if (!el || el === document) return;
      const y = el.scrollTop;
      if (y == null || isNaN(y)) return;

      if (y > lastY.current + 5 && y > 80) {
        setBellVisible(false);
      } else if (y < lastY.current - 5 || y <= 80) {
        setBellVisible(true);
      }
      lastY.current = y;
    };

    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', onScroll, { capture: true });
  }, []);

  // Reset on page change
  useEffect(() => {
    setBellVisible(true);
    lastY.current = 0;
  }, [location.pathname]);

  const navItems = [
    { path: '/foryou', label: t('nav.foryou'), icon: Home },
    { path: '/search', label: t('nav.search'), icon: SearchIcon },
    { path: '/applications', label: t('nav.applications'), icon: FileText },
    { path: '/messages', label: t('nav.messages'), icon: MessageSquare },
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
      {!isDesktop && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 16px',
          background: 'var(--bg)',
          borderBottom: '1px solid var(--border)',
          height: '56px',
          flexShrink: 0,
          zIndex: 100,
        }}>
          <div 
            onClick={() => navigate('/foryou')}
            style={{ 
              fontFamily: 'var(--font-display)', 
              fontSize: '1.15rem', 
              color: 'var(--text)',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
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
          <NotificationBell lang={lang} />
        </div>
      )}
      {/* Sidebar Navigation (Desktop) / Bottom Nav (Mobile) */}
      <nav style={{
        width: isDesktop ? '240px' : '100%',
        height: isDesktop ? '100%' : 'calc(60px + env(safe-area-inset-bottom, 0px))',
        background: 'var(--bg)',
        borderRight: isDesktop ? '1px solid var(--border)' : 'none',
        borderTop: isDesktop ? 'none' : '1px solid var(--border)',
        display: 'flex',
        flexDirection: isDesktop ? 'column' : 'row',
        padding: isDesktop ? '0 12px 24px' : '0',
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
            padding: '20px 16px',
            marginBottom: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div 
              onClick={() => navigate('/foryou')}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              style={{ 
                fontFamily: 'var(--font-display)', 
                fontSize: '1.3rem', 
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'opacity 0.2s'
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
            <NotificationBell lang={lang} />
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
                onClick={() => {
                  if (isActive) {
                    window.dispatchEvent(new CustomEvent('active-nav-click', { detail: { path: item.path } }));
                  }
                }}
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
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={isDesktop ? 22 : 20} strokeWidth={isActive ? 2.5 : 2} />
                  {item.path === '/messages' && unreadCount > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      background: 'var(--accent)',
                      color: '#fff',
                      fontSize: '9px',
                      fontWeight: 900,
                      borderRadius: '50%',
                      minWidth: '15px',
                      height: '15px',
                      padding: '0 2px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 8px rgba(255, 92, 0, 0.4)',
                      zIndex: 2
                    }}>
                      {unreadCount}
                    </span>
                  )}
                </div>
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
        overflowY: isDesktop ? 'auto' : (location.pathname === '/foryou' ? 'hidden' : 'auto'),
        overflowX: 'hidden',
        paddingBottom: isDesktop ? '0' : 'calc(60px + env(safe-area-inset-bottom, 0px))',
        position: 'relative'
      }}>
        <Outlet />
      </div>
    </div>
  );
}
