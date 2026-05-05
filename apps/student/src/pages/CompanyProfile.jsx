import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Globe, Briefcase, Users, Zap, MapPin } from 'lucide-react';
import JobDetail from '../components/JobDetail';
import { useApplications } from '../hooks/useApplications';
import { useTranslation } from '../I18nContext';

export default function CompanyProfile() {
  const { companyName } = useParams();
  const navigate = useNavigate();
  const { t, lang } = useTranslation();
  const { addApplication, applications } = useApplications();

  const [company, setCompany] = useState(null);
  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showFullAbout, setShowFullAbout] = useState(false);

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/company/${encodeURIComponent(companyName)}`);
        if (!res.ok) {
          setError(lang === 'en' ? 'Company not found' : 'Spoločnosť sa nenašla');
          return;
        }
        const data = await res.json();
        setCompany(data.company);
        setStats(data.stats);
        setJobs(data.jobs);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (companyName) fetchCompany();
  }, [companyName]);

  const hasApplied = (jobId) => {
    return applications.some(a => (a.job_id || a.id) === jobId);
  };

  const handleApply = (job) => {
    addApplication(job);
    setSelectedJob(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{lang === 'en' ? 'Loading company...' : 'Načítavam spoločnosť...'}</p>
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 48 }}>🏢</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>{error || 'Company not found'}</p>
        <button onClick={() => navigate(-1)} style={{ padding: '10px 24px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontWeight: 600 }}>
          ← {lang === 'en' ? 'Go back' : 'Späť'}
        </button>
      </div>
    );
  }

  const aboutText = company.description || (lang === 'en' ? 'No description available.' : 'Popis nie je dostupný.');
  const shouldTruncate = aboutText.length > 150;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      {/* Sticky Header Bar */}
      <div style={{ 
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, 
        background: 'var(--bg)', borderBottom: '1px solid var(--border)', 
        position: 'sticky', top: 0, zIndex: 20 
      }}>
        <button 
          onClick={() => navigate(-1)} 
          style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <ArrowLeft size={18} />
        </button>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>{company.name}</span>
      </div>

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Company Hero */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
          style={{ padding: '28px 20px 20px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}
        >
          {/* Background glow */}
          <div style={{ 
            position: 'absolute', top: '-60px', left: '50%', transform: 'translateX(-50%)',
            width: '300px', height: '200px', background: company.color || 'var(--accent)', 
            filter: 'blur(100px)', opacity: 0.12, borderRadius: '50%', zIndex: 0 
          }} />

          {/* Company Logo */}
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            style={{ 
              width: 80, height: 80, borderRadius: 24, margin: '0 auto 16px',
              background: `linear-gradient(135deg, ${company.color || '#FF5C00'}cc, ${company.color || '#FF5C00'})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, fontWeight: 900, color: '#fff', position: 'relative', zIndex: 1,
              boxShadow: `0 12px 40px ${company.color || '#FF5C00'}44`
            }}
          >
            {company.logo || company.name.charAt(0).toUpperCase()}
          </motion.div>

          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px', marginBottom: 6, position: 'relative', zIndex: 1 }}>
            {company.name}
          </h1>

          {company.website && (
            <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, marginBottom: 20, position: 'relative', zIndex: 1 }}
            >
              <Globe size={14} /> {company.website.replace(/^https?:\/\//, '')}
            </a>
          )}

          {/* Stats Row */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{ 
              display: 'flex', justifyContent: 'center', gap: 12, marginTop: 8,
              position: 'relative', zIndex: 1 
            }}
          >
            <div style={{ 
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, 
              padding: '12px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              minWidth: 80
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)' }}>
                <Briefcase size={14} />
                <span style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font-display)' }}>{stats?.activeJobs || 0}</span>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                {lang === 'en' ? 'Jobs' : 'Ponuky'}
              </span>
            </div>
            <div style={{ 
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, 
              padding: '12px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              minWidth: 80
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--blue, #3b82f6)' }}>
                <Users size={14} />
                <span style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font-display)' }}>{stats?.totalApplications || 0}</span>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                {lang === 'en' ? 'Applicants' : 'Prihlášky'}
              </span>
            </div>
            <div style={{ 
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, 
              padding: '12px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              minWidth: 80
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--green, #22c55e)' }}>
                <Zap size={14} />
                <span style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font-display)' }}>{stats?.avgMatchScore || 0}%</span>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                {lang === 'en' ? 'AI Match' : 'AI Zhoda'}
              </span>
            </div>
          </motion.div>
        </motion.div>

        {/* About Section */}
        {aboutText && aboutText !== (lang === 'en' ? 'No description available.' : 'Popis nie je dostupný.') && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{ padding: '0 20px 20px' }}
          >
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px' }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                {lang === 'en' ? 'About' : 'O spoločnosti'}
              </h3>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)', margin: 0 }}>
                {shouldTruncate && !showFullAbout ? aboutText.slice(0, 150) + '...' : aboutText}
              </p>
              {shouldTruncate && (
                <button 
                  onClick={() => setShowFullAbout(!showFullAbout)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 8, padding: 0 }}
                >
                  {showFullAbout ? (lang === 'en' ? 'Show less' : 'Zobraziť menej') : (lang === 'en' ? 'Show more' : 'Zobraziť viac')}
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Job Listings */}
        <div style={{ padding: '0 20px 100px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Briefcase size={16} color="var(--accent)" />
            {lang === 'en' ? 'Active Listings' : 'Aktívne ponuky'} 
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>({jobs.length})</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {jobs.map((job, i) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                onClick={() => setSelectedJob(job)}
                style={{ 
                  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, 
                  padding: '16px', cursor: 'pointer', transition: 'all 0.2s' 
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = company.color || 'var(--accent)'; e.currentTarget.style.boxShadow = `0 4px 20px ${company.color || 'var(--accent)'}15`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ 
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: `linear-gradient(135deg, ${job.color || '#FF5C00'}cc, ${job.color || '#FF5C00'})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    color: '#fff', fontSize: 16, fontWeight: 700 
                  }}>
                    {job.logo}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                      <MapPin size={12} />
                      {job.location || 'Bratislava'} · {job.workModel || 'On-site'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(job.tags || []).slice(0, 3).map((tag, ti) => (
                        <span key={tag} style={{ 
                          padding: '3px 8px', borderRadius: 100, fontSize: 10, fontWeight: 600, 
                          background: ti === 0 ? `${company.color || 'var(--accent)'}18` : 'transparent', 
                          color: ti === 0 ? (company.color || 'var(--accent)') : 'var(--text-muted)', 
                          border: `1px solid ${ti === 0 ? `${company.color || 'var(--accent)'}44` : 'var(--border)'}` 
                        }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: company.color || 'var(--accent)' }}>
                    {job.rate} <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{job.rateUnit}</span>
                  </div>
                  {hasApplied(job.id) ? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green, #22c55e)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      ✓ {lang === 'en' ? 'Applied' : 'Prihlásené'}
                    </span>
                  ) : (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSelectedJob(job); }}
                      style={{ 
                        background: 'var(--text)', color: 'var(--bg)', border: 'none', 
                        padding: '6px 14px', borderRadius: 100, fontSize: 11, fontWeight: 700, cursor: 'pointer' 
                      }}
                    >
                      {lang === 'en' ? 'View' : 'Zobraziť'}
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {jobs.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>
              <span style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>📭</span>
              {lang === 'en' ? 'No active listings from this company.' : 'Žiadne aktívne ponuky od tejto spoločnosti.'}
            </div>
          )}
        </div>
      </div>

      {/* Job Detail Overlay */}
      <JobDetail
        job={selectedJob}
        isOpen={!!selectedJob}
        onClose={() => setSelectedJob(null)}
        onApply={handleApply}
        hasApplied={selectedJob ? hasApplied(selectedJob.id) : false}
      />
    </div>
  );
}
