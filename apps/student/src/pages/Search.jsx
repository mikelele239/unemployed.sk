import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, SlidersHorizontal, X, Building2, ChevronRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useJobs } from '../hooks/useJobs';
import { useApplications } from '../hooks/useApplications';
import JobDetail from '../components/JobDetail';
import { useTranslation } from '../I18nContext';

const RATE_OPTIONS = [
  { label: '5€+', min: 5 },
  { label: '7€+', min: 7 },
  { label: '10€+', min: 10 },
];

const FOCUS_AREAS_SK = ['Marketing', 'IT & Tech', 'Gastro', 'Retail', 'Administratíva', 'Sklad'];
const FOCUS_AREAS_EN = ['Marketing', 'IT & Tech', 'Gastro', 'Retail', 'Admin', 'Warehouse'];

export default function Search() {
  const { t, lang } = useTranslation();
  const { jobs, loading } = useJobs();
  const { addApplication, hasApplied } = useApplications();
  const [filterQuery, setFilterQuery] = useState('');
  const [activeTab, setActiveTab] = useState('Všetky');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const navigate = useNavigate();

  // Filter states
  const [minRate, setMinRate] = useState(null);
  const [selectedFocus, setSelectedFocus] = useState([]);
  const [activePathway, setActivePathway] = useState(null);
  
  // Fetch registered employers via server API (bypasses RLS)
  const [employers, setEmployers] = useState([]);
  useEffect(() => {
    const fetchEmployers = async () => {
      try {
        const res = await fetch('/api/employers');
        const json = await res.json();
        console.log('[Search] Employers API result:', json);
        if (json.employers) {
          setEmployers(json.employers);
        }
      } catch (err) {
        console.error('[Search] Failed to fetch employers:', err);
      }
    };
    fetchEmployers();
  }, []);

  const tabs = [t('search.all') || 'Všetky', t('search.parttime') || 'Brigády', t('search.internships') || 'Stáže', t('search.gigs') || 'Jednorázovky'];

  const activeFilterCount = (minRate ? 1 : 0) + selectedFocus.length;

  const parseRate = (rateStr) => {
    if (!rateStr) return 0;
    const match = String(rateStr).match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  };

  // Filter companies by query
  const filteredCompanies = useMemo(() => {
    if (!filterQuery || filterQuery.length < 2) return [];
    return employers.filter(c => c.name.toLowerCase().includes(filterQuery.toLowerCase()));
  }, [employers, filterQuery]);

  const filteredJobs = jobs.filter(job => {
    if (activeTab === (t('search.parttime') || 'Brigády') && job.type !== 'part-time') return false;
    if (activeTab === (t('search.internships') || 'Stáže') && job.type !== 'internship') return false;
    if (activeTab === (t('search.gigs') || 'Jednorázovky') && job.type !== 'gig') return false;
    if (filterQuery && !job.title.toLowerCase().includes(filterQuery.toLowerCase()) && !job.company.toLowerCase().includes(filterQuery.toLowerCase()) && !job.location.toLowerCase().includes(filterQuery.toLowerCase())) return false;
    
    // Pathway filters
    if (activePathway === 'no-experience') {
      const text = [job.title, ...(job.tags || []), job.requirements].join(' ').toLowerCase();
      const matchesNoExp = text.includes('junior') || text.includes('stáž') || text.includes('no experience') || text.includes('bez praxe') || text.includes('absolvent') || job.type === 'internship';
      if (!matchesNoExp) return false;
    }
    
    if (activePathway === 'high-pay') {
      if (parseRate(job.rate) < 8) return false;
    }
    
    if (activePathway === 'remote') {
      const text = [job.location, ...(job.tags || []), job.work_model].join(' ').toLowerCase();
      const matchesRemote = text.includes('remote') || text.includes('domu') || text.includes('home') || text.includes('distanc');
      if (!matchesRemote) return false;
    }
    
    if (activePathway === 'gigs') {
      if (job.type !== 'gig' && !(job.tags || []).some(t => t.toLowerCase().includes('gig') || t.toLowerCase().includes('jednoraz'))) return false;
    }

    // Min rate filter
    if (minRate && parseRate(job.rate) < minRate) return false;
    
    // Focus area filter — match against tags or title
    if (selectedFocus.length > 0) {
      const jobText = [job.title, ...(job.tags || [])].join(' ').toLowerCase();
      const hasMatch = selectedFocus.some(f => jobText.includes(f.toLowerCase()));
      if (!hasMatch) return false;
    }
    
    return true;
  });

  const handleClearFilters = () => {
    setMinRate(null);
    setSelectedFocus([]);
    setActivePathway(null);
  };

  const toggleFocus = (area) => {
    setSelectedFocus(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]);
  };

  return (
    <div style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 20px', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, marginBottom: 16 }}>{t('search.title') || 'Hľadať práce'}</h1>
        
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <SearchIcon size={18} color="var(--text-muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder={lang === 'sk' ? 'Pozícia, firma alebo lokalita...' : 'Job title, company or location...'}
              value={filterQuery}
              onChange={e => setFilterQuery(e.target.value)}
              style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none' }}
            />
          </div>
          <button 
            onClick={() => setShowFilters(true)}
            style={{ 
              width: 44, height: 44, borderRadius: 12, 
              border: activeFilterCount > 0 ? '1.5px solid var(--accent)' : '1.5px solid var(--border)', 
              background: activeFilterCount > 0 ? 'rgba(255,92,0,0.1)' : 'var(--bg-card)', 
              color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--text)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' 
            }}
          >
            <SlidersHorizontal size={20} />
            {activeFilterCount > 0 && (
              <div style={{ 
                position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: '50%', 
                background: 'var(--accent)', color: '#fff', fontSize: 10, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>{activeFilterCount}</div>
            )}
          </button>
        </div>

        {/* Curated Explore Pathways Banners */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
            <Sparkles size={14} color="var(--accent)" />
            <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
              {lang === 'sk' ? 'Objavuj cesty' : 'Explore Pathways'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '6px', margin: '0 -20px', padding: '0 20px 6px' }}>
            {[
              { id: 'no-experience', label: lang === 'sk' ? 'Bez praxe' : 'No Exp Needed', gradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', icon: '👶' },
              { id: 'high-pay', label: lang === 'sk' ? '8€+/hod a viac' : '8€+/hr and more', gradient: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', icon: '💰' },
              { id: 'remote', label: lang === 'sk' ? 'Home Office' : 'Remote / WFH', gradient: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)', icon: '🏠' },
              { id: 'gigs', label: lang === 'sk' ? 'Rýchle brigády' : 'One-off Gigs', gradient: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', icon: '⚡' },
            ].map(p => {
              const isActive = activePathway === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setActivePathway(isActive ? null : p.id)}
                  style={{
                    flex: '0 0 135px',
                    height: '80px',
                    borderRadius: '12px',
                    background: p.gradient,
                    padding: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    overflow: 'hidden',
                    border: isActive ? '3px solid #fff' : '1px solid transparent',
                    boxShadow: isActive ? '0 0 12px rgba(255,255,255,0.4), 0 8px 16px rgba(0,0,0,0.15)' : '0 4px 10px rgba(0,0,0,0.08)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={e => {
                    if (!isActive) e.currentTarget.style.transform = 'none';
                  }}
                >
                  {/* Subtle Floating Icon */}
                  <span style={{ position: 'absolute', right: '4px', top: '2px', fontSize: '28px', opacity: 0.18 }}>
                    {p.icon}
                  </span>
                  
                  <span style={{ fontSize: '16px' }}>{p.icon}</span>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#fff', lineHeight: '1.2', textShadow: '0 1px 2px rgba(0,0,0,0.2)', zIndex: 1 }}>
                    {p.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active filter pills */}
        {activeFilterCount > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {minRate && (
              <span onClick={() => setMinRate(null)} style={{ padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: 'rgba(255,92,0,0.1)', color: 'var(--accent)', border: '1px solid rgba(255,92,0,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                {minRate}€+ <X size={12} />
              </span>
            )}
            {selectedFocus.map(f => (
              <span key={f} onClick={() => toggleFocus(f)} style={{ padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: 'rgba(255,92,0,0.1)', color: 'var(--accent)', border: '1px solid rgba(255,92,0,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                {f} <X size={12} />
              </span>
            ))}
            {activePathway && (
              <span onClick={() => setActivePathway(null)} style={{ padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: 'rgba(255,92,0,0.1)', color: 'var(--accent)', border: '1px solid rgba(255,92,0,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                {activePathway === 'no-experience' ? (lang === 'sk' ? 'Bez praxe' : 'No Exp') :
                 activePathway === 'high-pay' ? (lang === 'sk' ? '8€+/hod' : '8€+/hr') :
                 activePathway === 'remote' ? 'Home Office' : 'Gigy'} <X size={12} />
              </span>
            )}
            <span onClick={handleClearFilters} style={{ padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}>
              {lang === 'en' ? 'Clear all' : 'Vymazať'}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, margin: '0 -20px', padding: '0 20px 8px' }}>
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 16px',
                borderRadius: 100,
                border: 'none',
                background: activeTab === tab ? 'var(--text)' : 'var(--bg-card)',
                color: activeTab === tab ? 'var(--bg)' : 'var(--text-muted)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 20px 20px', flex: 1 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>
             <div className="typing-cursor" style={{ width: 24, height: 24, margin: '0 auto 12px' }}></div>
             {t('search.loading') || 'Načítavam ponuky...'}
          </div>
        ) : (
          <>
            {/* ── COMPANY RESULTS ── */}
            {filteredCompanies.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Building2 size={16} color="var(--accent)" />
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--accent)', fontFamily: 'var(--font-body)' }}>
                    {lang === 'sk' ? 'Firmy' : 'Companies'} ({filteredCompanies.length})
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredCompanies.map(comp => (
                    <motion.div
                      key={comp.name}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => navigate(`/company/${encodeURIComponent(comp.name)}`)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16,
                        cursor: 'pointer', transition: 'border-color 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                      <div style={{
                        width: 42, height: 42, borderRadius: 12, background: comp.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 16, fontWeight: 700, flexShrink: 0
                      }}>{typeof comp.logo === 'string' && comp.logo.length <= 2 ? comp.logo : comp.name.charAt(0)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-body)' }}>{comp.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                          {comp.jobCount} {lang === 'sk' ? (comp.jobCount === 1 ? 'pozícia' : comp.jobCount < 5 ? 'pozície' : 'pozícií') : (comp.jobCount === 1 ? 'open position' : 'open positions')}
                          {comp.location ? ` · ${comp.location}` : ''}
                        </div>
                      </div>
                      <ChevronRight size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* ── JOB RESULTS ── */}
            {filteredCompanies.length > 0 && filteredJobs.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                  {lang === 'sk' ? 'Pozície' : 'Jobs'} ({filteredJobs.length})
                </span>
              </div>
            )}

            {filteredJobs.length === 0 && filteredCompanies.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>{t('search.empty') || 'Žiadne výsledky nenašli pre tieto filtre.'}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {filteredJobs.map(job => (
                  <div 
                    key={job.id} 
                    onClick={() => setSelectedJob(job)}
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: '16px', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      {job.logo_url ? (
                        <img src={job.logo_url} alt={job.company} style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: job.color || 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
                          {job.logo || job.company?.charAt(0) || '?'}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 2px' }}>{job.title}</h3>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                          <span 
                            onClick={(e) => { e.stopPropagation(); navigate(`/company/${encodeURIComponent(job.company)}`); }}
                            style={{ cursor: 'pointer', fontWeight: 600, transition: 'color 0.2s' }}
                            onMouseEnter={e => e.target.style.color = 'var(--accent)'}
                            onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
                          >{job.company}</span> · {job.location}
                        </div>
                        
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                          {(job.tags || []).slice(0, 2).map((tag, i) => (
                             <span key={tag} style={{ padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: i === 0 ? 'var(--accent-lighter)' : 'transparent', color: i === 0 ? 'var(--accent)' : 'var(--text-muted)', border: `1px solid ${i === 0 ? 'var(--accent-light)' : 'var(--border)'}` }}>{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>{job.rate} <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{job.rateUnit}</span></div>
                      <button style={{ background: 'var(--text)', color: 'var(--bg)', border: 'none', padding: '6px 16px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>{t('search.view') || 'Zobraziť'}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <JobDetail 
        job={selectedJob} 
        isOpen={!!selectedJob} 
        onClose={() => setSelectedJob(null)}
        onApply={() => { if (selectedJob) addApplication(selectedJob); setSelectedJob(null); }}
        hasApplied={selectedJob ? hasApplied(selectedJob.id) : false}
      />

      {/* Filter Drawer */}
      <AnimatePresence>
        {showFilters && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100 }}
            onClick={() => setShowFilters(false)}
          >
            <motion.div
              initial={{ x: '100%' }} animate={{ x: '0%' }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 340, background: 'var(--bg)', borderRadius: '24px 0 0 24px', padding: '24px', overflowY: 'auto', boxShadow: '-8px 0 40px rgba(0,0,0,0.3)' }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h3 style={{ fontSize: 20, fontWeight: 800 }}>{t('search.filters') || 'Podrobné filtre'}</h3>
                {activeFilterCount > 0 && (
                  <button onClick={handleClearFilters} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    {lang === 'en' ? 'Reset' : 'Resetovať'}
                  </button>
                )}
              </div>
              
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{t('search.minRate') || 'Minimálna odmena'}</h4>
                <div style={{ display: 'flex', gap: 8 }}>
                  {RATE_OPTIONS.map(opt => {
                    const isActive = minRate === opt.min;
                    return (
                      <button 
                        key={opt.min}
                        onClick={() => setMinRate(isActive ? null : opt.min)}
                        style={{ 
                          flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer',
                          border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)', 
                          background: isActive ? 'var(--accent-lighter)' : 'var(--bg-card)', 
                          color: isActive ? 'var(--accent)' : 'var(--text)', 
                          fontSize: 13, fontWeight: 600, transition: 'all 0.2s' 
                        }}
                      >
                        {lang === 'en' ? `From ${opt.label}` : `Od ${opt.label}`}/{lang === 'en' ? 'hr' : 'hod'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: 32 }}>
                <h4 style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{t('search.focus') || 'Zameranie'}</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(lang === 'en' ? FOCUS_AREAS_EN : FOCUS_AREAS_SK).map(area => {
                    const isActive = selectedFocus.includes(area);
                    return (
                      <button 
                        key={area} 
                        onClick={() => toggleFocus(area)}
                        style={{ 
                          padding: '8px 16px', borderRadius: 100, cursor: 'pointer',
                          border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)', 
                          background: isActive ? 'var(--accent)' : 'var(--bg-card)', 
                          color: isActive ? '#fff' : 'var(--text)', 
                          fontSize: 13, fontWeight: 600, transition: 'all 0.2s' 
                        }}
                      >
                        {area}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button 
                className="btn-primary" 
                style={{ width: '100%', borderRadius: 12 }} 
                onClick={() => setShowFilters(false)}
              >
                {t('search.applyFilters') || 'Aplikovať filtre'} {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
