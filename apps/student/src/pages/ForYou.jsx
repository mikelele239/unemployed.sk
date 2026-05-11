import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useJobs } from '../hooks/useJobs';
import { supabase, getAccessToken } from '../supabase';
import SwipeCard from '../components/SwipeCard';
import JobDetail from '../components/JobDetail';
import { useApplications } from '../hooks/useApplications';
import { useTranslation } from '../I18nContext';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';

// ── Bilingual helpers ──
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
function biLangArr(arr, lang) {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => biLang(item, lang)).filter(Boolean);
}

// ── Match band helpers ──
function getScoreBand(score) {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'E';
}
const BAND_CONFIG = {
  A: { sk: 'Silná zhoda', en: 'Strong fit', color: '#22c55e', icon: '🟢', gradient: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))' },
  B: { sk: 'Dobrá zhoda', en: 'Good fit', color: '#3b82f6', icon: '🔵', gradient: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.04))' },
  C: { sk: 'Potenciálna zhoda', en: 'Potential fit', color: '#f59e0b', icon: '🟡', gradient: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))' },
  D: { sk: 'Čiastočná zhoda', en: 'Partial fit', color: '#f97316', icon: '🟠', gradient: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(249,115,22,0.04))' },
  E: { sk: 'Nízka zhoda', en: 'Low fit', color: '#ef4444', icon: '🔴', gradient: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))' },
};

const ELIGIBILITY_CONFIG = {
  eligible:      { sk: 'Spĺňaš požiadavky', en: 'You qualify', icon: '✅', color: '#22c55e' },
  near_miss:     { sk: 'Takmer spĺňaš',     en: 'Almost there', icon: '🔶', color: '#f59e0b' },
  not_eligible:  { sk: 'Nespĺňaš',          en: 'Not eligible', icon: '❌', color: '#ef4444' },
};

const INSIGHT_ICONS = {
  strength:  { icon: '💪', color: '#22c55e' },
  moderate:  { icon: '📊', color: '#f59e0b' },
  gap:       { icon: '📉', color: '#ef4444' },
  transfer:  { icon: '🔄', color: '#8b5cf6' },
  trainable: { icon: '🎓', color: '#3b82f6' },
  info:      { icon: '💡', color: 'var(--text-muted)' },
};

export default function ForYou() {
  const { t, lang } = useTranslation();
  const navigate = useNavigate();
  const { jobs, loading } = useJobs(true);
  const [cards, setCards] = useState([]);
  const [profile, setProfile] = useState({});
  const [selectedJob, setSelectedJob] = useState(null);
  const [toast, setToast] = useState(false);
  const { addApplication, hasApplied, applications } = useApplications();
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  const [matchScores, setMatchScores] = useState({});
  const [showMatchDrawer, setShowMatchDrawer] = useState(false);

  // Track ALL dismissed jobs (both liked and skipped) in localStorage — capped at 500
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('unemployed_dismissed')) || [];
      // Prune if over limit
      if (stored.length > 500) {
        const pruned = stored.slice(-500);
        localStorage.setItem('unemployed_dismissed', JSON.stringify(pruned));
        return pruned;
      }
      return stored;
    } catch { return []; }
  });

  const dismissJob = (jobId) => {
    setDismissedIds(prev => {
      if (prev.includes(jobId)) return prev;
      // Keep only the last 499 + new one = 500 max
      const trimmed = prev.length >= 500 ? prev.slice(-499) : prev;
      const next = [...trimmed, jobId];
      try { localStorage.setItem('unemployed_dismissed', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Track which jobs we've already logged a view for in this session
  const viewedJobsRef = React.useRef(new Set());

  const logJobView = async (jobId) => {
    if (!jobId || viewedJobsRef.current.has(jobId)) return;
    viewedJobsRef.current.add(jobId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from('job_views').insert({
          job_id: jobId,
          viewer_id: session.user.id,
        });
      }
    } catch {}
  };

  // ── Presence: track student viewing a specific job ──
  const presenceChannelRef = React.useRef(null);
  const trackPresence = (jobId) => {
    // Clean up previous channel
    if (presenceChannelRef.current) {
      supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
    }
    if (!jobId) return;
    const channel = supabase.channel(`job_room:${jobId}`);
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ online_at: new Date().toISOString() });
      }
    });
    presenceChannelRef.current = channel;
  };

  // Cleanup presence on unmount
  React.useEffect(() => {
    return () => {
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
      }
    };
  }, []);

  // Fetch match scores once
  useEffect(() => {
    const fetchScores = async () => {
      try {
        const token = getAccessToken();
        if (!token) return;
        const res = await fetch('/api/match-scores', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
          const { scores } = await res.json();
          const map = {};
          (scores || []).forEach(s => { map[s.job_id] = s; });
          setMatchScores(map);
        }
      } catch (e) { console.warn('[ForYou] Match scores fetch:', e.message); }
    };
    fetchScores();
  }, []);

  useEffect(() => {
    if (!loading) {
      const filtered = jobs.filter(j => !dismissedIds.includes(j.id) && !hasApplied(j.id));

      // Enrich with match scores and sort: eligible first, then by score desc
      const enriched = filtered.map(j => ({
        ...j,
        match: matchScores[j.id] || null,
      }));

      enriched.sort((a, b) => {
        const aE = a.match?.eligible !== false ? 1 : 0;
        const bE = b.match?.eligible !== false ? 1 : 0;
        if (aE !== bE) return bE - aE;
        const aS = a.match?.overall_score || 0;
        const bS = b.match?.overall_score || 0;
        if (aS !== bS) return bS - aS;
        return new Date(b.created_at) - new Date(a.created_at);
      });

      setCards([...enriched].reverse());
      if (enriched.length > 0) {
        logJobView(enriched[0]?.id);
        trackPresence(enriched[0]?.id);
      }
    }
  }, [loading, jobs, applications, matchScores]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (data) {
          setProfile({ name: `${data.first_name || ''} ${data.last_name || ''}`.trim() });
        }
      } catch (err) {
        console.error('Profile fetch error:', err);
      }
    };
    fetchProfile();
  }, []);

  const handleSwipe = (direction, job) => {
    // Always dismiss the job so it never reappears
    dismissJob(job.id);
    setShowMatchDrawer(false);

    if (direction === 'right') {
      addApplication(job);
      setToast(true);
      setTimeout(() => setToast(false), 2200);
    }
    const nextCards = cards.filter(c => c.id !== job.id);
    setCards(nextCards);
    if (nextCards.length > 0) {
      logJobView(nextCards[nextCards.length - 1].id);
      trackPresence(nextCards[nextCards.length - 1].id);
    } else {
      trackPresence(null); // no more cards, leave presence
    }
  };

  const handleApplyFromDetail = (job) => {
    addApplication(job);
    setToast(true);
    setTimeout(() => setToast(false), 2200);
  };

  // ── Like system ─────────────────────────────────────────────────────────
  const [likedJobIds, setLikedJobIds] = useState(new Set());

  useEffect(() => {
    const fetchLikes = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from('job_likes')
        .select('job_id')
        .eq('user_id', session.user.id);
      if (data) setLikedJobIds(new Set(data.map(r => r.job_id)));
    };
    fetchLikes();
  }, []);

  const toggleLike = async (jobId) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const uid = session.user.id;

    if (likedJobIds.has(jobId)) {
      // Unlike
      setLikedJobIds(prev => { const next = new Set(prev); next.delete(jobId); return next; });
      await supabase.from('job_likes').delete().eq('job_id', jobId).eq('user_id', uid);
    } else {
      // Like
      setLikedJobIds(prev => new Set(prev).add(jobId));
      await supabase.from('job_likes').insert({ job_id: jobId, user_id: uid }).select();
    }
  };

  const currentJob = cards.length > 0 ? cards[cards.length - 1] : null;

  // ═══════════════════════════════════════════════════════════════════════
  // DESKTOP LAYOUT — Two-column grid with details left, map+actions right
  // ═══════════════════════════════════════════════════════════════════════
  if (isDesktop) {
    return (
      <div style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{ padding: '24px 32px 16px', borderBottom: '1px solid var(--border)' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 400, letterSpacing: '-0.5px' }}>
            {t('foryou.title')}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
            {t('foryou.subtitle')}{profile.name ? profile.name.split(' ')[0] : t('foryou.defaultName')}
            {cards.length > 0 && <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>
              {cards.length} {lang === 'sk' ? (cards.length === 1 ? 'pozícia' : cards.length < 5 ? 'pozície' : 'pozícií') : (cards.length === 1 ? 'job left' : 'jobs left')}
            </span>}
          </p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)' }}>
            <div className="typing-cursor" style={{ width: 30, height: 30, marginBottom: 12 }}></div>
            <p style={{ fontSize: 14 }}>{t('foryou.loading')}</p>
          </div>
        ) : !currentJob ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 48, marginBottom: 16 }}>👍</span>
            <h3 style={{ fontSize: 22, color: 'var(--text)', fontWeight: 700, marginBottom: 6 }}>{t('foryou.empty')}</h3>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{t('foryou.emptyDesc')}</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentJob.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 340px)', gap: 0, overflow: 'hidden', maxWidth: '100%' }}
            >
              {/* ── LEFT COLUMN: Job Details ──────────────────── */}
              <div style={{ overflowY: 'auto', overflowX: 'hidden', padding: '32px', borderRight: '1px solid var(--border)', minWidth: 0 }}>
                {/* Company + Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                  {currentJob.logo_url ? (
                    <img src={currentJob.logo_url} alt={currentJob.company} style={{
                      width: 56, height: 56, borderRadius: 16, objectFit: 'cover', flexShrink: 0,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
                    }} />
                  ) : (
                    <div style={{
                      width: 56, height: 56, borderRadius: 16, background: currentJob.color || 'var(--accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 850, color: '#fff', fontSize: 22, flexShrink: 0,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
                    }}>{currentJob.logo || currentJob.company?.charAt(0) || '?'}</div>
                  )}
                  <div>
                    <div 
                      onClick={() => navigate(`/company/${encodeURIComponent(currentJob.company)}`)}
                      style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent)', cursor: 'pointer', transition: 'all 0.2s', textDecoration: 'underline', textDecorationColor: 'transparent', textUnderlineOffset: '3px' }}
                      onMouseEnter={e => { e.target.style.textDecorationColor = 'var(--accent)'; e.target.style.opacity = '0.8'; }}
                      onMouseLeave={e => { e.target.style.textDecorationColor = 'transparent'; e.target.style.opacity = '1'; }}
                    >{currentJob.company}</div>
                    <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                      {t('card.verified')}
                    </div>
                  </div>
                </div>

                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, lineHeight: 1.15, letterSpacing: '-0.3px', marginBottom: 16 }}>
                  {currentJob.title}
                </h2>

                {/* Tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                  {(currentJob.tags || []).map((tag, i) => (
                    <span key={tag} style={{
                      padding: '6px 16px', borderRadius: 100, fontSize: 12, fontWeight: 700,
                      background: i === 0 ? 'var(--accent)' : 'var(--bg-card-hover)',
                      color: i === 0 ? '#fff' : 'var(--text-muted)',
                      border: i === 0 ? 'none' : '1px solid var(--border)'
                    }}>{tag}</span>
                  ))}
                </div>

                {/* Highlights Grid */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 12, marginBottom: 28,
                  background: 'var(--bg-card)', padding: 16, borderRadius: 16, border: '1px solid var(--border)'
                }}>
                  {[
                    { icon: '💰', label: lang === 'sk' ? 'Odmena' : 'Pay', value: `${currentJob.rate || '—'} ${currentJob.rateUnit || ''}` },
                    { icon: '🕐', label: lang === 'sk' ? 'Úväzok' : 'Hours', value: currentJob.hours || '—' },
                    { icon: '📍', label: lang === 'sk' ? 'Model' : 'Model', value: currentJob.workModel || 'On-site' },
                    { icon: '📅', label: lang === 'sk' ? 'Nástup' : 'Start', value: currentJob.startDate || (lang === 'sk' ? 'Dohodou' : 'Flexible') },
                  ].map(item => (
                    <div key={item.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 20, marginBottom: 6 }}>{item.icon}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                {/* Description */}
                {currentJob.description && (
                  <div style={{ marginBottom: 28 }}>
                    <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 10 }}>
                      {lang === 'sk' ? 'Popis pozície' : 'Job Description'}
                    </h4>
                    <p style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--text)', whiteSpace: 'pre-line', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                      {currentJob.description}
                    </p>
                  </div>
                )}

                {/* Requirements */}
                {currentJob.requirements && (
                  <div style={{ marginBottom: 28 }}>
                    <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 10 }}>
                      {t('detail.requirements')}
                    </h4>
                    <p style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--text)', whiteSpace: 'pre-line', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                      {currentJob.requirements}
                    </p>
                  </div>
                )}
              </div>

              {/* ── RIGHT COLUMN: Compact, no scroll ──────────── */}
              <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', overflow: 'hidden', minWidth: 0 }}>
                {/* Map — compact */}
                <div style={{ height: 160, flexShrink: 0, position: 'relative' }}>
                  {currentJob.lat && currentJob.lng ? (
                    <MapContainer key={`desk-${currentJob.id}`} center={[Number(currentJob.lat), Number(currentJob.lng)]} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false} dragging={false} scrollWheelZoom={false} attributionControl={false}>
                      <TileLayer url={document.documentElement.getAttribute('data-theme') === 'light' ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'} />
                      <Marker position={[Number(currentJob.lat), Number(currentJob.lng)]} />
                    </MapContainer>
                  ) : (
                    <div style={{ height: '100%', background: 'var(--bg-card-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>{t('card.unknownLocation')}</div>
                  )}
                  <div style={{ position: 'absolute', bottom: 8, left: 8, zIndex: 10, background: 'var(--bg-card)', backdropFilter: 'blur(12px)', padding: '6px 10px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--text)', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {currentJob.location || 'Unknown'}
                  </div>
                </div>

                {/* Rate + Hours inline */}
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 26, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>
                      {currentJob.rate || '—'}<span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginLeft: 4 }}>{currentJob.rateUnit || ''}</span>
                    </div>
                  </div>
                  {currentJob.hours && <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{currentJob.hours}</span>}
                </div>

                {/* Quick stats — inline row */}
                {(currentJob.duration || currentJob.type) && (
                  <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16 }}>
                    {currentJob.duration && <div style={{ fontSize: 12 }}><span style={{ color: 'var(--text-muted)' }}>{lang === 'sk' ? 'Trvanie: ' : 'Duration: '}</span><span style={{ fontWeight: 600 }}>{currentJob.duration}</span></div>}
                    {currentJob.type && <div style={{ fontSize: 12 }}><span style={{ color: 'var(--text-muted)' }}>{lang === 'sk' ? 'Typ: ' : 'Type: '}</span><span style={{ fontWeight: 600 }}>{currentJob.type}</span></div>}
                  </div>
                )}

                {/* AI Match — Enhanced V3 section with insights, eligibility, and summary */}
                {currentJob.match && typeof currentJob.match.overall_score === 'number' && (
                  <div style={{ borderBottom: '1px solid var(--border)', overflow: 'hidden' }}>
                    {(() => {
                      const score = currentJob.match.overall_score;
                      const band = currentJob.match.match_band || getScoreBand(score);
                      const bc = BAND_CONFIG[band] || BAND_CONFIG['C'];
                      const tier = currentJob.match.eligibility_tier || (currentJob.match.eligible !== false ? 'eligible' : 'not_eligible');
                      const tierCfg = ELIGIBILITY_CONFIG[tier] || ELIGIBILITY_CONFIG.eligible;
                      const insights = currentJob.match.insights || [];
                      const summary = currentJob.match.executive_summary;
                      return (
                        <>
                          {/* Header + Details button */}
                          <div style={{ padding: '14px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                              {lang === 'sk' ? 'AI Zhoda' : 'AI Match'}
                            </div>
                            {(currentJob.match.breakdown || currentJob.match.gaps?.length || currentJob.match.match_reasons?.length) && (
                              <button onClick={() => setShowMatchDrawer(true)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px', fontSize: 10, fontWeight: 700, color: 'var(--accent)', cursor: 'pointer', transition: 'all 0.2s' }}
                                onMouseOver={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#fff'; }}
                                onMouseOut={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--accent)'; }}
                              >{lang === 'sk' ? 'Detail ›' : 'Details ›'}</button>
                            )}
                          </div>

                          {/* Score + Band + Eligibility */}
                          <div style={{ padding: '10px 20px 12px', background: bc.gradient, margin: '8px 12px', borderRadius: 14, border: `1px solid ${bc.color}22` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                              <div>
                                <span style={{ fontFamily: 'var(--font-body)', fontSize: 28, fontWeight: 800, lineHeight: 1, color: bc.color }}>{score}%</span>
                                <div style={{ fontSize: 10, fontWeight: 700, color: bc.color, marginTop: 2 }}>{bc.icon} {bc[lang] || bc.sk}</div>
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ height: 6, background: 'var(--bg-card-hover)', borderRadius: 3, overflow: 'hidden' }}>
                                  <div style={{ width: `${score}%`, height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${bc.color}, ${bc.color}cc)`, transition: 'width 0.6s ease' }} />
                                </div>
                              </div>
                            </div>
                            {/* Eligibility tier badge */}
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 8, background: `${tierCfg.color}18`, border: `1px solid ${tierCfg.color}33`, fontSize: 10, fontWeight: 700, color: tierCfg.color }}>
                              <span>{tierCfg.icon}</span> {tierCfg[lang] || tierCfg.en}
                            </div>
                          </div>

                          {/* Executive Summary */}
                          {summary && (
                            <div style={{ padding: '0 20px 10px', fontSize: 11, lineHeight: 1.55, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              "{biLang(summary, lang)}"
                            </div>
                          )}

                          {/* AI Insights */}
                          {insights.length > 0 && (
                            <div style={{ padding: '0 20px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                              {insights.slice(0, 3).map((ins, i) => {
                                const cfg = INSIGHT_ICONS[ins.type] || INSIGHT_ICONS.info;
                                return (
                                  <div key={i} style={{ fontSize: 11, color: 'var(--text)', display: 'flex', alignItems: 'flex-start', gap: 6, lineHeight: 1.45 }}>
                                    <span style={{ flexShrink: 0, fontSize: 11 }}>{cfg.icon}</span>
                                    <span style={{ color: cfg.color, fontWeight: 600 }}>{biLang(ins.text, lang)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Top reason + gap compact */}
                          {(currentJob.match.match_reasons?.[0] || currentJob.match.gaps?.[0]) && (
                            <div style={{ padding: '0 20px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                              {currentJob.match.match_reasons?.[0] && (
                                <div style={{ fontSize: 11, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  <span style={{ flexShrink: 0 }}>✓</span> {biLang(currentJob.match.match_reasons[0], lang)}
                                </div>
                              )}
                              {currentJob.match.gaps?.[0] && (
                                <div style={{ fontSize: 11, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  <span style={{ flexShrink: 0 }}>✕</span> {biLang(currentJob.match.gaps[0], lang)}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Action Buttons */}
                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexShrink: 0 }}>
                  <button onClick={() => handleSwipe('left', currentJob)} style={{ flex: 1, padding: '14px', borderRadius: 14, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = '#ff4747'; e.currentTarget.style.color = '#ff4747'; }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    {lang === 'sk' ? 'Preskočiť' : 'Skip'}
                  </button>
                  <button onClick={() => handleSwipe('right', currentJob)} style={{ flex: 2, padding: '14px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #FF8C32, #FF5C00)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 4px 16px rgba(255,92,0,0.3)' }}
                    onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                    onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    {lang === 'sk' ? 'Mám záujem' : "I'm interested"}
                  </button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
        {/* ── AI Match Details Drawer ── */}
        <AnimatePresence>
          {showMatchDrawer && currentJob?.match && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowMatchDrawer(false)}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 500, backdropFilter: 'blur(4px)' }} />
              <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, maxWidth: '90vw', background: 'var(--bg-card)', zIndex: 501, display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 40px rgba(0,0,0,0.25)', borderLeft: '1px solid var(--border)' }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{lang === 'sk' ? 'AI Zhoda — Detail' : 'AI Match — Details'}</h3>
                  </div>
                  <button onClick={() => setShowMatchDrawer(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                  {/* Score — with band label + eligibility */}
                  {(() => {
                    const s = currentJob.match.overall_score;
                    const band = currentJob.match.match_band || getScoreBand(s);
                    const bc = BAND_CONFIG[band] || BAND_CONFIG['C'];
                    const tier = currentJob.match.eligibility_tier || (currentJob.match.eligible !== false ? 'eligible' : 'not_eligible');
                    const tierCfg = ELIGIBILITY_CONFIG[tier] || ELIGIBILITY_CONFIG.eligible;
                    return (
                      <div style={{ marginBottom: 24, padding: '16px', borderRadius: 16, background: bc.gradient, border: `1px solid ${bc.color}22` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                          <div>
                            <span style={{ fontFamily: 'var(--font-body)', fontSize: 40, fontWeight: 800, color: bc.color }}>{s}%</span>
                            <div style={{ fontSize: 12, fontWeight: 700, color: bc.color, marginTop: 2 }}>{bc.icon} {bc[lang] || bc.sk}</div>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ height: 8, background: 'var(--bg-card-hover)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${s}%`, height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${bc.color}, ${bc.color}cc)`, transition: 'width 0.5s' }} />
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{lang === 'sk' ? 'Celkové skóre zhody' : 'Overall match score'}</div>
                          </div>
                        </div>
                        {/* Eligibility tier badge */}
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 10, background: `${tierCfg.color}18`, border: `1px solid ${tierCfg.color}33`, fontSize: 12, fontWeight: 700, color: tierCfg.color }}>
                          <span>{tierCfg.icon}</span> {tierCfg[lang] || tierCfg.en}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Executive Summary */}
                  {currentJob.match.executive_summary && (
                    <div style={{ marginBottom: 24, padding: '14px 16px', borderRadius: 14, background: 'var(--bg-card-hover)', border: '1px solid var(--border)' }}>
                      <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--accent)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        {lang === 'sk' ? 'Zhrnutie' : 'Summary'}
                      </h4>
                      <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text)', margin: 0, fontStyle: 'italic' }}>
                        "{biLang(currentJob.match.executive_summary, lang)}"
                      </p>
                    </div>
                  )}

                  {/* AI Insights */}
                  {(currentJob.match.insights || []).length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--accent)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        {lang === 'sk' ? 'AI Postrehy' : 'AI Insights'}
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {currentJob.match.insights.map((ins, i) => {
                          const cfg = INSIGHT_ICONS[ins.type] || INSIGHT_ICONS.info;
                          return (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', borderRadius: 10, background: `${cfg.color}0a`, border: `1px solid ${cfg.color}18` }}>
                              <span style={{ flexShrink: 0, fontSize: 14, marginTop: 1 }}>{cfg.icon}</span>
                              <span style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text)', fontWeight: 500, wordBreak: 'break-word' }}>{biLang(ins.text, lang)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Breakdown */}
                  {currentJob.match.breakdown && (
                    <div style={{ marginBottom: 24 }}>
                      <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 12 }}>{lang === 'sk' ? 'Rozklad skóre' : 'Score Breakdown'}</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[
                          { key: 'skills', label: lang === 'sk' ? 'Zručnosti' : 'Skills', max: 30 },
                          { key: 'education', label: lang === 'sk' ? 'Vzdelanie' : 'Education', max: 10 },
                          { key: 'experience_level', label: lang === 'sk' ? 'Skúsenosti' : 'Experience', max: 10 },
                          { key: 'location', label: lang === 'sk' ? 'Lokalita' : 'Location', max: 15 },
                          { key: 'category', label: lang === 'sk' ? 'Kategória' : 'Category', max: 8 },
                          { key: 'language', label: lang === 'sk' ? 'Jazyky' : 'Languages', max: 5 },
                          { key: 'job_type', label: lang === 'sk' ? 'Typ práce' : 'Job Type', max: 10 },
                          { key: 'availability', label: lang === 'sk' ? 'Dostupnosť' : 'Availability', max: 7 },
                          { key: 'salary', label: lang === 'sk' ? 'Plat' : 'Salary', max: 3 },
                          { key: 'work_mode', label: lang === 'sk' ? 'Prac. model' : 'Work Mode', max: 2 },
                        ].map(d => {
                          const val = currentJob.match.breakdown[d.key];
                          if (typeof val !== 'number') return null;
                          const pct = Math.round((val / d.max) * 100);
                          return (
                            <div key={d.key}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                                <span style={{ fontWeight: 600 }}>{d.label}</span>
                                <span style={{ color: pct >= 70 ? 'var(--green)' : pct >= 40 ? '#ffaa00' : '#ef4444', fontWeight: 700 }}>{val}/{d.max} ({pct}%)</span>
                              </div>
                              <div style={{ height: 6, background: 'var(--bg-card-hover)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: pct >= 70 ? 'var(--green)' : pct >= 40 ? '#ffaa00' : '#ef4444', transition: 'width 0.4s' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* Match reasons — bilingual */}
                  {currentJob.match.match_reasons?.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--green)', marginBottom: 8 }}>{lang === 'sk' ? 'Prečo sa hodíš' : 'Why you match'}</h4>
                      {biLangArr(currentJob.match.match_reasons, lang).map((r, i) => (
                        <div key={i} style={{ fontSize: 13, color: 'var(--text)', display: 'flex', gap: 8, marginBottom: 6, lineHeight: 1.5 }}>
                          <span style={{ color: 'var(--green)', flexShrink: 0, marginTop: 2 }}>✓</span>
                          <span style={{ wordBreak: 'break-word' }}>{r}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Gaps — bilingual */}
                  {currentJob.match.gaps?.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#ef4444', marginBottom: 8 }}>{lang === 'sk' ? 'Čo ti chýba' : "What you're missing"}</h4>
                      {biLangArr(currentJob.match.gaps, lang).map((g, i) => (
                        <div key={i} style={{ fontSize: 13, color: 'var(--text)', display: 'flex', gap: 8, marginBottom: 6, lineHeight: 1.5 }}>
                          <span style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }}>✕</span>
                          <span style={{ wordBreak: 'break-word' }}>{g}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              style={{
                position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
                background: 'var(--green)', color: '#fff',
                padding: '14px 28px', borderRadius: 14,
                fontSize: 14, fontWeight: 700, textAlign: 'center',
                zIndex: 60, boxShadow: '0 8px 32px rgba(34,197,94,0.35)',
                whiteSpace: 'nowrap'
              }}
            >
              {t('foryou.toast')}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MOBILE LAYOUT — Swipe cards with tighter spacing
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 16px 6px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 400 }}>{t('foryou.title')}</h1>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('foryou.subtitle')}{profile.name ? profile.name.split(' ')[0] : t('foryou.defaultName')}</p>
      </div>

      <div style={{ position: 'relative', flex: 1, margin: '8px 16px 12px', maxWidth: 420, width: 'calc(100% - 32px)', alignSelf: 'center', perspective: 800 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            <div className="typing-cursor" style={{ width: 30, height: 30, marginBottom: 12 }}></div>
            <p style={{ fontSize: 13 }}>{t('foryou.loading')}</p>
          </div>
        ) : cards.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 40, marginBottom: 12 }}>👍</span>
            <h3 style={{ fontSize: 18, color: 'var(--text)', fontWeight: 700, marginBottom: 4 }}>{t('foryou.empty')}</h3>
            <p style={{ fontSize: 13 }}>{t('foryou.emptyDesc')}</p>
          </div>
        ) : (
          <AnimatePresence>
            {cards.map((job, index) => {
              const cardIndex = cards.length - 1 - index;
              return (
                <SwipeCard 
                  key={job.id} 
                  job={job} 
                  index={cardIndex} 
                  total={cards.length}
                  onSwipe={handleSwipe}
                  onClick={setSelectedJob}
                  onLike={toggleLike}
                  isLiked={likedJobIds.has(job.id)}
                />
              );
            })}
          </AnimatePresence>
        )}
      </div>

      <JobDetail 
        job={selectedJob} 
        isOpen={!!selectedJob} 
        onClose={() => setSelectedJob(null)}
        onApply={(j) => handleApplyFromDetail(j)}
        hasApplied={selectedJob ? hasApplied(selectedJob.id) : false}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            style={{
              position: 'fixed',
              bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
              left: 12, right: 12,
              background: 'var(--green)', color: '#fff',
              padding: '10px 14px', borderRadius: 12,
              fontSize: 12, fontWeight: 600, textAlign: 'center',
              zIndex: 60, boxShadow: '0 4px 20px rgba(34,197,94,0.3)'
            }}
          >
            {t('foryou.toast')}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
