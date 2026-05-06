import React, { useState, useEffect } from 'react';
import { useI18n, useAppState } from '../contexts';
import { supabase } from '../supabase';
import CandidateCard from '../components/CandidateCard';
import Toast from '../components/Toast';
import { motion, AnimatePresence } from 'framer-motion';

const Candidates = () => {
  const { t } = useI18n();
  const { invitedIds, setInvitedIds, acceptedIds, setAcceptedIds, companyProfile, refreshAnalytics } = useAppState();
  
  const [candidates, setCandidates] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [skippedMatches, setSkippedMatches] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); return; }

        // Step 1: Get employer's job IDs
        const { data: jobs } = await supabase
          .from('jobs')
          .select('id, title, title_en, location')
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

        console.log('[Candidates] Jobs found:', jobIds.length, 'Applications found:', (apps || []).length, 'Error:', appsErr);
        if (appsErr) throw appsErr;

        const candidateIds = [...new Set((apps || []).map(a => a.candidate_id).filter(Boolean))];
        let profilesMap = {};
        if (candidateIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('user_id', candidateIds);
          (profiles || []).forEach(p => { profilesMap[p.user_id] = p; });
        }

        const enrichedCandidates = (apps || []).map(app => {
          const profile = profilesMap[app.candidate_id] || {};
          const job = jobsMap[app.job_id] || {};
          return {
            ...app,
            student_name: (profile.first_name || profile.last_name)
              ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
              : app.student_name,
            student_profile: { ...(app.student_profile || {}), ...profile },
            job_title: job.title || job.title_en || '—',
            job_location: job.location || '',
          };
        });

        setCandidates(enrichedCandidates);
      } catch (err) {
        console.error('Candidates fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleInvite = async (id, status = 'Interview', interviewDates = null) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const body = { status };
      if (interviewDates) body.interview_dates = interviewDates;

      const { error } = await supabase
        .from('applications')
        .update(body)
        .eq('id', id);

      if (!error) {
        if (status === 'Interview' && !invitedIds.includes(id)) {
          setInvitedIds([...invitedIds, id]);
        }
        setCandidates(prev => prev.map(c => c.id === id ? {
          ...c, status,
          interview_dates: interviewDates || c.interview_dates
        } : c));

        setToastMsg(status === 'Hired' ? 'Kandidát bol úspešne prijatý!' : t('toastInvite'));
        setShowToast(true);
        refreshAnalytics();
      }
    } catch (err) {
      console.error('Update status error:', err);
    }
  };

  const handleAcceptMatch = (id) => {
    if (!acceptedIds.includes(id)) {
      setAcceptedIds([...acceptedIds, id]);
      setToastMsg(t('toastMatch'));
      setShowToast(true);
    }
  };

  const handleSkipMatch = (id) => {
    setSkippedMatches([...skippedMatches, id]);
  };

  const filteredCandidates = candidates.filter(c => 
    (c.status || '').toLowerCase() !== 'rejected' &&
    (
      (c.student_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (c.student_profile?.field || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const visibleMatches = matches.filter(m => !skippedMatches.includes(m.student_id) && !acceptedIds.includes(m.student_id));

  return (
    <div style={{ animation: 'tabSlideIn 0.3s cubic-bezier(0.4, 0, 0.15, 1)' }}>
      {/* Candidates Header */}
      <div style={{ padding: '16px 18px 10px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700' }}>{t('candTitle')}</h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('candSub')}</p>
      </div>

      {/* Search Input */}
      <div style={{ 
        margin: '0 18px 12px', display: 'flex', alignItems: 'center', gap: '6px', 
        padding: '9px 12px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--border)' 
      }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px', color: 'var(--text-muted)', flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
        </svg>
        <input 
          type="text" 
          placeholder={t('candSearch')} 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, border: 'none', background: 'none', fontSize: '13px', fontFamily: 'var(--font-body)', outline: 'none', color: 'var(--text)' }}
        />
      </div>

      {/* Candidates List */}
      <div style={{ padding: '0 18px' }}>
        <AnimatePresence mode="popLayout">
          {filteredCandidates.length === 0 ? (
            <motion.div 
              key="empty-candidates"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}
            >
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🕵️</div>
              <p style={{ fontSize: '13px' }}>{t('noResults')}</p>
            </motion.div>
          ) : (
            filteredCandidates.map(c => (
              <motion.div
                key={c.id}
                layout="position"
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              >
                <CandidateCard 
                  candidate={c} 
                  isInvited={invitedIds.includes(c.id)} 
                  onInvite={handleInvite} 
                />
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      <Toast message={toastMsg} show={showToast} onHide={() => setShowToast(false)} />
    </div>
  );
};

export default Candidates;
