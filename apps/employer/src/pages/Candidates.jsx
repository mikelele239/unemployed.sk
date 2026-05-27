import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n, useAppState } from '../contexts';
import { supabase } from '../supabase';
import CandidateAvatar from '../components/CandidateAvatar';
import Toast from '../components/Toast';
import ModernDatePicker from '../components/ModernDatePicker';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  Calendar, 
  Check, 
  X, 
  ChevronRight, 
  Clock, 
  AlertCircle,
  Eye
} from 'lucide-react';

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

const Candidates = () => {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { invitedIds, setInvitedIds, acceptedIds, setAcceptedIds, companyProfile, refreshAnalytics } = useAppState();
  
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals / Dropdown states
  const [activeDatePickerApp, setActiveDatePickerApp] = useState(null);
  const [activeHireApp, setActiveHireApp] = useState(null);
  const [activeRejectApp, setActiveRejectApp] = useState(null);
  
  // Toast notifications
  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Drag state
  const [draggedAppId, setDraggedAppId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      // Step 1: Get employer's job IDs
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, title, location')
        .eq('employer_id', session.user.id);

      const jobIds = (jobs || []).map(j => j.id);
      if (jobIds.length === 0) { setLoading(false); return; }

      const jobsMap = {};
      (jobs || []).forEach(j => { jobsMap[j.id] = j; });

      // Step 2: Get applications for those jobs
      const { data: apps, error: appsErr } = await supabase
        .from('applications')
        .select('*')
        .in('job_id', jobIds)
        .order('created_at', { ascending: false });

      if (appsErr) throw appsErr;

      const candidateIds = [...new Set((apps || []).map(a => a.candidate_id).filter(Boolean))];
      let profilesMap = {};
      let aiProfilesMap = {};
      
      if (candidateIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', candidateIds);
        (profiles || []).forEach(p => { profilesMap[p.user_id] = p; });

        // Fetch AI profiles via proxy
        try {
          const aiRes = await fetch('/api/employer/ai-profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ candidate_ids: candidateIds }),
          });
          if (aiRes.ok) {
            const aiData = await aiRes.json();
            aiProfilesMap = aiData.profiles || {};
          }
        } catch (aiErr) { console.error('[Candidates] AI profiles fetch failed:', aiErr.message); }
      }

      // Fetch match scores via proxy
      let matchScoresMap = {};
      if (candidateIds.length > 0 && jobIds.length > 0) {
        try {
          const msRes = await fetch('/api/employer/match-scores-bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ candidate_ids: candidateIds, job_ids: jobIds }),
          });
          if (msRes.ok) {
            const msData = await msRes.json();
            matchScoresMap = msData.scores || {};
          }
        } catch (msErr) { console.error('[Candidates] Match scores fetch failed:', msErr.message); }
      }

      const enrichedCandidates = (apps || []).map(app => {
        const profile = profilesMap[app.candidate_id] || {};
        const ai = aiProfilesMap[app.candidate_id] || {};
        const job = jobsMap[app.job_id] || {};
        const matchKey = `${app.candidate_id}_${app.job_id}`;
        const matchData = matchScoresMap[matchKey] || {};
        return {
          ...app,
          student_name: (profile.first_name || profile.last_name)
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
            : app.student_name,
          student_profile: { ...(app.student_profile || {}), ...profile },
          ai_profile: ai,
          ai_reasoning: ai.ai_summary || null,
          ai_headline: ai.ai_headline || null,
          ai_score: matchData.overall_score || 0,
          match_band: matchData.match_band || null,
          eligibility_tier: matchData.eligibility_tier || 'eligible',
          score_breakdown: matchData.breakdown || {},
          match_reasons: matchData.match_reasons || [],
          match_gaps: matchData.gaps || [],
          job_title: job.title || '—',
          job_location: job.location || '',
          interviewInfo: {
            offered_dates: app.interview_dates || [],
            selected_date: app.selected_date || null,
            declined: app.status === 'Declined',
          },
        };
      });

      setCandidates(enrichedCandidates);
    } catch (err) {
      console.error('Candidates fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleInvite = async (id, status = 'Interview', interviewDates = null, selectedDate = null) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const body = { status };
      if (interviewDates) body.interview_dates = interviewDates;
      if (selectedDate) body.selected_date = selectedDate;

      const res = await fetch(`/api/employer/candidates/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        if (status === 'Interview' && !invitedIds.includes(id)) {
          setInvitedIds([...invitedIds, id]);
        }
        
        // Update local candidates list
        setCandidates(prev => prev.map(c => c.id === id ? {
          ...c, 
          status,
          interview_dates: interviewDates || c.interview_dates,
          selected_date: selectedDate || c.selected_date,
          interviewInfo: {
            ...c.interviewInfo,
            selected_date: selectedDate || c.selected_date,
            offered_dates: interviewDates || c.interviewInfo.offered_dates,
          }
        } : c));

        let successMsg = t('toastInvite');
        if (status === 'Hired') successMsg = lang === 'sk' ? 'Kandidát bol úspešne prijatý!' : 'Candidate successfully hired!';
        if (status === 'Rejected') successMsg = lang === 'sk' ? 'Prihláška bola zamietnutá.' : 'Application rejected.';
        if (status === 'Viewed') successMsg = lang === 'sk' ? 'Stav aktualizovaný na: Posúdený' : 'Status updated to: Shortlisted';
        if (status === 'Pending') successMsg = lang === 'sk' ? 'Stav obnovený na: Nový' : 'Status reverted to: New';

        setToastMsg(successMsg);
        setShowToast(true);
        refreshAnalytics();
      } else {
        console.error('Status update failed:', await res.text());
      }
    } catch (err) {
      console.error('Update status error:', err);
    }
  };

  const handleOpenChat = async (e, candidate) => {
    e.stopPropagation();
    try {
      const { getOrCreateConversationForApplication } = await import('../services/messagingService');
      const convId = await getOrCreateConversationForApplication(candidate.id);
      navigate(`/messages`, { state: { activeConvId: convId } });
    } catch (err) {
      console.error('Failed to open chat:', err);
    }
  };

  const filteredCandidates = candidates.filter(c => 
    (c.student_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.student_profile?.field || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.job_title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Kanban column config
  const columns = [
    { id: 'Pending', label: lang === 'sk' ? 'Noví' : 'New', color: '#FF5C00' },
    { id: 'Viewed', label: lang === 'sk' ? 'Posúdení' : 'Shortlisted', color: '#2563eb' },
    { id: 'Interview', label: lang === 'sk' ? 'Pohovory' : 'Interviews', color: '#8b5cf6' },
    { id: 'Hired', label: lang === 'sk' ? 'Prijatí' : 'Hired', color: '#22c55e' },
    { id: 'Rejected', label: lang === 'sk' ? 'Zamietnutí' : 'Rejected', color: '#ef4444' }
  ];

  const getColumnCandidates = (columnId) => {
    return filteredCandidates.filter(c => {
      const cStatus = (c.status || 'Pending');
      if (columnId === 'Interview') {
        return ['interview', 'interview-confirmed', 'counter-offer'].includes(cStatus.toLowerCase());
      }
      if (columnId === 'Rejected') {
        return ['rejected', 'declined', 'withdrawn'].includes(cStatus.toLowerCase());
      }
      return cStatus.toLowerCase() === columnId.toLowerCase();
    });
  };

  const handleColumnDrop = (appId, targetColId) => {
    const candidate = candidates.find(c => c.id === appId);
    if (!candidate) return;

    const currentStatus = (candidate.status || 'Pending').toLowerCase();
    
    // Check if status is actually changing to prevent redundant API calls
    const isSameColumn = (
      (targetColId === 'Pending' && currentStatus === 'pending') ||
      (targetColId === 'Viewed' && currentStatus === 'viewed') ||
      (targetColId === 'Interview' && ['interview', 'interview-confirmed', 'counter-offer'].includes(currentStatus)) ||
      (targetColId === 'Hired' && currentStatus === 'hired') ||
      (targetColId === 'Rejected' && ['rejected', 'declined', 'withdrawn'].includes(currentStatus))
    );

    if (isSameColumn) return;

    if (targetColId === 'Interview') {
      // Propose Counter-Offer acceptance directly if they dropped a counter-offered candidate
      if (currentStatus === 'counter-offer' && candidate.selected_date) {
        handleInvite(appId, 'Interview-Confirmed', null, candidate.selected_date);
      } else {
        setActiveDatePickerApp(candidate);
      }
    } else if (targetColId === 'Hired') {
      setActiveHireApp(candidate);
    } else if (targetColId === 'Rejected') {
      setActiveRejectApp(candidate);
    } else {
      // Pending or Viewed
      handleInvite(appId, targetColId);
    }
  };

  return (
    <div style={{ animation: 'tabSlideIn 0.3s cubic-bezier(0.4, 0, 0.15, 1)' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '400', margin: 0 }}>{t('candTitle')}</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: 4 }}>{lang === 'sk' ? 'Prehľad a správa uchádzačov cez náborový lievik.' : 'Manage and track applicants through your recruitment pipeline.'}</p>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ 
        margin: '12px 20px 24px', display: 'flex', alignItems: 'center', gap: '8px', 
        padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' 
      }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '18px', height: '18px', color: 'var(--text-muted)', flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
        </svg>
        <input 
          type="text" 
          placeholder={lang === 'sk' ? 'Hľadať podľa mena, zamerania, pozície...' : 'Search by name, tags, job...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, border: 'none', background: 'none', fontSize: '14px', fontFamily: 'var(--font-body)', outline: 'none', color: 'var(--text)' }}
        />
      </div>

      {/* Kanban Board Container */}
      <div className="kanban-board-scroll" style={{ padding: '0 20px 40px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: '16px', minWidth: 'fit-content', paddingBottom: '16px' }}>
          {columns.map(col => {
            const colCandidates = getColumnCandidates(col.id);
            const isDraggingOver = dragOverColumn === col.id;

            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverColumn !== col.id) setDragOverColumn(col.id);
                }}
                onDragLeave={() => {
                  setDragOverColumn(null);
                }}
                onDrop={(e) => {
                  setDragOverColumn(null);
                  const appId = e.dataTransfer.getData('text/plain');
                  if (appId) handleColumnDrop(appId, col.id);
                }}
                style={{
                  width: '280px',
                  background: isDraggingOver ? 'rgba(255, 92, 0, 0.02)' : 'var(--bg-card)',
                  border: isDraggingOver ? '1.5px dashed var(--accent)' : '1px solid var(--border)',
                  borderRadius: '16px',
                  padding: '16px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  minHeight: '620px',
                  transition: 'all 0.2s ease',
                  boxShadow: isDraggingOver ? '0 0 12px rgba(255,92,0,0.06) inset' : 'none'
                }}
              >
                {/* Column Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '10px', margin: '0 4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.color }} />
                    <span style={{ fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{col.label}</span>
                  </div>
                  <span style={{ fontSize: '11px', background: 'var(--border)', padding: '2px 8px', borderRadius: '20px', fontWeight: '800', opacity: 0.8 }}>
                    {colCandidates.length}
                  </span>
                </div>

                {/* Column Cards Area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', minHeight: '400px' }}>
                  {colCandidates.length === 0 ? (
                    <div style={{ 
                      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
                      border: '1px dashed var(--border)', borderRadius: '12px', padding: '20px', opacity: 0.45, textAlign: 'center'
                    }}>
                      <span style={{ fontSize: 24, marginBottom: 8 }}>📥</span>
                      <span style={{ fontSize: '11px', fontWeight: 600 }}>
                        {lang === 'sk' ? 'Sem potiahnite' : 'Drag candidates here'}
                      </span>
                    </div>
                  ) : (
                    colCandidates.map(c => {
                      const score = c.ai_score || 0;
                      const scoreColor = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
                      const subStatus = (c.status || 'Pending').toLowerCase();

                      return (
                        <div
                          key={c.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', c.id);
                            setDraggedAppId(c.id);
                          }}
                          onDragEnd={() => {
                            setDraggedAppId(null);
                          }}
                          onClick={() => navigate(`/candidates/${c.candidate_id}?jobId=${c.job_id}`)}
                          style={{
                            background: 'var(--bg)',
                            border: '1px solid var(--border)',
                            borderRadius: '12px',
                            padding: '12px',
                            cursor: 'grab',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.02)',
                            position: 'relative',
                            borderLeft: `3.5px solid ${col.color}`
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.borderColor = 'var(--accent)';
                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.02)';
                          }}
                        >
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            <CandidateAvatar userId={c.candidate_id} avatarUrl={c.student_profile?.avatar_url} name={c.student_name} size={36} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'center', gap: '4px' }}>
                                <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '150px' }}>
                                  {c.student_name}
                                </div>
                                <span style={{ 
                                  fontSize: '10px', fontWeight: '800', background: `${scoreColor}14`, color: scoreColor, 
                                  padding: '1px 6px', borderRadius: '4px', border: `1px solid ${scoreColor}22` 
                                }}>
                                  {score}%
                                </span>
                              </div>

                              <div style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase', marginTop: 4, letterSpacing: '0.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {c.job_title}
                              </div>

                              {c.ai_headline && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  "{biLang(c.ai_headline, lang)}"
                                </div>
                              )}

                              {/* Scheduler Status Detail */}
                              {subStatus === 'interview-confirmed' && c.selected_date && (
                                <div style={{ marginTop: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '6px', padding: '4px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: '10px' }}>✅</span>
                                  <span style={{ fontSize: '10px', fontWeight: '700', color: '#22c55e' }}>
                                    {new Date(c.selected_date).toLocaleDateString('sk-SK')} o {new Date(c.selected_date).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              )}

                              {subStatus === 'counter-offer' && c.selected_date && (
                                <div style={{ marginTop: 8, background: 'rgba(255,92,0,0.08)', border: '1px solid rgba(255,92,0,0.15)', borderRadius: '6px', padding: '4px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: '10px' }}>📅</span>
                                  <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--accent)' }}>
                                    Protinávrh: {new Date(c.selected_date).toLocaleDateString('sk-SK')}
                                  </span>
                                </div>
                              )}

                              {subStatus === 'interview' && (
                                <div style={{ marginTop: 8, background: 'var(--accent-light)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: '10px' }}>⏳</span>
                                  <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)' }}>
                                    {lang === 'sk' ? 'Výber termínu' : 'Choosing slot'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Quick Actions overlay */}
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/candidates/${c.candidate_id}?jobId=${c.job_id}`); }}
                              title="Zobraziť detail"
                              style={{ border: 'none', background: 'var(--bg-card)', color: 'var(--text-muted)', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              <Eye size={12} />
                              <span style={{ fontSize: '10px', fontWeight: 600 }}>{lang === 'sk' ? 'Profil' : 'Profile'}</span>
                            </button>
                            <button
                              onClick={(e) => handleOpenChat(e, c)}
                              title="Otvoriť chat"
                              style={{ border: 'none', background: 'var(--accent-light)', color: 'var(--accent)', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              <MessageSquare size={12} />
                              <span style={{ fontSize: '10px', fontWeight: 700 }}>Chat</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Date Picker Modal Overlay */}
      <AnimatePresence>
        {activeDatePickerApp && (
          <div 
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: 20 }}
            onClick={() => setActiveDatePickerApp(null)}
          >
            <div onClick={e => e.stopPropagation()}>
              <ModernDatePicker 
                onSelect={(dates) => {
                  handleInvite(activeDatePickerApp.id, 'Interview', dates);
                  setActiveDatePickerApp(null);
                }}
                onCancel={() => setActiveDatePickerApp(null)}
              />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Reject Modal Overlay */}
      <AnimatePresence>
        {activeRejectApp && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001 }}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}
            >
              <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>{lang === 'sk' ? 'Odmietnuť kandidáta?' : 'Reject candidate?'}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 20px' }}>
                {lang === 'sk' 
                  ? `Naozaj chcete zamietnuť kandidáta ${activeRejectApp.student_name}? Táto akcia ho o tom automaticky upovedomí.` 
                  : `Are you sure you want to reject candidate ${activeRejectApp.student_name}? This action notifies them.`}
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setActiveRejectApp(null)} style={{ flex: 1, padding: 10, borderRadius: 8, background: 'none', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}>Zrušiť</button>
                <button onClick={() => {
                  handleInvite(activeRejectApp.id, 'Rejected');
                  setActiveRejectApp(null);
                }} style={{ flex: 1, padding: 10, borderRadius: 8, background: '#ef4444', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Zamietnuť</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Hire Modal Overlay */}
      <AnimatePresence>
        {activeHireApp && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001 }}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}
            >
              <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>{lang === 'sk' ? 'Potvrdiť prijatie?' : 'Confirm hiring?'}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 20px' }}>
                {lang === 'sk' 
                  ? `Chcete označiť kandidáta ${activeHireApp.student_name} ako úspešne prijatého na pozíciu?` 
                  : `Do you want to mark candidate ${activeHireApp.student_name} as successfully hired for the position?`}
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setActiveHireApp(null)} style={{ flex: 1, padding: 10, borderRadius: 8, background: 'none', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}>Zrušiť</button>
                <button onClick={() => {
                  handleInvite(activeHireApp.id, 'Hired');
                  setActiveHireApp(null);
                }} style={{ flex: 1, padding: 10, borderRadius: 8, background: '#22c55e', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Prijať</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Toast message={toastMsg} show={showToast} onHide={() => setShowToast(false)} />
      
      <style>{`
        .kanban-board-scroll::-webkit-scrollbar {
          height: 8px;
        }
        .kanban-board-scroll::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};

export default Candidates;
