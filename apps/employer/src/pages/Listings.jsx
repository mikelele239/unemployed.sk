import React, { useState, useEffect } from 'react';
import { useI18n, useAppState } from '../contexts';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ModernDatePicker from '../components/ModernDatePicker';

const ListingCard = ({ l, lang, t, onDelete, onEdit, getStatusColor, translateStatus, liveViewerCount }) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [applicants, setApplicants] = useState(null);
  const [loadingApps, setLoadingApps] = useState(false);
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [showInterviewPicker, setShowInterviewPicker] = useState(false);
  const title = l.title || '—';
  const status = l.status || 'Active';
  const workModel = l.work_model || l.workModel || 'On-site';

  const fetchApplicants = async () => {
    if (applicants !== null) return;
    setLoadingApps(true);
    try {
      const { data: apps } = await supabase
        .from('applications')
        .select('id, student_name, student_email, status, created_at, candidate_id, interview_dates, selected_date')
        .eq('job_id', l.id)
        .order('created_at', { ascending: false });
      const candidateIds = [...new Set((apps || []).map(a => a.candidate_id).filter(Boolean))];
      let profilesMap = {};
      if (candidateIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, first_name, last_name, education, location, skills, cv_id, original_filename, avatar_url').in('user_id', candidateIds);
        (profiles || []).forEach(p => { profilesMap[p.user_id] = p; });
      }
      setApplicants((apps || []).map(app => {
        const prof = profilesMap[app.candidate_id] || {};
        return { ...app,
          student_name: (prof.first_name || prof.last_name) ? `${prof.first_name || ''} ${prof.last_name || ''}`.trim() : app.student_name || app.student_email?.split('@')[0] || 'Kandidát',
          education: prof.education || '', location: prof.location || '',
          skills: prof.skills || [], cv_id: prof.cv_id || '', original_filename: prof.original_filename || '', avatar_url: prof.avatar_url || '',
        };
      }));
    } catch (err) { console.error(err); }
    finally { setLoadingApps(false); }
  };

  const handleCardClick = () => { if (!expanded) fetchApplicants(); setExpanded(!expanded); };
  const appStatusColor = (s) => { switch ((s||'').toLowerCase()) { case 'hired': return '#22c55e'; case 'interview': return '#6366f1'; case 'interview-confirmed': return '#22c55e'; case 'counter-offer': return 'var(--accent)'; case 'rejected': case 'declined': return '#ef4444'; default: return 'var(--text-muted)'; } };

  return (
    <motion.div layout="position" transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: '4px solid transparent', borderRadius: 'var(--radius)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'pointer', boxShadow: 'var(--shadow)', position: 'relative', overflow: 'hidden' }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 30px rgba(255, 92, 0, 0.15)'; e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.borderLeftColor = 'var(--accent)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.borderLeftColor = 'transparent'; }}
      className="listing-card"
    >
      <div onClick={handleCardClick} style={{ padding: '24px' }}>
        <div className="flex-responsive" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '6px', color: 'var(--text)' }}>{title}</h3>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              {l.location} • {workModel}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: '800', color: 'var(--accent)', background: 'rgba(255, 92, 0, 0.1)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(255, 92, 0, 0.2)' }}>
                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', animation: 'blink 1.5s infinite' }}></span>
                LIVE
              </div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: getStatusColor(status), background: 'var(--bg)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {translateStatus(status)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={(e) => { e.stopPropagation(); onEdit(l); }} style={{ padding: '6px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', transition: 'all 0.2s' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button onClick={(e) => { e.stopPropagation(); setIsConfirming(true); }} style={{ padding: '6px', borderRadius: '6px', border: '1px solid var(--border)', background: 'rgba(255, 71, 71, 0.1)', color: '#ff4747', cursor: 'pointer', transition: 'all 0.2s' }} title={t('delete')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"></path></svg>
              </button>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: window.innerWidth <= 900 ? '16px' : '32px', borderTop: '1px solid var(--border)', paddingTop: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '24px', fontWeight: '800', fontFamily: 'var(--font-body)', color: 'var(--accent)' }}>{l.applications || 0}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>{t('applications')}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '24px', fontWeight: '800', fontFamily: 'var(--font-body)', color: 'var(--text)' }}>{l.total_views || 0}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>{lang === 'sk' ? 'Zobrazenia' : 'Views'}</div>
          </div>
          {liveViewerCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', marginLeft: 'auto' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', animation: 'blink 1.5s infinite', boxShadow: '0 0 8px rgba(34,197,94,0.5)' }}></span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#22c55e' }}>{liveViewerCount} {lang === 'sk' ? 'pozerá teraz' : 'viewing now'}</span>
            </div>
          )}
          <div style={{ marginLeft: liveViewerCount > 0 ? '0' : 'auto', color: 'var(--text-muted)', transition: 'transform 0.3s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
          </div>
        </div>
      </div>

      {/* ── Applicants Dropdown ── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div key="applicants-dropdown"
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1, transition: { duration: 0.3 } }} 
            exit={{ height: 0, opacity: 0, transition: { duration: 0.2 } }}
            style={{ borderTop: '1px solid var(--border)', background: 'var(--bg)', overflow: 'hidden' }}
          >
            <div style={{ padding: '16px 24px' }}>
              <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
                {lang === 'sk' ? 'Prihlášky' : 'Applications'} ({(applicants || []).length})
              </div>
              {loadingApps ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>{lang === 'sk' ? 'Načítavam...' : 'Loading...'}</div>
              ) : (!applicants || applicants.length === 0) ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  <span style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>📭</span>
                  {lang === 'sk' ? 'Zatiaľ žiadne prihlášky' : 'No applications yet'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {applicants.map(app => (
                    <div key={app.id} onClick={(e) => { e.stopPropagation(); setSelectedApplicant(app); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', transition: 'all 0.2s', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #1a1a1a, #333)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '13px', fontWeight: 800, overflow: 'hidden' }}>
                        {app.avatar_url ? <img src={app.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (app.student_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.student_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {app.education || app.student_email || '—'}{app.location && ` · ${app.location}`}
                        </div>
                      </div>
                      <div style={{ fontSize: '9px', fontWeight: 900, padding: '4px 10px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', color: appStatusColor(app.status), background: 'var(--bg)', border: `1px solid ${appStatusColor(app.status)}22` }}>
                        {app.status || 'Pending'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {app.created_at ? new Date(app.created_at).toLocaleDateString('sk-SK') : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Applicant Detail Popup ── */}
      <AnimatePresence>
        {selectedApplicant && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={() => setSelectedApplicant(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: 520, maxHeight: '85vh', background: 'var(--bg-card)', borderRadius: 24, border: '1px solid var(--border)', padding: 28, overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #333, #111)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 900, overflow: 'hidden', flexShrink: 0 }}>
                    {selectedApplicant.avatar_url ? <img src={selectedApplicant.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (selectedApplicant.student_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{selectedApplicant.student_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {selectedApplicant.education || '—'}{selectedApplicant.location && ` · ${selectedApplicant.location}`}
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedApplicant(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              {/* Status Badge */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <span style={{ fontSize: 10, fontWeight: 900, padding: '5px 12px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.5px', color: appStatusColor(selectedApplicant.status), background: 'var(--bg)', border: `1px solid ${appStatusColor(selectedApplicant.status)}33` }}>
                  {selectedApplicant.status || 'Pending'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                  {lang === 'sk' ? 'Prihlásený' : 'Applied'}: {selectedApplicant.created_at ? new Date(selectedApplicant.created_at).toLocaleDateString('sk-SK') : '—'}
                </span>
              </div>

              {/* Interview Status */}
              {(selectedApplicant.status === 'Interview-Confirmed' || selectedApplicant.status === 'Counter-Offer') && selectedApplicant.selected_date && (
                <div style={{ padding: 16, borderRadius: 14, marginBottom: 20,
                  background: selectedApplicant.status === 'Counter-Offer' ? 'rgba(255,92,0,0.06)' : 'rgba(34,197,94,0.06)',
                  border: `1px solid ${selectedApplicant.status === 'Counter-Offer' ? 'rgba(255,92,0,0.2)' : 'rgba(34,197,94,0.2)'}`
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8,
                    color: selectedApplicant.status === 'Counter-Offer' ? 'var(--accent)' : '#22c55e'
                  }}>
                    {selectedApplicant.status === 'Counter-Offer' 
                      ? (lang === 'sk' ? '📅 Kandidát navrhuje iný termín' : '📅 Candidate proposes different date')
                      : (lang === 'sk' ? '✅ Kandidát potvrdil termín' : '✅ Candidate confirmed date')}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 12, fontFamily: 'var(--font-body)' }}>
                    {new Date(selectedApplicant.selected_date).toLocaleString('sk-SK', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                  {selectedApplicant.status === 'Counter-Offer' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={async () => {
                          const { error } = await supabase.from('applications')
                            .update({ status: 'Interview-Confirmed' })
                            .eq('id', selectedApplicant.id);
                          if (!error) {
                            setApplicants(prev => (prev || []).map(a => a.id === selectedApplicant.id ? { ...a, status: 'Interview-Confirmed' } : a));
                            setSelectedApplicant({ ...selectedApplicant, status: 'Interview-Confirmed' });
                          }
                        }}
                        style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: 'none', background: '#22c55e', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                      >
                        ✓ {lang === 'sk' ? 'Súhlasím s termínom' : 'Accept date'}
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowInterviewPicker(true)}
                        style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                      >
                        📅 {lang === 'sk' ? 'Navrhnúť nové' : 'Propose new dates'}
                      </motion.button>
                    </div>
                  )}
                </div>
              )}

              {selectedApplicant.status === 'Interview' && selectedApplicant.interview_dates && selectedApplicant.interview_dates.length > 0 && (
                <div style={{ padding: 14, borderRadius: 14, marginBottom: 20, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                    {lang === 'sk' ? '⏳ Čaká sa na odpoveď kandidáta' : '⏳ Waiting for candidate response'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {selectedApplicant.interview_dates.map(d => (
                      <span key={d} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-body)' }}>
                        {new Date(d).toLocaleString('sk-SK', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* Skills */}
              {selectedApplicant.skills && selectedApplicant.skills.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{lang === 'sk' ? 'Zručnosti' : 'Skills'}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {selectedApplicant.skills.map(s => (
                      <span key={s} style={{ padding: '4px 12px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: 'rgba(255,92,0,0.08)', color: 'var(--accent)', border: '1px solid rgba(255,92,0,0.15)' }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* CV */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{lang === 'sk' ? 'Životopis' : 'CV'}</div>
                {selectedApplicant.cv_id ? (
                  <button onClick={async () => {
                    console.log('[Popup] Opening CV:', selectedApplicant.cv_id);
                    const { data, error: cvErr } = await supabase.storage.from('cvs').createSignedUrl(selectedApplicant.cv_id, 3600);
                    console.log('[Popup] CV signed URL result:', data, cvErr);
                    if (data?.signedUrl) {
                      window.open(data.signedUrl, '_blank');
                    } else {
                      // Fallback: try public URL
                      const { data: pub } = supabase.storage.from('cvs').getPublicUrl(selectedApplicant.cv_id);
                      if (pub?.publicUrl) {
                        window.open(pub.publicUrl, '_blank');
                      } else {
                        alert(lang === 'sk' ? 'Nepodarilo sa otvoriť CV' : 'Failed to open CV');
                      }
                    }
                  }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.2s', width: '100%' }}
                    onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                    onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                    📄 {selectedApplicant.original_filename || 'CV.pdf'}
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>{lang === 'sk' ? 'Otvoriť' : 'Open'}</span>
                  </button>
                ) : (
                  <div style={{ padding: '10px 16px', borderRadius: 12, border: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: 13 }}>
                    {lang === 'sk' ? 'Žiadny životopis nahraný' : 'No CV uploaded'}
                  </div>
                )}
              </div>

              {/* AI Match placeholder */}
              <div style={{ padding: 14, borderRadius: 12, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>🤖</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6366f1' }}>{lang === 'sk' ? 'AI Zhoda' : 'AI Match'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lang === 'sk' ? 'Čoskoro dostupné' : 'Coming soon'}</div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {/* Interview Date Picker Overlay */}
                <AnimatePresence>
                  {showInterviewPicker && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                      style={{ width: '100%', marginBottom: 8 }}
                    >
                      <ModernDatePicker 
                        onSelect={async (dates) => {
                          const { error } = await supabase.from('applications').update({ 
                            status: 'Interview', 
                            interview_dates: dates 
                          }).eq('id', selectedApplicant.id);
                          console.log('[Popup] Interview with dates:', error || 'OK', dates);
                          if (!error) {
                            setApplicants(prev => (prev || []).map(a => a.id === selectedApplicant.id ? { ...a, status: 'Interview' } : a));
                            setSelectedApplicant({ ...selectedApplicant, status: 'Interview' });
                            setShowInterviewPicker(false);
                          } else {
                            alert(lang === 'sk' ? `Chyba: ${error.message}` : `Error: ${error.message}`);
                          }
                        }}
                        onCancel={() => setShowInterviewPicker(false)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {!showInterviewPicker && (selectedApplicant.status || '').toLowerCase() !== 'interview' && (
                  <motion.button 
                    whileHover={{ scale: 1.02, boxShadow: '0 8px 24px rgba(99,102,241,0.25)' }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setShowInterviewPicker(true)}
                    style={{ 
                      flex: 1, padding: '14px 18px', borderRadius: 12, border: 'none', 
                      background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff', 
                      fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: '0 4px 14px rgba(99,102,241,0.25)', transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {lang === 'sk' ? 'Pohovor' : 'Interview'}
                  </motion.button>
                )}
                {(selectedApplicant.status || '').toLowerCase() !== 'hired' && (
                  <motion.button 
                    whileHover={{ scale: 1.02, boxShadow: '0 8px 24px rgba(34,197,94,0.25)', background: 'linear-gradient(135deg, #22c55e, #16a34a)', borderColor: 'transparent' }}
                    whileTap={{ scale: 0.96 }}
                    onClick={async () => {
                    const { error } = await supabase.from('applications').update({ status: 'Hired' }).eq('id', selectedApplicant.id);
                    console.log('[Popup] Hire update:', error || 'OK');
                    if (!error) {
                      setApplicants(prev => (prev || []).map(a => a.id === selectedApplicant.id ? { ...a, status: 'Hired' } : a));
                      setSelectedApplicant({ ...selectedApplicant, status: 'Hired' });
                    } else {
                      alert(lang === 'sk' ? `Chyba: ${error.message}` : `Error: ${error.message}`);
                    }
                  }} style={{ 
                    flex: 1, padding: '14px 18px', borderRadius: 12, border: '1.5px solid #22c55e', 
                    background: 'rgba(34,197,94,0.06)', color: '#22c55e', 
                    fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    {lang === 'sk' ? 'Prijať' : 'Hire'}
                  </motion.button>
                )}
                <motion.button 
                  whileHover={{ scale: 1.02, boxShadow: '0 8px 24px rgba(239,68,68,0.15)', background: 'rgba(239,68,68,0.08)', borderColor: '#ef4444', color: '#ef4444' }}
                  whileTap={{ scale: 0.96 }}
                  onClick={async () => {
                  const { error } = await supabase.from('applications').update({ status: 'Rejected' }).eq('id', selectedApplicant.id);
                  console.log('[Popup] Reject update:', error || 'OK');
                  if (!error) {
                    setApplicants(prev => (prev || []).map(a => a.id === selectedApplicant.id ? { ...a, status: 'Rejected' } : a));
                    setSelectedApplicant(null);
                  } else {
                    alert(lang === 'sk' ? `Chyba: ${error.message}` : `Error: ${error.message}`);
                  }
                }} style={{ 
                  padding: '14px 18px', borderRadius: 12, border: '1.5px solid var(--border)', 
                  background: 'var(--bg-card)', color: 'var(--text-muted)', 
                  fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  {lang === 'sk' ? 'Odmietnuť' : 'Reject'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Overlay */}
      <AnimatePresence>
        {isConfirming && (
          <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center', zIndex: 10 }}
          >
            <p style={{ color: '#fff', fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>{t('deleteConfirm')}</p>
            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
              <button onClick={(e) => { e.stopPropagation(); onDelete(l.id); }} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#ff4747', color: '#fff', border: 'none', fontWeight: '700', cursor: 'pointer' }}>{t('delete')}</button>
              <button onClick={(e) => { e.stopPropagation(); setIsConfirming(false); }} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', fontWeight: '600', cursor: 'pointer' }}>Zrušiť</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};


const Listings = () => {
  const { t, lang } = useI18n();
  const { listings, setListings, liveViewers } = useAppState();

  const [loading, setLoading] = useState(true);
  const [editingListing, setEditingListing] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    // listings are loaded by AppStateProvider on mount — just clear loading
    setLoading(false);
  }, [listings]);

  const getStatusColor = (status) => status === 'Active' ? 'var(--green)' : 'var(--accent)';
  const translateStatus = (s) => t(`status${s}`);

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from('jobs').delete().eq('id', id);
      if (error) {
        console.error(error);
        alert(`Chyba pri odstraňovaní: ${error.message || 'Nepovolené (Skontrolujte RLS politiky)'}`);
      } else {
        setListings(prev => prev.filter(l => l.id !== id));
      }
    } catch (err) { console.error(err); }
  };

  const handleUpdate = async () => {
    if (!editingListing.title) return;
    try {
      setSaveLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const payload = {
        title: editingListing.title,
        description: editingListing.description || '',
        requirements: editingListing.requirements || '',
        rate: editingListing.rate || '',
        rate_unit: editingListing.rate_unit || editingListing.rateUnit || '',
        work_model: editingListing.work_model || editingListing.workModel || 'On-site',
        location: editingListing.location || '',
        hours: editingListing.hours || '',
        type: editingListing.type || '',
        duration: editingListing.duration || '',
        start_date: editingListing.start_date || editingListing.startDate || '',
        tags: editingListing.tags || [],
      };
      const { error } = await supabase
        .from('jobs')
        .update(payload)
        .eq('id', editingListing.id);

      if (error) {
        console.error(error);
        alert(`Chyba pri aktualizácii: ${error.message || 'Nepovolené (Skontrolujte RLS politiky)'}`);
      } else {
        setListings(prev => prev.map(l => l.id === editingListing.id ? { ...l, ...payload } : l));
        setEditingListing(null);
      }
    } catch (err) { 
      console.error(err); 
      alert(`Chyba: ${err.message}`);
    } finally { 
      setSaveLoading(false); 
    }
  };

  const [activeFilter, setActiveFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const filters = [
    { key: 'all', label: lang === 'sk' ? 'Všetky' : 'All' },
    { key: 'Full-time', label: 'Full-time' },
    { key: 'Part-time', label: 'Part-time' },
    { key: 'Internship', label: lang === 'sk' ? 'Stáž' : 'Internship' },
  ];

  const filteredListings = listings
    .filter(l => activeFilter === 'all' || (l.type || '').toLowerCase() === activeFilter.toLowerCase())
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      if (sortBy === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      if (sortBy === 'apps') return (b.applications || 0) - (a.applications || 0);
      return 0;
    });

  return (
    <div style={{ animation: 'tabSlideIn 0.4s ease' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: '400' }}>{t('listingsTitle')}</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{t('listingsSub')}</p>
      </div>

      {/* Filters & Sort */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          {filters.map(f => (
            <button key={f.key} onClick={() => setActiveFilter(f.key)}
              style={{
                padding: '6px 16px', borderRadius: 100, fontSize: 12, fontWeight: 700,
                border: activeFilter === f.key ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: activeFilter === f.key ? 'var(--accent)' : 'var(--bg-card)',
                color: activeFilter === f.key ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap'
              }}
            >{f.label}</button>
          ))}
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
          <option value="newest">{lang === 'sk' ? 'Najnovšie' : 'Newest first'}</option>
          <option value="oldest">{lang === 'sk' ? 'Najstaršie' : 'Oldest first'}</option>
          <option value="apps">{lang === 'sk' ? 'Podľa prihlášok' : 'Most applications'}</option>
        </select>
      </div>

      <motion.div 
        layout
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 400px), 1fr))', gap: '24px' }}
      >
        <AnimatePresence mode="popLayout">
          {filteredListings.map(l => (
            <ListingCard 
              key={l.id} l={l} t={t} lang={lang}
              onDelete={handleDelete} onEdit={setEditingListing}
              getStatusColor={getStatusColor} translateStatus={translateStatus}
              liveViewerCount={liveViewers?.[l.id] || 0}
            />
          ))}
        </AnimatePresence>
        {!loading && filteredListings.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
            {activeFilter !== 'all' ? (lang === 'sk' ? 'Žiadne ponuky v tejto kategórii' : 'No listings in this category') : t('noResults')}
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {editingListing && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
            onClick={() => setEditingListing(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', background: 'var(--bg-card)', borderRadius: '24px', border: '1px solid var(--border)', padding: '32px', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 800 }}>Upraviť ponuku</h2>
                <button onClick={() => setEditingListing(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>{lang === 'sk' ? 'Názov pozície' : 'Job Title'}</label>
                  <input className="text-input" value={editingListing.title || ''} onChange={e => setEditingListing({...editingListing, title: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>{lang === 'sk' ? 'Lokalita' : 'Location'}</label>
                  <input className="text-input" value={editingListing.location || ''} onChange={e => setEditingListing({...editingListing, location: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>{lang === 'sk' ? 'Pracovný model' : 'Work Model'}</label>
                  <select className="text-input" value={editingListing.work_model || editingListing.workModel || 'On-site'} onChange={e => setEditingListing({...editingListing, work_model: e.target.value})}>
                    <option value="On-site">On-site</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Remote">Remote</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>{lang === 'sk' ? 'Odmena' : 'Rate'}</label>
                  <input className="text-input" value={editingListing.rate || ''} onChange={e => setEditingListing({...editingListing, rate: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>{lang === 'sk' ? 'Jednotka odmeny' : 'Rate Unit'}</label>
                  <input className="text-input" placeholder="napr. €/hod, €/mes" value={editingListing.rate_unit || editingListing.rateUnit || ''} onChange={e => setEditingListing({...editingListing, rate_unit: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>{lang === 'sk' ? 'Typ' : 'Type'}</label>
                  <select className="text-input" value={editingListing.type || ''} onChange={e => setEditingListing({...editingListing, type: e.target.value})}>
                    <option value="">—</option>
                    <option value="internship">Internship</option>
                    <option value="part-time">Part-time</option>
                    <option value="full-time">Full-time</option>
                    <option value="contract">Contract</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>{lang === 'sk' ? 'Úväzok (hodiny)' : 'Hours'}</label>
                  <input className="text-input" placeholder="napr. 20 hod/týždenne" value={editingListing.hours || ''} onChange={e => setEditingListing({...editingListing, hours: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>{lang === 'sk' ? 'Trvanie' : 'Duration'}</label>
                  <input className="text-input" placeholder="napr. 3 mesiace" value={editingListing.duration || ''} onChange={e => setEditingListing({...editingListing, duration: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>{lang === 'sk' ? 'Dátum nástupu' : 'Start Date'}</label>
                  <input className="text-input" type="date" value={editingListing.start_date || editingListing.startDate || ''} onChange={e => setEditingListing({...editingListing, start_date: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>{lang === 'sk' ? 'Tagy' : 'Tags'}</label>
                  <input className="text-input" placeholder="marketing, dizajn, ..." value={(editingListing.tags || []).join(', ')} onChange={e => setEditingListing({...editingListing, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})} />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>{lang === 'sk' ? 'Popis' : 'Description'}</label>
                <textarea className="text-input" style={{ minHeight: '120px', resize: 'vertical' }} value={editingListing.description || ''} onChange={e => setEditingListing({...editingListing, description: e.target.value})} />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>{lang === 'sk' ? 'Požiadavky' : 'Requirements'}</label>
                <textarea className="text-input" style={{ minHeight: '100px', resize: 'vertical' }} value={editingListing.requirements || ''} onChange={e => setEditingListing({...editingListing, requirements: e.target.value})} />
              </div>

              <button className="btn-main" onClick={handleUpdate} disabled={saveLoading} style={{ width: '100%', height: '52px' }}>
                {saveLoading ? 'Ukladám...' : 'Uložiť zmeny'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Listings;
