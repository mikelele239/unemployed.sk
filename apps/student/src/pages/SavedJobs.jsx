import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase';
import { useTranslation } from '../I18nContext';
import JobDetail from '../components/JobDetail';
import { useApplications } from '../hooks/useApplications';

export default function SavedJobs() {
  const { t, lang } = useTranslation();
  const { addApplication, hasApplied } = useApplications();
  const [savedJobs, setSavedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSaved = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // 1. Get liked job IDs
        const { data: likes } = await supabase
          .from('job_likes')
          .select('job_id')
          .eq('user_id', session.user.id);

        if (!likes || likes.length === 0) {
          setSavedJobs([]);
          return;
        }

        const jobIds = likes.map(l => l.job_id);

        // 2. Fetch full job data
        const { data: jobs } = await supabase
          .from('jobs')
          .select('*')
          .in('id', jobIds)
          .order('created_at', { ascending: false });

        setSavedJobs(jobs || []);
      } catch (err) {
        console.error('Saved jobs error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSaved();
  }, []);

  const handleUnlike = async (jobId) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('job_likes').delete().eq('user_id', session.user.id).eq('job_id', jobId);
    setSavedJobs(prev => prev.filter(j => j.id !== jobId));
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        {lang === 'sk' ? 'Načítavam...' : 'Loading...'}
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 400, marginBottom: 8 }}>
        {lang === 'sk' ? 'Uložené ponuky' : 'Saved Jobs'}
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>
        {lang === 'sk' ? `${savedJobs.length} uložených ponúk` : `${savedJobs.length} saved jobs`}
      </p>

      {savedJobs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💜</div>
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            {lang === 'sk' ? 'Zatiaľ nemáte žiadne uložené ponuky' : 'No saved jobs yet'}
          </p>
          <p style={{ fontSize: 13 }}>
            {lang === 'sk' ? 'Kliknutím na ❤️ si uložíte ponuky na neskôr.' : 'Tap ❤️ on jobs to save them for later.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <AnimatePresence>
            {savedJobs.map(job => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 16, padding: '18px 20px', cursor: 'pointer',
                  transition: 'border-color 0.2s',
                }}
                onClick={() => setSelectedJob(job)}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{job.title}</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                      {job.company} • {job.location}
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {job.rate && (
                        <span style={{ padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: 'var(--accent-lighter)', color: 'var(--accent)', border: '1px solid var(--accent-light)' }}>
                          {job.rate} {job.rate_unit || '€/hod'}
                        </span>
                      )}
                      {job.type && (
                        <span style={{ padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                          {job.type}
                        </span>
                      )}
                      {hasApplied(job.id) && (
                        <span style={{ padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
                          ✓ {lang === 'sk' ? 'Aplikované' : 'Applied'}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleUnlike(job.id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#ef4444', padding: 4 }}
                    title={lang === 'sk' ? 'Odstrániť z uložených' : 'Remove from saved'}
                  >
                    ♥
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <JobDetail
        job={selectedJob}
        isOpen={!!selectedJob}
        onClose={() => setSelectedJob(null)}
        onApply={() => { if (selectedJob) addApplication(selectedJob); setSelectedJob(null); }}
        hasApplied={selectedJob ? hasApplied(selectedJob.id) : false}
      />
    </div>
  );
}
