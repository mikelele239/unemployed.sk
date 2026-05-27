import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  Send, 
  MessageSquare, 
  Clock, 
  ArrowLeft, 
  Briefcase, 
  User, 
  Calendar,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
  Mail,
  UserCheck,
  MapPin,
  Globe,
  GraduationCap,
  Award,
  X,
  ExternalLink,
  Phone
} from 'lucide-react';
import { useI18n } from '../contexts';
import { 
  getConversations, 
  getMessages, 
  sendMessage, 
  markAsRead, 
  subscribeToMessages, 
  subscribeToConversations 
} from '../services/messagingService';
import { supabase } from '../supabase';
import ModernDatePicker from '../components/ModernDatePicker';
import CandidateAvatar from '../components/CandidateAvatar';

const formatSystemMessage = (body, lang) => {
  if (!body) return '';
  // Slovak translations / rewrites for employer view
  if (body.includes('Boli ste pozvaný na pohovor pre pozíciu')) {
    return body.replace('Boli ste pozvaný na pohovor pre pozíciu', lang === 'sk' ? 'Pozvali ste uchádzača na pohovor pre pozíciu' : 'You invited the candidate to an interview for');
  }
  if (body.includes('Zamestnávateľ vás pozval na pohovor. Vyberte si termín.')) {
    return lang === 'sk' ? 'Pozvali ste uchádzača na pohovor. Čaká sa na výber termínu.' : 'You invited the candidate to an interview. Awaiting selection.';
  }
  if (body.includes('Váš pohovor pre') && body.includes('bol potvrdený')) {
    return body.replace('Váš pohovor pre', lang === 'sk' ? 'Pohovor pre' : 'Interview for').replace('bol potvrdený', lang === 'sk' ? 'je potvrdený' : 'is confirmed');
  }
  if (body.includes('Zamestnávateľ si pozrel váš profil.')) {
    return lang === 'sk' ? 'Pozreli ste si profil uchádzača.' : 'You viewed the candidate\'s profile.';
  }
  if (body.includes('Výberové konanie bolo ukončené.')) {
    return lang === 'sk' ? 'Uchádzač bol zamietnutý / Výberové konanie ukončené.' : 'Candidate was rejected / Selection process closed.';
  }
  if (body.includes('Gratulujeme! Boli ste prijatý na pozíciu')) {
    return body.replace('Gratulujeme! Boli ste prijatý na pozíciu', lang === 'sk' ? 'Prijali ste uchádzača na pozíciu' : 'You hired the candidate for');
  }
  return body;
};

// Helper: parse bilingual JSON strings {sk,en}
function biLang(val, lang) {
  if (!val) return '';
  if (typeof val === 'object' && (val.sk || val.en)) return val[lang] || val.en || val.sk || '';
  if (typeof val !== 'string') return String(val);
  try {
    const parsed = JSON.parse(val);
    if (parsed && typeof parsed === 'object' && (parsed.sk || parsed.en)) return parsed[lang] || parsed.en || parsed.sk || '';
    return val;
  } catch { return val; }
}

// Helper for bilingual arrays
function biLangArr(arr, lang) {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => biLang(item, lang)).filter(Boolean);
}

const BAND_DISPLAY = {
  A: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', icon: '🟢', label: { sk: 'Silná zhoda', en: 'Strong fit' } },
  B: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', icon: '🔵', label: { sk: 'Dobrá zhoda', en: 'Good fit' } },
  C: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '🟡', label: { sk: 'Potenciálna zhoda', en: 'Potential fit' } },
  D: { color: '#f97316', bg: 'rgba(249,115,22,0.1)', icon: '🟠', label: { sk: 'Čiastočná zhoda', en: 'Partial fit' } },
  E: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: '🔴', label: { sk: 'Nízka zhoda', en: 'Low fit' } },
};

function getScoreBand(score) {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'E';
}

const ELIG_DISPLAY = {
  eligible:     { sk: 'Spĺňa podmienky',       en: 'Eligible',      color: '#22c55e', bg: 'rgba(34,197,94,0.1)', icon: '✓' },
  near_miss:    { sk: 'Takmer spĺňa',           en: 'Near miss',     color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '≈' },
  not_eligible: { sk: 'Nespĺňa podmienky',      en: 'Not eligible',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: '✗' },
};

const formatStatusDetail = (app, lang) => {
  if (!app) return '';
  const status = (app.status || 'pending').toLowerCase();
  switch (status) {
    case 'pending':
      return lang === 'sk' ? 'Čaká na posúdenie' : 'Awaiting Review';
    case 'interview': {
      const dates = app.interview_dates || [];
      if (dates.length === 0) {
        return lang === 'sk' ? 'Navrhnutý pohovor (čaká na výber termínu)' : 'Interview proposed (awaiting selection)';
      }
      const datesStr = dates.map(d => new Date(d).toLocaleString(lang === 'sk' ? 'sk-SK' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })).join(', ');
      return lang === 'sk' 
        ? `Navrhnutý pohovor (čaká na výber termínu). Navrhnuté termíny: ${datesStr}` 
        : `Interview proposed (awaiting selection). Proposed dates: ${datesStr}`;
    }
    case 'counter-offer':
      return lang === 'sk'
        ? `Protinávrh termínu: ${app.selected_date ? new Date(app.selected_date).toLocaleString('sk-SK', { dateStyle: 'medium', timeStyle: 'short' }) : ''}`
        : `Candidate counter-offered: ${app.selected_date ? new Date(app.selected_date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : ''}`;
    case 'interview-confirmed':
      return lang === 'sk'
        ? `Pohovor potvrdený na: ${app.selected_date ? new Date(app.selected_date).toLocaleString('sk-SK', { dateStyle: 'medium', timeStyle: 'short' }) : ''}`
        : `Interview confirmed for: ${app.selected_date ? new Date(app.selected_date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : ''}`;
    case 'hired':
      return lang === 'sk' ? 'Kandidát bol úspešne prijatý' : 'Candidate successfully hired';
    case 'rejected':
      return lang === 'sk' ? 'Uchádzač bol zamietnutý' : 'Candidate was rejected';
    case 'declined':
      return lang === 'sk' ? 'Uchádzač odmietol pozvanie' : 'Candidate declined invite';
    default:
      return app.status;
  }
};

export default function Messages() {
  const { t, lang } = useI18n();
  const location = useLocation();
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingConv, setLoadingConv] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [showEmployerDatePicker, setShowEmployerDatePicker] = useState(false);
  const navigate = useNavigate();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [profileCvUrl, setProfileCvUrl] = useState(null);
  const [fullscreenCV, setFullscreenCV] = useState(false);

  const handleViewProfile = async () => {
    if (!activeConv) return;
    const candidateId = activeConv.studentId;
    const jobId = activeConv.jobId;

    if (!candidateId) return;

    setLoadingProfile(true);
    setShowProfileModal(true);
    setProfileData(null);
    setProfileCvUrl(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // 1. Fetch profile from Supabase
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', candidateId)
        .maybeSingle();
      
      if (profErr) throw profErr;
      if (!prof) {
        setLoadingProfile(false);
        return;
      }

      // 2. Fetch AI profile
      let aiProfile = {};
      try {
        const aiRes = await fetch('/api/employer/ai-profiles', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${session.access_token}` 
          },
          body: JSON.stringify({ candidate_ids: [candidateId] }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          aiProfile = aiData.profiles?.[candidateId] || {};
        }
      } catch (err) {
        console.error('AI Profile fetch failed:', err);
      }

      // 3. Fetch Match Score
      let matchScore = {};
      if (jobId) {
        try {
          const msRes = await fetch('/api/employer/match-scores-bulk', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json', 
              'Authorization': `Bearer ${session.access_token}` 
            },
            body: JSON.stringify({ 
              candidate_ids: [candidateId], 
              job_ids: [jobId] 
            }),
          });
          if (msRes.ok) {
            const msData = await msRes.json();
            const matchKey = `${candidateId}_${jobId}`;
            matchScore = msData.scores?.[matchKey] || {};
          }
        } catch (err) {
          console.error('Match score fetch failed:', err);
        }
      }

      // 4. Fetch CV URL
      let cvUrlStr = null;
      if (prof.cv_id) {
        try {
          const cvRes = await fetch(`/api/employer/cv/${encodeURIComponent(prof.cv_id)}/signed-url`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
          });
          if (cvRes.ok) {
            const cvData = await cvRes.json();
            cvUrlStr = cvData.url;
          }
        } catch (cvErr) {
          console.error('CV url fetch failed:', cvErr);
        }
      }

      setProfileData({
        profile: prof,
        aiProfile,
        matchScore
      });
      setProfileCvUrl(cvUrlStr);
    } catch (err) {
      console.error('Error loading candidate profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const messagesEndRef = useRef(null);
  const activeConvRef = useRef(null);

  // Sync active conv ref for realtime callbacks
  useEffect(() => {
    activeConvRef.current = activeConvId;
  }, [activeConvId]);

  // Sync responsive state
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Adjust parent layout for full-bleed display
  useEffect(() => {
    const appContent = document.querySelector('.app-content');
    if (appContent) {
      const originalPadding = appContent.style.padding;
      const originalOverflowY = appContent.style.overflowY;
      const originalHeight = appContent.style.height;

      appContent.style.padding = '0';
      appContent.style.overflowY = 'hidden';
      appContent.style.height = '100vh';

      return () => {
        appContent.style.padding = originalPadding;
        appContent.style.overflowY = originalOverflowY;
        appContent.style.height = originalHeight;
      };
    }
  }, []);

  // Fetch current user and inbox
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(session.user);
      }
      await fetchInbox();
      setLoadingConv(false);
    };

    init();

    // Subscribe to inbox changes
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

  // Set active conv if passed from router state
  useEffect(() => {
    if (location.state?.activeConvId) {
      setActiveConvId(location.state.activeConvId);
    }
  }, [location.state]);

  // Load conversation messages
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

      await markAsRead(activeConvId);
      await fetchInbox();
    };

    fetchMsgs();

    // Subscribe to message updates
    const sub = subscribeToMessages(activeConvId, (newMsg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      scrollToBottom();
      
      // Refresh conversations/inbox list to stay in sync with latest message/status
      fetchInbox();

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
    const tempId = Math.random().toString(36).substring(2, 9);
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
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  const activeConv = conversations.find(c => c.id === activeConvId);

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const today = new Date();
    
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString(lang === 'sk' ? 'sk-SK' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString(lang === 'sk' ? 'sk-SK' : 'en-US', { day: 'numeric', month: 'short' });
  };

  const renderInboxList = () => (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      background: 'var(--bg)',
      borderRight: '1px solid var(--border)',
      width: isMobile ? '100%' : '360px',
      flexShrink: 0
    }}>
      {/* Header */}
      <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <MessageSquare style={{ color: 'var(--accent)' }} size={24} />
          {lang === 'sk' ? 'Správy' : 'Messages'}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          {lang === 'sk' ? 'Komunikujte s uchádzačmi v reálnom čase.' : 'Real-time candidate messaging.'}
        </p>
      </div>

      {/* Conversations Scroll area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
        {loadingConv ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 0' }}>
            <div className="spinner" style={{
              width: 24, height: 24,
              border: '2px solid rgba(255,255,255,0.05)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
          </div>
        ) : conversations.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px 20px' }}>
            <span style={{ fontSize: 36, marginBottom: 12, display: 'block' }}>💬</span>
            <p style={{ fontWeight: 600 }}>{lang === 'sk' ? 'Žiadne konverzácie' : 'No conversations yet'}</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>{lang === 'sk' ? 'Akonáhle dostanete prihlášku alebo oslovíte kandidáta, uvidíte to tu.' : 'Matched conversations will appear here.'}</p>
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
                <div
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  style={{
                    padding: '16px',
                    borderRadius: 12,
                    background: isActive ? 'var(--accent-light)' : 'var(--bg-card)',
                    border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    position: 'relative',
                    transition: 'all 0.2s ease',
                  }}
                  className="conv-card-hover"
                >
                  {/* Candidate Avatar */}
                  <CandidateAvatar 
                    userId={conv.studentId} 
                    avatarUrl={conv.candidateAvatar} 
                    name={conv.candidateName} 
                    size={44} 
                  />

                  {/* Metadata */}
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
                        {conv.candidateName}
                      </h4>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                        {formatTime(conv.lastMessageAt)}
                      </span>
                    </div>

                    {conv.job?.title && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--accent)', fontWeight: 700, marginBottom: 4 }}>
                        <Briefcase size={10} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conv.job.title}</span>
                      </div>
                    )}

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

                  {hasUnread && (
                    <span style={{ 
                      width: 18, height: 18, borderRadius: '50%',
                      background: 'var(--accent)', color: '#fff',
                      fontSize: 10, fontWeight: 900,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderChatThread = () => (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      background: 'var(--bg)', 
      flex: 1 
    }}>
      {/* Header */}
      <div style={{ 
        padding: '18px 24px', 
        borderBottom: '1px solid var(--border)', 
        background: 'var(--bg-card)',
        display: 'flex', 
        alignItems: 'center', 
        gap: 12 
      }}>
        {isMobile && (
          <button 
            onClick={() => setActiveConvId(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', marginRight: 8, display: 'flex', alignItems: 'center' }}
          >
            <ArrowLeft size={20} />
          </button>
        )}

        <div 
          onClick={handleViewProfile} 
          style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
          className="hover-scale"
        >
          <CandidateAvatar 
            userId={activeConv?.studentId} 
            avatarUrl={activeConv?.candidateAvatar} 
            name={activeConv?.candidateName} 
            size={40} 
          />
        </div>

        {/* Header Title */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 
            onClick={handleViewProfile}
            style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            className="hover-accent-color"
          >
            {activeConv?.candidateName}
          </h3>
          {activeConv?.job?.title && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Briefcase size={12} style={{ color: 'var(--accent)' }} />
              <span>{activeConv.job.title}</span>
              {activeConv.application && (
                <>
                  <span style={{ color: 'var(--border)' }}>•</span>
                  <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 10, color: 'var(--accent)' }}>
                    {formatStatusDetail(activeConv.application, lang)}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Profile Button */}
        <button
          onClick={handleViewProfile}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <FileText size={14} style={{ color: 'var(--accent)' }} />
          <span className="desktop-only">{lang === 'sk' ? 'Profil' : 'Profile'}</span>
        </button>
      </div>



      {/* Messages list */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        background: 'linear-gradient(180deg, var(--bg) 0%, var(--bg-card) 100%)'
      }}>
        {loadingMessages ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <div className="spinner" style={{
              width: 24, height: 24,
              border: '2px solid rgba(255,255,255,0.05)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
          </div>
        ) : messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center' }}>
            <Sparkles size={32} style={{ color: 'var(--accent)', marginBottom: 8 }} />
            <p style={{ fontSize: 14, fontWeight: 700 }}>{lang === 'sk' ? 'Konverzácia otvorená' : 'Conversation started'}</p>
            <p style={{ fontSize: 12 }}>{lang === 'sk' ? 'Napíšte správu pre nadviazanie kontaktu.' : 'Type a message to candidate.'}</p>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.sender_id === currentUser?.id;
            const isSystem = msg.message_type === 'system';
            
            if (isSystem) {
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
                  <div style={{ 
                    background: 'var(--bg-card)', 
                    border: '1px solid var(--border)', 
                    borderRadius: 100, 
                    padding: '6px 16px', 
                    fontSize: 11, 
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
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
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: isMe 
                      ? 'linear-gradient(135deg, var(--accent) 0%, #FF8C32 100%)' 
                      : 'var(--bg-card)',
                    color: isMe ? '#fff' : 'var(--text)',
                    border: isMe ? 'none' : '1px solid var(--border)',
                    fontSize: 14,
                    lineHeight: '1.4',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {msg.body}
                  </div>
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

      {/* Interactive Interview/Status Popup Banner */}
      {activeConv?.application && (
        <div style={{
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1.5px solid rgba(59, 130, 246, 0.2)',
          borderRadius: 12,
          padding: '14px 18px',
          margin: '0 24px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
          backdropFilter: 'blur(8px)',
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260 }}>
              <Clock size={16} style={{ color: '#2563eb', flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>
                {lang === 'sk' ? 'Stav výberu:' : 'Hiring Process:'}{' '}
                <span style={{ color: '#2563eb', fontWeight: 600 }}>
                  {formatStatusDetail(activeConv.application, lang)}
                </span>
              </span>
            </div>

            {/* Actions for Counter-Offer */}
            {activeConv.application.status === 'Counter-Offer' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={async () => {
                    const session = (await supabase.auth.getSession()).data.session;
                    if (!session) return;
                    const res = await fetch(`/api/employer/candidates/${activeConv.applicationId}`, {
                      method: 'PATCH',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                      },
                      body: JSON.stringify({ 
                        status: 'Interview-Confirmed', 
                        selected_date: activeConv.application.selected_date 
                      })
                    });
                    if (res.ok) {
                      await fetchInbox();
                    }
                  }}
                  style={{
                    padding: '6px 12px', borderRadius: 6, background: '#22c55e', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  {lang === 'sk' ? 'Prijať termín' : 'Accept Date'}
                </button>
                <button
                  onClick={() => setShowEmployerDatePicker(true)}
                  style={{
                    padding: '6px 12px', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  {lang === 'sk' ? 'Zmeniť' : 'Change'}
                </button>
              </div>
            )}

            {/* Actions to Invite if not already in scheduling process */}
            {!['interview', 'interview-confirmed', 'counter-offer', 'declined', 'hired', 'rejected'].includes((activeConv.application.status || '').toLowerCase()) && (
              <button
                onClick={() => setShowEmployerDatePicker(true)}
                style={{
                  padding: '8px 16px', borderRadius: 8, background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)'
                }}
              >
                {lang === 'sk' ? 'Naplánovať pohovor' : 'Schedule Interview'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Input */}
      <form 
        onSubmit={handleSend}
        style={{ 
          padding: '20px 24px', 
          borderTop: '1px solid var(--border)', 
          background: 'var(--bg-card)',
          display: 'flex',
          gap: 10,
          alignItems: 'center'
        }}
      >
        <input 
          type="text" 
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder={lang === 'sk' ? 'Napísať správu...' : 'Type message...'}
          style={{
            flex: 1,
            padding: '12px 20px',
            borderRadius: 100,
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: 14,
            outline: 'none',
            transition: 'all 0.2s',
          }}
          className="chat-input-focus"
        />
        <button 
          disabled={!inputValue.trim()}
          type="submit"
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
          }}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );



  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', overflow: 'hidden' }}>
      {isMobile ? (
        activeConvId ? (
          <div style={{ width: '100%', height: '100%' }}>
            {renderChatThread()}
          </div>
        ) : (
          <div style={{ width: '100%', height: '100%' }}>
            {renderInboxList()}
          </div>
        )
      ) : (
        <>
          {renderInboxList()}
          {activeConvId ? (
            <>
              {renderChatThread()}
            </>
          ) : (
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              background: 'var(--bg)', 
              color: 'var(--text-muted)',
              textAlign: 'center',
              padding: 40
            }}>
              <MessageSquare size={44} style={{ color: 'var(--border)', marginBottom: 12 }} />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                {lang === 'sk' ? 'Vyberte si konverzáciu' : 'Select a conversation'}
              </h3>
              <p style={{ fontSize: 13, marginTop: 4 }}>
                {lang === 'sk' ? 'Komunikujte s kandidátom priamo výberom chatu vľavo.' : 'Select a candidate conversation from the list to start chatting.'}
              </p>
            </div>
          )}
        </>
      )}
      <style>{`
        .spinner { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .conv-card-hover:hover {
          background: var(--bg-card-hover) !important;
        }
        .chat-input-focus:focus {
          border-color: var(--accent) !important;
          box-shadow: 0 0 0 2px rgba(255, 92, 0, 0.1) !important;
        }
      `}</style>

      {/* Date Picker Overlay */}
      <AnimatePresence>
        {showEmployerDatePicker && activeConv?.application && (
          <div 
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: 20 }}
            onClick={() => setShowEmployerDatePicker(false)}
          >
            <div onClick={e => e.stopPropagation()}>
              <ModernDatePicker 
                onSelect={async (dates) => {
                  const session = (await supabase.auth.getSession()).data.session;
                  if (!session) return;
                  const res = await fetch(`/api/employer/candidates/${activeConv.applicationId}`, {
                    method: 'PATCH',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                      status: 'Interview',
                      interview_dates: dates
                    })
                  });
                  if (res.ok) {
                    setShowEmployerDatePicker(false);
                    await fetchInbox();
                  } else {
                    alert(lang === 'sk' ? 'Chyba pri ukladaní termínov' : 'Error saving interview dates');
                  }
                }}
                onCancel={() => setShowEmployerDatePicker(false)}
              />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Candidate Profile Modal Overlay */}
      <AnimatePresence>
        {showProfileModal && (
          <div 
            style={{ 
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10002, padding: isMobile ? 12 : 24 
            }}
            onClick={() => setShowProfileModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ 
                width: '100%', maxWidth: '900px', height: isMobile ? '100%' : '85vh', 
                background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: isMobile ? 0 : 16, 
                display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                position: 'relative'
              }}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Sparkles size={18} style={{ color: 'var(--accent)' }} />
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                    {lang === 'sk' ? 'Profil kandidáta' : 'Candidate Profile'}
                  </h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {activeConv && (
                    <button
                      onClick={() => {
                        setShowProfileModal(false);
                        navigate(`/candidates/${activeConv.studentId}?jobId=${activeConv.jobId}`);
                      }}
                      style={{ 
                        background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', 
                        fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 
                      }}
                    >
                      <span>{lang === 'sk' ? 'Otvoriť celú stránku' : 'Open Full Page'}</span>
                      <ExternalLink size={12} />
                    </button>
                  )}
                  <button 
                    onClick={() => setShowProfileModal(false)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text)', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Modal Content Scroll Area */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
                {loadingProfile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
                    <div className="spinner" style={{ width: 32, height: 32, border: '2px solid rgba(255,255,255,0.05)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{lang === 'sk' ? 'Načítavam údaje...' : 'Loading details...'}</span>
                  </div>
                ) : !profileData ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                    <AlertCircle size={32} style={{ color: '#ef4444', marginBottom: 12 }} />
                    <p>{lang === 'sk' ? 'Nepodarilo sa načítať profil.' : 'Failed to load profile.'}</p>
                  </div>
                ) : (() => {
                  const { profile, aiProfile, matchScore } = profileData;
                  const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Kandidát';
                  const skills = profile.skills || aiProfile?.hard_skills || [];
                  const locationText = profile.location || aiProfile?.location || '';
                  
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                      
                      {/* Top Header Card */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                        <CandidateAvatar userId={profile.user_id} avatarUrl={profile.avatar_url} name={name} size={72} style={{ border: '2px solid var(--border)' }} />
                        
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px', color: 'var(--text)' }}>{name}</h2>
                          {aiProfile?.ai_headline && (
                            <p style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--accent)', fontWeight: 600, margin: '0 0 8px' }}>
                              "{biLang(aiProfile.ai_headline, lang)}"
                            </p>
                          )}
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                            {locationText && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} />{locationText}</span>}
                            {profile.email && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={12} />{profile.email}</span>}
                          </div>
                        </div>

                        {/* Match Score Badge */}
                        {matchScore && matchScore.overall_score && (() => {
                          const score = matchScore.overall_score;
                          const band = matchScore.match_band || getScoreBand(score);
                          const bandStyle = BAND_DISPLAY[band] || BAND_DISPLAY.E;
                          return (
                            <div style={{ padding: '10px 16px', borderRadius: 10, background: bandStyle.bg, border: `1px solid ${bandStyle.color}22`, display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ fontSize: 22, fontWeight: 900, color: bandStyle.color }}>{score}%</div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: bandStyle.color, lineHeight: 1.2 }}>
                                <div>{bandStyle.icon} {bandStyle.label[lang]}</div>
                                <div style={{ fontSize: 9, opacity: 0.8, textTransform: 'uppercase', marginTop: 2 }}>{lang === 'sk' ? 'Zhoda s pozíciou' : 'Job Match'}</div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* AI Executive Summary */}
                      <div>
                        <h4 style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Sparkles size={14} />
                          {lang === 'sk' ? 'Výkonné zhrnutie (AI Analýza)' : 'AI Executive Summary'}
                        </h4>
                        <div style={{ background: 'var(--bg)', padding: '16px 20px', borderRadius: 10, border: '1px solid var(--border)', borderLeft: '4px solid var(--accent)', fontSize: 14, lineHeight: '1.6', color: 'var(--text)' }}>
                          {biLang(aiProfile?.ai_summary || profile.bio, lang) || (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              {lang === 'sk' ? 'Žiadne zhrnutie nie je k dispozícii.' : 'No summary available.'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Strengths & Gaps (Split) */}
                      {matchScore && (matchScore.match_reasons || matchScore.gaps) && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }} className="grid-responsive cols-1">
                          <div>
                            <h5 style={{ fontSize: 11, fontWeight: 800, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, marginTop: 0 }}>
                              ✓ {lang === 'sk' ? 'Silné stránky zhody' : 'Match strengths'}
                            </h5>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {biLangArr(matchScore.match_reasons || aiProfile?.ai_strengths || [], lang).slice(0, 4).map((r, i) => (
                                <span key={i} style={{ fontSize: 12, background: 'rgba(34,197,94,0.05)', color: '#22c55e', padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(34,197,94,0.1)', fontWeight: 600 }}>
                                  {r}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h5 style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, marginTop: 0 }}>
                              ✗ {lang === 'sk' ? 'Medzery / Rozvojové oblasti' : 'Gaps'}
                            </h5>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {biLangArr(matchScore.gaps || aiProfile?.ai_missing_fields || [], lang).slice(0, 4).map((g, i) => {
                                const isTrainable = g.includes('trénovateľné') || g.includes('trainable');
                                return (
                                  <span key={i} style={{ fontSize: 12, background: isTrainable ? 'rgba(59,130,246,0.05)' : 'rgba(239,68,68,0.05)', color: isTrainable ? '#3b82f6' : '#ef4444', padding: '5px 10px', borderRadius: 6, border: `1px solid ${isTrainable ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)'}`, fontWeight: 600 }}>
                                    {isTrainable ? '⚡' : '✗'} {g}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Education & Experience & Skills & Languages Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="grid-responsive cols-1">
                        {/* Skills */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <h4 style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                            <Award size={14} style={{ color: 'var(--accent)' }} />
                            {lang === 'sk' ? 'Zručnosti' : 'Skills'}
                          </h4>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {skills.map((s, idx) => (
                              <span key={idx} style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--bg)', fontSize: 11, border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600 }}>
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Languages */}
                        {aiProfile?.languages && aiProfile.languages.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <h4 style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                              <Globe size={14} style={{ color: 'var(--accent)' }} />
                              {lang === 'sk' ? 'Jazyky' : 'Languages'}
                            </h4>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {aiProfile.languages.map((l, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'var(--bg)', border: '1px solid var(--border)' }}>
                                  <span>{l.lang}</span>
                                  <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 4px', borderRadius: 3, background: 'rgba(255,92,0,0.1)', color: 'var(--accent)' }}>{l.level}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Education */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <h4 style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                            <GraduationCap size={14} style={{ color: 'var(--accent)' }} />
                            {lang === 'sk' ? 'Najvyššie vzdelanie' : 'Highest Education'}
                          </h4>
                          <div style={{ borderLeft: '2px solid var(--accent)', paddingLeft: 10, fontSize: 12 }}>
                            {aiProfile?.education_level ? (
                              <>
                                <div style={{ fontWeight: 700 }}>
                                  {{
                                    high_school: lang === 'sk' ? 'Stredná škola' : 'High School',
                                    bachelors: lang === 'sk' ? 'Bakalárske štúdium' : 'Bachelor\'s',
                                    masters: lang === 'sk' ? 'Magisterské štúdium' : 'Master\'s',
                                    phd: 'Doktorandské štúdium (PhD)',
                                  }[aiProfile.education_level] || aiProfile.education_level}
                                </div>
                                {aiProfile.education_field && <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{aiProfile.education_field}</div>}
                              </>
                            ) : profile.education ? (
                              <div style={{ fontWeight: 700 }}>{profile.education}</div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{lang === 'sk' ? 'Vzdelanie neuvedené.' : 'Not specified.'}</span>
                            )}
                          </div>
                        </div>

                        {/* Experience */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <h4 style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                            <Briefcase size={14} style={{ color: 'var(--accent)' }} />
                            {lang === 'sk' ? 'Dĺžka praxe' : 'Experience Length'}
                          </h4>
                          <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: 10, fontSize: 12 }}>
                            <div style={{ fontWeight: 700 }}>{aiProfile?.experience_years || 0} {lang === 'sk' ? 'rokov' : 'years'}</div>
                            {aiProfile?.experience_years === 0 && <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{lang === 'sk' ? 'Bez formálnej praxe.' : 'No formal experience.'}</div>}
                          </div>
                        </div>
                      </div>

                      {/* Resume Original Doc */}
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                        <h4 style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, marginTop: 0 }}>
                          <FileText size={14} style={{ color: 'var(--accent)' }} />
                          {lang === 'sk' ? 'Originálny životopis (PDF)' : 'Original Resume (PDF)'}
                        </h4>
                        
                        {profile.cv_id && profileCvUrl ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10 }}>
                              <span style={{ fontSize: 12, fontWeight: 600 }}>{profile.original_filename || 'Zivotopis.pdf'}</span>
                              <button 
                                onClick={() => setFullscreenCV(true)}
                                style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                              >
                                {lang === 'sk' ? 'Otvoriť náhľad' : 'Open Preview'}
                              </button>
                            </div>
                            {/* Short inline PDF frame in modal */}
                            <div style={{ height: 350, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                              <iframe src={profileCvUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Resume Modal PDF" />
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13 }}>
                            {lang === 'sk' ? 'Životopis nie je priložený.' : 'No resume attached.'}
                          </span>
                        )}
                      </div>

                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Fullscreen CV Viewer inside chat */}
      <AnimatePresence>
        {fullscreenCV && profileCvUrl && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 100003, display: 'flex', flexDirection: 'column', backdropFilter: 'blur(10px)', padding: '40px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', color: '#fff' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '900', margin: 0 }}>
                  {profileData?.profile ? `${profileData.profile.first_name || ''} ${profileData.profile.last_name || ''}`.trim() : 'Kandidát'}
                </h2>
                <p style={{ fontSize: '12px', opacity: 0.7, margin: 0 }}>Originálny životopis</p>
              </div>
              <button 
                onClick={() => setFullscreenCV(false)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: '44px', height: '44px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={20} style={{ margin: '0 auto' }} />
              </button>
            </div>
            <div style={{ flex: 1, background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
              <iframe src={profileCvUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Full CV Preview" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
