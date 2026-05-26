import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
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
  UserCheck
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
                  <div style={{ 
                    width: 44, height: 44, borderRadius: '50%', 
                    background: 'linear-gradient(135deg, var(--accent) 0%, #FF8C32 100%)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    color: '#fff', fontSize: 15, fontWeight: 700, flexShrink: 0 
                  }}>
                    {conv.candidateName.charAt(0).toUpperCase()}
                  </div>

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

        <div style={{ 
          width: 40, height: 40, borderRadius: '50%', 
          background: 'linear-gradient(135deg, var(--accent) 0%, #FF8C32 100%)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', 
          color: '#fff', fontSize: 14, fontWeight: 700 
        }}>
          {activeConv?.candidateName.charAt(0).toUpperCase()}
        </div>

        {/* Header Title */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
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
                    {activeConv.application.status}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Interview Banner */}
      {activeConv?.application && (
        <div style={{
          background: 'rgba(255, 92, 0, 0.04)',
          borderBottom: '1px solid var(--border)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          zIndex: 10
        }}>
          {activeConv.application.status === 'Interview' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
              <Clock size={16} style={{ color: 'var(--accent)' }} />
              <span>
                {lang === 'sk' ? 'Pozvánka odoslaná. Čaká sa na výber termínu uchádzačom.' : 'Invitation sent. Awaiting candidate selection.'}
              </span>
            </div>
          )}

          {activeConv.application.status === 'Counter-Offer' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={16} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  {lang === 'sk' 
                    ? `Uchádzač navrhol iný termín: ${new Date(activeConv.application.selected_date).toLocaleString('sk-SK', { dateStyle: 'short', timeStyle: 'short' })}` 
                    : `Candidate counter-offered: ${new Date(activeConv.application.selected_date).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}`
                  }
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={async () => {
                    const { error } = await supabase
                      .from('applications')
                      .update({ status: 'Interview-Confirmed' })
                      .eq('id', activeConv.applicationId);
                    if (!error) {
                      await fetchInbox();
                    }
                  }}
                  style={{
                    padding: '6px 12px', borderRadius: 6, background: '#22c55e', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  {lang === 'sk' ? 'Prijať' : 'Accept'}
                </button>
                <button
                  onClick={() => setShowEmployerDatePicker(true)}
                  style={{
                    padding: '6px 12px', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  {lang === 'sk' ? 'Iné termíny' : 'New Dates'}
                </button>
              </div>
            </div>
          )}

          {activeConv.application.status === 'Interview-Confirmed' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#22c55e', fontWeight: 700 }}>
              <CheckCircle2 size={16} />
              <span>
                {lang === 'sk' 
                  ? `Pohovor potvrdený na: ${new Date(activeConv.application.selected_date).toLocaleString('sk-SK', { dateStyle: 'medium', timeStyle: 'short' })}` 
                  : `Interview confirmed for: ${new Date(activeConv.application.selected_date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`
                }
              </span>
            </div>
          )}

          {activeConv.application.status === 'Declined' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#ef4444', fontWeight: 700 }}>
              <AlertCircle size={16} />
              <span>
                {lang === 'sk' ? 'Uchádzač odmietol pozvanie na pohovor.' : 'Candidate declined the interview invitation.'}
              </span>
            </div>
          )}

          {!['interview', 'interview-confirmed', 'counter-offer', 'declined', 'hired', 'rejected'].includes((activeConv.application.status || '').toLowerCase()) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {lang === 'sk' ? 'Chcete s týmto uchádzačom naplánovať pohovor?' : 'Want to schedule an interview with this candidate?'}
              </span>
              <button
                onClick={() => setShowEmployerDatePicker(true)}
                style={{
                  padding: '6px 12px', borderRadius: 6, background: 'linear-gradient(135deg, var(--accent) 0%, #FF8C32 100%)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                }}
              >
                {lang === 'sk' ? 'Naplánovať pohovor' : 'Schedule Interview'}
              </button>
            </div>
          )}
        </div>
      )}

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

  const renderCandidateSummary = () => {
    if (!activeConv || !activeConv.application) return null;
    const app = activeConv.application;
    
    return (
      <div style={{
        width: '300px',
        height: '100%',
        background: 'var(--bg)',
        borderLeft: '1px solid var(--border)',
        padding: '28px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        overflowY: 'auto'
      }} className="desktop-only">
        <div>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>
            {lang === 'sk' ? 'Detail uchádzača' : 'Candidate Details'}
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
              <User size={16} style={{ color: 'var(--accent)' }} />
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{activeConv.candidateName}</span>
            </div>
            
            {app.student_email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                <Mail size={16} />
                <span style={{ wordBreak: 'break-all' }}>{app.student_email}</span>
              </div>
            )}
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
              <UserCheck size={16} />
              <span>Stav: <strong style={{ color: 'var(--accent)' }}>{app.status}</strong></span>
            </div>
          </div>
        </div>

        {/* Interview Management */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={14} style={{ color: 'var(--accent)' }} />
            <span>{lang === 'sk' ? 'Plánovanie pohovoru' : 'Interview Scheduling'}</span>
          </h4>

          {/* Action based on status */}
          {!['interview', 'interview-confirmed', 'counter-offer', 'declined', 'hired', 'rejected'].includes((app.status || '').toLowerCase()) && (
            <button
              onClick={() => setShowEmployerDatePicker(true)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                background: 'linear-gradient(135deg, var(--accent) 0%, #FF8C32 100%)',
                border: 'none',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <span>{lang === 'sk' ? 'Pozvať na pohovor' : 'Invite to Interview'}</span>
            </button>
          )}

          {app.status === 'Interview' && (
            <div style={{ background: 'rgba(255, 92, 0, 0.04)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 6 }}>
                {lang === 'sk' ? 'Odoslané termíny' : 'Proposed Dates'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(app.interview_dates || []).map((date, idx) => (
                  <div key={idx} style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>
                    • {new Date(date).toLocaleString(lang === 'sk' ? 'sk-SK' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic' }}>
                {lang === 'sk' ? 'Čaká sa na odpoveď od uchádzača.' : 'Awaiting candidate selection.'}
              </div>
            </div>
          )}

          {app.status === 'Counter-Offer' && (
            <div style={{ background: 'rgba(255, 92, 0, 0.04)', border: '1px solid var(--accent)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 4 }}>
                  {lang === 'sk' ? 'Protinávrh uchádzača' : 'Candidate Counter-Offer'}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  {app.selected_date ? new Date(app.selected_date).toLocaleString(lang === 'sk' ? 'sk-SK' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={async () => {
                    const { error } = await supabase
                      .from('applications')
                      .update({ status: 'Interview-Confirmed' })
                      .eq('id', app.id);
                    if (!error) {
                      await fetchInbox();
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: 6,
                    background: '#22c55e',
                    border: 'none',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  {lang === 'sk' ? 'Prijať' : 'Accept'}
                </button>

                <button
                  onClick={() => setShowEmployerDatePicker(true)}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: 6,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  {lang === 'sk' ? 'Iné termíny' : 'New Dates'}
                </button>
              </div>
            </div>
          )}

          {app.status === 'Interview-Confirmed' && (
            <div style={{ background: 'rgba(34, 197, 94, 0.05)', border: '1px solid #22c55e', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', marginBottom: 4 }}>
                <CheckCircle2 size={12} />
                <span>{lang === 'sk' ? 'Pohovor potvrdený' : 'Interview Confirmed'}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                {app.selected_date ? new Date(app.selected_date).toLocaleString(lang === 'sk' ? 'sk-SK' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
              </div>
            </div>
          )}

          {app.status === 'Declined' && (
            <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid #ef4444', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', marginBottom: 4 }}>
                {lang === 'sk' ? 'Pohovor odmietnutý' : 'Interview Declined'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {lang === 'sk' ? 'Uchádzač odmietol pozvanie na pohovor.' : 'Candidate declined the interview invite.'}
              </div>
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-muted)' }}>
            {lang === 'sk' ? 'Rýchle akcie' : 'Quick Actions'}
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => {
                // Navigate to candidate detail (which is usually in listings or dashboard)
                window.location.href = `/employer/candidates`;
              }}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <FileText size={14} />
              <span>{lang === 'sk' ? 'Zobraziť profil' : 'View Profile'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

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
              {renderCandidateSummary()}
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
                  const { error } = await supabase.from('applications').update({ 
                    status: 'Interview', 
                    interview_dates: dates 
                  }).eq('id', activeConv.applicationId);
                  if (!error) {
                    setShowEmployerDatePicker(false);
                    await fetchInbox();
                  } else {
                    alert(lang === 'sk' ? `Chyba: ${error.message}` : `Error: ${error.message}`);
                  }
                }}
                onCancel={() => setShowEmployerDatePicker(false)}
              />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
