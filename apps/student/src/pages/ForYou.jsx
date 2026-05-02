import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useJobs } from '../hooks/useJobs';
import { getAccessToken } from '../supabase';
import { isDemoMode } from '../demoMode';
import SwipeCard from '../components/SwipeCard';
import JobDetail from '../components/JobDetail';
import { useApplications } from '../hooks/useApplications';
import { useTranslation } from '../I18nContext';

export default function ForYou() {
  const demo = isDemoMode();
  const { t } = useTranslation();
  const { jobs, loading } = useJobs(true);
  const [cards, setCards] = useState([]);
  const [profile, setProfile] = useState({});
  const [selectedJob, setSelectedJob] = useState(null);
  const [toast, setToast] = useState(false);
  const { addApplication, hasApplied, applications } = useApplications();

  const logJobView = async (jobId) => {
    if (!jobId || demo) return; // Skip in demo mode
    try {
      const token = getAccessToken();
      console.log(`[SYNC] Triggering view for Job=${jobId}`);
      const res = await fetch(`/api/jobs/${jobId}/view`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!res.ok) {
        const errorData = await res.json();
        console.error(`[SYNC] View failed for Job=${jobId}:`, errorData);
      }
    } catch (e) { 
      console.error(`[SYNC] Network error while logging view for Job=${jobId}:`, e);
    }
  };

  useEffect(() => {
    if (!loading) {
      // Exclude jobs that have already been applied to
      const filtered = jobs.filter(j => !hasApplied(j.id));
      console.log(`[DEBUG] Filtering cards: ${jobs.length} total -> ${filtered.length} remaining`);
      setCards([...filtered].reverse());
      
      // Log view for the top card if it exists
      if (filtered.length > 0) {
        logJobView(filtered[0]?.id);
      }
    }
  }, [loading, jobs, applications]);

  useEffect(() => {
    if (demo) {
      // Demo mode: use localStorage profile only
      const prof = JSON.parse(localStorage.getItem('unemployed_profile')) || {};
      setProfile(prof);
      return;
    }
    const fetchProfile = async () => {
      try {
        const token = getAccessToken();
        const res = await fetch('/api/profile', {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          // Map backend names back to expected frontend state
          setProfile({
            ...data,
            name: `${data.first_name} ${data.last_name || ''}`.trim()
          });
        } else {
          // Fallback to local
          const prof = JSON.parse(localStorage.getItem('unemployed_profile')) || {};
          setProfile(prof);
        }
      } catch (err) {
        console.error('Profile fetch error:', err);
      }
    };
    fetchProfile();
  }, []);

  const handleSwipe = (direction, job) => {
    if (direction === 'right') {
      addApplication(job);
      setToast(true);
      setTimeout(() => setToast(false), 2200);
    }
    const nextCards = cards.filter(c => c.id !== job.id);
    setCards(nextCards);
    // Log view for the next card revealed
    if (nextCards.length > 0) {
      logJobView(nextCards[nextCards.length - 1].id);
    }
  };

  const handleApplyFromDetail = (job) => {
    addApplication(job);
    setToast(true);
    setTimeout(() => setToast(false), 2200);
    // Optionally remove card from stack after applying if desired
  };

  return (
    <div style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 20px 10px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800 }}>{t('foryou.title')}</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('foryou.subtitle')}{profile.name ? profile.name.split(' ')[0] : t('foryou.defaultName')}</p>
      </div>

      <div style={{ position: 'relative', flex: 1, margin: '16px 24px', perspective: 800 }}>
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
              const cardIndex = cards.length - 1 - index; // 0 is top
              return (
                <SwipeCard 
                  key={job.id} 
                  job={job} 
                  index={cardIndex} 
                  total={cards.length}
                  onSwipe={handleSwipe}
                  onClick={setSelectedJob}
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
              bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
              left: 16, right: 16,
              background: 'var(--green)',
              color: '#fff',
              padding: '12px 14px',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 600,
              textAlign: 'center',
              zIndex: 60,
              boxShadow: '0 4px 20px rgba(34,197,94,0.3)'
            }}
          >
            {t('foryou.toast')}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
