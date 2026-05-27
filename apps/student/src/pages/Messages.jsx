import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  ArrowLeft, 
  MessageSquare, 
  Building, 
  Briefcase, 
  Clock, 
  Sparkles,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';
import { useTranslation } from '../I18nContext';
import { 
  getConversations, 
  getMessages, 
  sendMessage, 
  markAsRead, 
  subscribeToMessages, 
  subscribeToConversations 
} from '../services/messagingService';
import { supabase } from '../supabase';
import { useLocation } from 'react-router-dom';
import ModernDatePicker from '../components/ModernDatePicker';
import VerificationChat from '../components/VerificationChat';
import { getVerificationStatus } from '../services/verificationService';

const AI_VERIFY_ID = 'ai-verify';

const formatSystemMessage = (body, lang) => {
  if (!body) return '';
  if (lang === 'sk') return body;

  // Slovak to English translations
  if (body.includes('Prihláška bola úspešne odoslaná.')) {
    return 'Your application has been successfully submitted.';
  }
  if (body.includes('Prihláška odoslaná.')) {
    return 'Application submitted.';
  }
  if (body.includes('Zamestnávateľ si pozrel váš profil.')) {
    return 'The employer has viewed your profile.';
  }
  if (body.includes('Zamestnávateľ vás pozval na pohovor. Vyberte si termín.')) {
    return 'The employer invited you to an interview. Choose a date.';
  }
  if (body.includes('Pohovor bol potvrdený na termín:')) {
    return body.replace('Pohovor bol potvrdený na termín:', 'Interview confirmed for:');
  }
  if (body.includes('Kandidát navrhol iný termín pohovoru:')) {
    return body.replace('Kandidát navrhol iný termín pohovoru:', 'You proposed a counter-offer date:');
  }
  if (body.includes('Gratulujeme! Boli ste prijatý na pozíciu')) {
    return body.replace('Gratulujeme! Boli ste prijatý na pozíciu', 'Congratulations! You have been accepted for');
  }
  if (body.includes('Výberové konanie bolo ukončené.')) {
    return 'The selection process has ended.';
  }
  if (body.includes('Pozvanie na pohovor bolo odmietnuté.')) {
    return 'The interview invitation was declined.';
  }
  return body;
};

export default function Messages() {
  const { t, lang } = useTranslation();
  const location = useLocation();
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingConv, setLoadingConv] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showStudentCounterPicker, setShowStudentCounterPicker] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null); // null | 'in_progress' | 'completed'

  const messagesEndRef = useRef(null);
  const activeConvRef = useRef(null);

  // Set activeConvId from state if navigation passed it
  useEffect(() => {
    if (location.state?.activeConvId) {
      setActiveConvId(location.state.activeConvId);
    }
  }, [location.state]);

  // Keep track of active conversation ID in ref for realtime updates
  useEffect(() => {
    activeConvRef.current = activeConvId;
  }, [activeConvId]);

  // Handle responsiveness
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch current user and conversations
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(session.user);
      }
      await fetchInbox();
      setLoadingConv(false);

      // Fetch verification status for the pinned AI thread
      try {
        const { verification } = await getVerificationStatus();
        if (verification?.status) setVerificationStatus(verification.status);
      } catch (_) {}
    };

    init();

    // Handle navigation with pre-selected conversation or AI verify thread
    if (location.state?.openVerification) {
      setActiveConvId(AI_VERIFY_ID);
    }

    // Subscribe to conversations/inbox updates
    const sub = subscribeToConversations(async () => {
      await fetchInbox();
    });

    return () => {
      if (sub && typeof sub.unsubscribe === 'function') sub.unsubscribe();
    };
  }, []);

  const fetchInbox = async () => {
    const convs = await getConversations();
    setConversations(convs);
  };

  // Fetch messages when active conversation changes
  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    const fetchMsgs = async () => {
      const msgs = await getMessages(activeConvId);
      setMessages(msgs);
      setLoadingMessages(false);
      scrollToBottom();
      
      // Mark as read
      await markAsRead(activeConvId);
      await fetchInbox();
    };

    fetchMsgs();

    // Subscribe to new messages inside active conversation
    const sub = subscribeToMessages(activeConvId, (newMsg) => {
      // Ensure the message isn't already in list (optimistic update fallback)
      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      scrollToBottom();
      
      // Keep conversations/application status in sync
      fetchInbox();

      // If active conversation is this one, mark it as read immediately
      if (activeConvRef.current === activeConvId) {
        markAsRead(activeConvId);
      }
    });

    return () => {
      if (sub && typeof sub.unsubscribe === 'function') sub.unsubscribe();
    };
  }, [activeConvId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || !activeConvId) return;

    const text = inputValue.trim();
    setInputValue('');

    // Optimistic update
    const tempId = genRandomId();
    const tempMsg = {
      id: tempId,
      conversation_id: activeConvId,
      sender_id: currentUser?.id,
      message_type: 'text',
      body: text,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMsg]);
    scrollToBottom();

    try {
      await sendMessage(activeConvId, text);
    } catch (err) {
      console.error('Failed to send message:', err);
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  const genRandomId = () => Math.random().toString(36).substring(2, 9);

  const activeConv = conversations.find(c => c.id === activeConvId);

  // Helper to format date relative to Slovak standard
  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const today = new Date();
    
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString(lang === 'sk' ? 'sk-SK' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString(lang === 'sk' ? 'sk-SK' : 'en-US', { day: 'numeric', month: 'short' });
  };

  const formatFullDate = (isoString) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleString(lang === 'sk' ? 'sk-SK' : 'en-US', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Inbox List Sidebar / Component
  const renderInboxList = () => (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      background: 'var(--bg)',
      borderRight: !isMobile ? '1px solid var(--border)' : 'none',
      width: !isMobile ? '360px' : '100%',
      flexShrink: 0
    }}>
      {/* Search/Header */}
      <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 400, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <MessageSquare style={{ color: 'var(--accent)' }} size={26} />
          {lang === 'sk' ? 'Správy' : 'Messages'}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          {lang === 'sk' ? 'Komunikácia s tvojimi potenciálnymi zamestnávateľmi.' : 'Chat with potential employers.'}
        </p>
      </div>

      {/* Conversations List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {/* ── Pinned: AI Verification Thread ── */}
        {(() => {
          const isActive = activeConvId === AI_VERIFY_ID;
          const isDone = verificationStatus === 'completed';
          const isInProgress = verificationStatus === 'in_progress';
          return (
            <motion.div
              whileHover={{ scale: 1.01 }}
              onClick={() => setActiveConvId(AI_VERIFY_ID)}
              style={{
                padding: '14px 16px',
                borderRadius: 16,
                background: isActive
                  ? 'linear-gradient(135deg, rgba(255,92,0,0.12), rgba(255,140,50,0.06))'
                  : isDone
                    ? 'rgba(34,197,94,0.05)'
                    : 'linear-gradient(135deg, rgba(255,92,0,0.06), rgba(255,140,50,0.03))',
                border: isActive
                  ? '1px solid var(--accent)'
                  : isDone
                    ? '1px solid rgba(34,197,94,0.3)'
                    : '1px solid rgba(255,92,0,0.25)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 8,
                transition: 'all 0.2s ease',
                boxShadow: isActive ? '0 4px 20px rgba(255,92,0,0.1)' : 'none',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Shimmer for not-done state */}
              {!isDone && (
                <motion.div
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 3 }}
                  style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
                    pointerEvents: 'none',
                  }}
                />
              )}

              {/* Icon */}
              <div style={{
                width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                background: isDone
                  ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                  : 'linear-gradient(135deg, var(--accent), #FF8C32)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isDone
                  ? '0 4px 12px rgba(34,197,94,0.3)'
                  : '0 4px 12px rgba(255,92,0,0.25)',
              }}>
                {isDone
                  ? <ShieldCheck size={22} color="#fff" />
                  : <Sparkles size={22} color="#fff" />}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
                    unemployed.sk AI
                  </h4>
                  {isDone && (
                    <span style={{
                      fontSize: 9, fontWeight: 800, color: '#22c55e', textTransform: 'uppercase',
                      letterSpacing: '0.5px', background: 'rgba(34,197,94,0.12)',
                      border: '1px solid rgba(34,197,94,0.25)', borderRadius: 100, padding: '1px 6px',
                    }}>✓ {lang === 'sk' ? 'Overené' : 'Verified'}</span>
                  )}
                  {isInProgress && (
                    <span style={{
                      fontSize: 9, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase',
                      letterSpacing: '0.5px', background: 'rgba(255,92,0,0.1)',
                      border: '1px solid rgba(255,92,0,0.2)', borderRadius: 100, padding: '1px 6px',
                    }}>{lang === 'sk' ? 'Rozpracované' : 'In progress'}</span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', fontWeight: 500,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {isDone
                    ? (lang === 'sk' ? '✅ Tvoj profil je overený' : '✅ Your profile is verified')
                    : (lang === 'sk' ? '🎤 Overte si profil a získajte odznaky' : '🎤 Verify your profile to get badges')}
                </p>
              </div>

              {/* Chevron or done dot */}
              {!isDone && (
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--accent)', flexShrink: 0,
                  boxShadow: '0 0 8px rgba(255,92,0,0.6)',
                  animation: 'pulse 2s infinite',
                }} />
              )}
            </motion.div>
          );
        })()}

        {loadingConv ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 0' }}>
            <div className="spinner" style={{
              width: 24, height: 24,
              border: '2px solid rgba(255,255,255,0.1)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
          </div>
        ) : conversations.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 20px' }}>
            <span style={{ fontSize: 40, marginBottom: 12, display: 'block' }}>💬</span>
            <p style={{ fontWeight: 600 }}>{lang === 'sk' ? 'Zatiaľ žiadne správy' : 'No messages yet'}</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>{lang === 'sk' ? 'Keď ťa zamestnávateľ kontaktuje alebo položíš otázku, uvidíš to tu.' : 'Once an employer contacts you, the thread will appear here.'}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {conversations.map(conv => {
              const isActive = conv.id === activeConvId;
              const hasUnread = conv.unreadCount > 0;
              const lastMsgText = conv.lastMessage 
                ? (conv.lastMessage.message_type === 'system' ? `⚙️ ${formatSystemMessage(conv.lastMessage.body, lang)}` : conv.lastMessage.body)
                : (lang === 'sk' ? 'Začnite konverzáciu...' : 'Start conversation...');

              return (
                <motion.div
                  key={conv.id}
                  whileHover={{ scale: 1.01, background: 'var(--accent-light)' }}
                  onClick={() => setActiveConvId(conv.id)}
                  style={{
                    padding: '16px',
                    borderRadius: 16,
                    background: isActive ? 'var(--accent-light)' : 'var(--bg-card)',
                    border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    boxShadow: isActive ? '0 4px 20px rgba(255, 92, 0, 0.05)' : 'none'
                  }}
                >
                  {/* Brand Logo Avatar */}
                  <div style={{ 
                    width: 46, height: 46, borderRadius: 12, 
                    background: 'var(--accent)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    color: '#fff', fontSize: 16, fontWeight: 800, flexShrink: 0,
                    overflow: 'hidden'
                  }}>
                    {conv.employer?.logo_url ? (
                      <img src={conv.employer.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      (conv.employer?.name || '?').charAt(0).toUpperCase()
                    )}
                  </div>

                  {/* Conv metadata */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                      <h4 style={{ 
                        margin: 0, 
                        fontSize: 14, 
                        fontWeight: hasUnread ? 800 : 700, 
                        color: 'var(--text)',
                        whiteSpace: 'nowrap', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis' 
                      }}>
                        {conv.employer?.name || 'Zamestnávateľ'}
                      </h4>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, flexShrink: 0 }}>
                        {formatTime(conv.lastMessageAt)}
                      </span>
                    </div>

                    {/* Job Title / Subject tag */}
                    {conv.job?.title && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--accent)', fontWeight: 700, marginBottom: 4 }}>
                        <Briefcase size={10} />
                        <span>{conv.job.title}</span>
                      </div>
                    )}

                    {/* Last message snippet */}
                    <p style={{ 
                      margin: 0, 
                      fontSize: 12, 
                      color: hasUnread ? 'var(--text)' : 'var(--text-muted)',
                      fontWeight: hasUnread ? 700 : 500,
                      whiteSpace: 'nowrap', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis' 
                    }}>
                      {lastMsgText}
                    </p>
                  </div>

                  {/* Unread indicator badge */}
                  {hasUnread && (
                    <span style={{ 
                      width: 18, height: 18, borderRadius: '50%',
                      background: 'var(--accent)', color: '#fff',
                      fontSize: 10, fontWeight: 900,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 0 10px rgba(255, 92, 0, 0.4)'
                    }}>
                      {conv.unreadCount}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // AI Verification Chat Thread
  const renderVerificationThread = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-card)', flex: 1 }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        {isMobile && (
          <button
            onClick={() => setActiveConvId(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: '4px 8px 4px 0', display: 'flex', alignItems: 'center' }}
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: verificationStatus === 'completed'
            ? 'linear-gradient(135deg, #22c55e, #16a34a)'
            : 'linear-gradient(135deg, var(--accent), #FF8C32)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {verificationStatus === 'completed'
            ? <ShieldCheck size={20} color="#fff" />
            : <Sparkles size={20} color="#fff" />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>unemployed.sk AI</h3>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {verificationStatus === 'completed'
              ? (lang === 'sk' ? '✅ Overenie dokončené' : '✅ Verification complete')
              : (lang === 'sk' ? '🎤 Overenie profilu' : '🎤 Profile Verification')}
          </div>
        </div>
      </div>

      {/* The VerificationChat component fills remaining space */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <VerificationChat
          onComplete={(status) => setVerificationStatus(status)}
        />
      </div>
    </div>
  );

  // Chat Thread Component
  const renderChatThread = () => (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      background: 'var(--bg-card)', 
      flex: 1 
    }}>
      {/* Chat Header */}
      <div style={{ 
        padding: '16px 20px', 
        borderBottom: '1px solid var(--border)', 
        background: 'var(--bg)',
        display: 'flex', 
        alignItems: 'center', 
        gap: 12 
      }}>
        {/* Back Button (Mobile only) */}
        {isMobile && (
          <button 
            onClick={() => setActiveConvId(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: '4px 8px 4px 0', display: 'flex', alignItems: 'center' }}
          >
            <ArrowLeft size={20} />
          </button>
        )}

        {/* Company Logo */}
        <div style={{ 
          width: 40, height: 40, borderRadius: 10, 
          background: 'var(--accent)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', 
          color: '#fff', fontSize: 14, fontWeight: 800,
          overflow: 'hidden'
        }}>
          {activeConv?.employer?.logo_url ? (
            <img src={activeConv.employer.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            (activeConv?.employer?.name || '?').charAt(0).toUpperCase()
          )}
        </div>

        {/* Header Title */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {activeConv?.employer?.name}
          </h3>
          {activeConv?.job?.title && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Briefcase size={12} style={{ color: 'var(--accent)' }} />
              <span>{activeConv.job.title}</span>
              {activeConv.application && (
                <>
                  <span style={{ color: 'var(--border)' }}>•</span>
                  <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 10, color: 'var(--accent)' }}>
                    {activeConv.application.status}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Interview Banner */}
      {activeConv?.application && ['Interview', 'Interview-Confirmed', 'Counter-Offer', 'Declined'].includes(activeConv.application.status) && (
        <div style={{
          background: 'rgba(255, 92, 0, 0.04)',
          borderBottom: '1px solid var(--border)',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          position: 'relative',
          backdropFilter: 'blur(10px)',
          zIndex: 10
        }}>
          {activeConv.application.status === 'Interview' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={18} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
                    {lang === 'sk' ? 'Pozvánka na pohovor' : 'Interview Invitation'}
                  </span>
                </div>
                <button
                  onClick={async () => {
                    if (window.confirm(lang === 'sk' ? 'Naozaj chceš odmietnuť toto pozvanie?' : 'Do you really want to decline this invitation?')) {
                      const session = (await supabase.auth.getSession()).data.session;
                      if (!session) return;
                      const res = await fetch(`/api/applications/${activeConv.applicationId}`, {
                        method: 'PATCH',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${session.access_token}`
                        },
                        body: JSON.stringify({ status: 'Declined' })
                      });
                      if (res.ok) {
                        await fetchInbox();
                      }
                    }
                  }}
                  style={{
                    background: 'none', border: 'none', color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline'
                  }}
                >
                  {lang === 'sk' ? 'Odmietnuť' : 'Decline'}
                </button>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                {lang === 'sk' ? 'Zamestnávateľ ti navrhol nasledovné termíny pohovoru. Vyber si ten, ktorý ti vyhovuje:' : 'The employer proposed the following interview dates. Choose one that fits:'}
              </p>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(activeConv.application.interview_dates || []).length === 0 ? (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {lang === 'sk' ? 'Žiadne navrhnuté termíny. Počkaj na správu od zamestnávateľa.' : 'No proposed dates. Wait for message from employer.'}
                  </span>
                ) : (
                  activeConv.application.interview_dates.map(date => (
                    <motion.button
                      whileHover={{ scale: 1.02, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }}
                      whileTap={{ scale: 0.98 }}
                      key={date}
                      onClick={async () => {
                        const session = (await supabase.auth.getSession()).data.session;
                        if (!session) return;
                        const res = await fetch(`/api/applications/${activeConv.applicationId}`, {
                          method: 'PATCH',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`
                          },
                          body: JSON.stringify({ status: 'Interview-Confirmed', selected_date: date })
                        });
                        if (res.ok) {
                          await fetchInbox();
                        }
                      }}
                      style={{
                        padding: '10px 14px', borderRadius: 10, border: '1px solid var(--accent)',
                        background: 'var(--bg-card)', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        transition: 'all 0.2s', fontFamily: 'var(--font-body)'
                      }}
                    >
                      {new Date(date).toLocaleString(lang === 'sk' ? 'sk-SK' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                    </motion.button>
                  ))
                )}
                
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowStudentCounterPicker(true)}
                  style={{
                    padding: '10px 14px', borderRadius: 10, border: '1px dashed var(--accent)',
                    background: 'rgba(255, 92, 0, 0.04)', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'var(--font-body)'
                  }}
                >
                  {lang === 'sk' ? 'Navrhnúť iný termín' : 'Propose other date'}
                </motion.button>
              </div>
            </>
          )}

          {activeConv.application.status === 'Interview-Confirmed' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(34, 197, 94, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                ✅
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#22c55e', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {lang === 'sk' ? 'Potvrdený termín pohovoru' : 'Confirmed Interview Date'}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>
                  {new Date(activeConv.application.selected_date).toLocaleString(lang === 'sk' ? 'sk-SK' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </div>
            </div>
          )}

          {activeConv.application.status === 'Counter-Offer' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255, 92, 0, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                📅
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {lang === 'sk' ? 'Tvoj navrhnutý protinávrh termínu' : 'Your Proposed Counter-Offer Date'}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>
                  {new Date(activeConv.application.selected_date).toLocaleString(lang === 'sk' ? 'sk-SK' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {lang === 'sk' ? 'Čaká sa na schválenie od zamestnávateľa.' : 'Awaiting employer confirmation.'}
                </div>
              </div>
            </div>
          )}

          {activeConv.application.status === 'Declined' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                🚫
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#ef4444' }}>
                  {lang === 'sk' ? 'Odmietol/la si pozvanie na pohovor.' : 'You declined the interview invitation.'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Messages Scroll Area */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        background: 'linear-gradient(180deg, var(--bg) 0%, var(--bg-card) 100%)'
      }}>
        {loadingMessages ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <div className="spinner" style={{
              width: 24, height: 24,
              border: '2px solid rgba(255,255,255,0.1)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
          </div>
        ) : messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center', padding: '0 20px' }}>
            <Sparkles size={32} style={{ color: 'var(--accent)', marginBottom: 8, animation: 'pulse 2s infinite' }} />
            <p style={{ fontSize: 14, fontWeight: 700 }}>{lang === 'sk' ? 'Začiatok vašej konverzácie' : 'Start of your conversation'}</p>
            <p style={{ fontSize: 12 }}>{lang === 'sk' ? 'Pošlite prvú správu pre nadviazanie kontaktu.' : 'Send a first message to start the connection.'}</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.sender_id === currentUser?.id;
            const isSystem = msg.message_type === 'system';
            
            if (isSystem) {
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                  <div style={{ 
                    background: 'var(--bg)', 
                    border: '1px solid var(--border)', 
                    borderRadius: 100, 
                    padding: '6px 16px', 
                    fontSize: 11, 
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                  }}>
                    {msg.body.includes('potvrdený') ? (
                      <CheckCircle2 size={12} style={{ color: '#22c55e' }} />
                    ) : msg.body.includes('pohovor') ? (
                      <Calendar size={12} style={{ color: 'var(--accent)' }} />
                    ) : (
                      <AlertCircle size={12} style={{ color: 'var(--text-muted)' }} />
                    )}
                     <span>{formatSystemMessage(msg.body, lang)}</span>
                  </div>
                </div>
              );
            }

            return (
              <div 
                key={msg.id} 
                style={{ 
                  display: 'flex', 
                  justifyContent: isMe ? 'flex-end' : 'flex-start',
                  width: '100%'
                }}
              >
                <div style={{
                  maxWidth: '70%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMe ? 'flex-end' : 'flex-start'
                }}>
                  {/* Message bubble */}
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: isMe ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                    background: isMe 
                      ? 'linear-gradient(135deg, var(--accent) 0%, #FF8C32 100%)' 
                      : 'var(--bg)',
                    color: isMe ? '#fff' : 'var(--text)',
                    border: isMe ? 'none' : '1px solid var(--border)',
                    fontSize: 14,
                    fontWeight: 500,
                    lineHeight: '1.4',
                    boxShadow: isMe 
                      ? '0 4px 12px rgba(255, 92, 0, 0.15)' 
                      : '0 2px 8px rgba(0,0,0,0.02)',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {msg.body}
                  </div>
                  
                  {/* Message timestamp */}
                  <span style={{ 
                    fontSize: 9, 
                    color: 'var(--text-muted)', 
                    marginTop: 4, 
                    padding: '0 4px',
                    fontWeight: 600
                  }}>
                    {new Date(msg.created_at).toLocaleTimeString(lang === 'sk' ? 'sk-SK' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Message Area */}
      <form 
        onSubmit={handleSend}
        style={{ 
          padding: '16px 20px', 
          borderTop: '1px solid var(--border)', 
          background: 'var(--bg)',
          display: 'flex',
          gap: 10,
          alignItems: 'center'
        }}
      >
        <input 
          type="text" 
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder={lang === 'sk' ? 'Napíš správu...' : 'Type a message...'}
          style={{
            flex: 1,
            padding: '12px 18px',
            borderRadius: 100,
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            color: 'var(--text)',
            fontSize: 14,
            fontWeight: 500,
            outline: 'none',
            transition: 'all 0.2s',
            fontFamily: 'var(--font-body)'
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="submit"
          disabled={!inputValue.trim()}
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent) 0%, #FF8C32 100%)',
            border: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: inputValue.trim() ? 'pointer' : 'default',
            opacity: inputValue.trim() ? 1 : 0.6,
            boxShadow: '0 4px 12px rgba(255, 92, 0, 0.2)'
          }}
        >
          <Send size={18} />
        </motion.button>
      </form>
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', overflow: 'hidden' }}>
      <AnimatePresence mode="wait">
        {/* On mobile, show either Inbox list or active thread */}
        {isMobile ? (
          activeConvId ? (
            <motion.div 
              key="chat"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              style={{ width: '100%', height: '100%' }}
            >
              {renderChatThread()}
            </motion.div>
          ) : (
            <motion.div 
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ width: '100%', height: '100%' }}
            >
              {renderInboxList()}
            </motion.div>
          )
        ) : (
          /* On desktop, show side-by-side split screen */
          <>
            {renderInboxList()}
            {activeConvId === AI_VERIFY_ID ? (
              renderVerificationThread()
            ) : activeConvId ? (
              renderChatThread()
            ) : (
              <div style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                background: 'var(--bg-card)', 
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: 40
              }}>
                <MessageSquare size={48} style={{ color: 'var(--border)', marginBottom: 12 }} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                  {lang === 'sk' ? 'Vyber si konverzáciu' : 'Select a conversation'}
                </h3>
                <p style={{ fontSize: 13, marginTop: 4 }}>
                  {lang === 'sk' ? 'Vyber si správu zo zoznamu vľavo a začni chatovať.' : 'Choose a message from the list on the left to start chatting.'}
                </p>
              </div>
            )}
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showStudentCounterPicker && activeConv?.application && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', zIndex: 10001, padding: 20
            }}
            onClick={() => setShowStudentCounterPicker(false)}
          >
            <div onClick={e => e.stopPropagation()}>
              <ModernDatePicker
                singleDate
                title={lang === 'sk' ? 'Navrhnúť termín' : 'Propose Date'}
                onSelect={async (dates) => {
                  const counterDate = dates[0];
                  const session = (await supabase.auth.getSession()).data.session;
                  if (!session) return;
                  const res = await fetch(`/api/applications/${activeConv.applicationId}`, {
                    method: 'PATCH',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({ status: 'Counter-Offer', selected_date: counterDate })
                  });
                  if (res.ok) {
                    setShowStudentCounterPicker(false);
                    await fetchInbox();
                  }
                }}
                onCancel={() => setShowStudentCounterPicker(false)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .spinner { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
