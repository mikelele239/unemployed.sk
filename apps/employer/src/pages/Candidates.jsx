import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n, useAppState } from '../contexts';
import { supabase } from '../supabase';
import CandidateAvatar from '../components/CandidateAvatar';
import Toast from '../components/Toast';
import ModernDatePicker from '../components/ModernDatePicker';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Eye,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

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

// Custom hook for responsive detection
function useIsMobile(breakpoint = 820) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
}

const Candidates = () => {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { invitedIds, setInvitedIds, companyProfile, refreshAnalytics } = useAppState();
  const isMobile = useIsMobile();

  const columns = [
    { id: 'Pending',  label: lang === 'sk' ? 'Noví'       : 'New',        color: '#FF5C00' },
    { id: 'Viewed',   label: lang === 'sk' ? 'Posúdení'   : 'Shortlisted', color: '#2563eb' },
    { id: 'Interview',label: lang === 'sk' ? 'Pohovory'   : 'Interviews',  color: '#8b5cf6' },
    { id: 'Hired',    label: lang === 'sk' ? 'Prijatí'    : 'Hired',       color: '#22c55e' },
    { id: 'Rejected', label: lang === 'sk' ? 'Zamietnutí' : 'Rejected',    color: '#ef4444' },
  ];

  const [applications, setApplications] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Lazy loaded detail stores
  const [profiles, setProfiles] = useState({});
  const [aiProfiles, setAiProfiles] = useState({});
  const [matchScores, setMatchScores] = useState({});

  // Column page limits
  const [visibleCounts, setVisibleCounts] = useState({
    Pending: 12,
    Viewed: 12,
    Interview: 12,
    Hired: 12,
    Rejected: 12
  });

  const [selectedJobId, setSelectedJobId] = useState('all');

  // Modals
  const [activeDatePickerApp, setActiveDatePickerApp] = useState(null);
  const [activeHireApp, setActiveHireApp] = useState(null);
  const [activeRejectApp, setActiveRejectApp] = useState(null);

  // Toast
  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Drag state (desktop only)
  const [draggedAppId, setDraggedAppId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  // Mobile accordion: which columns are open
  const [openColumns, setOpenColumns] = useState(['Pending', 'Interview']);

  const toggleColumn = (colId) => {
    setOpenColumns(prev =>
      prev.includes(colId) ? prev.filter(id => id !== colId) : [...prev, colId]
    );
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const { data: jobsData, error: jobsErr } = await supabase
        .from('jobs')
        .select('id, title, location')
        .eq('employer_id', session.user.id);

      if (jobsErr) throw jobsErr;
      const fetchedJobs = jobsData || [];
      setJobs(fetchedJobs);

      const jobIds = fetchedJobs.map(j => j.id);
      if (jobIds.length === 0) { setLoading(false); return; }

      const { data: apps, error: appsErr } = await supabase
        .from('applications')
        .select('*')
        .in('job_id', jobIds)
        .order('created_at', { ascending: false });

      if (appsErr) throw appsErr;
      setApplications(apps || []);
    } catch (err) {
      console.error('Candidates fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

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
        setApplications(prev => prev.map(c => c.id === id ? {
          ...c,
          status,
          interview_dates: interviewDates || c.interview_dates,
          selected_date: selectedDate || c.selected_date,
        } : c));

        let successMsg = t('toastInvite');
        if (status === 'Hired') successMsg = lang === 'sk' ? 'Kandidát bol úspešne prijatý!' : 'Candidate successfully hired!';
        if (status === 'Rejected') successMsg = lang === 'sk' ? 'Prihláška bola zamietnutá.' : 'Application rejected.';
        if (status === 'Viewed') successMsg = lang === 'sk' ? 'Stav: Posúdený' : 'Status: Shortlisted';
        if (status === 'Pending') successMsg = lang === 'sk' ? 'Stav: Nový' : 'Status: New';

        setToastMsg(successMsg);
        setShowToast(true);
        refreshAnalytics();
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

  // ── Candidate Enrichment ──
  const enrichCandidate = useCallback((app) => {
    const profile = profiles[app.candidate_id] || {};
    const ai = aiProfiles[app.candidate_id] || {};
    const job = jobs.find(j => j.id === app.job_id) || {};
    const matchKey = `${app.candidate_id}_${app.job_id}`;
    const matchData = matchScores[matchKey] || {};
    return {
      ...app,
      student_name: (profile.first_name || profile.last_name)
        ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
        : app.student_name,
      student_profile: { ...(app.student_profile || {}), ...profile },
      ai_profile: ai,
      ai_headline: ai.ai_headline || null,
      ai_score: matchData.overall_score || 0,
      match_band: matchData.match_band || null,
      job_title: job.title || '—',
      interviewInfo: {
        offered_dates: app.interview_dates || [],
        selected_date: app.selected_date || null,
        declined: app.status === 'Declined',
      },
    };
  }, [profiles, aiProfiles, matchScores, jobs]);

  // ── Column Filter & Pagination ──
  const getColumnCandidates = useCallback((columnId, allFiltered = false) => {
    let filtered = applications.filter(app => {
      // Job Filter
      if (selectedJobId !== 'all' && app.job_id !== selectedJobId) {
        return false;
      }
      // Search query filter (search by name, field, or job title)
      const name = (app.student_name || '').toLowerCase();
      const field = (app.student_profile?.field || '').toLowerCase();
      const job = jobs.find(j => j.id === app.job_id);
      const title = (job?.title || '').toLowerCase();
      const query = searchQuery.toLowerCase();

      if (searchQuery && !name.includes(query) && !field.includes(query) && !title.includes(query)) {
        return false;
      }
      return true;
    });

    // Filter by column status
    filtered = filtered.filter(c => {
      const s = (c.status || 'Pending').toLowerCase();
      if (columnId === 'Interview') return ['interview', 'interview-confirmed', 'counter-offer'].includes(s);
      if (columnId === 'Rejected') return ['rejected', 'declined', 'withdrawn'].includes(s);
      return s === columnId.toLowerCase();
    });

    if (allFiltered) {
      return filtered;
    }

    const limit = visibleCounts[columnId] || 12;
    return filtered.slice(0, limit);
  }, [applications, selectedJobId, searchQuery, visibleCounts, jobs]);

  // ── Lazy Loading Details Fetcher ──
  const loadMissingDetails = async (visibleCandidates) => {
    const missingCids = [];
    const missingPairs = [];

    visibleCandidates.forEach(c => {
      if (!profiles[c.candidate_id]) {
        missingCids.push(c.candidate_id);
      }
      const matchKey = `${c.candidate_id}_${c.job_id}`;
      if (!matchScores[matchKey]) {
        missingPairs.push({ candidate_id: c.candidate_id, job_id: c.job_id });
      }
    });

    const uniqueMissingCids = [...new Set(missingCids)];

    if (uniqueMissingCids.length === 0 && missingPairs.length === 0) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      let updatedProfiles = { ...profiles };
      let updatedAiProfiles = { ...aiProfiles };
      let updatedMatchScores = { ...matchScores };
      let updated = false;

      // A. Fetch student profiles
      if (uniqueMissingCids.length > 0) {
        for (let i = 0; i < uniqueMissingCids.length; i += 50) {
          const chunk = uniqueMissingCids.slice(i, i + 50);
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('*')
            .in('user_id', chunk);

          if (profilesData) {
            profilesData.forEach(p => {
              updatedProfiles[p.user_id] = p;
            });
            updated = true;
          }
        }

        // B. Fetch AI profiles
        for (let i = 0; i < uniqueMissingCids.length; i += 50) {
          const chunk = uniqueMissingCids.slice(i, i + 50);
          try {
            const aiRes = await fetch('/api/employer/ai-profiles', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({ candidate_ids: chunk }),
            });
            if (aiRes.ok) {
              const aiData = await aiRes.json();
              const fetchedProfiles = aiData.profiles || {};
              Object.keys(fetchedProfiles).forEach(uid => {
                updatedAiProfiles[uid] = fetchedProfiles[uid];
              });
              updated = true;
            }
          } catch (aiErr) {
            console.error('[Candidates] Lazy AI profiles fetch failed:', aiErr.message);
          }
        }
      }

      // C. Fetch Match Scores
      if (missingPairs.length > 0) {
        for (let i = 0; i < missingPairs.length; i += 50) {
          const chunk = missingPairs.slice(i, i + 50);
          const cIds = chunk.map(p => p.candidate_id);
          const jIds = [...new Set(chunk.map(p => p.job_id))];

          try {
            const msRes = await fetch('/api/employer/match-scores-bulk', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({ candidate_ids: cIds, job_ids: jIds }),
            });
            if (msRes.ok) {
              const msData = await msRes.json();
              const fetchedScores = msData.scores || {};
              Object.keys(fetchedScores).forEach(key => {
                updatedMatchScores[key] = fetchedScores[key];
              });
              updated = true;
            }
          } catch (msErr) {
            console.error('[Candidates] Lazy Match scores fetch failed:', msErr.message);
          }
        }
      }

      if (updated) {
        setProfiles(updatedProfiles);
        setAiProfiles(updatedAiProfiles);
        setMatchScores(updatedMatchScores);
      }
    } catch (err) {
      console.error('Lazy loading details error:', err);
    }
  };

  useEffect(() => {
    if (applications.length > 0) {
      const visibleCandidates = columns.flatMap(col => getColumnCandidates(col.id, false));
      loadMissingDetails(visibleCandidates);
    }
  }, [applications, selectedJobId, searchQuery, visibleCounts, getColumnCandidates]);

  const handleColumnDrop = (appId, targetColId) => {
    const app = applications.find(c => c.id === appId);
    if (!app) return;
    const candidate = enrichCandidate(app);
    const currentStatus = (candidate.status || 'Pending').toLowerCase();
    const isSameColumn = (
      (targetColId === 'Pending'   && currentStatus === 'pending') ||
      (targetColId === 'Viewed'    && currentStatus === 'viewed') ||
      (targetColId === 'Interview' && ['interview', 'interview-confirmed', 'counter-offer'].includes(currentStatus)) ||
      (targetColId === 'Hired'     && currentStatus === 'hired') ||
      (targetColId === 'Rejected'  && ['rejected', 'declined', 'withdrawn'].includes(currentStatus))
    );
    if (isSameColumn) return;

    if (targetColId === 'Interview') {
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
      handleInvite(appId, targetColId);
    }
  };

  // ── Candidate Card (shared between desktop + mobile) ───────────────────────
  const CandidateCard = ({ c, colColor }) => {
    const score = c.ai_score || 0;
    const scoreColor = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
    const subStatus = (c.status || 'Pending').toLowerCase();

    const matchKey = `${c.candidate_id}_${c.job_id}`;
    const scoreLoaded = !!matchScores[matchKey];
    const aiLoaded = !!aiProfiles[c.candidate_id];

    return (
      <div
        draggable={!isMobile}
        onDragStart={!isMobile ? (e) => {
          e.dataTransfer.setData('text/plain', c.id);
          setDraggedAppId(c.id);
        } : undefined}
        onDragEnd={!isMobile ? () => setDraggedAppId(null) : undefined}
        onClick={() => navigate(`/candidates/${c.candidate_id}?jobId=${c.job_id}`)}
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderLeft: `3.5px solid ${colColor}`,
          borderRadius: '10px',
          padding: '10px 12px',
          cursor: isMobile ? 'pointer' : 'grab',
          transition: 'all 0.18s',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          position: 'relative',
          userSelect: 'none',
        }}
        onMouseEnter={!isMobile ? (e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.07)';
        } : undefined}
        onMouseLeave={!isMobile ? (e) => {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.03)';
        } : undefined}
      >
        {/* Top row: avatar + name + score */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <CandidateAvatar userId={c.candidate_id} avatarUrl={c.student_profile?.avatar_url} name={c.student_name} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 'calc(100% - 44px)' }}>
                {c.student_name}
              </span>
              {!scoreLoaded ? (
                <span style={{
                  fontSize: '9px', fontWeight: 700, background: 'var(--border)', color: 'var(--text-muted)',
                  padding: '1px 5px', borderRadius: 4, animation: 'pulse 1.5s infinite', flexShrink: 0
                }}>
                  AI...
                </span>
              ) : (
                <span style={{
                  fontSize: '9px', fontWeight: 800, background: `${scoreColor}14`, color: scoreColor,
                  padding: '1px 5px', borderRadius: 4, border: `1px solid ${scoreColor}22`, flexShrink: 0
                }}>
                  {score}%
                </span>
              )}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', marginTop: 2, letterSpacing: '0.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.job_title}
            </div>
            {!aiLoaded ? (
              <div style={{ width: '80%', height: 10, background: 'var(--border)', borderRadius: 4, marginTop: 5, animation: 'pulse 1.5s infinite' }} />
            ) : c.ai_headline ? (
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                "{biLang(c.ai_headline, lang)}"
              </div>
            ) : null}
          </div>
        </div>

        {/* Sub-status badges */}
        {subStatus === 'interview-confirmed' && c.selected_date && (
          <div style={{ marginTop: 7, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 6, padding: '3px 7px', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 10 }}>✅</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#22c55e' }}>
              {new Date(c.selected_date).toLocaleDateString('sk-SK')} {new Date(c.selected_date).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
        {subStatus === 'counter-offer' && c.selected_date && (
          <div style={{ marginTop: 7, background: 'rgba(255,92,0,0.08)', border: '1px solid rgba(255,92,0,0.15)', borderRadius: 6, padding: '3px 7px', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 10 }}>📅</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)' }}>
              Protinávrh: {new Date(c.selected_date).toLocaleDateString('sk-SK')}
            </span>
          </div>
        )}
        {subStatus === 'interview' && (
          <div style={{ marginTop: 7, background: 'var(--accent-light)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 7px', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 10 }}>⏳</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>
              {lang === 'sk' ? 'Čaká na výber' : 'Awaiting selection'}
            </span>
          </div>
        )}

        {/* Quick action buttons */}
        <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', marginTop: 9, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/candidates/${c.candidate_id}?jobId=${c.job_id}`); }}
            style={{ border: 'none', background: 'var(--bg-card)', color: 'var(--text-muted)', padding: '4px 8px', borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600 }}
          >
            <Eye size={11} />{lang === 'sk' ? 'Profil' : 'Profile'}
          </button>
          <button
            onClick={(e) => handleOpenChat(e, c)}
            style={{ border: 'none', background: 'var(--accent-light)', color: 'var(--accent)', padding: '4px 8px', borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700 }}
          >
            <MessageSquare size={11} />Chat
          </button>
        </div>
      </div>
    );
  };

  // ── Mobile Accordion Column ────────────────────────────────────────────────
  const MobileColumn = ({ col, colCandidates, colCandidatesAll }) => {
    const isOpen = openColumns.includes(col.id);
    return (
      <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--bg-card)' }}>
        {/* Accordion Header */}
        <button
          onClick={() => toggleColumn(col.id)}
          style={{
            width: '100%', padding: '12px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: isOpen ? '1px solid var(--border)' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: col.color, flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text)' }}>
              {col.label}
            </span>
            <span style={{ fontSize: 11, background: 'var(--border)', padding: '1px 8px', borderRadius: 20, fontWeight: 800, color: 'var(--text-muted)' }}>
              {colCandidatesAll.length}
            </span>
          </div>
          <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={16} color="var(--text-muted)" />
          </motion.div>
        </button>

        {/* Accordion Body */}
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              key="body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {colCandidatesAll.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px', opacity: 0.5, fontSize: 12, color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 8 }}>
                    {lang === 'sk' ? 'Žiadni uchádzači' : 'No candidates'}
                  </div>
                ) : (
                  <>
                    {colCandidates.map(c => (
                      <CandidateCard key={c.id} c={enrichCandidate(c)} colColor={col.color} />
                    ))}
                    {colCandidatesAll.length > colCandidates.length && (
                      <button
                        onClick={() => {
                          setVisibleCounts(prev => ({
                            ...prev,
                            [col.id]: prev[col.id] + 12
                          }));
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          background: 'none',
                          border: '1px dashed var(--border)',
                          borderRadius: 10,
                          color: 'var(--accent)',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.2s',
                          marginTop: 4,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--accent-light)';
                          e.currentTarget.style.borderColor = 'var(--accent)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'none';
                          e.currentTarget.style.borderColor = 'var(--border)';
                        }}
                      >
                        {lang === 'sk'
                          ? `+ Zobraziť viac (${colCandidatesAll.length - colCandidates.length})`
                          : `+ Show more (${colCandidatesAll.length - colCandidates.length})`}
                      </button>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="kanban-fullpage" style={{ animation: 'tabSlideIn 0.3s cubic-bezier(0.4, 0, 0.15, 1)' }}>
      {/* ── Header ── */}
      <div style={{ padding: '16px 20px 10px', flexShrink: 0 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? 22 : 24, fontWeight: 400, margin: 0 }}>
          {t('candTitle')}
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          {lang === 'sk' ? 'Správa uchádzačov cez náborový lievik.' : 'Manage applicants through your recruitment pipeline.'}
        </p>
      </div>

      {/* ── Filters Row (Search + Job Selector) ── */}
      <div style={{
        margin: '8px 20px 16px',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        gap: 12,
        flexShrink: 0
      }}>
        {/* Search Input */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 14px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 16, height: 16, color: 'var(--text-muted)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder={lang === 'sk' ? 'Meno, pozícia...' : 'Name, job title...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, border: 'none', background: 'none', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', color: 'var(--text)' }}
          />
        </div>

        {/* Job Filter Dropdown */}
        <div style={{
          position: 'relative',
          minWidth: isMobile ? '100%' : '260px',
        }}>
          <select
            value={selectedJobId}
            onChange={(e) => {
              setSelectedJobId(e.target.value);
              // Reset column pagination limits to default when changing filter
              setVisibleCounts({ Pending: 12, Viewed: 12, Interview: 12, Hired: 12, Rejected: 12 });
            }}
            style={{
              width: '100%',
              padding: '9px 36px 9px 14px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text)',
              fontSize: 13,
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23888888' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 12px center',
              backgroundSize: '14px',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
          >
            <option value="all">
              {lang === 'sk' ? 'Všetky ponuky' : 'All Jobs'} ({applications.length})
            </option>
            {jobs.map(job => {
              const count = applications.filter(a => a.job_id === job.id).length;
              return (
                <option key={job.id} value={job.id}>
                  {job.title} ({count})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
          {lang === 'sk' ? 'Načítavam...' : 'Loading...'}
        </div>
      )}

      {/* ── Board ── */}
      {!loading && (
        isMobile ? (
          /* ─── MOBILE: Accordion Stack ─── */
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {columns.map(col => (
              <MobileColumn
                key={col.id}
                col={col}
                colCandidates={getColumnCandidates(col.id, false)}
                colCandidatesAll={getColumnCandidates(col.id, true)}
              />
            ))}
          </div>
        ) : (
          /* ─── DESKTOP: Horizontal Kanban ─── */
          <div
            className="kanban-scroll"
            style={{
              flex: 1,
              overflowX: 'auto',
              overflowY: 'hidden',
              padding: '0 20px 24px',
            }}
          >
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, minmax(200px, 1fr))',
              gap: 12,
              height: '100%',
              minWidth: 900,
            }}>
              {columns.map(col => {
                const colCandidates = getColumnCandidates(col.id, false);
                const colCandidatesAll = getColumnCandidates(col.id, true);
                const isDraggingOver = dragOverColumn === col.id;

                return (
                  <div
                    key={col.id}
                    onDragOver={(e) => { e.preventDefault(); if (dragOverColumn !== col.id) setDragOverColumn(col.id); }}
                    onDragLeave={() => setDragOverColumn(null)}
                    onDrop={(e) => {
                      setDragOverColumn(null);
                      const appId = e.dataTransfer.getData('text/plain');
                      if (appId) handleColumnDrop(appId, col.id);
                    }}
                    style={{
                      background: isDraggingOver ? 'rgba(255, 92, 0, 0.02)' : 'var(--bg-card)',
                      border: isDraggingOver ? '1.5px dashed var(--accent)' : '1px solid var(--border)',
                      borderRadius: 14,
                      padding: '12px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      overflow: 'hidden',
                      transition: 'all 0.18s ease',
                      boxShadow: isDraggingOver ? '0 0 12px rgba(255,92,0,0.06) inset' : 'none',
                    }}
                  >
                    {/* Column Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 8, flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: col.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text)' }}>
                          {col.label}
                        </span>
                      </div>
                      <span style={{ fontSize: 10, background: 'var(--border)', padding: '1px 7px', borderRadius: 20, fontWeight: 800, color: 'var(--text-muted)' }}>
                        {colCandidatesAll.length}
                      </span>
                    </div>

                    {/* Cards */}
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {colCandidatesAll.length === 0 ? (
                        <div style={{
                          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          border: '1px dashed var(--border)', borderRadius: 10, padding: '20px 12px', opacity: 0.4, textAlign: 'center', minHeight: 120
                        }}>
                          <span style={{ fontSize: 20, marginBottom: 6 }}>📥</span>
                          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>
                            {lang === 'sk' ? 'Potiahnite sem' : 'Drop here'}
                          </span>
                        </div>
                      ) : (
                        <>
                          {colCandidates.map(c => (
                            <CandidateCard key={c.id} c={enrichCandidate(c)} colColor={col.color} />
                          ))}
                          {colCandidatesAll.length > colCandidates.length && (
                            <button
                              onClick={() => {
                                setVisibleCounts(prev => ({
                                  ...prev,
                                  [col.id]: prev[col.id] + 12
                                }));
                              }}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                background: 'none',
                                border: '1px dashed var(--border)',
                                borderRadius: 10,
                                color: 'var(--accent)',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                                textAlign: 'center',
                                transition: 'all 0.2s',
                                marginTop: 4,
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--accent-light)';
                                e.currentTarget.style.borderColor = 'var(--accent)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'none';
                                e.currentTarget.style.borderColor = 'var(--border)';
                              }}
                            >
                              {lang === 'sk'
                                ? `+ Zobraziť viac (${colCandidatesAll.length - colCandidates.length})`
                                : `+ Show more (${colCandidatesAll.length - colCandidates.length})`}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* ── Modals ── */}

      {/* Date Picker */}
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

      {/* Reject Confirm */}
      <AnimatePresence>
        {activeRejectApp && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: 16 }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              style={{ width: '100%', maxWidth: 380, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}
            >
              <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800 }}>{lang === 'sk' ? 'Odmietnuť kandidáta?' : 'Reject candidate?'}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 18px' }}>
                {lang === 'sk'
                  ? `Naozaj chcete zamietnuť ${activeRejectApp.student_name}? Kandidát bude automaticky upovedomený.`
                  : `Reject ${activeRejectApp.student_name}? They will be automatically notified.`}
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setActiveRejectApp(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'none', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}>
                  {lang === 'sk' ? 'Zrušiť' : 'Cancel'}
                </button>
                <button onClick={() => { handleInvite(activeRejectApp.id, 'Rejected'); setActiveRejectApp(null); }}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#ef4444', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                  {lang === 'sk' ? 'Zamietnuť' : 'Reject'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hire Confirm */}
      <AnimatePresence>
        {activeHireApp && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: 16 }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              style={{ width: '100%', maxWidth: 380, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}
            >
              <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800 }}>{lang === 'sk' ? 'Potvrdiť prijatie?' : 'Confirm hiring?'}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 18px' }}>
                {lang === 'sk'
                  ? `Chcete označiť ${activeHireApp.student_name} ako úspešne prijatého?`
                  : `Mark ${activeHireApp.student_name} as successfully hired?`}
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setActiveHireApp(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'none', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}>
                  {lang === 'sk' ? 'Zrušiť' : 'Cancel'}
                </button>
                <button onClick={() => { handleInvite(activeHireApp.id, 'Hired'); setActiveHireApp(null); }}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#22c55e', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                  {lang === 'sk' ? 'Prijať' : 'Hire'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Toast message={toastMsg} show={showToast} onHide={() => setShowToast(false)} />

      <style>{`
        .kanban-scroll {
          scrollbar-width: thin;
          scrollbar-color: var(--border) transparent;
        }
        .kanban-scroll::-webkit-scrollbar { height: 6px; }
        .kanban-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        .kanban-scroll::-webkit-scrollbar-track { background: transparent; }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Candidates;
