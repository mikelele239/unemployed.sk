import React, { useState, useEffect } from 'react';
import { useI18n } from '../contexts';
import { motion, AnimatePresence } from 'framer-motion';
import ModernDatePicker from './ModernDatePicker';

const CandidateCard = ({ candidate, onInvite }) => {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showCV, setShowCV] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [confirmHire, setConfirmHire] = useState(false);
  const [localSuccess, setLocalSuccess] = useState(null);
  const [cvUrl, setCvUrl] = useState(null);
  const [fullscreenCV, setFullscreenCV] = useState(false);

  const profile = candidate.student_profile || {};
  const cvId = profile.cv_id;

  useEffect(() => {
    if (expanded && cvId && !cvUrl) {
      const fetchCvUrl = async () => {
        try {
          const token = localStorage.getItem('employer_token');
          const res = await fetch(`/api/employer/cv/${cvId}/signed-url`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setCvUrl(data.url);
          }
        } catch (err) {
          console.error("Failed to fetch CV preview URL:", err);
        }
      };
      fetchCvUrl();
    }
  }, [expanded, cvId, cvUrl]);
  const initials = (candidate.student_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase();
  const status = (candidate.status || 'pending').toLowerCase();

  const getStatusDisplay = () => {
    switch(status) {
      case 'hired': return { label: 'ZMLUVNE PRIJATÝ', color: '#22c55e', bg: 'var(--green-light)' };
      case 'rejected': return { label: 'NEPRIJATÝ', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' };
      case 'interview': return { label: 'POHOVOR V PROCESE', color: 'var(--accent)', bg: 'var(--accent-light)' };
      default: return null;
    }
  };

  const statusInfo = getStatusDisplay();

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', 
      marginBottom: '16px', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', overflow: 'hidden',
      cursor: 'pointer', borderLeft: status === 'pending' ? '4px solid var(--accent)' : '1px solid var(--border)',
      boxShadow: expanded ? '0 10px 30px rgba(0,0,0,0.1)' : 'none'
    }} onClick={() => setExpanded(!expanded)}>
      {/* Main Header */}
      <div className="flex-responsive" style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '18px 20px' }}>
        <div style={{
          width: '46px', height: '46px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: '700', fontSize: '16px', color: '#fff', flexShrink: 0, 
          background: 'linear-gradient(135deg, #1a1a1a, #000)', border: '1px solid rgba(255,255,255,0.05)'
        }}>
          {initials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <h4 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '12px', letterSpacing: '-0.2px' }}>
              {candidate.student_name}
              {statusInfo && (
                <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '4px', background: statusInfo.bg, color: statusInfo.color, fontWeight: '900', letterSpacing: '0.5px' }}>
                  {statusInfo.label}
                </span>
              )}
            </h4>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ 
              fontSize: '10px', fontWeight: '900', padding: '4px 10px', background: 'var(--bg)', border: '1px solid var(--border)', 
              borderRadius: '4px', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }}>
              {candidate.job_title}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
              <span style={{ opacity: 0.3, margin: '0 4px' }}>•</span> {profile.school || 'Vysoká škola'}
            </div>
          </div>
        </div>
        
        {/* Executive Action Badge for Pending */}
        {status === 'pending' ? (
          <motion.div 
            whileHover={{ scale: 1.02 }}
            style={{ 
              padding: '10px 20px', background: 'var(--accent)', color: '#fff', borderRadius: '4px', 
              fontSize: '11px', fontWeight: '900', letterSpacing: '1px', boxShadow: '0 8px 20px rgba(255, 92, 0, 0.25)'
            }}>
            POTREBNÉ VYJADRENIE
          </motion.div>
        ) : (
          <div style={{ padding: '8px', color: 'var(--text-muted)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
          </div>
        )}
      </div>

      {/* Expanded Executive Summary & Actions */}
      <AnimatePresence>
        {expanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onClick={(e) => e.stopPropagation()} 
            style={{ borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', padding: window.innerWidth <= 900 ? '20px' : '32px' }}
          >
            {/* Compact CV Preview Chip */}
            <div style={{ marginBottom: '32px' }}>
               <div style={{ fontSize: '11px', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 900, letterSpacing: '1.5px' }}>Životopis (Originál PDF)</div>
               
               <motion.div 
                 whileHover={{ scale: 1.01, borderColor: 'var(--accent)' }}
                 onClick={() => cvId && setFullscreenCV(true)}
                 style={{ 
                   width: '100%', maxWidth: '300px', padding: '16px', background: 'var(--bg-card)', 
                   borderRadius: '12px', border: '1px solid var(--border)', cursor: cvId ? 'pointer' : 'default',
                   display: 'flex', alignItems: 'center', gap: '16px', transition: 'all 0.2s ease',
                   boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                 }}
               >
                 <div style={{ 
                   width: '40px', height: '40px', borderRadius: '8px', background: 'var(--accent-light)', 
                   display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' 
                 }}>
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                 </div>
                 <div style={{ flex: 1 }}>
                   <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text)' }}>
                     {cvId ? (profile.original_filename || 'Zivotopis.pdf') : 'Životopis nepriložený'}
                   </div>
                   {cvId && <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: '700' }}>KLIKNITE PRE CELOOBRAZOVÝ NÁHĽAD</div>}
                 </div>
               </motion.div>

               {/* Fullscreen CV Viewer Modal */}
               <AnimatePresence>
                 {fullscreenCV && cvUrl && (
                   <motion.div 
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     exit={{ opacity: 0 }}
                     style={{ 
                       position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', 
                       zIndex: 99999, display: 'flex', flexDirection: 'column',
                       backdropFilter: 'blur(10px)', padding: '40px'
                     }}
                   >
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', color: '#fff' }}>
                       <div>
                         <h2 style={{ fontSize: '20px', fontWeight: '900', margin: 0 }}>{candidate.student_name}</h2>
                         <p style={{ fontSize: '12px', opacity: 0.7, margin: 0 }}>Originálny životopis</p>
                       </div>
                       <button 
                         onClick={() => setFullscreenCV(false)}
                         style={{ 
                           background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', 
                           width: '44px', height: '44px', borderRadius: '50%', cursor: 'pointer',
                           display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px'
                         }}
                       >
                         &times;
                       </button>
                     </div>
                     <div style={{ flex: 1, background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                       <iframe 
                         src={cvUrl} 
                         style={{ width: '100%', height: '100%', border: 'none' }}
                         title="Full CV Preview"
                       />
                     </div>
                   </motion.div>
                 )}
               </AnimatePresence>
            </div>

            <div className="grid-responsive cols-2" style={{ display: 'grid', gap: '48px' }}>
              <div>
                <h5 style={{ fontSize: '11px', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '16px', fontWeight: 900, letterSpacing: '1.5px' }}>Výkonné zhrnutie (AI Analysis)</h5>
                <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '6px', border: '1px solid var(--border)', borderLeft: '4px solid var(--accent)' }}>
                  <p style={{ fontSize: '15px', lineHeight: '1.7', color: 'var(--text)', opacity: 0.9 }}>
                    {candidate.ai_reasoning || candidate.reason_sk || 'Tento kandidát vykazuje silný potenciál v oblasti technických zručností a tímovej spolupráce.'}
                  </p>
                  <div style={{ marginTop: '24px', display: 'flex', gap: '16px' }}>
                    <div style={{ padding: '12px 20px', borderRadius: '4px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 700, textTransform: 'uppercase' }}>Index zhody</div>
                      <div style={{ fontWeight: 900, color: 'var(--text)', fontSize: '20px' }}>{candidate.ai_score || candidate.match || candidate.score || 0}%</div>
                    </div>
                  </div>
                </div>

                {/* Executive Actions Panel */}
                <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {status === 'interview' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{
                          flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid var(--accent)', background: 'var(--accent-light)',
                          color: 'var(--accent)', fontSize: '11px', fontWeight: '900', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                          POZVÁNKA ODOSLANÁ
                        </div>
                        <motion.button 
                          whileTap={{ scale: 0.97 }}
                          onClick={() => onInvite(candidate.id, 'Pending')}
                          style={{
                            padding: '0 16px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-card)',
                            color: 'var(--text-muted)', fontSize: '11px', fontWeight: '800', cursor: 'pointer'
                          }}
                        >
                          ZRUŠIŤ
                        </motion.button>
                      </div>

                      {/* Interview Scheduling Status */}
                      <div style={{ background: 'rgba(0,0,0,0.05)', padding: '16px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Plánovanie pohovoru</div>
                        {candidate.interviewInfo?.declined ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
                            <div style={{ fontSize: '13px', fontWeight: '700' }}>Kandidát odmietol pozvanie.</div>
                          </div>
                        ) : candidate.interviewInfo?.selected_date ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--green)' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)' }} />
                            <div style={{ fontSize: '13px', fontWeight: '700' }}>
                              Potvrdený termín: {new Date(candidate.interviewInfo.selected_date).toLocaleString('sk-SK', { dateStyle: 'medium', timeStyle: 'short' })}
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: '12px', color: 'var(--text)', opacity: 0.8 }}>
                            Kandidát si vyberá z vašich termínov:
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                              {(candidate.interviewInfo?.offered_dates || []).map(d => (
                                <span key={d} style={{ fontSize: '10px', background: 'var(--bg)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                                  {new Date(d).toLocaleString('sk-SK', { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Date Selection Panel (Shown before inviting) */}
                      {status !== 'hired' && status !== 'rejected' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }}>
                          <div style={{ fontSize: '11px', fontWeight: '900', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ponúknuť termíny pohovoru</div>
                          
                          <AnimatePresence>
                            {showPicker && (
                              <div style={{ 
                                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                zIndex: 10000, padding: '20px', backdropFilter: 'blur(5px)'
                              }}
                              onClick={() => setShowPicker(false)}>
                                <div onClick={e => e.stopPropagation()}>
                                  <ModernDatePicker 
                                    onSelect={(dates) => {
                                      onInvite(candidate.id, 'Interview', dates);
                                      setShowPicker(false);
                                    }}
                                    onCancel={() => setShowPicker(false)}
                                  />
                                </div>
                              </div>
                            )}
                          </AnimatePresence>

                          {!showPicker && (
                            <motion.button 
                              whileHover={{ scale: 1.02, background: 'var(--accent)', color: '#fff' }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setShowPicker(true)}
                              style={{ 
                                width: '100%', padding: '14px', borderRadius: '8px', border: '1.5px solid var(--accent)', 
                                background: 'var(--accent-light)', color: 'var(--accent)', fontSize: '12px', fontWeight: '900', cursor: 'pointer',
                                transition: 'background 0.2s, color 0.2s', letterSpacing: '0.5px'
                              }}
                            >
                              VYBRAŤ TERMÍNY Z KALENDÁRA
                            </motion.button>
                          )}
                        </div>
                      )}
                      
                      <AnimatePresence mode="wait">
                        {localSuccess ? (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                            style={{ width: '100%', textAlign: 'center', padding: '20px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)' }}
                          >
                            <div style={{ fontSize: '32px', marginBottom: '8px' }}>{localSuccess === 'Hired' ? '🤝' : '✅'}</div>
                            <div style={{ fontSize: '15px', fontWeight: '800', color: localSuccess === 'Hired' ? 'var(--green)' : 'var(--text-muted)' }}>
                              {localSuccess === 'Hired' ? 'Kandidát prijatý!' : 'Kandidát odmietnutý'}
                            </div>
                          </motion.div>
                        ) : confirmReject ? (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            style={{ width: '100%', padding: '16px', background: 'rgba(239,68,68,0.05)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}
                          >
                            <div style={{ fontSize: '13px', fontWeight: '800', color: '#ef4444', marginBottom: '12px', textAlign: 'center' }}>
                              Naozaj chcete odmietnuť tohto kandidáta?
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <button onClick={() => setConfirmReject(false)} style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid var(--border)', background: '#fff', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}>ZRUŠIŤ</button>
                              <button 
                                onClick={() => {
                                  onInvite(candidate.id, 'Rejected');
                                  setLocalSuccess('Rejected');
                                }}
                                style={{ flex: 1, padding: '10px', borderRadius: '4px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}
                              >
                                ODMIETNUŤ
                              </button>
                            </div>
                          </motion.div>
                        ) : confirmHire ? (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            style={{ width: '100%', padding: '16px', background: 'rgba(34,197,94,0.05)', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.2)' }}
                          >
                            <div style={{ fontSize: '13px', fontWeight: '800', color: '#22c55e', marginBottom: '12px', textAlign: 'center' }}>
                              Chcete oficiálne prijať tohto kandidáta?
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <button onClick={() => setConfirmHire(false)} style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid var(--border)', background: '#fff', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}>ZRUŠIŤ</button>
                              <button 
                                onClick={() => {
                                  onInvite(candidate.id, 'Hired');
                                  setLocalSuccess('Hired');
                                }}
                                style={{ flex: 1, padding: '10px', borderRadius: '4px', border: 'none', background: '#22c55e', color: '#fff', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}
                              >
                                POTVRDIŤ PRIJATIE
                              </button>
                            </div>
                          </motion.div>
                        ) : (
                          <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                            <motion.button 
                              whileHover={{ scale: 1.02, boxShadow: '0 4px 15px rgba(34, 197, 94, 0.2)' }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setConfirmHire(true)}
                              style={{
                                flex: 1, padding: '14px', borderRadius: '8px', border: '1.5px solid #22c55e', background: '#fff',
                                color: '#22c55e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                              }}
                            >
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M20 6L9 17l-5-5"/></svg>
                              <span style={{ fontSize: '12px', fontWeight: '900' }}>PRIJAŤ</span>
                            </motion.button>

                            <motion.button 
                              whileHover={{ scale: 1.02, boxShadow: '0 4px 15px rgba(239, 68, 68, 0.1)' }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setConfirmReject(true)}
                              style={{
                                flex: 2, padding: '14px', borderRadius: '8px', border: '1.5px solid var(--border)', background: '#fff',
                                color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                              }}
                            >
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                              <span style={{ fontSize: '12px', fontWeight: '900' }}>ODMIETNUŤ</span>
                            </motion.button>
                          </div>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </div>
              </div>
              
              <div>
                <h5 style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '16px', fontWeight: 900, letterSpacing: '1.5px' }}>Detailné kompetencie</h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 700 }}>PRIMÁRNA LOKALITA</div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)' }}>{profile.location || 'Bratislava, Slovensko'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: 700 }}>ZRUČNOSTI A CERTIFIKÁCIE</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {(profile.skills || []).map(skill => (
                        <span key={skill} style={{ padding: '6px 14px', borderRadius: '2px', background: 'var(--bg-card)', fontSize: '12px', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600 }}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CandidateCard;
