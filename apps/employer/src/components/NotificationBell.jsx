import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../supabase';

export default function NotificationBell({ lang }) {
  const [notifications, setNotifications] = useState([]);
  const [showPanel, setShowPanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, right: 0 });
  const bellRef = useRef(null);
  const panelRef = useRef(null);

  const unreadCount = (Array.isArray(notifications) ? notifications : []).filter(n => !n.read).length;

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const token = session.access_token;
      const res = await fetch(`/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Fetch notifications error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Poll every 30 seconds as fallback
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // ── Supabase Realtime: instant live notifications ──
  useEffect(() => {
    let channel = null;
    let cancelled = false;

    const setupRealtime = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) return;
        const userId = session.user.id;

        channel = supabase
          .channel('employer-notifications-realtime')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${userId}`,
            },
            (payload) => {
              const newNotif = payload.new;
              if (!newNotif) return;
              // Map 'message' column to 'body' for frontend compatibility
              const mapped = { ...newNotif, body: newNotif.message };
              setNotifications(prev => {
                // Avoid duplicates
                if (prev.some(n => n.id === mapped.id)) return prev;
                return [mapped, ...prev];
              });
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${userId}`,
            },
            (payload) => {
              const updated = payload.new;
              if (!updated) return;
              setNotifications(prev =>
                prev.map(n => n.id === updated.id ? { ...n, ...updated, body: updated.message } : n)
              );
            }
          )
          .subscribe((status) => {
            if (status === 'CHANNEL_ERROR') {
              console.warn('[Notifications Realtime] Channel error, falling back to polling');
            }
          });
      } catch (err) {
        console.warn('[Notifications Realtime] Setup failed:', err.message);
      }
    };

    setupRealtime();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Calculate dropdown position from bell button
  const updatePosition = useCallback(() => {
    if (bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect();
      setPanelPos({
        top: rect.bottom + 8,
        right: Math.max(16, window.innerWidth - rect.right),
      });
    }
  }, []);

  useEffect(() => {
    if (showPanel) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [showPanel, updatePosition]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        bellRef.current && !bellRef.current.contains(e.target)
      ) {
        setShowPanel(false);
      }
    };
    if (showPanel) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPanel]);

  const markAsRead = async (id) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) { console.error(err); }
  };

  const markAllRead = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`/api/notifications/read-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) { console.error(err); }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'application_received': return '📩';
      case 'status_update': return '📋';
      case 'interview_scheduled': return '📅';
      case 'hired': return '🎉';
      case 'rejected': return '❌';
      default: return '🔔';
    }
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return lang === 'sk' ? 'práve teraz' : 'just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  };

  const dropdown = showPanel ? createPortal(
    <AnimatePresence>
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        style={{
          position: 'fixed',
          top: panelPos.top,
          right: panelPos.right,
          width: Math.min(360, window.innerWidth - 32),
          maxHeight: 440,
          overflowY: 'auto',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          boxShadow: '0 16px 48px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.1)',
          zIndex: 9999,
        }}
      >
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
            {lang === 'sk' ? 'Notifikácie' : 'Notifications'}
          </h3>
          {unreadCount > 0 && (
            <button onClick={markAllRead} style={{
              background: 'none', border: 'none', color: 'var(--accent)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
              {lang === 'sk' ? 'Prečítať všetko' : 'Mark all read'}
            </button>
          )}
        </div>

        {loading && notifications.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {lang === 'sk' ? 'Načítavam...' : 'Loading...'}
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
            <p style={{ fontSize: 13 }}>{lang === 'sk' ? 'Žiadne notifikácie' : 'No notifications yet'}</p>
          </div>
        ) : (
          <div>
            {notifications.map(n => {
              // Extract AI Match % from title if present
              const matchRegex = /\(AI Match:\s*(\d+)%\)/;
              const matchResult = matchRegex.exec(n.title);
              const matchPct = matchResult ? parseInt(matchResult[1]) : null;
              const cleanTitle = matchResult ? n.title.replace(matchRegex, '').trim() : n.title;
              const cleanBody = matchResult && n.body ? n.body.replace(matchRegex, '').trim() : n.body;

              // Badge color based on score
              const badgeColor = matchPct != null
                ? matchPct >= 70 ? '#22c55e' : matchPct >= 40 ? '#f59e0b' : '#ef4444'
                : null;

              return (
              <div
                key={n.id}
                onClick={() => { if (!n.read) markAsRead(n.id); }}
                style={{
                  padding: '14px 18px', borderBottom: '1px solid var(--border)',
                  display: 'flex', gap: 12, cursor: 'pointer',
                  background: n.read ? 'transparent' : 'rgba(255,92,0,0.04)',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,92,0,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(255,92,0,0.04)'}
              >
                <div style={{ fontSize: 20, flexShrink: 0 }}>{getIcon(n.type)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <p style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: 'var(--text)', lineHeight: 1.4, margin: 0 }}>
                      {cleanTitle}
                    </p>
                    {matchPct != null && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        background: `${badgeColor}18`, color: badgeColor,
                        fontSize: 11, fontWeight: 700, padding: '2px 8px',
                        borderRadius: 20, border: `1px solid ${badgeColor}30`,
                        whiteSpace: 'nowrap', lineHeight: 1.4,
                      }}>
                        <span style={{ fontSize: 10 }}>🤖</span> {matchPct}%
                      </span>
                    )}
                  </div>
                  {cleanBody && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cleanBody}
                    </p>
                  )}
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {timeAgo(n.created_at)}
                  </p>
                </div>
                {!n.read && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 4 }} />
                )}
              </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </AnimatePresence>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={bellRef}
        onClick={() => { setShowPanel(!showPanel); if (!showPanel) fetchNotifications(); }}
        style={{
          position: 'relative', background: 'none', border: 'none',
          color: showPanel ? 'var(--accent)' : 'var(--text-muted)',
          cursor: 'pointer', padding: 8, borderRadius: 10,
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,92,0,0.08)'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            width: 18, height: 18, borderRadius: '50%',
            background: '#ef4444', color: '#fff',
            fontSize: 10, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--bg)',
            animation: 'bellPulse 2s ease infinite',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {dropdown}

      <style>{`
        @keyframes bellPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
    </>
  );
}
