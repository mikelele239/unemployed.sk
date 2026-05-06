import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useJobs } from '../hooks/useJobs';
import { supabase } from '../supabase';
import SwipeCard from '../components/SwipeCard';
import JobDetail from '../components/JobDetail';
import { useApplications } from '../hooks/useApplications';
import { useTranslation } from '../I18nContext';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';

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

  // Track ALL dismissed jobs (both liked and skipped) in localStorage
  const [dismissedIds, setDismissedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('unemployed_dismissed')) || []; } catch { return []; }
  });

  const dismissJob = (jobId) => {
    setDismissedIds(prev => {
      if (prev.includes(jobId)) return prev;
      const next = [...prev, jobId];
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

  useEffect(() => {
    if (!loading) {
      const filtered = jobs.filter(j => !dismissedIds.includes(j.id) && !hasApplied(j.id));
      setCards([...filtered].reverse());
      if (filtered.length > 0) {
        logJobView(filtered[0]?.id);
        trackPresence(filtered[0]?.id);
      }
    }
  }, [loading, jobs, applications]);

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
      <div style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '24px 32px 16px', borderBottom: '1px solid var(--border)' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, letterSpacing: '-0.5px' }}>
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
              style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 380px', gap: 0, overflow: 'hidden' }}
            >
              {/* ── LEFT COLUMN: Job Details ──────────────────── */}
              <div style={{ overflowY: 'auto', padding: '32px', borderRight: '1px solid var(--border)' }}>
                {/* Company + Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 16, background: currentJob.color || 'var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 850, color: '#fff', fontSize: 22, flexShrink: 0,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
                  }}>{currentJob.logo || currentJob.company?.charAt(0)}</div>
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

                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.3px', marginBottom: 16 }}>
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
                  display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28,
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
                    <p style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--text)', whiteSpace: 'pre-line' }}>
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
                    <p style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--text)', whiteSpace: 'pre-line' }}>
                      {currentJob.requirements}
                    </p>
                  </div>
                )}
              </div>

              {/* ── RIGHT COLUMN: Map + Actions ──────────────── */}
              <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', overflow: 'hidden' }}>
                {/* Map */}
                <div style={{ height: 240, flexShrink: 0, position: 'relative' }}>
                  {currentJob.lat && currentJob.lng ? (
                    <MapContainer
                      key={`desk-${currentJob.id}`}
                      center={[Number(currentJob.lat), Number(currentJob.lng)]}
                      zoom={13}
                      style={{ height: '100%', width: '100%' }}
                      zoomControl={false}
                      dragging={false}
                      scrollWheelZoom={false}
                      attributionControl={false}
                    >
                      <TileLayer url={document.documentElement.getAttribute('data-theme') === 'light'
                        ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
                        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'} />
                      <Marker position={[Number(currentJob.lat), Number(currentJob.lng)]} />
                    </MapContainer>
                  ) : (
                    <div style={{ height: '100%', background: 'var(--bg-card-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                      {t('card.unknownLocation')}
                    </div>
                  )}
                  {/* Location badge */}
                  <div style={{
                    position: 'absolute', bottom: 12, left: 12, zIndex: 10,
                    background: 'var(--bg-card)', backdropFilter: 'blur(12px)',
                    padding: '8px 14px', borderRadius: 12,
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 13, fontWeight: 700, color: 'var(--text)',
                    border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    {currentJob.location || 'Unknown'}
                  </div>
                </div>

                {/* Rate Card */}
                <div style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 8 }}>
                    {lang === 'sk' ? 'Odmena' : 'Compensation'}
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 32, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>
                    {currentJob.rate || '—'}
                    <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600, marginLeft: 6 }}>{currentJob.rateUnit || ''}</span>
                  </div>
                  {currentJob.hours && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>{currentJob.hours}</div>
                  )}
                </div>

                {/* Job stats quick info */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {currentJob.duration && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)' }}>{lang === 'sk' ? 'Trvanie' : 'Duration'}</span>
                      <span style={{ fontWeight: 600 }}>{currentJob.duration}</span>
                    </div>
                  )}
                  {currentJob.type && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)' }}>{lang === 'sk' ? 'Typ' : 'Type'}</span>
                      <span style={{ fontWeight: 600 }}>{currentJob.type}</span>
                    </div>
                  )}

                </div>

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Action Buttons */}
                <div style={{ padding: '24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 12 }}>
                  <button
                    onClick={() => handleSwipe('left', currentJob)}
                    style={{
                      flex: 1, padding: '16px', borderRadius: 16,
                      border: '1px solid var(--border)', background: 'transparent',
                      color: 'var(--text-muted)', fontSize: 15, fontWeight: 700,
                      cursor: 'pointer', transition: 'all 0.2s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                    }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = '#ff4747'; e.currentTarget.style.color = '#ff4747'; }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    {lang === 'sk' ? 'Preskočiť' : 'Skip'}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleLike(currentJob.id); }}
                    style={{
                      width: 56, padding: '16px 0', borderRadius: 16,
                      border: likedJobIds.has(currentJob.id) ? '2px solid #ef4444' : '1px solid var(--border)',
                      background: likedJobIds.has(currentJob.id) ? 'rgba(239,68,68,0.08)' : 'transparent',
                      color: likedJobIds.has(currentJob.id) ? '#ef4444' : 'var(--text-muted)',
                      fontSize: 18, cursor: 'pointer', transition: 'all 0.2s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill={likedJobIds.has(currentJob.id) ? '#ef4444' : 'none'} stroke="currentColor" strokeWidth="2.5">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => handleSwipe('right', currentJob)}
                    style={{
                      flex: 2, padding: '16px', borderRadius: 16,
                      border: 'none', background: 'linear-gradient(135deg, #FF8C32, #FF5C00)',
                      color: '#fff', fontSize: 15, fontWeight: 700,
                      cursor: 'pointer', transition: 'all 0.2s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: '0 6px 24px rgba(255,92,0,0.35)'
                    }}
                    onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    {lang === 'sk' ? 'Mám záujem' : "I'm interested"}
                  </button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}

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
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800 }}>{t('foryou.title')}</h1>
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
