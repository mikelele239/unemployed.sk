import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Home, Search as SearchIcon, FileText, User } from 'lucide-react';
import { motion } from 'framer-motion';

export default function MainLayout() {
  const location = useLocation();

  const navItems = [
    { path: '/foryou', label: 'Pre teba', icon: Home },
    { path: '/search', label: 'Hľadať', icon: SearchIcon },
    { path: '/applications', label: 'Prihlášky', icon: FileText },
    { path: '/profile', label: 'Profil', icon: User },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px))' }}>
        <Outlet />
      </div>

      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'calc(60px + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'var(--bg)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        zIndex: 50
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
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: '9px',
                fontWeight: 500,
                textDecoration: 'none',
                position: 'relative'
              }}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span>{item.label}</span>
              
              {isActive && (
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
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
