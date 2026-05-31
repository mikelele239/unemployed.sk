import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../contexts';
import { supabase } from '../supabase';
import { motion, AnimatePresence } from 'framer-motion';
import ModernDatePicker from './ModernDatePicker';
import CandidateAvatar from './CandidateAvatar';
import { getOrCreateConversationForApplication } from '../services/messagingService';

// Helper: parse bilingual JSON strings {sk,en} — returns the right language
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
// Helper for bilingual arrays (each element may be a JSON string)
function biLangArr(arr, lang) {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => biLang(item, lang)).filter(Boolean);
}

// Match band display config
const BAND_DISPLAY = {
  A: { color: 'var(--color-success)', bg: 'var(--color-success-bg)', icon: '🟢' },
  B: { color: 'var(--color-info)',    bg: 'var(--color-info-bg)',    icon: '🔵' },
  C: { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', icon: '🟡' },
  D: { color: 'var(--accent)',        bg: 'var(--accent-light)',      icon: '🟠' },
  E: { color: 'var(--color-error)',   bg: 'var(--color-error-bg)',   icon: '🔴' },
};
const BAND_LABELS = {
  A: { sk: 'Silná zhoda', en: 'Strong fit' },
  B: { sk: 'Dobrá zhoda', en: 'Good fit' },
  C: { sk: 'Potenciálna zhoda', en: 'Potential fit' },
  D: { sk: 'Čiastočná zhoda', en: 'Partial fit' },
  E: { sk: 'Nízka zhoda', en: 'Low fit' },
};

function getScoreBand(score) {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'E';
}

// Eligibility tier display
const ELIG_DISPLAY = {
  eligible:     { sk: 'Spĺňa podmienky',       en: 'Eligible',      color: 'var(--color-success)', bg: 'var(--color-success-bg)', icon: '✓' },
  near_miss:    { sk: 'Takmer spĺňa',           en: 'Near miss',     color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', icon: '≈' },
  not_eligible: { sk: 'Nespĺňa podmienky',      en: 'Not eligible',  color: 'var(--color-error)',   bg: 'var(--color-error-bg)',   icon: '✗' },
};

const CandidateCard = ({ candidate, onInvite }) => {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showCV, setShowCV] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [confirmHire, setConfirmHire] = useState(false);
  const [localSuccess, setLocalSuccess] = useState(null);
  const [cvUrl, setCvUrl] = useState(null);
  const [fullscreenCV, setFullscreenCV] = useState(false);

  const handleOpenChat = async (e) => {
    e.stopPropagation();
    try {
      const convId = await getOrCreateConversationForApplication(candidate.id);
      navigate(`/messages`, { state: { activeConvId: convId } });
    } catch (err) {
      console.error('Failed to open chat:', err);
    }
  };


  const profile = candidate.student_profile || {};
  const ai = candidate.ai_profile || {};
  const cvId = profile.cv_id;

  useEffect(() => {
    if (expanded && cvId && !cvUrl) {
      const fetchCvUrl = async () => {
        try {
          const { data, error } = await supabase.storage.from('cvs').createSignedUrl(cvId, 3600);
          if (error) throw error;
          if (data?.signedUrl) {
            setCvUrl(data.signedUrl);
          }
        } catch (err) {
          console.error("Failed to fetch CV preview URL:", err);
        }
      };
      fetchCvUrl();
    }
  }, [expanded, cvId, cvUrl]);
  const status = (candidate.status || 'pending').toLowerCase();

  const getStatusDisplay = () => {
    switch(status) {
      case 'hired': return { label: 'ZMLUVNE PRIJATÝ', color: 'var(--color-success)', bg: 'var(--color-success-bg)' };
      case 'rejected': case 'declined': return { label: status === 'declined' ? 'ODMIETNUTÝ KANDIDÁTOM' : 'NEPRIJATÝ', color: 'var(--color-error)', bg: 'var(--color-error-bg)' };
      case 'interview': return { label: 'POHOVOR V PROCESE', color: 'var(--color-premium)', bg: 'var(--color-premium-bg)' };
      case 'interview-confirmed': return { label: 'POHOVOR POTVRDENÝ', color: 'var(--color-success)', bg: 'var(--color-success-bg)' };
      case 'counter-offer': return { label: 'PROTINÁVRH TERMÍNU', color: 'var(--accent)', bg: 'var(--accent-light)' };
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
        <CandidateAvatar userId={candidate.candidate_id} avatarUrl={profile.avatar_url} name={candidate.student_name} size={46} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <h4 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '12px', letterSpacing: '-0.2px', flexWrap: 'wrap' }}>
              {candidate.student_name}
              {candidate.verification_status?.status === 'completed' && (
                <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', fontWeight: '900', letterSpacing: '0.3px', display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                  {lang === 'sk' ? 'OVERENÝ' : 'VERIFIED'}
                </span>
              )}
              {statusInfo && (
                <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '4px', background: statusInfo.bg, color: statusInfo.color, fontWeight: '900', letterSpacing: '0.5px' }}>
                  {statusInfo.label}
                </span>
              )}
            </h4>
          {ai.ai_headline && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px', fontStyle: 'italic' }}>
              {biLang(ai.ai_headline, lang)}
            </div>
          )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ 
              fontSize: '10px', fontWeight: '900', padding: '4px 10px', background: 'var(--bg)', border: '1px solid var(--border)', 
              borderRadius: '4px', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }}>
              {candidate.job_title || candidate.jobs?.title || '—'}
            </div>
            {(ai.education_field || ai.education_school || profile.education) && (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
                <span style={{ opacity: 0.3, margin: '0 4px' }}>•</span> {ai.education_field || ai.education_school || profile.education}
              </div>
            )}
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
            style={{ borderTop: '1px solid var(--border)', background: 'var(--overlay-light)', padding: window.innerWidth <= 900 ? '20px' : '32px' }}
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
                   boxShadow: '0 4px 12px var(--overlay-card)'
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
                     <div style={{ flex: 1, background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 50px var(--overlay-dark)' }}>
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
                <h5 style={{ fontSize: '11px', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '16px', fontWeight: 900, letterSpacing: '1.5px' }}>{lang === 'sk' ? 'Výkonné zhrnutie (AI Analýza)' : 'Executive Summary (AI Analysis)'}</h5>
                <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '6px', border: '1px solid var(--border)', borderLeft: '4px solid var(--accent)' }}>
                  <p style={{ fontSize: '15px', lineHeight: '1.7', color: 'var(--text)', opacity: 0.9 }}>
                    {biLang(candidate.ai_reasoning, lang) || (lang === 'sk' ? 'AI analýza ešte nebola vygenerovaná.' : 'AI analysis not yet generated.')}
                  </p>
                  
                  {/* Match Band + Score + Eligibility */}
                  <div style={{ marginTop: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    {(() => {
                      const score = candidate.ai_score || 0;
                      const band = candidate.match_band || getScoreBand(score);
                      const bandStyle = BAND_DISPLAY[band] || BAND_DISPLAY.E;
                      const bandLabel = BAND_LABELS[band] || BAND_LABELS.E;
                      const eligTier = candidate.eligibility_tier || 'eligible';
                      const eligStyle = ELIG_DISPLAY[eligTier] || ELIG_DISPLAY.eligible;
                      return (
                        <>
                          <div style={{ padding: '12px 20px', borderRadius: '4px', background: bandStyle.bg, border: `1px solid ${bandStyle.color}22`, minWidth: '120px' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 700, textTransform: 'uppercase' }}>{lang === 'sk' ? 'Zhoda' : 'Match'}</div>
                            <div style={{ fontWeight: 900, fontSize: '13px', color: bandStyle.color, marginBottom: '4px' }}>
                              {bandStyle.icon} {bandLabel[lang] || bandLabel.sk}
                            </div>
                            <div style={{ fontWeight: 900, fontSize: '24px', color: bandStyle.color }}>
                              {score}%
                            </div>
                            <div style={{ width: '100%', height: '3px', background: 'var(--border)', borderRadius: '2px', marginTop: '6px' }}>
                              <div style={{ width: `${score}%`, height: '100%', borderRadius: '2px', background: bandStyle.color }} />
                            </div>
                          </div>
                          <div style={{ padding: '8px 14px', borderRadius: '4px', background: eligStyle.bg, border: `1px solid ${eligStyle.color}22`, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '14px' }}>{eligStyle.icon}</span>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: eligStyle.color }}>
                              {eligStyle[lang] || eligStyle.sk}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                    
                    {/* Score breakdown — percentage bars */}
                    {candidate.score_breakdown && Object.keys(candidate.score_breakdown).length > 0 && (() => {
                      const labels = {
                        skills: { sk: 'Zručnosti', en: 'Skills' },
                        location: { sk: 'Lokácia', en: 'Location' },
                        education: { sk: 'Vzdelanie', en: 'Education' },
                        experience_level: { sk: 'Skúsenosti', en: 'Experience' },
                        language: { sk: 'Jazyky', en: 'Languages' },
                        job_type: { sk: 'Typ práce', en: 'Job Type' },
                        category: { sk: 'Kategória', en: 'Category' },
                        availability: { sk: 'Dostupnosť', en: 'Availability' },
                        work_mode: { sk: 'Model práce', en: 'Work Mode' },
                        salary: { sk: 'Plat', en: 'Salary' },
                      };
                      const maxScores = { skills: 30, location: 15, job_type: 10, category: 8, education: 10, experience_level: 10, language: 5, availability: 7, salary: 3, work_mode: 2 };
                      const entries = Object.entries(candidate.score_breakdown).filter(([,v]) => v > 0);
                      const pcts = entries.map(([key, val]) => Math.min(100, Math.round((val / (maxScores[key] || 10)) * 100)));
                      // If all percentages are identical (no real differentiation), hide breakdown
                      const allSame = pcts.length > 0 && pcts.every(p => p === pcts[0]);
                      if (allSame) {
                        return (
                          <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: 'var(--radius-xs)', background: 'var(--color-premium-bg)', border: '1px solid var(--color-premium-border)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            💡 {lang === 'sk'
                              ? 'Pre detailnejšie porovnanie kandidátov nastavte kritériá zhody v ponuke (zručnosti, jazyky, vzdelanie...).'
                              : 'Configure match criteria in your listing (skills, languages, education...) for detailed candidate comparison.'}
                          </div>
                        );
                      }
                      return (
                        <div style={{ width: '100%', marginTop: '16px' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                            {lang === 'sk' ? 'Rozklad skóre' : 'Score Breakdown'}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
                            {entries
                              .sort((a,b) => {
                                const pctA = (a[1] / (maxScores[a[0]] || 10)) * 100;
                                const pctB = (b[1] / (maxScores[b[0]] || 10)) * 100;
                                return pctB - pctA;
                              })
                              .map(([key, val]) => {
                                const maxVal = maxScores[key] || 10;
                                const pct = Math.min(100, Math.round((val / maxVal) * 100));
                                const dimColor = pct >= 70 ? 'var(--color-success)' : pct >= 40 ? 'var(--color-warning)' : 'var(--color-error)';
                                const label = labels[key] ? (labels[key][lang] || labels[key].sk) : key;
                                return (
                                  <div key={key} style={{ padding: '8px 10px', borderRadius: '6px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>{label}</span>
                                      <span style={{ fontSize: '11px', fontWeight: 800, color: dimColor }}>{pct}%</span>
                                    </div>
                                    <div style={{ width: '100%', height: '3px', background: 'var(--border)', borderRadius: '2px' }}>
                                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: '2px', background: dimColor, transition: 'width 0.5s ease' }} />
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  
                  {/* Match reasons (strengths) */}
                  {(candidate.match_reasons || []).length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--color-success)', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>{lang === 'sk' ? 'Silné stránky zhody' : 'Match strengths'}</div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {biLangArr(candidate.match_reasons, lang).slice(0, 6).map((r, i) => (
                          <span key={i} style={{ fontSize: '10px', padding: '3px 8px', borderRadius: 'var(--radius-xs)', background: 'var(--color-success-bg)', color: 'var(--color-success)', fontWeight: 600 }}>✓ {r}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Match gaps */}
                  {(candidate.match_gaps || []).length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>{lang === 'sk' ? 'Medzery' : 'Gaps'}</div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {biLangArr(candidate.match_gaps, lang).slice(0, 5).map((g, i) => {
                          const isTrainable = g.includes('trénovateľné') || g.includes('trainable');
                          return (
                            <span key={i} style={{ fontSize: '10px', padding: '3px 8px', borderRadius: 'var(--radius-xs)', background: isTrainable ? 'var(--color-info-bg)' : 'var(--color-error-bg)', color: isTrainable ? 'var(--color-info)' : 'var(--color-error)', fontWeight: 600 }}>
                              {isTrainable ? '⚡' : '✗'} {g}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* AI CV Verification Results */}
                {candidate.verification_status?.status === 'completed' && candidate.verification_status.overall_score != null && (
                  <div style={{ marginTop: '16px', padding: '16px', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.04)', border: '1px solid rgba(34, 197, 94, 0.15)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {lang === 'sk' ? 'AI CV Overenie dokončené' : 'AI CV Verification Complete'}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 900, color: '#22c55e', marginLeft: 'auto' }}>
                        {Math.round(candidate.verification_status.overall_score * 100)}%
                      </span>
                    </div>
                    {candidate.verification_status.results && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                        {Object.entries(candidate.verification_status.results).map(([attr, result]) => {
                          const labels = { language: { sk: 'Jazyky', en: 'Languages' }, skills: { sk: 'Zručnosti', en: 'Skills' }, experience: { sk: 'Skúsenosti', en: 'Experience' }, soft_skills: { sk: 'Soft skills', en: 'Soft Skills' } };
                          const score = result.score || 0;
                          const color = score >= 0.7 ? '#22c55e' : score >= 0.4 ? 'var(--accent)' : 'var(--color-error)';
                          return (
                            <div key={attr} style={{ padding: '6px 10px', borderRadius: '6px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                                <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{labels[attr]?.[lang] || attr}</span>
                                <span style={{ fontSize: '10px', fontWeight: 800, color }}>{Math.round(score * 100)}%</span>
                              </div>
                              <div style={{ width: '100%', height: '2px', background: 'var(--border)', borderRadius: '1px' }}>
                                <div style={{ width: `${Math.round(score * 100)}%`, height: '100%', borderRadius: '1px', background: color }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* AI Decision Support Disclaimer */}
                <div style={{ marginTop: '16px', padding: '8px 12px', borderRadius: 'var(--radius-xs)', background: 'var(--color-premium-bg)', border: '1px solid var(--color-premium-border)', fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {lang === 'sk'
                    ? '🤖 AI skóre je len pomôcka pre vaše rozhodovanie. Vždy si overte kandidáta na pohovore.'
                    : '🤖 AI scores are decision support only. Always validate candidates through interviews.'}
                </div>

                {/* Executive Actions Panel */}
                <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                  {/* Date Picker Overlay - always available */}
                  <AnimatePresence>
                    {showPicker && (
                      <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ 
                          position: 'fixed', inset: 0, background: 'var(--overlay-modal)', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', 
                          zIndex: 10000, padding: '20px', backdropFilter: 'blur(8px)'
                        }}
                        onClick={() => setShowPicker(false)}>
                        <div onClick={e => e.stopPropagation()}>
                          <ModernDatePicker 
                            onSelect={(dates) => {
                              onInvite(candidate.id, 'Interview', dates);
                            }}
                            onCancel={() => setShowPicker(false)}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {['interview', 'interview-confirmed', 'counter-offer'].includes(status) ? (
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
                      <div style={{ background: 'var(--overlay-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Plánovanie pohovoru</div>
                        
                        {candidate.interviewInfo?.declined ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-error)' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-error)' }} />
                            <div style={{ fontSize: '13px', fontWeight: '700' }}>Kandidát odmietol pozvanie.</div>
                          </div>
                        ) : status === 'counter-offer' && candidate.interviewInfo?.selected_date ? (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent)', marginBottom: 12 }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' }} />
                              <div style={{ fontSize: '13px', fontWeight: '700' }}>
                                Kandidát navrhuje: {new Date(candidate.interviewInfo.selected_date).toLocaleString('sk-SK', { dateStyle: 'medium', timeStyle: 'short' })}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <motion.button whileTap={{ scale: 0.95 }}
                                onClick={() => onInvite(candidate.id, 'Interview-Confirmed', candidate.interview_dates)}
                                style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: 'none', background: 'var(--color-success)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                              >✓ Súhlasím</motion.button>
                              <motion.button whileTap={{ scale: 0.95 }}
                                onClick={() => setShowPicker(true)}
                                style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                              >📅 Nové termíny</motion.button>
                            </div>
                          </div>
                        ) : candidate.interviewInfo?.selected_date && status === 'interview-confirmed' ? (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-success)', marginBottom: 10 }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-success)' }} />
                              <div style={{ fontSize: '13px', fontWeight: '700' }}>
                                Potvrdený: {new Date(candidate.interviewInfo.selected_date).toLocaleString('sk-SK', { dateStyle: 'medium', timeStyle: 'short' })}
                              </div>
                            </div>
                            <motion.button whileTap={{ scale: 0.95 }}
                              onClick={() => setShowPicker(true)}
                              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                            >Zmeniť termín</motion.button>
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontSize: '12px', color: 'var(--text)', opacity: 0.8, marginBottom: 8 }}>
                              ⏳ Kandidát si vyberá z vašich termínov:
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: 10 }}>
                              {(candidate.interviewInfo?.offered_dates || []).map(d => (
                                <span key={d} style={{ fontSize: '11px', background: 'var(--bg)', padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontWeight: 600, fontFamily: 'var(--font-body)' }}>
                                  {new Date(d).toLocaleString('sk-SK', { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                              ))}
                            </div>
                            <motion.button whileTap={{ scale: 0.95 }}
                              onClick={() => setShowPicker(true)}
                              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                            >Zmeniť termíny</motion.button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Date Selection Panel (Shown before inviting) */}
                      {status !== 'hired' && status !== 'rejected' && status !== 'declined' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }}>
                          <div style={{ fontSize: '11px', fontWeight: '900', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ponúknuť termíny pohovoru</div>

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
                            style={{ width: '100%', textAlign: 'center', padding: '24px', background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border)' }}
                          >
                            <div style={{ fontSize: '36px', marginBottom: '10px' }}>{localSuccess === 'Hired' ? '🤝' : '✅'}</div>
                            <div style={{ fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: '700', color: localSuccess === 'Hired' ? 'var(--color-success)' : 'var(--text-muted)' }}>
                              {localSuccess === 'Hired' ? 'Kandidát prijatý!' : 'Kandidát odmietnutý'}
                            </div>
                          </motion.div>
                        ) : confirmReject ? (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            style={{ width: '100%', padding: '20px', background: 'var(--color-error-bg)', borderRadius: '14px', border: '1px solid rgba(217,64,64,0.15)' }}
                          >
                            <div style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600', color: 'var(--color-error)', marginBottom: '16px', textAlign: 'center', lineHeight: 1.5 }}>
                              Naozaj chcete odmietnuť tohto kandidáta?
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <motion.button 
                                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                                onClick={() => setConfirmReject(false)} 
                                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-card)', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '700', cursor: 'pointer', color: 'var(--text)', transition: 'all 0.2s' }}
                              >Zrušiť</motion.button>
                              <motion.button 
                                whileHover={{ scale: 1.02, boxShadow: '0 6px 20px var(--color-error-bg)' }} whileTap={{ scale: 0.97 }}
                                onClick={() => {
                                  onInvite(candidate.id, 'Rejected');
                                  setLocalSuccess('Rejected');
                                }}
                                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--color-error)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 14px var(--color-error-bg)', transition: 'all 0.2s' }}
                              >
                                Odmietnuť
                              </motion.button>
                            </div>
                          </motion.div>
                        ) : confirmHire ? (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            style={{ width: '100%', padding: '20px', background: 'var(--color-success-bg)', borderRadius: '14px', border: '1px solid var(--color-success-border)' }}
                          >
                            <div style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600', color: 'var(--color-success)', marginBottom: '16px', textAlign: 'center', lineHeight: 1.5 }}>
                              Chcete oficiálne prijať tohto kandidáta?
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <motion.button 
                                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                                onClick={() => setConfirmHire(false)} 
                                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-card)', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '700', cursor: 'pointer', color: 'var(--text)', transition: 'all 0.2s' }}
                              >Zrušiť</motion.button>
                              <motion.button 
                                whileHover={{ scale: 1.02, boxShadow: '0 6px 20px var(--color-success-bg)' }} whileTap={{ scale: 0.97 }}
                                onClick={() => {
                                  onInvite(candidate.id, 'Hired');
                                  setLocalSuccess('Hired');
                                }}
                                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, var(--color-success), #118830)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 14px var(--color-success-bg)', transition: 'all 0.2s' }}
                              >
                                Potvrdiť prijatie
                              </motion.button>
                            </div>
                          </motion.div>
                        ) : (
                          <>
                            <div style={{ display: 'flex', gap: '12px', width: '100%', marginBottom: '12px' }}>
                              <motion.button 
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.96 }}
                                onClick={handleOpenChat}
                                style={{
                                  flex: 1, padding: '14px 20px', borderRadius: '12px', border: '1.5px solid var(--accent)', 
                                  background: 'var(--accent-light)', color: 'var(--accent)', cursor: 'pointer', 
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                  fontFamily: 'var(--font-body)', fontWeight: '700', fontSize: '13px',
                                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}
                              >
                                💬 {lang === 'sk' ? 'Kontaktovať (Chat)' : 'Contact (Chat)'}
                              </motion.button>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                              <motion.button 
                                whileHover={{ scale: 1.02, boxShadow: '0 8px 24px var(--color-success-bg)', background: 'linear-gradient(135deg, var(--color-success), #118830)', color: '#fff', borderColor: 'transparent' }}
                                whileTap={{ scale: 0.96 }}
                                onClick={() => setConfirmHire(true)}
                                style={{
                                  flex: 1, padding: '16px 20px', borderRadius: '12px', border: '1.5px solid var(--color-success)', 
                                  background: 'var(--color-success-bg)', color: 'var(--color-success)', cursor: 'pointer', 
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                  fontFamily: 'var(--font-body)', transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                                <span style={{ fontSize: '13px', fontWeight: '700', letterSpacing: '0.3px' }}>Prijať</span>
                              </motion.button>

                              <motion.button 
                                whileHover={{ scale: 1.02, boxShadow: '0 8px 24px var(--color-error-bg)', background: 'var(--color-error-bg)', borderColor: 'var(--color-error)' }}
                                whileTap={{ scale: 0.96 }}
                                onClick={() => setConfirmReject(true)}
                                style={{
                                  flex: 1, padding: '16px 20px', borderRadius: '12px', border: '1.5px solid var(--border)', 
                                  background: 'var(--bg-card)', color: 'var(--text-muted)', cursor: 'pointer', 
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                  fontFamily: 'var(--font-body)', transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                <span style={{ fontSize: '13px', fontWeight: '700', letterSpacing: '0.3px' }}>Odmietnuť</span>
                              </motion.button>
                            </div>
                          </>
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
                      {(ai.hard_skills || profile.skills || []).map(skill => (
                        <span key={skill} style={{ padding: '6px 14px', borderRadius: '2px', background: 'var(--bg-card)', fontSize: '12px', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600 }}>
                          {skill}
                        </span>
                      ))}
                    </div>
                    {(ai.languages || []).length > 0 && (
                      <div style={{ marginTop: '16px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 700 }}>JAZYKY</div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {ai.languages.map((l, i) => (
                            <span key={i} style={{ padding: '6px 14px', borderRadius: '2px', background: 'var(--accent-light)', fontSize: '12px', border: '1px solid var(--accent)', color: 'var(--accent)', fontWeight: 600 }}>
                              {l.lang} {l.level}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
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
