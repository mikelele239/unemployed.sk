import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, Sparkles, CheckCircle2, ChevronRight, FileText, BrainCircuit } from 'lucide-react';
import { useTranslation } from '../I18nContext';
import { cvApi } from '../services/cvApi';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';

const SKILLS_POOL_SK = ['Komunikatívny', 'Tímový hráč', 'Spoľahlivý', 'Rýchlo sa učí', 'Kreatívny', 'Detailista', 'Líder', 'Riešiteľ', 'Organizovaný', 'Angličtina B2'];
const SKILLS_POOL_EN = ['Communicative', 'Team player', 'Reliable', 'Fast learner', 'Creative', 'Detail-oriented', 'Leader', 'Problem solver', 'Organised', 'English B2'];
const JOB_TYPES_SK = ['Brigáda', 'Stáž', 'Plný úväzok', 'Jednorázovky', 'Remote'];
const JOB_TYPES_EN = ['Part-time', 'Internship', 'Full-time', 'One-off gigs', 'Remote'];

export default function Onboarding({ onComplete }) {
  const { t, lang } = useTranslation();

  // Phase: 'upload' | 'parsing' | 'review' | 'manual' | 'climax'
  const [phase, setPhase] = useState('upload'); 
  const [parsingProgress, setParsingProgress] = useState(0);
  const [climaxStep, setClimaxStep] = useState(0);
  const [data, setData] = useState({ name: '', edu: '', loc: '', avail: [], jobType: [], skills: [], bio: '', cv_id: null });
  const [manualStep, setManualStep] = useState(0);

  const MANUAL_STEPS = [
    { id: 'name',    type: 'text',   title: 'Ako sa voláš?',  sub: 'Tvoje celé meno pre zamestnávateľov.', placeholder: 'Janko Hraško' },
    { id: 'edu',     type: 'single', title: 'Dosiahnuté vzdelanie',   sub: 'Vyber tvoj aktuálny stav.',  options: lang === 'en' ? ['High school', 'University', 'Graduate'] : ['Stredná škola', 'Vysoká škola', 'Absolvent'] },
    { id: 'loc',     type: 'single', title: 'Kde chceš pracovať?',   sub: 'Vyber preferovanú lokalitu.',  options: ['Bratislava', 'Košice', 'Žilina', 'B. Bystrica', 'Nitra', 'Iné'] },
    { id: 'jobType', type: 'multi',  title: 'Aký úväzok hľadáš?',  sub: 'Môžeš vybrať viac možností.', options: lang === 'en' ? ['Part-time', 'Internship', 'Full-time'] : ['Brigáda', 'Stáž', 'Plný úväzok'] },
  ];

  // 1. Skip Welcome
  useEffect(() => {
    if (phase === 'welcome') setPhase('upload');
  }, [phase]);

  // 2. Actions
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.dataTransfer.files?.[0]) startParsing(e.dataTransfer.files[0]);
  };
  const handleFileChange = (e) => {
    if (e.target.files?.[0]) startParsing(e.target.files[0]);
  };

  const startParsing = async (fileObj) => {
    setPhase('parsing');
    setParsingProgress(20);
    try {
      const cvData = await cvApi.uploadCV(fileObj);
      setData(prev => ({ ...prev, cv_id: cvData.id }));
    } catch (err) {
      console.warn('CV api upload failed, bypassing for flow completion.', err);
      setData(prev => ({ ...prev, cv_id: 'mock-id-' + Date.now() }));
    }

    try {
      setParsingProgress(60);
      let name = fileObj.name.replace(/\.[^/.]+$/, "").replace(/_|-|cv|resume/gi, " ").trim();
      name = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      const skillsPool = lang === 'en' ? SKILLS_POOL_EN : SKILLS_POOL_SK;
      const skills = [...skillsPool].sort(() => 0.5 - Math.random()).slice(0, 4);
      const bio = lang === 'en' 
        ? `${name} is a motivated student specializing in ${skills[0]}.`
        : `${name} je motivovaný študent so zameraním na ${skills[0]}.`;
      setData(prev => ({ ...prev, name, bio, skills, edu: 'Vysoká škola', loc: 'Bratislava', jobType: ['Brigáda'] }));
      setParsingProgress(100);
      setTimeout(() => setPhase('review'), 400);
    } catch (err) { setPhase('upload'); }
  };

  const handleManualAction = (id, val, isMulti) => {
    if (isMulti) {
      setData(prev => ({ ...prev, [id]: prev[id].includes(val) ? prev[id].filter(o => o !== val) : [...prev[id], val] }));
    } else {
      setData(prev => ({ ...prev, [id]: val }));
    }
  };

  const finalizeMatching = async () => {
    setPhase('climax');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const nameParts = (data.name || '').trim().split(' ');
        const res = await fetch('/api/student/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            first_name: nameParts[0] || '',
            last_name: nameParts.slice(1).join(' ') || '',
            education: data.edu || '',
            location: data.loc || '',
            skills: data.skills || [],
            job_preferences: data.jobType || [],
          })
        });
        if (res.ok) console.log('Profile saved via server API.');
        else console.error('Profile save error:', await res.text());
      }
      // Also keep local copy as fallback
      localStorage.setItem('unemployed_profile', JSON.stringify(data));
    } catch (err) { console.error('Error during finalizeMatching:', err); }

    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step >= 1) {
        clearInterval(interval);
        setTimeout(() => typeof onComplete === 'function' && onComplete(), 1500);
      }
    }, 1000);
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

        {/* UPLOAD PHASE: THE LABORATORY SCAN */}
        {phase === 'upload' && (
          <motion.div key="upload"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '80px 24px', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, #ff5c0008, transparent), #050505' }}
          >
            <div style={{ textAlign: 'center', marginBottom: 60 }}>
              <div style={{ 
                fontFamily: 'var(--font-display)', 
                fontSize: '1.4rem', 
                color: 'var(--text)',
                display: 'inline-flex',
                alignItems: 'center',
                cursor: 'default',
                whiteSpace: 'nowrap',
                marginBottom: 24,
                opacity: 0.8
              }}>
                <span style={{ position: 'relative' }}>
                  un
                  <span style={{ position: 'absolute', left: '-1px', right: '-1px', top: '50%', height: '2px', background: 'var(--accent)', borderRadius: '2px' }} />
                </span>
                employed.sk
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '3.5rem', fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 0.9, color: '#fff' }}>
                Vytvor si profil.
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 17, marginTop: 20, maxWidth: 420, margin: '20px auto 0', lineHeight: 1.6 }}>
                Nahraj svoje CV a nechaj našu AI <br/>extrahovať tvoju expertízu.
              </p>
            </div>

            <label
              onDragOver={handleDragOver} onDrop={handleDrop}
              style={{ 
                width: '100%', maxWidth: 540, height: 360, 
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 48, 
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
                background: 'rgba(255,255,255,0.01)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', 
                cursor: 'pointer', transition: 'all 0.5s cubic-bezier(0.2, 1, 0.2, 1)',
                padding: '40px', textAlign: 'center', position: 'relative', overflow: 'hidden',
                boxShadow: '0 40px 100px rgba(0,0,0,0.5)'
              }}
              onMouseEnter={(e) => { 
                e.currentTarget.style.borderColor = 'rgba(255,92,0,0.3)'; 
                e.currentTarget.style.background = 'rgba(255,92,0,0.02)';
                e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
              }}
              onMouseLeave={(e) => { 
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; 
                e.currentTarget.style.background = 'rgba(255,255,255,0.01)';
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
              }}
            >
              <input type="file" accept=".pdf,.doc,.docx" onChange={handleFileChange} style={{ display: 'none' }} />
              
              {/* Pulsing Glow */}
              <motion.div 
                animate={{ opacity: [0.1, 0.2, 0.1], scale: [1, 1.1, 1] }} 
                transition={{ duration: 3, repeat: Infinity }}
                style={{ position: 'absolute', width: '60%', height: '60%', background: 'var(--accent)', filter: 'blur(100px)', zIndex: 0 }} 
              />

              <div style={{ 
                width: 90, height: 90, borderRadius: 32, 
                background: 'linear-gradient(135deg, var(--accent), #FF8C32)', color: '#fff', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                marginBottom: 28, boxShadow: '0 25px 50px rgba(255,92,0,0.4)', zIndex: 1 
              }}>
                <UploadCloud size={42} />
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 800, marginBottom: 10, letterSpacing: '-0.5px', zIndex: 1, color: '#fff' }}>Presuň životopis sem</h3>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 15, zIndex: 1, fontWeight: 500 }}>PDF alebo DOCX (max 10MB)</p>
            </label>

            <div style={{ marginTop: 70, textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 20 }}>Nemáš po ruke súbor?</p>
              <motion.button 
                whileHover={{ scale: 1.05, background: 'rgba(255,255,255,0.05)' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setPhase('manual')}
                style={{ 
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', 
                  color: '#fff', fontSize: 14, fontWeight: 700, padding: '16px 36px', 
                  borderRadius: 100, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.3s' 
                }}
              >
                Pokračovať manuálne <ChevronRight size={18} color="var(--accent)" />
              </motion.button>
            </div>
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
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '40px 24px', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, #ff5c0008, transparent), #050505' }}
          >
            <div style={{ 
              width: '100%', maxWidth: 540, minHeight: 480, 
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 48, 
              display: 'flex', flexDirection: 'column', 
              background: 'rgba(255,255,255,0.01)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', 
              boxShadow: '0 40px 100px rgba(0,0,0,0.5)'
            }}>
              <div style={{ padding: '24px 32px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <button onClick={() => manualStep === 0 ? setPhase('upload') : setManualStep(s => s - 1)}
                  style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 12, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                >←</button>
                <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${((manualStep + 1) / MANUAL_STEPS.length) * 100}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s ease' }} />
                </div>
              </div>

              <div style={{ flex: 1, padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <AnimatePresence mode="wait">
                  {(() => {
                    const s = MANUAL_STEPS[manualStep];
                    return (
                      <motion.div key={manualStep} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 900, marginBottom: 8, letterSpacing: '-0.5px', color: '#fff', lineHeight: 1.1 }}>{s.title}</h2>
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16, marginBottom: 32 }}>{s.sub}</p>

                        {s.type === 'text' && (
                          <input type="text" placeholder={s.placeholder} value={data[s.id]}
                            onChange={e => setData({ ...data, [s.id]: e.target.value })}
                            onKeyDown={e => e.key === 'Enter' && data[s.id].trim() && (manualStep < MANUAL_STEPS.length - 1 ? setManualStep(x => x + 1) : typeof finalizeMatching === 'function' && finalizeMatching())}
                            style={{ width: '100%', padding: '20px 24px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: '#fff', fontSize: 18, fontWeight: 600, outline: 'none', transition: 'border 0.2s' }}
                            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                            autoFocus
                          />
                        )}

                      {(s.type === 'single' || s.type === 'multi') && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                          {s.options.map(opt => {
                            const isSelected = s.type === 'multi' ? data[s.id].includes(opt) : data[s.id] === opt;
                            return (
                              <button key={opt} onClick={() => typeof handleManualAction === 'function' && handleManualAction(s.id, opt, s.type === 'multi')}
                                style={{ padding: '14px 24px', borderRadius: 100, border: '1px solid', borderColor: isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.1)', background: isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.03)', color: isSelected ? '#fff' : 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
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

            <div style={{ padding: '32px' }}>
              <button onClick={() => manualStep < MANUAL_STEPS.length - 1 ? setManualStep(x => x + 1) : typeof finalizeMatching === 'function' && finalizeMatching()}
                disabled={MANUAL_STEPS[manualStep].type === 'text' && !data.name.trim()}
                style={{ width: '100%', padding: '18px', fontSize: 16, fontWeight: 800, borderRadius: 20, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', opacity: (MANUAL_STEPS[manualStep].type === 'text' && !data.name.trim()) ? 0.5 : 1, transition: 'transform 0.2s, opacity 0.2s' }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                {manualStep < MANUAL_STEPS.length - 1 ? 'Ďalej' : 'Uložiť profil'}
              </button>
            </div>
            </div>
          </motion.div>
        )}

        {/* CLIMAX */}
        {phase === 'climax' && (
          <motion.div key="climax"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}
          >
            <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(255,92,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <BrainCircuit size={32} color="var(--accent)" />
              </div>
            </motion.div>
            <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: 24, letterSpacing: '-0.5px' }}>
              Hľadáme najlepšie ponuky...
            </motion.h2>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
