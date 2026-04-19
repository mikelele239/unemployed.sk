import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { JOBS } from '../data/mockJobs';
import SwipeCard from '../components/SwipeCard';
import JobDetail from '../components/JobDetail';
import { useApplications } from '../hooks/useApplications';

export default function ForYou() {
  const [cards, setCards] = useState([...JOBS].reverse()); // Top card is last in array visually, but we render back-to-front
  const [profile, setProfile] = useState({});
  const [selectedJob, setSelectedJob] = useState(null);
  const [toast, setToast] = useState(false);
  const { addApplication, hasApplied } = useApplications();

  useEffect(() => {
    const prof = JSON.parse(localStorage.getItem('unemployed_profile')) || {};
    setProfile(prof);
  }, []);

  const handleSwipe = (direction, job) => {
    if (direction === 'right') {
      addApplication(job);
      setToast(true);
      setTimeout(() => setToast(false), 2200);
    }
    setCards(prev => prev.filter(c => c.id !== job.id));
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
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800 }}>Pre teba</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Tvoje najlepšie zhody, {profile.name ? profile.name.split(' ')[0] : 'Kamoško'}</p>
      </div>

      <div style={{ position: 'relative', flex: 1, margin: '16px', perspective: 800 }}>
        {cards.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 40, marginBottom: 12 }}>👍</span>
            <h3 style={{ fontSize: 18, color: 'var(--text)', fontWeight: 700, marginBottom: 4 }}>To je všetko!</h3>
            <p style={{ fontSize: 13 }}>Prezri si záložku Prihlášky</p>
          </div>
        ) : (
          cards.map((job, index) => {
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
          })
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
            ✓ Máš záujem! Zamestnávateľ sa ti ozve.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
