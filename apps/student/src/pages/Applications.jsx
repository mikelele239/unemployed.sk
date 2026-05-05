import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApplications } from '../hooks/useApplications';
import JobDetail from '../components/JobDetail';
import { useTranslation } from '../I18nContext';
import { getAccessToken } from '../supabase';

export default function Applications() {
  const { t } = useTranslation();
  const { applications, fetchApplications } = useApplications();
  const [selectedJob, setSelectedJob] = useState(null);
  const [confirmDeclineId, setConfirmDeclineId] = useState(null);
  const [successId, setSuccessId] = useState(null);

  const getStatusColor = (status) => {
    switch(status) {
      case 'Pending': return 'var(--text-muted)';
      case 'Viewed': return 'var(--blue)';
      case 'Interview': return 'var(--accent)';
      case 'Hired': return 'var(--green)';
      default: return 'var(--text-muted)';
    }
  };

  return (
    <div style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 20px 10px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800 }}>{t('apps.title') || 'Prihlášky'}</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('apps.subtitle') || 'Sleduj stav svojich žiadostí.'}</p>
      </div>

      <div style={{ padding: '20px', flex: 1 }}>
        {applications.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 60 }}>
            <span style={{ fontSize: 40, marginBottom: 12, display: 'block' }}>📄</span>
            <p>{t('apps.empty') || 'Zatiaľ si sa nikam neprihlásil/a.'}</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>{t('apps.emptyDesc') || 'Potiahni doprava na karte práce, o ktorú máš záujem.'}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {applications.map(app => (
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
                    alignItems: 'center',
                    gap: 18,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ 
                    width: 52, height: 52, borderRadius: 14, background: app.color, 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    color: '#fff', fontSize: 18, fontWeight: 800, flexShrink: 0,
                    boxShadow: `0 8px 16px ${app.color}33`
                  }}>
                    {app.logo}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.title}</h3>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{app.company}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: getStatusColor(app.status), display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: getStatusColor(app.status), boxShadow: `0 0 8px ${getStatusColor(app.status)}88` }} />
                      {app.status === 'Pending' ? (t('apps.pending') || 'Čaká sa') : (t(`apps.${app.status.toLowerCase()}`) || app.status)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontWeight: 600 }}>
                      {new Date(app.timestamp).toLocaleDateString('sk-SK')}
                    </div>
                  </div>
                </motion.div>

              {/* Interview Scheduler Notice */}
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
                        <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--green)' }}>Potvrdené!</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Termín bol pridaný do tvojho plánu.</div>
                      </motion.div>
                    ) : confirmDeclineId === app.id ? (
                      <motion.div 
                        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                        style={{ background: 'rgba(239,68,68,0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)' }}
                      >
                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#ef4444', marginBottom: '12px', textAlign: 'center' }}>
                          Naozaj chceš odmietnuť toto pozvanie?
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setConfirmDeclineId(null); }}
                            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}
                          >
                            Zrušiť
                          </button>
                          <button 
                            onClick={async (e) => {
                              e.stopPropagation();
                              const btn = e.currentTarget;
                              btn.disabled = true;
                              btn.innerText = 'Spracovávam...';
                              try {
                                const token = getAccessToken();
                                await fetch(`/api/applications/${app.id}/interview`, {
                                  method: 'PATCH',
                                  headers: { 
                                    'Content-Type': 'application/json', 
                                    'Authorization': `Bearer ${token}` 
                                  },
                                  body: JSON.stringify({ declined: true })
                                });
                              } catch (err) {
                                console.error('Decline error:', err);
                              }
                              setConfirmDeclineId(null);
                              fetchApplications();
                            }}
                            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}
                          >
                            Áno, odmietnuť
                          </button>
                        </div>
                      </motion.div>
                    ) : app.interviewInfo?.declined ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#ef4444' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                          🚫
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: '800' }}>Pozvanie na pohovor si odmietol/la.</div>
                      </div>
                    ) : app.interviewInfo?.selected_date ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                          🗓️
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Potvrdený termín</div>
                          <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>
                            {new Date(app.interviewInfo.selected_date).toLocaleString('sk-SK', { dateStyle: 'medium', timeStyle: 'short' })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 2s infinite' }} />
                            <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Pozvánka na pohovor
                            </div>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setConfirmDeclineId(app.id); }}
                            style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', fontWeight: '800', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            Odmietnuť
                          </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {(app.interviewInfo?.offered_dates || []).length === 0 ? (
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              Zamestnávateľ pripravuje termíny...
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
                                    const token = getAccessToken();
                                    const res = await fetch(`/api/applications/${app.id}/interview`, {
                                      method: 'PATCH',
                                      headers: { 
                                        'Content-Type': 'application/json', 
                                        'Authorization': `Bearer ${token}` 
                                      },
                                      body: JSON.stringify({ selectedDate: date })
                                    });
                                    if (res.ok) {
                                      setSuccessId(app.id);
                                      setTimeout(() => {
                                        setSuccessId(null);
                                        fetchApplications();
                                      }, 2000);
                                    }
                                  } catch (err) {
                                    btn.disabled = false;
                                  }
                                }}
                                style={{
                                  width: '100%', padding: '14px 18px', borderRadius: '12px', border: '1.5px solid var(--accent)',
                                  background: '#fff', color: 'var(--accent)', fontSize: '13px', fontWeight: '800', cursor: 'pointer',
                                  textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                  transition: 'all 0.2s', boxShadow: '0 4px 6px rgba(0,0,0,0.02)'
                                }}
                              >
                                <span>{new Date(date).toLocaleString('sk-SK', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                <span style={{ fontSize: '11px', fontWeight: '900' }}>VYBRAŤ →</span>
                              </motion.button>
                            ))
                          )}
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
