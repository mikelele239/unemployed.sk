import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n, useAppState } from '../contexts';
import { supabase } from '../supabase';
import CandidateAvatar from '../components/CandidateAvatar';
import ModernDatePicker from '../components/ModernDatePicker';
import { getOrCreateConversationForApplication } from '../services/messagingService';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Briefcase, 
  MapPin, 
  User, 
  Mail, 
  Calendar, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Globe, 
  GraduationCap, 
  ChevronRight,
  MessageSquare,
  Award,
  BookOpen,
  CalendarCheck,
  TrendingUp,
  X,
  Phone,
  ShieldCheck,
  ChevronDown
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

// Helper for bilingual arrays
function biLangArr(arr, lang) {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => biLang(item, lang)).filter(Boolean);
}

const BAND_DISPLAY = {
  A: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', icon: '🟢', label: { sk: 'Silná zhoda', en: 'Strong fit' } },
  B: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', icon: '🔵', label: { sk: 'Dobrá zhoda', en: 'Good fit' } },
  C: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '🟡', label: { sk: 'Potenciálna zhoda', en: 'Potential fit' } },
  D: { color: '#f97316', bg: 'rgba(249,115,22,0.1)', icon: '🟠', label: { sk: 'Čiastočná zhoda', en: 'Partial fit' } },
  E: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: '🔴', label: { sk: 'Nízka zhoda', en: 'Low fit' } },
};

function getScoreBand(score) {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'E';
}

const ELIG_DISPLAY = {
  eligible:     { sk: 'Spĺňa podmienky',       en: 'Eligible',      color: '#22c55e', bg: 'rgba(34,197,94,0.1)', icon: '✓' },
  near_miss:    { sk: 'Takmer spĺňa',           en: 'Near miss',     color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '≈' },
  not_eligible: { sk: 'Nespĺňa podmienky',      en: 'Not eligible',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: '✗' },
};

export default function CandidateProfile() {
  const { candidateId } = useParams();
  const [searchParams] = useSearchParams();
  const queryJobId = searchParams.get('jobId');
  
  const { t, lang } = useI18n();
  const { invitedIds, setInvitedIds, refreshAnalytics } = useAppState();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [aiProfile, setAiProfile] = useState(null);
  const [employerJobs, setEmployerJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [matchData, setMatchData] = useState(null);
  const [cvUrl, setCvUrl] = useState(null);
  const [fullscreenCV, setFullscreenCV] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [confirmHire, setConfirmHire] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [verificationData, setVerificationData] = useState(null);
  const [showFullTranscript, setShowFullTranscript] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate('/login');
          return;
        }

        // 1. Fetch main profile
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', candidateId)
          .maybeSingle();
        
        if (profErr) throw profErr;
        if (!prof) {
          setProfile(null);
          setLoading(false);
          return;
        }
        setProfile(prof);

        // 2. Fetch AI profile summary via server endpoint
        try {
          const aiRes = await fetch('/api/employer/ai-profiles', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json', 
              'Authorization': `Bearer ${session.access_token}` 
            },
            body: JSON.stringify({ candidate_ids: [candidateId] }),
          });
          if (aiRes.ok) {
            const aiData = await aiRes.json();
            setAiProfile(aiData.profiles?.[candidateId] || {});
          }
        } catch (err) {
          console.error('[CandidateProfile] Failed to fetch AI Profile:', err);
        }

        // 3. Fetch employer's jobs
        const { data: jobs } = await supabase
          .from('jobs')
          .select('id, title, location')
          .eq('employer_id', session.user.id);
        
        const jobsList = jobs || [];
        setEmployerJobs(jobsList);

        // 4. Fetch candidate's applications for these jobs
        if (jobsList.length > 0) {
          const { data: apps } = await supabase
            .from('applications')
            .select('*')
            .eq('candidate_id', candidateId)
            .in('job_id', jobsList.map(j => j.id));
          
          const appList = apps || [];
          setApplications(appList);

          // Select current application
          let activeApp = null;
          if (queryJobId) {
            activeApp = appList.find(a => a.job_id === queryJobId);
          }
          if (!activeApp && appList.length > 0) {
            activeApp = appList[0]; // Fallback to first application
          }
          setSelectedApp(activeApp);
        }

        // 5. Fetch CV Signed URL
        if (prof.cv_id) {
          try {
            const cvRes = await fetch(`/api/employer/cv/${encodeURIComponent(prof.cv_id)}/signed-url`, {
              headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (cvRes.ok) {
              const cvData = await cvRes.json();
              setCvUrl(cvData.url);
            }
          } catch (cvErr) {
            console.error('[CandidateProfile] CV url fetch failed:', cvErr);
          }
        }

        // 6. Fetch AI verification data
        try {
          const verRes = await fetch(`/api/employer/candidate/${candidateId}/verification`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` },
          });
          if (verRes.ok) {
            const verData = await verRes.json();
            setVerificationData(verData.verification || null);
          }
        } catch (verErr) {
          console.warn('[CandidateProfile] Verification fetch non-fatal:', verErr);
        }
      } catch (err) {
        console.error('[CandidateProfile] Load error:', err);
      } finally {
        setLoading(false);
      }
    };

    if (candidateId) {
      loadData();
    }
  }, [candidateId, queryJobId, navigate]);

  // Load match score whenever selected application changes
  useEffect(() => {
    const loadMatchScore = async () => {
      if (!selectedApp) {
        setMatchData(null);
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const msRes = await fetch('/api/employer/match-scores-bulk', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${session.access_token}` 
          },
          body: JSON.stringify({ 
            candidate_ids: [candidateId], 
            job_ids: [selectedApp.job_id] 
          }),
        });

        if (msRes.ok) {
          const msData = await msRes.json();
          const matchKey = `${candidateId}_${selectedApp.job_id}`;
          setMatchData(msData.scores?.[matchKey] || null);
        }
      } catch (err) {
        console.error('[CandidateProfile] Failed to fetch match score:', err);
      }
    };

    loadMatchScore();
  }, [selectedApp, candidateId]);

  const handleOpenChat = async () => {
    if (!selectedApp) return;
    try {
      const convId = await getOrCreateConversationForApplication(selectedApp.id);
      navigate(`/messages`, { state: { activeConvId: convId } });
    } catch (err) {
      console.error('Failed to open chat:', err);
    }
  };

  const handleUpdateStatus = async (status, interviewDates = null) => {
    if (!selectedApp) return;
    try {
      setActionLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const body = { status };
      if (interviewDates) body.interview_dates = interviewDates;

      const res = await fetch(`/api/employer/candidates/${selectedApp.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        // Update local status
        setSelectedApp(prev => ({
          ...prev,
          status,
          interview_dates: interviewDates || prev.interview_dates
        }));
        setApplications(prev => prev.map(a => a.id === selectedApp.id ? {
          ...a,
          status,
          interview_dates: interviewDates || a.interview_dates
        } : a));
        
        if (status === 'Interview' && !invitedIds.includes(selectedApp.id)) {
          setInvitedIds([...invitedIds, selectedApp.id]);
        }
        
        setConfirmReject(false);
        setConfirmHire(false);
        setShowDatePicker(false);
        refreshAnalytics();
      } else {
        alert('Chyba pri aktualizácii stavu: ' + await res.text());
      }
    } catch (err) {
      console.error('Update status error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReachOut = async (jobId) => {
    try {
      setActionLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const selectedJob = employerJobs.find(j => j.id === jobId);
      const studentName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Kandidát';

      // Insert new application record
      const { data: newApp, error } = await supabase
        .from('applications')
        .insert({
          job_id: jobId,
          candidate_id: candidateId,
          employer_id: session.user.id,
          student_name: studentName,
          student_email: profile.email || '',
          status: 'Pending'
        })
        .select('*')
        .single();

      if (error) throw error;

      // Update state
      setApplications(prev => [newApp, ...prev]);
      setSelectedApp(newApp);
      
      // Auto open chat
      const convId = await getOrCreateConversationForApplication(newApp.id);
      navigate(`/messages`, { state: { activeConvId: convId } });
    } catch (err) {
      console.error('Reach out error:', err);
      alert('Chyba pri oslovení: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ height: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: 16 }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.05)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 14 }}>{lang === 'sk' ? 'Načítavam profil kandidáta...' : 'Loading candidate profile...'}</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        <AlertCircle size={48} style={{ color: '#ef4444', marginBottom: 16 }} />
        <h3>{lang === 'sk' ? 'Uchádzač nebol nájdený' : 'Candidate not found'}</h3>
        <button onClick={() => navigate('/candidates')} style={{ marginTop: 20, padding: '10px 20px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}>
          {lang === 'sk' ? 'Návrat na kandidátov' : 'Back to Candidates'}
        </button>
      </div>
    );
  }

  const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Kandidát';
  const bio = profile.bio || '';
  const locationText = profile.location || aiProfile?.location || '';
  const educationText = profile.education || '';
  const skills = profile.skills || aiProfile?.hard_skills || [];

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
        <button 
          onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
        >
          <ArrowLeft size={16} />
          {lang === 'sk' ? 'Naspäť' : 'Back'}
        </button>
        
        {applications.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
              {lang === 'sk' ? 'Zobraziť pre pozíciu:' : 'View for position:'}
            </span>
            <select 
              value={selectedApp?.id || ''} 
              onChange={(e) => {
                const app = applications.find(a => a.id === e.target.value);
                setSelectedApp(app);
              }}
              style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, fontWeight: 700, outline: 'none' }}
            >
              {applications.map(app => {
                const job = employerJobs.find(j => j.id === app.job_id);
                return (
                  <option key={app.id} value={app.id}>
                    {job?.title || 'Pracovná ponuka'} ({app.status})
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      {/* Main Profile Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) 1fr', gap: 32, alignItems: 'start' }} className="profile-grid-responsive">
        
        {/* Left Side: Avatar, Basic Info, Match & Actions Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Main Info Card */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <CandidateAvatar userId={candidateId} avatarUrl={profile.avatar_url} name={name} size={110} style={{ border: '3px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }} />
            
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', color: 'var(--text)', letterSpacing: '-0.3px' }}>{name}</h2>
              {aiProfile?.ai_headline && (
                <p style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--accent)', fontWeight: 600, margin: '0 0 10px' }}>
                  "{biLang(aiProfile.ai_headline, lang)}"
                </p>
              )}
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', marginTop: 12 }}>
                {locationText && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
                    <MapPin size={14} />
                    <span>{locationText}</span>
                  </div>
                )}
                {profile.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
                    <Mail size={14} />
                    <span style={{ wordBreak: 'break-all' }}>{profile.email}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Application Status Badge */}
            {selectedApp && (
              <div style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{lang === 'sk' ? 'Stav prihlášky:' : 'App Status:'}</span>
                <span style={{ 
                  fontSize: 11, padding: '4px 12px', borderRadius: 6, fontWeight: 800,
                  background: selectedApp.status === 'Hired' ? 'rgba(34,197,94,0.1)' : selectedApp.status === 'Rejected' ? 'rgba(239,68,68,0.1)' : 'rgba(255,92,0,0.1)',
                  color: selectedApp.status === 'Hired' ? '#22c55e' : selectedApp.status === 'Rejected' ? '#ef4444' : 'var(--accent)'
                }}>
                  {selectedApp.status.toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Job Match Score Card */}
          {selectedApp && matchData && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                {lang === 'sk' ? 'Analýza zhody' : 'Match Analysis'}
              </h3>

              {(() => {
                const score = matchData.overall_score || 0;
                const band = matchData.match_band || getScoreBand(score);
                const bandStyle = BAND_DISPLAY[band] || BAND_DISPLAY.E;
                const eligTier = matchData.eligibility_tier || 'eligible';
                const eligStyle = ELIG_DISPLAY[eligTier] || ELIG_DISPLAY.eligible;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      {/* Circular Progress Gauge */}
                      <div style={{ position: 'relative', width: 68, height: 68, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="68" height="68" viewBox="0 0 36 36">
                          <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="rgba(255,255,255,0.05)"
                            strokeWidth="3.5"
                          />
                          <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke={bandStyle.color}
                            strokeWidth="3.5"
                            strokeDasharray={`${score}, 100`}
                          />
                        </svg>
                        <span style={{ position: 'absolute', fontSize: 16, fontWeight: 900, color: bandStyle.color }}>{score}%</span>
                      </div>
                      
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15, color: bandStyle.color }}>
                          {bandStyle.icon} {bandStyle.label[lang]}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {eligStyle[lang]}
                        </div>
                      </div>
                    </div>

                    {/* Breakdown Dimension list */}
                    {matchData.breakdown && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                        {Object.entries(matchData.breakdown)
                          .filter(([, v]) => v > 0)
                          .map(([dim, val]) => {
                            const maxScores = { skills: 30, location: 15, job_type: 10, category: 8, education: 10, experience_level: 10, language: 5 };
                            const pct = Math.min(100, Math.round((val / (maxScores[dim] || 10)) * 100));
                            const barColor = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444';
                            
                            const dimLabels = {
                              skills: { sk: 'Zručnosti', en: 'Skills' },
                              location: { sk: 'Lokácia', en: 'Location' },
                              education: { sk: 'Vzdelanie', en: 'Education' },
                              experience_level: { sk: 'Skúsenosti', en: 'Experience' },
                              language: { sk: 'Jazyky', en: 'Languages' },
                              job_type: { sk: 'Typ práce', en: 'Job Type' },
                              category: { sk: 'Kategória', en: 'Category' },
                            };
                            return (
                              <div key={dim}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                                  <span style={{ color: 'var(--text-muted)' }}>{dimLabels[dim]?.[lang] || dim}</span>
                                  <span style={{ color: barColor, fontWeight: 700 }}>{pct}%</span>
                                </div>
                                <div style={{ height: 4, background: 'var(--bg)', borderRadius: 2, overflow: 'hidden' }}>
                                  <div style={{ width: `${pct}%`, height: '100%', background: barColor }} />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── AI Verification Card ── */}
          {(() => {
            const ATTR_CONFIG = {
              language:    { icon: '🌍', color: '#3b82f6', sk: 'Jazykové znalosti', en: 'Language Skills' },
              skills:      { icon: '💻', color: '#8b5cf6', sk: 'Technické zručnosti', en: 'Technical Skills' },
              experience:  { icon: '💼', color: '#f59e0b', sk: 'Pracovné skúsenosti', en: 'Work Experience' },
              soft_skills: { icon: '🤝', color: '#22c55e', sk: 'Mäkké zručnosti', en: 'Soft Skills' },
            };

            if (!verificationData) {
              return (
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <ShieldCheck size={16} style={{ color: 'var(--text-muted)' }} />
                    <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                      {lang === 'sk' ? 'Overenie profilu' : 'Profile Verification'}
                    </h3>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                    {lang === 'sk' ? 'Kandidát ešte neabsolvoval AI overovací pohovor.' : 'Candidate has not yet completed AI verification.'}
                  </p>
                </div>
              );
            }

            const results = verificationData.results || {};
            const overallPct = Math.round((verificationData.overall_score || 0) * 100);
            const overallColor = overallPct >= 70 ? '#22c55e' : overallPct >= 45 ? '#f59e0b' : '#ef4444';

            return (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldCheck size={16} style={{ color: '#22c55e' }} />
                    <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                      {lang === 'sk' ? 'Overenie profilu' : 'Profile Verification'}
                    </h3>
                  </div>
                  <div style={{
                    fontSize: 14, fontWeight: 900, color: overallColor,
                    background: `${overallColor}15`, border: `1px solid ${overallColor}30`,
                    borderRadius: 100, padding: '2px 10px',
                  }}>
                    {overallPct}%
                  </div>
                </div>

                {/* Per-attribute badges */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {['language', 'skills', 'experience', 'soft_skills'].map(attr => {
                    const r = results[attr];
                    const cfg = ATTR_CONFIG[attr];
                    if (!r) return null;
                    const scorePct = Math.round((r.score || 0) * 100);
                    return (
                      <div key={attr} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '10px 12px', borderRadius: 10,
                        background: r.verified ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.04)',
                        border: `1px solid ${r.verified ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.15)'}`,
                      }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{cfg.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text)' }}>
                              {lang === 'sk' ? cfg.sk : cfg.en}
                            </span>
                            <span style={{
                              fontSize: 10, fontWeight: 800,
                              color: r.verified ? '#22c55e' : '#ef4444',
                              display: 'flex', alignItems: 'center', gap: 3,
                            }}>
                              {r.verified ? '✅' : '⚠️'} {scorePct}%
                            </span>
                          </div>
                          {r.level && (
                            <div style={{ fontSize: 10, color: cfg.color, fontWeight: 700, marginBottom: 3 }}>
                              {r.level}
                            </div>
                          )}
                          {r.summary && (
                            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
                              {r.summary}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Transcript toggle */}
                {verificationData.full_transcript?.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowFullTranscript(v => !v)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'none', border: 'none', color: 'var(--accent)',
                        fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0,
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      <ChevronDown
                        size={14}
                        style={{ transform: showFullTranscript ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                      />
                      {showFullTranscript
                        ? (lang === 'sk' ? 'Skryť prepis' : 'Hide transcript')
                        : (lang === 'sk' ? 'Zobraziť celý prepis' : 'Show full transcript')}
                    </button>

                    {showFullTranscript && (
                      <div style={{
                        marginTop: 10, maxHeight: 280, overflowY: 'auto',
                        background: 'var(--bg)', borderRadius: 10, padding: 12,
                        border: '1px solid var(--border)',
                        display: 'flex', flexDirection: 'column', gap: 8,
                      }}>
                        {verificationData.full_transcript
                          .filter(t => t.role === 'ai' || t.role === 'student')
                          .map((t, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                              <span style={{
                                fontSize: 9, fontWeight: 800, flexShrink: 0, marginTop: 2,
                                color: t.role === 'ai' ? 'var(--accent)' : 'var(--text-muted)',
                                textTransform: 'uppercase', letterSpacing: '0.5px',
                                minWidth: 32,
                              }}>
                                {t.role === 'ai' ? 'AI' : (lang === 'sk' ? 'KAN' : 'CND')}
                              </span>
                              <p style={{ margin: 0, fontSize: 11, color: 'var(--text)', lineHeight: 1.5 }}>
                                {t.text}
                              </p>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Action Panel */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
              {lang === 'sk' ? 'Akcie s kandidátom' : 'Candidate Actions'}
            </h3>

            {selectedApp ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* 1. Chat */}
                <button
                  onClick={handleOpenChat}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 10, border: '1.5px solid var(--accent)', 
                    background: 'var(--accent-light)', color: 'var(--accent)', cursor: 'pointer', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    fontWeight: 700, fontSize: 13, transition: 'all 0.2s'
                  }}
                >
                  <MessageSquare size={16} />
                  {lang === 'sk' ? 'Otvoriť chat' : 'Open Chat'}
                </button>

                {/* 2. Schedule */}
                {!['interview', 'interview-confirmed', 'counter-offer', 'declined', 'hired', 'rejected'].includes((selectedApp.status || '').toLowerCase()) && (
                  <button
                    onClick={() => setShowDatePicker(true)}
                    style={{
                      width: '100%', padding: '12px', borderRadius: 10, border: 'none', 
                      background: 'linear-gradient(135deg, var(--accent) 0%, #FF8C32 100%)', color: '#fff', cursor: 'pointer', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      fontWeight: 700, fontSize: 13
                    }}
                  >
                    <Calendar size={16} />
                    {lang === 'sk' ? 'Naplánovať pohovor' : 'Schedule Interview'}
                  </button>
                )}

                {/* Confirm/Accept/Reject Controls */}
                {selectedApp.status === 'Counter-Offer' && (
                  <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255, 92, 0, 0.04)', border: '1px solid var(--accent)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>PROTINÁVRH TERMÍNU:</div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>
                      {new Date(selectedApp.selected_date).toLocaleString('sk-SK', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => handleUpdateStatus('Interview-Confirmed')} style={{ flex: 1, padding: 8, borderRadius: 6, background: '#22c55e', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Prijať</button>
                      <button onClick={() => setShowDatePicker(true)} style={{ flex: 1, padding: 8, borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Iné termíny</button>
                    </div>
                  </div>
                )}

                {/* Hired / Rejected status details */}
                {selectedApp.status !== 'Hired' && selectedApp.status !== 'Rejected' && selectedApp.status !== 'Declined' && (
                  <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                    <button 
                      onClick={() => setConfirmHire(true)} 
                      style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1.5px solid #22c55e', background: 'rgba(34,197,94,0.05)', color: '#22c55e', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Prijať
                    </button>
                    <button 
                      onClick={() => setConfirmReject(true)} 
                      style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1.5px solid #ef4444', background: 'rgba(239,68,68,0.05)', color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Odmietnuť
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // If candidate has not applied, let employer invite them to one of their active jobs
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {lang === 'sk' ? 'Tento uchádzač sa ešte neprihlásil na žiadnu vašu ponuku.' : 'This candidate has not applied to your offers yet.'}
                </p>
                {employerJobs.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{lang === 'sk' ? 'OSLOVIŤ PRE POZÍCIU:' : 'REACH OUT FOR:'}</span>
                    {employerJobs.map(job => (
                      <button
                        key={job.id}
                        disabled={actionLoading}
                        onClick={() => handleReachOut(job.id)}
                        style={{
                          width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)',
                          background: 'var(--bg-card)', color: 'var(--text)', fontSize: 12, fontWeight: 600,
                          cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}
                      >
                        <span>{job.title}</span>
                        <ChevronRight size={14} style={{ color: 'var(--accent)' }} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 11, color: '#ff5c00', fontWeight: 600 }}>
                    {lang === 'sk' ? 'Nemáte žiadne aktívne ponuky pre oslovenie.' : 'You have no active listings to invite to.'}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: AI Resume Summary, Profile Detail, CV Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          
          {/* Executive Summary Section */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <Sparkles size={18} />
              {lang === 'sk' ? 'AI Analýza a Zhrnutie' : 'AI Analysis & Summary'}
            </h3>
            
            <div style={{ background: 'var(--bg)', padding: 24, borderRadius: 12, border: '1.5px solid var(--border)', borderLeft: '4px solid var(--accent)', lineHeight: '1.7', fontSize: 15, color: 'var(--text)', opacity: 0.9 }}>
              {biLang(aiProfile?.ai_summary || profile.bio, lang) || (
                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {lang === 'sk' ? 'Uchádzač neuviedol žiadne informácie.' : 'No candidate summary available.'}
                </span>
              )}
            </div>

            {/* Strengths & Gaps Row */}
            {selectedApp && matchData && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="grid-responsive cols-1">
                {/* Strengths */}
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 800, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, marginTop: 0 }}>
                    ✓ {lang === 'sk' ? 'Silné stránky' : 'Strengths'}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {biLangArr(matchData.match_reasons || aiProfile?.ai_strengths || [], lang).map((s, i) => (
                      <span key={i} style={{ fontSize: 12, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)', color: '#22c55e', padding: '6px 12px', borderRadius: 8, fontWeight: 600 }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Gaps */}
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, marginTop: 0 }}>
                    ✗ {lang === 'sk' ? 'Rozvojové oblasti / Medzery' : 'Gaps'}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {biLangArr(matchData.gaps || aiProfile?.ai_missing_fields || [], lang).map((g, i) => {
                      const isTrainable = g.includes('trénovateľné') || g.includes('trainable');
                      return (
                        <span key={i} style={{ fontSize: 12, background: isTrainable ? 'rgba(59,130,246,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${isTrainable ? 'rgba(59,130,246,0.12)' : 'rgba(239,68,68,0.12)'}`, color: isTrainable ? '#3b82f6' : '#ef4444', padding: '6px 12px', borderRadius: 8, fontWeight: 600 }}>
                          {isTrainable ? '⚡' : '✗'} {g}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Education & Experience Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }} className="grid-responsive cols-1">
            
            {/* Education Card */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <GraduationCap size={18} style={{ color: 'var(--accent)' }} />
                {lang === 'sk' ? 'Vzdelanie' : 'Education'}
              </h3>
              
              {aiProfile?.education_level ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 12 }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>
                      {{
                        high_school: lang === 'sk' ? 'Stredoškolské vzdelanie' : 'High School Education',
                        bachelors: lang === 'sk' ? 'Bakalárske štúdium' : 'Bachelor\'s Degree',
                        masters: lang === 'sk' ? 'Magisterské / Inžinierske štúdium' : 'Master\'s Degree',
                        phd: 'Doktorandské štúdium (PhD)',
                      }[aiProfile.education_level] || aiProfile.education_level}
                    </div>
                    {aiProfile.education_field && (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2, fontWeight: 600 }}>{aiProfile.education_field}</div>
                    )}
                    {aiProfile.education_school && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{aiProfile.education_school}</div>
                    )}
                  </div>
                </div>
              ) : educationText ? (
                <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>{educationText}</p>
              ) : (
                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13 }}>
                  {lang === 'sk' ? 'Vzdelanie neuvedené.' : 'Education details not specified.'}
                </span>
              )}
            </div>

            {/* Experience Card */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <Briefcase size={16} style={{ color: 'var(--accent)' }} />
                {lang === 'sk' ? 'Prax / Skúsenosti' : 'Experience'}
              </h3>
              
              <div style={{ borderLeft: '3px solid var(--border)', paddingLeft: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>
                  {lang === 'sk' ? 'Dĺžka doterajšej praxe:' : 'Length of experience:'}
                </div>
                <div style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 800, marginTop: 4 }}>
                  {aiProfile?.experience_years || 0} {lang === 'sk' ? 'rokov' : 'years'}
                </div>
                {aiProfile?.experience_years === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4 }}>
                    {lang === 'sk' ? 'Kandidát je študent alebo absolvent bez predchádzajúcej formálnej praxe.' : 'Candidate is a student or fresh graduate without formal work experience.'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Skills & Languages Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }} className="grid-responsive cols-1">
            {/* Skills */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <Award size={18} style={{ color: 'var(--accent)' }} />
                {lang === 'sk' ? 'Zručnosti' : 'Skills'}
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {skills.length > 0 ? (
                  skills.map((skill, idx) => (
                    <span key={idx} style={{ padding: '6px 14px', borderRadius: 8, background: 'var(--bg)', fontSize: 12, border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600 }}>
                      {skill}
                    </span>
                  ))
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13 }}>
                    {lang === 'sk' ? 'Zručnosti neuvedené.' : 'Skills not specified.'}
                  </span>
                )}
              </div>
            </div>

            {/* Languages */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <Globe size={16} style={{ color: 'var(--accent)' }} />
                {lang === 'sk' ? 'Jazykové znalosti' : 'Languages'}
              </h3>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {aiProfile?.languages && aiProfile.languages.length > 0 ? (
                  aiProfile.languages.map((l, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text)' }}>{l.lang}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                        background: l.level?.startsWith('C') ? 'rgba(34,197,94,0.12)' : l.level?.startsWith('B') ? 'rgba(99,102,241,0.12)' : 'rgba(255,170,0,0.12)',
                        color: l.level?.startsWith('C') ? '#22c55e' : l.level?.startsWith('B') ? '#6366f1' : '#ffaa00',
                      }}>{l.level}</span>
                    </div>
                  ))
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13 }}>
                    {lang === 'sk' ? 'Jazyky neuvedené.' : 'Languages not specified.'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Original CV View Section */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <FileText size={16} style={{ color: 'var(--accent)' }} />
              {lang === 'sk' ? 'Životopis (Originál)' : 'Resume (Original)'}
            </h3>

            {profile.cv_id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(255,92,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📄</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                        {profile.original_filename || 'Zivotopis.pdf'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>PDF Document</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setFullscreenCV(true)}
                    style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    {lang === 'sk' ? 'Zobraziť životopis' : 'View Resume'}
                  </button>
                </div>

                {/* Inline CV Frame if loaded and screen is wide */}
                {cvUrl && window.innerWidth > 768 && (
                  <div style={{ height: 600, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                    <iframe src={cvUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Resume PDF Inline" />
                  </div>
                )}
              </div>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13 }}>
                {lang === 'sk' ? 'Životopis nie je priložený.' : 'No resume attached.'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Date Picker Overlay */}
      <AnimatePresence>
        {showDatePicker && selectedApp && (
          <div 
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: 20 }}
            onClick={() => setShowDatePicker(false)}
          >
            <div onClick={e => e.stopPropagation()}>
              <ModernDatePicker 
                onSelect={(dates) => handleUpdateStatus('Interview', dates)}
                onCancel={() => setShowDatePicker(false)}
              />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Reject Modal Overlay */}
      <AnimatePresence>
        {confirmReject && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001 }}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}
            >
              <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>{lang === 'sk' ? 'Odmietnuť kandidáta?' : 'Reject candidate?'}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 20px' }}>
                {lang === 'sk' ? `Naozaj chcete zamietnuť kandidáta ${name}? Táto akcia ho o tom upovedomí.` : `Are you sure you want to reject candidate ${name}? This action notifies the candidate.`}
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setConfirmReject(false)} style={{ flex: 1, padding: 10, borderRadius: 8, background: 'none', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}>Zrušiť</button>
                <button onClick={() => handleUpdateStatus('Rejected')} style={{ flex: 1, padding: 10, borderRadius: 8, background: '#ef4444', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Zamietnuť</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Hire Modal Overlay */}
      <AnimatePresence>
        {confirmHire && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001 }}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}
            >
              <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>{lang === 'sk' ? 'Potvrdiť prijatie?' : 'Confirm hiring?'}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 20px' }}>
                {lang === 'sk' ? `Chcete označiť kandidáta ${name} ako úspešne prijatého na pozíciu?` : `Do you want to mark candidate ${name} as successfully hired for the position?`}
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setConfirmHire(false)} style={{ flex: 1, padding: 10, borderRadius: 8, background: 'none', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}>Zrušiť</button>
                <button onClick={() => handleUpdateStatus('Hired')} style={{ flex: 1, padding: 10, borderRadius: 8, background: '#22c55e', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Prijať</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Fullscreen CV Viewer Modal */}
      <AnimatePresence>
        {fullscreenCV && cvUrl && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 99999, display: 'flex', flexDirection: 'column', backdropFilter: 'blur(10px)', padding: '40px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', color: '#fff' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '900', margin: 0 }}>{name}</h2>
                <p style={{ fontSize: '12px', opacity: 0.7, margin: 0 }}>Originálny životopis</p>
              </div>
              <button 
                onClick={() => setFullscreenCV(false)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: '44px', height: '44px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifycontent: 'center', fontSize: '24px' }}
              >
                <X size={20} style={{ margin: '0 auto' }} />
              </button>
            </div>
            <div style={{ flex: 1, background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
              <iframe src={cvUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Full CV Preview" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .spinner { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          .profile-grid-responsive {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
