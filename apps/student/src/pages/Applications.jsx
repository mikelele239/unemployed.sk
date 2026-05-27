import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApplications } from '../hooks/useApplications';
import JobDetail from '../components/JobDetail';
import ModernDatePicker from '../components/ModernDatePicker';
import { useTranslation } from '../I18nContext';
import { supabase } from '../supabase';
import { getOrCreateConversationForApplication } from '../services/messagingService';

const getStatusStepIndex = (status) => {
  switch(status) {
    case 'Pending': return 0;
    case 'Viewed': return 1;
    case 'Interview':
    case 'Interview-Confirmed':
    case 'Counter-Offer': return 2;
    case 'Hired':
    case 'Rejected':
    case 'Declined':
    case 'Withdrawn': return 3;
    default: return 0;
  }
};

function StatusTimeline({ status, lang }) {
  const stepIndex = getStatusStepIndex(status);
  const isFailed = ['Rejected', 'Declined', 'Withdrawn'].includes(status);
  const isSuccess = status === 'Hired';

  const steps = [
    { label: lang === 'sk' ? 'Odoslané' : 'Submitted', desc: lang === 'sk' ? 'Žiadosť doručená' : 'App received' },
    { label: lang === 'sk' ? 'Pozreté' : 'Viewed', desc: lang === 'sk' ? 'Zamestnávateľ videl' : 'Employer viewed' },
    { label: lang === 'sk' ? 'Pohovor' : 'Interview', desc: lang === 'sk' ? 'Plánovanie termínu' : 'Scheduling' },
    { 
      label: isFailed 
        ? (status === 'Withdrawn' ? (lang === 'sk' ? 'Stiahnuté' : 'Withdrawn') : (lang === 'sk' ? 'Zamietnuté' : 'Rejected'))
        : isSuccess 
          ? (lang === 'sk' ? 'Prijaté 🎉' : 'Hired 🎉') 
          : (lang === 'sk' ? 'Rozhodnutie' : 'Decision'),
      desc: isFailed 
        ? (lang === 'sk' ? 'Nábor ukončený' : 'Process ended')
        : isSuccess 
          ? (lang === 'sk' ? 'Ponuka odoslaná!' : 'Offer extended!') 
          : (lang === 'sk' ? 'Vyhodnotenie' : 'Awaiting result')
    }
  ];

  return (
    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', position: 'relative' }} onClick={e => e.stopPropagation()}>
      {/* Background Line */}
      <div style={{ position: 'absolute', top: '24px', left: '12%', right: '12%', height: '3px', background: 'var(--border)', zIndex: 1 }} />
      
      {/* Active Line Fill */}
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${(stepIndex / 3) * 76}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        style={{ 
          position: 'absolute', 
          top: '24px', 
          left: '12%', 
          height: '3px', 
          background: isFailed ? '#ef4444' : isSuccess ? 'var(--green)' : 'var(--accent)', 
          zIndex: 2 
        }} 
      />

      {steps.map((step, idx) => {
        const done = idx < stepIndex;
        const current = idx === stepIndex;
        const pending = idx > stepIndex;

        let nodeBg = 'var(--bg-card)';
        let nodeBorder = '2px solid var(--border)';
        let labelColor = 'var(--text-muted)';

        if (done) {
          nodeBg = isFailed ? '#ef4444' : isSuccess ? 'var(--green)' : 'var(--accent)';
          nodeBorder = `2px solid ${isFailed ? '#ef4444' : isSuccess ? 'var(--green)' : 'var(--accent)'}`;
          labelColor = 'var(--text)';
        } else if (current) {
          nodeBg = 'var(--bg-card)';
          nodeBorder = `2px solid ${isFailed ? '#ef4444' : isSuccess ? 'var(--green)' : 'var(--accent)'}`;
          labelColor = isFailed ? '#ef4444' : isSuccess ? 'var(--green)' : 'var(--accent)';
        }

        return (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '25%', textAlign: 'center', zIndex: 3, position: 'relative' }}>
            <motion.div 
              animate={current ? { scale: [1, 1.15, 1] } : { scale: 1 }}
              transition={current ? { repeat: Infinity, duration: 2.5, ease: 'easeInOut' } : {}}
              style={{ 
                width: '16px', 
                height: '16px', 
                borderRadius: '50%', 
                background: nodeBg, 
                border: nodeBorder,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: current ? `0 0 10px ${isFailed ? '#ef4444' : isSuccess ? 'var(--green)' : 'var(--accent)'}66` : 'none',
                transition: 'all 0.2s',
                boxSizing: 'border-box'
              }}
            >
              {done && <span style={{ fontSize: '9px', color: '#fff', fontWeight: 900 }}>✓</span>}
              {current && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isFailed ? '#ef4444' : isSuccess ? 'var(--green)' : 'var(--accent)' }} />}
            </motion.div>
            <span style={{ fontSize: '11px', fontWeight: current || done ? 800 : 500, color: labelColor, marginTop: '8px' }}>
              {step.label}
            </span>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500 }}>
              {step.desc}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function Applications() {
  const { t, lang } = useTranslation();
  const navigate = useNavigate();
  const { applications, fetchApplications } = useApplications();
  const handleOpenChat = async (e, app) => {
    e.stopPropagation();
    try {
      const convId = await getOrCreateConversationForApplication(app.appId || app.id);
      navigate(`/messages`, { state: { activeConvId: convId } });
    } catch (err) {
      console.error('Failed to open chat:', err);
    }
  };
  const [selectedJob, setSelectedJob] = useState(null);
  const [confirmDeclineId, setConfirmDeclineId] = useState(null);
  const [successId, setSuccessId] = useState(null);
  const [counterPickerId, setCounterPickerId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [withdrawConfirmId, setWithdrawConfirmId] = useState(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const getStatusColor = (status) => {
    switch(status) {
      case 'Pending': return 'var(--text-muted)';
      case 'Viewed': return 'var(--blue, #3b82f6)';
      case 'Interview': return '#6366f1';
      case 'Interview-Confirmed': return '#22c55e';
      case 'Counter-Offer': return 'var(--accent)';
      case 'Hired': return 'var(--green)';
      case 'Rejected': case 'Declined': return '#ef4444';
      default: return 'var(--text-muted)';
    }
  };

  const filters = [
    { key: 'all', label: lang === 'sk' ? 'Všetky' : 'All' },
    { key: 'Pending', label: lang === 'sk' ? 'Čaká sa' : 'Pending', color: 'var(--text-muted)' },
    { key: 'Interview', label: lang === 'sk' ? 'Pohovor' : 'Interview', color: 'var(--accent)' },
    { key: 'Hired', label: lang === 'sk' ? 'Prijaté' : 'Hired', color: 'var(--green)' },
  ];

  const filteredApps = activeFilter === 'all' 
    ? applications 
    : applications.filter(a => (a.status || 'Pending') === activeFilter);

  return (
    <div style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 20px 10px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400 }}>{t('apps.title') || 'Prihlášky'}</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('apps.subtitle') || 'Sleduj stav svojich žiadostí.'}</p>
        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto', paddingBottom: 4 }}>
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              style={{
                padding: '6px 16px', borderRadius: 100, fontSize: 12, fontWeight: 700,
                border: activeFilter === f.key ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: activeFilter === f.key ? 'var(--accent)' : 'var(--bg-card)',
                color: activeFilter === f.key ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              {f.color && <span style={{ width: 6, height: 6, borderRadius: '50%', background: activeFilter === f.key ? '#fff' : f.color }} />}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '20px', flex: 1 }}>
        {filteredApps.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 60 }}>
            <span style={{ fontSize: 40, marginBottom: 12, display: 'block' }}>📄</span>
            <p>{activeFilter !== 'all' ? (lang === 'sk' ? 'Žiadne prihlášky v tejto kategórii.' : 'No applications in this category.') : (t('apps.empty') || 'Zatiaľ si sa nikam neprihlásil/a.')}</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>{t('apps.emptyDesc') || 'Potiahni doprava na karte práce, o ktorú máš záujem.'}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredApps.map(app => (
              <React.Fragment key={app.id}>
                <motion.div 
                  whileHover={{ scale: 1.01, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}
                  onClick={() => setSelectedJob(app)}
                  style={{ 
                    background: 'var(--bg-card)', 
                    border: '1px solid var(--border)', 
                    borderRadius: 20, 
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                    <div style={{ 
                      width: 52, height: 52, borderRadius: 14, background: app.color || '#6366f1', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      color: '#fff', fontSize: 18, fontWeight: 800, flexShrink: 0,
                      boxShadow: `0 8px 16px ${(app.color || '#6366f1')}33`,
                      overflow: 'hidden'
                    }}>
                      {app.logo_url ? (
                        <img src={app.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        app.logo || (app.company || '?').charAt(0).toUpperCase()
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.title}</h3>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                        <span 
                          onClick={(e) => { e.stopPropagation(); navigate(`/company/${encodeURIComponent(app.company)}`); }}
                          style={{ cursor: 'pointer', transition: 'color 0.2s' }}
                          onMouseEnter={e => e.target.style.color = 'var(--accent)'}
                          onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
                        >{app.company}</span>
                      </div>
                      {/* Inline confirmed/counter-offer date badge */}
                      {app.status === 'Interview-Confirmed' && app.interviewInfo?.selected_date && (
                        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#22c55e' }}>
                          <span>✅</span>
                          <span>{new Date(app.interviewInfo.selected_date).toLocaleString('sk-SK', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        </div>
                      )}
                      {app.status === 'Counter-Offer' && app.interviewInfo?.selected_date && (
                        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
                          <span>📅</span>
                          <span>Protinávrh: {new Date(app.interviewInfo.selected_date).toLocaleString('sk-SK', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: getStatusColor(app.status), display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: getStatusColor(app.status), boxShadow: `0 0 8px ${getStatusColor(app.status)}88` }} />
                        {app.status === 'Pending' ? (t('apps.pending') || 'Čaká sa') : (t(`apps.${app.status.toLowerCase()}`) || app.status)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontWeight: 600 }}>
                        {new Date(app.created_at || app.timestamp).toLocaleDateString('sk-SK')}
                      </div>
                      <button 
                        onClick={(e) => handleOpenChat(e, app)}
                        style={{
                          marginTop: 8,
                          background: 'var(--accent-light)',
                          border: '1px solid var(--accent)',
                          color: 'var(--accent)',
                          borderRadius: 8,
                          padding: '4px 8px',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          transition: 'all 0.2s'
                        }}
                      >
                        💬 {lang === 'sk' ? 'Správy' : 'Chat'}
                      </button>
                      {/* Withdraw button — only for Pending/Viewed apps */}
                      {(app.status === 'Pending' || app.status === 'Viewed') && (
                        withdrawConfirmId === (app.appId || app.id) ? (
                          <div style={{ display: 'flex', gap: 6, marginTop: 8 }} onClick={e => e.stopPropagation()}>
                            <button
                              disabled={withdrawing}
                              onClick={async (e) => {
                                e.stopPropagation();
                                setWithdrawing(true);
                                try {
                                  const { data: { session } } = await supabase.auth.getSession();
                                  if (!session) return;
                                  const res = await fetch(`/api/applications/${app.appId || app.id}`, {
                                    method: 'PATCH',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'Authorization': `Bearer ${session.access_token}`
                                    },
                                    body: JSON.stringify({ status: 'Withdrawn' })
                                  });
                                  if (res.ok) {
                                    fetchApplications();
                                  }
                                } catch (err) { console.error(err); }
                                setWithdrawConfirmId(null);
                                setWithdrawing(false);
                              }}
                              style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                            >
                              {withdrawing ? '...' : (lang === 'sk' ? 'Áno' : 'Yes')}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setWithdrawConfirmId(null); }}
                              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                            >
                              {lang === 'sk' ? 'Nie' : 'No'}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); setWithdrawConfirmId(app.appId || app.id); }}
                            style={{ marginTop: 8, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                          >
                            {lang === 'sk' ? 'Stiahnuť' : 'Withdraw'}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                  <StatusTimeline status={app.status} lang={lang} />
                </motion.div>

              {/* Interview Scheduler Notice — only when action is needed */}
              {app.status?.toLowerCase() === 'interview' && (
                <div style={{
                  margin: '-10px 20px 22px', padding: '20px', background: 'var(--accent-light)', 
                  border: '1px solid var(--accent)', borderTop: 'none', borderRadius: '0 0 16px 16px',
                  boxShadow: '0 10px 20px rgba(255, 131, 0, 0.08)', animation: 'slideInDown 0.4s ease'
                }}>
                  <AnimatePresence mode="wait">
                    {successId === app.id ? (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        style={{ textAlign: 'center', padding: '10px 0' }}
                      >
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎉</div>
                        <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--green)' }}>{lang === 'en' ? 'Confirmed!' : 'Potvrdené!'}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{lang === 'en' ? 'Date has been added to your schedule.' : 'Termín bol pridaný do tvojho plánu.'}</div>
                      </motion.div>
                    ) : confirmDeclineId === app.id ? (
                      <motion.div 
                        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                        style={{ background: 'rgba(239,68,68,0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)' }}
                      >
                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#ef4444', marginBottom: '12px', textAlign: 'center' }}>
                          {lang === 'en' ? 'Do you really want to decline this invitation?' : 'Naozaj chceš odmietnuť toto pozvanie?'}
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setConfirmDeclineId(null); }}
                            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}
                          >
                            {lang === 'en' ? 'Cancel' : 'Zrušiť'}
                          </button>
                          <button 
                            onClick={async (e) => {
                              e.stopPropagation();
                              const btn = e.currentTarget;
                              btn.disabled = true;
                              btn.innerText = lang === 'en' ? 'Processing...' : 'Spracovávam...';
                              try {
                                const { data: { session } } = await supabase.auth.getSession();
                                if (!session) return;
                                await fetch(`/api/applications/${app.appId || app.id}`, {
                                  method: 'PATCH',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${session.access_token}`
                                  },
                                  body: JSON.stringify({ status: 'Declined' })
                                });
                              } catch (err) {
                                console.error('Decline error:', err);
                              }
                              setConfirmDeclineId(null);
                              fetchApplications();
                            }}
                            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}
                          >
                            {lang === 'en' ? 'Yes, decline' : 'Áno, odmietnuť'}
                          </button>
                        </div>
                      </motion.div>
                    ) : app.interviewInfo?.declined ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#ef4444' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                          🚫
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: '800' }}>{lang === 'en' ? 'You declined the interview invitation.' : 'Pozvanie na pohovor si odmietol/la.'}</div>
                      </div>
                    ) : app.status === 'Interview-Confirmed' && app.interviewInfo?.selected_date ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                          ✅
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: '800', color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{lang === 'en' ? 'Confirmed date' : 'Potvrdený termín'}</div>
                          <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>
                            {new Date(app.interviewInfo.selected_date).toLocaleString(lang === 'en' ? 'en-US' : 'sk-SK', { dateStyle: 'medium', timeStyle: 'short' })}
                          </div>
                        </div>
                      </div>
                    ) : app.status === 'Counter-Offer' && app.interviewInfo?.selected_date ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,92,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                          📅
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{lang === 'en' ? 'Your counter-offer — awaiting response' : 'Tvoj protinávrh — čaká sa na odpoveď'}</div>
                          <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>
                            {new Date(app.interviewInfo.selected_date).toLocaleString(lang === 'en' ? 'en-US' : 'sk-SK', { dateStyle: 'medium', timeStyle: 'short' })}
                          </div>
                        </div>
                      </div>
                    ) : app.interviewInfo?.selected_date ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                          🗓️
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{lang === 'en' ? 'Selected date' : 'Vybraný termín'}</div>
                          <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>
                            {new Date(app.interviewInfo.selected_date).toLocaleString(lang === 'en' ? 'en-US' : 'sk-SK', { dateStyle: 'medium', timeStyle: 'short' })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 2s infinite' }} />
                            <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              {lang === 'en' ? 'Interview invitation' : 'Pozvánka na pohovor'}
                            </div>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setConfirmDeclineId(app.id); }}
                            style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', fontWeight: '800', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            {lang === 'en' ? 'Decline' : 'Odmietnuť'}
                          </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {(app.interviewInfo?.offered_dates || []).length === 0 ? (
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              {lang === 'en' ? 'Employer is preparing dates...' : 'Zamestnávateľ pripravuje termíny...'}
                            </div>
                          ) : (
                            app.interviewInfo.offered_dates.map(date => (
                              <motion.button
                                whileHover={{ x: 5, background: 'var(--accent)', color: '#fff' }}
                                whileTap={{ scale: 0.98 }}
                                key={date}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const btn = e.currentTarget;
                                  btn.disabled = true;
                                  
                                  try {
                                    const { data: { session } } = await supabase.auth.getSession();
                                    if (!session) return;
                                    const res = await fetch(`/api/applications/${app.appId || app.id}`, {
                                      method: 'PATCH',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${session.access_token}`
                                      },
                                      body: JSON.stringify({ 
                                        status: 'Interview-Confirmed',
                                        selected_date: date
                                      })
                                    });
                                    if (res.ok) {
                                      setSuccessId(app.id);
                                      setTimeout(() => {
                                        setSuccessId(null);
                                        fetchApplications();
                                      }, 2000);
                                    } else {
                                      btn.disabled = false;
                                    }
                                  } catch (err) {
                                    btn.disabled = false;
                                  }
                                }}
                                style={{
                                  width: '100%', padding: '14px 18px', borderRadius: '12px', border: '1.5px solid var(--accent)',
                                  background: 'var(--bg-card)', color: 'var(--accent)', fontSize: '13px', fontWeight: '800', cursor: 'pointer',
                                  textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                  transition: 'all 0.2s', boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
                                  fontFamily: 'var(--font-body)'
                                }}
                              >
                                <span>{new Date(date).toLocaleString(lang === 'en' ? 'en-US' : 'sk-SK', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                <span style={{ fontSize: '11px', fontWeight: '900' }}>{lang === 'en' ? 'SELECT →' : 'VYBRAŤ →'}</span>
                              </motion.button>
                            ))
                          )}

                          {/* Counter-offer */}
                          {(app.interviewInfo?.offered_dates || []).length > 0 && (
                            <div style={{ marginTop: 4 }}>
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={(e) => { e.stopPropagation(); setCounterPickerId(app.id); }}
                                style={{
                                  width: '100%', padding: '12px 16px', borderRadius: 12,
                                  border: '1.5px dashed var(--accent)', background: 'rgba(255,92,0,0.04)',
                                  color: 'var(--accent)', fontSize: 12, fontWeight: 700,
                                  cursor: 'pointer', fontFamily: 'var(--font-body)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                                }}
                              >
                                📅 {lang === 'sk' ? 'Navrhnúť iný termín' : 'Propose different date'}
                              </motion.button>
                            </div>
                          )}

                          {/* Counter-offer calendar overlay */}
                          <AnimatePresence>
                            {counterPickerId === app.id && (
                              <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                style={{
                                  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
                                  backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center',
                                  justifyContent: 'center', zIndex: 10001, padding: 20
                                }}
                                onClick={() => setCounterPickerId(null)}
                              >
                                <div onClick={e => e.stopPropagation()}>
                                  <ModernDatePicker
                                    singleDate
                                    title={lang === 'sk' ? 'Navrhnúť termín' : 'Propose Date'}
                                    onSelect={async (dates) => {
                                      const counterDate = dates[0];
                                      try {
                                        const { data: { session } } = await supabase.auth.getSession();
                                        if (!session) return;
                                        const res = await fetch(`/api/applications/${app.appId || app.id}`, {
                                          method: 'PATCH',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${session.access_token}`
                                          },
                                          body: JSON.stringify({ status: 'Counter-Offer', selected_date: counterDate })
                                        });
                                        if (res.ok) {
                                          setCounterPickerId(null);
                                          setSuccessId(app.id);
                                          setTimeout(() => { setSuccessId(null); fetchApplications(); }, 2000);
                                        }
                                      } catch (err) { console.error(err); }
                                    }}
                                    onCancel={() => setCounterPickerId(null)}
                                  />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      <JobDetail 
        job={selectedJob} 
        isOpen={!!selectedJob} 
        onClose={() => setSelectedJob(null)}
        onApply={() => {}} // Disabled inside detail anyway since hasApplied is true
        hasApplied={true}
      />
    </div>
  );
}
