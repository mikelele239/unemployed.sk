import { useState } from 'react';
import { Search as SearchIcon, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useJobs } from '../hooks/useJobs';
import JobDetail from '../components/JobDetail';

export default function Search() {
  const { jobs, loading } = useJobs();
  const [filterQuery, setFilterQuery] = useState('');
  const [activeTab, setActiveTab] = useState('Všetky');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  
  const tabs = ['Všetky', 'Brigády', 'Stáže', 'Jednorázovky'];

  const filteredJobs = jobs.filter(job => {
    if (activeTab === 'Brigády' && job.type !== 'Brigáda') return false;
    if (activeTab === 'Stáže' && job.type !== 'Stáž') return false;
    if (activeTab === 'Jednorázovky' && job.type !== 'Jednorázovka') return false;
    if (filterQuery && !job.title.toLowerCase().includes(filterQuery.toLowerCase()) && !job.company.toLowerCase().includes(filterQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 20px', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, marginBottom: 16 }}>Hľadať práce</h1>
        
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <SearchIcon size={18} color="var(--text-muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Názov pozície alebo firma..." 
              value={filterQuery}
              onChange={e => setFilterQuery(e.target.value)}
              style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 14, outline: 'none' }}
            />
          </div>
          <button 
            onClick={() => setShowFilters(true)}
            style={{ width: 44, height: 44, borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <SlidersHorizontal size={20} />
          </button>
        </div>

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
             Načítavam ponuky...
          </div>
        ) : filteredJobs.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>Žiadne výsledky nenašli pre tieto filtre.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filteredJobs.map(job => (
              <div 
                key={job.id} 
                onClick={() => setSelectedJob(job)}
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: '16px', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: job.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
                    {job.logo}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 2px' }}>{job.title}</h3>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{job.company} · {job.location}</div>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                      {job.tags.slice(0, 2).map((tag, i) => (
                         <span key={tag} style={{ padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: i === 0 ? 'var(--accent-lighter)' : 'transparent', color: i === 0 ? 'var(--accent)' : 'var(--text-muted)', border: `1px solid ${i === 0 ? 'var(--accent-light)' : 'var(--border)'}` }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>{job.rate} <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{job.rateUnit}</span></div>
                  <button style={{ background: 'var(--text)', color: 'var(--bg)', border: 'none', padding: '6px 16px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Zobraziť</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <JobDetail 
        job={selectedJob} 
        isOpen={!!selectedJob} 
        onClose={() => setSelectedJob(null)}
        onApply={() => { setSelectedJob(null); }}
        hasApplied={false}
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
              initial={{ y: '100%' }} animate={{ y: '0%' }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--bg)', borderRadius: '24px 24px 0 0', padding: '24px' }}
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 24 }}>Podrobné filtre</h3>
              
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>Minimálna odmena</h4>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['Od 5€/hod', 'Od 7€/hod', 'Od 10€/hod'].map((o,i) => (
                    <button key={o} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: i===0?'1px solid var(--accent)':'1px solid var(--border)', background: i===0?'var(--accent-lighter)':'var(--bg-card)', color: i===0?'var(--accent)':'var(--text)', fontSize: 13, fontWeight: 600 }}>{o}</button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 32 }}>
                <h4 style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>Zameranie</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {['Marketing', 'IT & Tech', 'Gastro', 'Retail', 'Administratíva', 'Sklad'].map((o,i) => (
                    <button key={o} style={{ padding: '8px 16px', borderRadius: 100, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 13 }}>{o}</button>
                  ))}
                </div>
              </div>

              <button className="btn-primary" style={{ width: '100%', borderRadius: 12 }} onClick={() => setShowFilters(false)}>Aplikovať filtre</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
