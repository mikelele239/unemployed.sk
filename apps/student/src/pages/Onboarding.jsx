import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, Sparkles, CheckCircle2, ChevronRight, FileText, BrainCircuit } from 'lucide-react';
import { useTranslation } from '../I18nContext';

const SKILLS_POOL_SK = ['Komunikatívny', 'Tímový hráč', 'Spoľahlivý', 'Rýchlo sa učí', 'Kreatívny', 'Detailista', 'Líder', 'Riešiteľ', 'Organizovaný', 'Angličtina B2'];
const SKILLS_POOL_EN = ['Communicative', 'Team player', 'Reliable', 'Fast learner', 'Creative', 'Detail-oriented', 'Leader', 'Problem solver', 'Organised', 'English B2'];
const JOB_TYPES_SK = ['Brigáda', 'Stáž', 'Plný úväzok', 'Jednorázovky', 'Remote'];
const JOB_TYPES_EN = ['Part-time', 'Internship', 'Full-time', 'One-off gigs', 'Remote'];

export default function Onboarding({ onComplete }) {
  const { t, lang } = useTranslation();

  // Phase: 'welcome' | 'upload' | 'parsing' | 'review' | 'manual' | 'climax'
  const [phase, setPhase] = useState('welcome');
  const [parsingProgress, setParsingProgress] = useState(0);
  const [climaxStep, setClimaxStep] = useState(0);
  const [data, setData] = useState({ name: '', edu: '', loc: '', avail: [], jobType: [], skills: [] });
  const [manualStep, setManualStep] = useState(0);

  const MANUAL_STEPS = [
    { id: 'name',    type: 'text',   title: t('ob.manualName'),  sub: t('ob.manualNameSub'), placeholder: t('ob.manualNamePh') },
    { id: 'edu',     type: 'single', title: t('ob.manualEdu'),   sub: t('ob.manualEduSub'),  options: lang === 'en' ? ['High school', 'University', 'Graduate'] : ['Stredná škola', 'Vysoká škola', 'Absolvent'] },
    { id: 'loc',     type: 'single', title: t('ob.manualLoc'),   sub: t('ob.manualLocSub'),  options: ['Bratislava', 'Košice', 'Žilina', 'B. Bystrica', 'Nitra', lang === 'en' ? 'Other' : 'Iné'] },
    { id: 'jobType', type: 'multi',  title: t('ob.manualType'),  sub: t('ob.manualTypeSub'), options: lang === 'en' ? ['Part-time', 'Internship', 'Full-time', 'One-off'] : ['Brigáda', 'Stáž', 'Plný úväzok', 'Jednorázovky'] },
  ];

  // 1. Welcome auto-advance
  useEffect(() => {
    if (phase === 'welcome') {
      const timer = setTimeout(() => setPhase('upload'), 3000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // 2. Drag & Drop
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.dataTransfer.files?.[0]) startParsing(e.dataTransfer.files[0]);
  };
  const handleFileChange = (e) => {
    if (e.target.files?.[0]) startParsing(e.target.files[0]);
  };

  // 3. Faux parsing simulation
  const startParsing = (fileObj) => {
    // Simulate AI extracting name from filename (e.g. "Tomas_Horvath_CV.pdf" -> "Tomas Horvath")
    let extractedName = fileObj.name.replace(/\.[^/.]+$/, ""); // remove extension
    extractedName = extractedName.replace(/_|-|cv|resume|životopis|zivotopis/gi, " ").replace(/\s+/g, " ").trim();
    if (extractedName) {
      extractedName = extractedName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
    
    setData(prev => ({ ...prev, name: extractedName || '' }));

    setPhase('parsing');
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 15;
      if (p >= 100) {
        clearInterval(interval);
        setParsingProgress(100);
        finishParsing();
      } else {
        setParsingProgress(Math.floor(p));
      }
    }, 300);
  };

  const finishParsing = () => {
    const skillsPool = lang === 'en' ? SKILLS_POOL_EN : SKILLS_POOL_SK;
    const jobPool = lang === 'en' ? JOB_TYPES_EN : JOB_TYPES_SK;
    setData(prev => ({
      ...prev,
      edu: lang === 'en' ? 'University' : 'Vysoká škola',
      loc: 'Bratislava',
      avail: [],
      jobType: [...jobPool].sort(() => 0.5 - Math.random()).slice(0, 2),
      skills: [...skillsPool].sort(() => 0.5 - Math.random()).slice(0, 3),
    }));
    setTimeout(() => setPhase('review'), 600);
  };

  // 4. Manual fallback chip clicks
  const handleManualAction = (id, val, isMulti) => {
    if (isMulti) {
      setData(prev => ({ ...prev, [id]: prev[id].includes(val) ? prev[id].filter(o => o !== val) : [...prev[id], val] }));
    } else {
      setData(prev => ({ ...prev, [id]: val }));
    }
  };

  // 5. Climax animation then complete
  const finalizeMatching = () => {
    localStorage.setItem('unemployed_profile', JSON.stringify(data));
    setPhase('climax');
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setClimaxStep(step);
      if (step >= 4) {
        clearInterval(interval);
        setTimeout(() => onComplete(), 1200);
      }
    }, 900);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
      <AnimatePresence mode="wait">

        {/* WELCOME */}
        {phase === 'welcome' && (
          <motion.div key="welcome"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}
          >
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-1px', marginBottom: 16 }}>
                {t('ob.hook')}
              </h1>
              <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>{t('ob.hookSub')}</p>
            </motion.div>
          </motion.div>
        )}

        {/* UPLOAD DROPZONE */}
        {phase === 'upload' && (
          <motion.div key="upload"
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '40px 20px', alignItems: 'center' }}
          >
            <div style={{ alignSelf: 'flex-start', marginBottom: 40 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-0.5px', marginBottom: 8, lineHeight: 1.1 }}>
                {t('ob.uploadTitle')} <br />{t('ob.uploadTitle2')}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>{t('ob.uploadSub')}</p>
            </div>

            <label
              onDragOver={handleDragOver} onDrop={handleDrop}
              style={{ width: '100%', maxWidth: 400, flex: 1, maxHeight: 300, border: '2px dashed var(--border)', borderRadius: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card)', cursor: 'pointer', transition: 'all 0.2s ease' }}
            >
              <input type="file" accept=".pdf,.doc,.docx" onChange={handleFileChange} style={{ display: 'none' }} />
              <div style={{ width: 64, height: 64, borderRadius: 32, background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <UploadCloud size={32} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{t('ob.uploadCta')}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('ob.uploadFormats')}</p>
            </label>

            <button onClick={() => setPhase('manual')}
              style={{ marginTop: 'auto', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 15, fontWeight: 600, padding: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {t('ob.noCV')} <ChevronRight size={16} />
            </button>
          </motion.div>
        )}

        {/* PARSING */}
        {phase === 'parsing' && (
          <motion.div key="parsing"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}
          >
            <div style={{ position: 'relative', width: 120, height: 120, marginBottom: 32 }}>
              <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }}
                style={{ position: 'absolute', inset: -20, background: 'var(--accent)', borderRadius: '50%', filter: 'blur(20px)' }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-card)', borderRadius: 24, border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={48} color="var(--accent)" />
              </div>
              <motion.div initial={{ top: '0%' }} animate={{ top: '100%' }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                style={{ position: 'absolute', left: -10, right: -10, height: 2, background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)' }}
              />
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 900, marginBottom: 12 }}>{t('ob.parsing')}</h2>
            <div style={{ width: '100%', maxWidth: 240, height: 6, background: 'var(--bg-card)', borderRadius: 3, overflow: 'hidden', marginBottom: 16 }}>
              <motion.div style={{ width: `${parsingProgress}%`, height: '100%', background: 'var(--accent)' }} />
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('ob.parsingSub')}</p>
          </motion.div>
        )}

        {/* REVIEW */}
        {phase === 'review' && (
          <motion.div key="review"
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '40px 20px', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 48, height: 48, borderRadius: 24, background: 'rgba(52,211,153,0.1)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={24} />
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-0.5px' }}>{t('ob.reviewTitle')}</h2>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 32 }}>{t('ob.reviewSub')}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 16, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('ob.reviewName')}</span>
                <input value={data.name} onChange={e => setData({ ...data, name: e.target.value })}
                  placeholder={t('ob.reviewNamePlaceholder')}
                  style={{ background: 'transparent', border: 'none', color: data.name ? 'var(--text)' : 'var(--text-muted)', fontSize: 18, fontWeight: 700, width: '100%', marginTop: 8, outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1, background: 'var(--bg-card)', padding: 16, borderRadius: 16, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('ob.reviewEdu')}</span>
                  <div style={{ fontSize: 16, fontWeight: 600, marginTop: 8 }}>{data.edu}</div>
                </div>
                <div style={{ flex: 1, background: 'var(--bg-card)', padding: 16, borderRadius: 16, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('ob.reviewLoc')}</span>
                  <div style={{ fontSize: 16, fontWeight: 600, marginTop: 8 }}>{data.loc}</div>
                </div>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 16, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12, display: 'block' }}>{t('ob.reviewSkills')}</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {data.skills.map(s => (
                    <span key={s} style={{ background: 'var(--accent-light)', color: 'var(--accent)', padding: '6px 12px', borderRadius: 100, fontSize: 13, fontWeight: 600 }}>{s}</span>
                  ))}
                  <span style={{ background: 'var(--border)', color: 'var(--text-muted)', padding: '6px 12px', borderRadius: 100, fontSize: 13, fontWeight: 600 }}>
                    {t('ob.reviewAddMore')}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 32 }}>
              <button className="btn-primary" onClick={finalizeMatching}
                style={{ width: '100%', padding: 18, borderRadius: 16, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {t('ob.reviewConfirm')} <Sparkles size={18} />
              </button>
            </div>
          </motion.div>
        )}

        {/* MANUAL FALLBACK */}
        {phase === 'manual' && (
          <motion.div key="manual"
            initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => manualStep === 0 ? setPhase('upload') : setManualStep(s => s - 1)}
                style={{ width: 36, height: 36, background: 'var(--bg-card)', border: 'none', borderRadius: 10, cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >←</button>
              <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${((manualStep + 1) / MANUAL_STEPS.length) * 100}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s ease' }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{manualStep + 1}/{MANUAL_STEPS.length}</span>
            </div>

            <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column' }}>
              <AnimatePresence mode="wait">
                {(() => {
                  const s = MANUAL_STEPS[manualStep];
                  return (
                    <motion.div key={manualStep} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2 }}>
                      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 900, marginBottom: 8, letterSpacing: '-0.5px' }}>{s.title}</h2>
                      <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 32 }}>{s.sub}</p>

                      {s.type === 'text' && (
                        <input type="text" placeholder={s.placeholder} value={data[s.id]}
                          onChange={e => setData({ ...data, [s.id]: e.target.value })}
                          onKeyDown={e => e.key === 'Enter' && data[s.id].trim() && (manualStep < MANUAL_STEPS.length - 1 ? setManualStep(x => x + 1) : finalizeMatching())}
                          style={{ width: '100%', padding: '20px', borderRadius: 16, border: '2px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 18, fontWeight: 600, outline: 'none' }}
                          autoFocus
                        />
                      )}

                      {(s.type === 'single' || s.type === 'multi') && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                          {s.options.map(opt => {
                            const isSelected = s.type === 'multi' ? data[s.id].includes(opt) : data[s.id] === opt;
                            return (
                              <button key={opt} onClick={() => handleManualAction(s.id, opt, s.type === 'multi')}
                                style={{ padding: '14px 22px', borderRadius: 100, border: '2px solid', borderColor: isSelected ? 'var(--accent)' : 'var(--border)', background: isSelected ? 'var(--accent)' : 'var(--bg-card)', color: isSelected ? '#fff' : 'var(--text)', fontSize: 15, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                              >{opt}</button>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  );
                })()}
              </AnimatePresence>
            </div>

            <div style={{ padding: '20px', paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}>
              <button onClick={() => manualStep < MANUAL_STEPS.length - 1 ? setManualStep(x => x + 1) : finalizeMatching()}
                disabled={MANUAL_STEPS[manualStep].type === 'text' && !data.name.trim()}
                className="btn-primary"
                style={{ width: '100%', padding: 20, fontSize: 16, fontWeight: 700, borderRadius: 16, opacity: (MANUAL_STEPS[manualStep].type === 'text' && !data.name.trim()) ? 0.5 : 1 }}
              >
                {manualStep < MANUAL_STEPS.length - 1 ? t('ob.next') : t('ob.finish')}
              </button>
            </div>
          </motion.div>
        )}

        {/* CLIMAX */}
        {phase === 'climax' && (
          <motion.div key="climax"
            initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center', background: 'var(--bg)' }}
          >
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 4, ease: 'linear' }} style={{ marginBottom: 40 }}>
              <BrainCircuit size={64} color="var(--accent)" />
            </motion.div>
            <div style={{ height: 160, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {climaxStep === 0 && <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text)' }}>{t('ob.climax1')}</motion.h2>}
              {climaxStep === 1 && <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)' }}>{t('ob.climax2')}</motion.h2>}
              {climaxStep === 2 && <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)' }}>{t('ob.climax3')}</motion.h2>}
              {climaxStep >= 3 && (
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>{t('ob.climax4')}</h2>
                  <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399', padding: '8px 16px', borderRadius: 100, fontWeight: 800, fontSize: '1.2rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={18} /> {t('ob.climaxMatch')}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
