import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, Sparkles, CheckCircle2, ChevronRight, FileText, BrainCircuit, ShieldCheck, Mic } from 'lucide-react';
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
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 480);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 480);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Phase: 'upload' | 'parsing' | 'review' | 'manual' | 'climax'
  const [phase, setPhase] = useState('upload'); 
  const [parsingProgress, setParsingProgress] = useState(0);
  const [climaxStep, setClimaxStep] = useState(0);
  const [data, setData] = useState({
    name: '', edu: '', loc: '', avail: [], jobType: [], skills: [], bio: '', cv_id: null,
    workModel: '', languages: [], availHours: '', salaryExpect: '',
  });
  const [manualStep, setManualStep] = useState(0);
  const [addingSkillReview, setAddingSkillReview] = useState(false);
  const [parseWarnings, setParseWarnings] = useState([]);
  const [uploadError, setUploadError] = useState('');

  const MANUAL_STEPS = [
    { id: 'name',    type: 'text',   title: lang === 'en' ? 'What is your name?' : 'Ako sa voláš?',  sub: lang === 'en' ? 'Your full name for employers.' : 'Tvoje celé meno pre zamestnávateľov.', placeholder: 'Janko Hraško' },
    { id: 'edu',     type: 'single', title: lang === 'en' ? 'Education level' : 'Dosiahnuté vzdelanie',   sub: lang === 'en' ? 'Select your current level.' : 'Vyber tvoj aktuálny stav.',  options: lang === 'en' ? ['High school', 'University', 'Graduate'] : ['Stredná škola', 'Vysoká škola', 'Absolvent'] },
    { id: 'loc',     type: 'single', title: lang === 'en' ? 'Where do you want to work?' : 'Kde chceš pracovať?',   sub: lang === 'en' ? 'Select your preferred location.' : 'Vyber preferovanú lokalitu.',  options: ['Bratislava', 'Košice', 'Žilina', 'B. Bystrica', 'Nitra', 'Iné'] },
    { id: 'jobType', type: 'multi',  title: lang === 'en' ? 'What type of work?' : 'Aký úväzok hľadáš?',  sub: lang === 'en' ? 'You can pick multiple.' : 'Môžeš vybrať viac možností.', options: lang === 'en' ? ['Part-time', 'Internship', 'Full-time'] : ['Brigáda', 'Stáž', 'Plný úväzok'] },
    { id: 'workModel', type: 'single', title: lang === 'en' ? 'Work model preference' : 'Preferovaný model práce', sub: lang === 'en' ? 'Where would you like to work?' : 'Kde by si chcel pracovať?', options: lang === 'en' ? ['On-site', 'Hybrid', 'Remote'] : ['Na mieste', 'Hybrid', 'Remote'] },
    { id: 'languages', type: 'multi', title: lang === 'en' ? 'Languages you speak' : 'Jazyky, ktoré ovládaš', sub: lang === 'en' ? 'Select all that apply.' : 'Vyber všetky, ktoré ovládaš.', options: ['Slovenčina', 'Angličtina', 'Nemčina', 'Čeština', 'Maďarčina', 'Francúzština', 'Španielčina', 'Iné'] },
    { id: 'availHours', type: 'single', title: lang === 'en' ? 'Weekly availability' : 'Koľko hodín týždenne?', sub: lang === 'en' ? 'How many hours per week can you work?' : 'Koľko hodín týždenne môžeš pracovať?', options: ['10', '20', '30', '40+'] },
    { id: 'salaryExpect', type: 'single', title: lang === 'en' ? 'Salary expectation' : 'Platové očakávania', sub: lang === 'en' ? 'Monthly gross salary (€).' : 'Mesačná hrubá mzda (€).', options: lang === 'en' ? ['€400-600', '€600-900', '€900-1200', '€1200+'] : ['400-600€', '600-900€', '900-1200€', '1200+€'] },
    { id: 'skills', type: 'multi', title: lang === 'en' ? 'Your top skills' : 'Tvoje silné stránky', sub: lang === 'en' ? 'Select skills that describe you best.' : 'Vyber zručnosti, ktoré ťa najlepšie opisujú.', options: lang === 'en' ? SKILLS_POOL_EN : SKILLS_POOL_SK },
  ];

  // 1. Skip Welcome + pre-populate name from auth
  useEffect(() => {
    if (phase === 'welcome') setPhase('upload');
  }, [phase]);

  useEffect(() => {
    // Pre-populate name from Supabase auth metadata if available
    const prefill = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const fullName = session?.user?.user_metadata?.full_name;
        if (fullName && !data.name) {
          setData(prev => ({ ...prev, name: fullName }));
        }
      } catch {}
    };
    prefill();
  }, []);

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
    setParsingProgress(10);
    setParseWarnings([]);
    setUploadError('');

    try {
      setParsingProgress(30);
      const result = await cvApi.uploadCV(fileObj);
      setData(prev => ({ ...prev, cv_id: result.id }));
      setParsingProgress(40);

      // Now poll for the parsed AI profile
      let parsedAi = null;
      let finalStatus = 'processing';
      const pollDelays = [2000, 3000, 3000, 4000]; // 2s, 3s, 3s, 4s = 12s total
      
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (token) {
        for (let i = 0; i < pollDelays.length; i++) {
          setParsingProgress(40 + Math.round(((i + 1) / pollDelays.length) * 45)); // progresses from 40% to 85%
          await new Promise(resolve => setTimeout(resolve, pollDelays[i]));
          try {
            const aiRes = await fetch('/api/ai-profile', { 
              headers: { 'Authorization': `Bearer ${token}` } 
            });
            if (aiRes.ok) {
              const aiData = await aiRes.json();
              if (aiData.profile && aiData.profile.parse_status !== 'processing' && aiData.profile.parse_status !== 'pending') {
                parsedAi = aiData.profile;
                finalStatus = aiData.profile.parse_status;
                break;
              }
            }
          } catch (e) {
            console.warn('AI profile poll error:', e.message);
          }
        }
      }

      setParsingProgress(90);

      if (parsedAi && finalStatus !== 'failed') {
        // Map AI profile data to onboarding data format
        const eduMap = { high_school: 'Stredná škola', bachelors: 'Vysoká škola', masters: 'Vysoká škola', phd: 'Vysoká škola' };
        const eduMapEn = { high_school: 'High school', bachelors: 'University', masters: 'Graduate', phd: 'Graduate' };
        const allSkills = [...(parsedAi.hard_skills || []), ...(parsedAi.soft_skills || [])].slice(0, 10);

        // Map languages from AI
        const aiLangs = (parsedAi.languages || []).map(l => l.lang).filter(Boolean);

        // Map work model from AI
        const workModelMap = { 'on-site': lang === 'en' ? 'On-site' : 'Na mieste', 'hybrid': 'Hybrid', 'remote': 'Remote' };

        // Map preferred job types from AI
        const jobTypeDbMap = {
          'part-time': lang === 'en' ? 'Part-time' : 'Brigáda',
          'part_time': lang === 'en' ? 'Part-time' : 'Brigáda',
          'internship': lang === 'en' ? 'Internship' : 'Stáž',
          'full-time': lang === 'en' ? 'Full-time' : 'Plný úväzok',
          'full_time': lang === 'en' ? 'Full-time' : 'Plný úväzok',
        };
        const jobTypes = (parsedAi.preferred_job_types || []).map(t => jobTypeDbMap[t.toLowerCase()]).filter(Boolean);

        // Map salary expectation
        let salaryOption = '';
        if (parsedAi.salary_expectation) {
          const s = parsedAi.salary_expectation;
          if (s <= 600) salaryOption = lang === 'en' ? '€400-600' : '400-600€';
          else if (s <= 900) salaryOption = lang === 'en' ? '€600-900' : '600-900€';
          else if (s <= 1200) salaryOption = lang === 'en' ? '€900-1200' : '900-1200€';
          else salaryOption = lang === 'en' ? '€1200+' : '1200+€';
        }

        const name = parsedAi.full_name || data.name || '';
        const bio = parsedAi.ai_summary || (lang === 'en'
          ? (name || 'Student') + ' — ' + allSkills.slice(0, 3).join(', ') + '.'
          : (name || 'Študent') + ' — ' + allSkills.slice(0, 3).join(', ') + '.');

        setData(prev => ({
          ...prev,
          name: name || prev.name,
          bio: bio,
          skills: allSkills.length > 0 ? allSkills : prev.skills,
          edu: lang === 'en' ? (eduMapEn[parsedAi.education_level] || '') : (eduMap[parsedAi.education_level] || ''),
          loc: parsedAi.location || '',
          jobType: jobTypes.length > 0 ? jobTypes : prev.jobType,
          workModel: workModelMap[parsedAi.work_mode_preference || (parsedAi.preferred_work_models && parsedAi.preferred_work_models[0]) || ''] || '',
          languages: aiLangs.length > 0 ? aiLangs : prev.languages,
          availHours: parsedAi.availability_hours ? String(parsedAi.availability_hours) : '',
          salaryExpect: salaryOption || prev.salaryExpect,
        }));

        if (finalStatus === 'needs_review') {
          setParseWarnings([lang === 'sk'
            ? 'AI profil má nízku istotu — skontroluj údaje a doplň chýbajúce.'
            : 'AI profile has low confidence — review and fill in missing data.']);
        }
      } else {
        // CV was uploaded but parse failed or timed out — still go to review so user can fill in manually
        setParseWarnings([lang === 'sk'
          ? 'CV bolo nahrané, ale nepodarilo sa extrahovať dáta — vyplň údaje nižšie.'
          : 'CV uploaded but data extraction failed — please fill in below.']);
      }

      setParsingProgress(100);
      setTimeout(() => setPhase('review'), 400);

    } catch (err) {
      console.error('CV upload error:', err);
      setParseWarnings([
        (lang === 'sk' ? 'Chyba pri nahrávaní: ' : 'Upload error: ') + (err.message || 'Unknown error'),
        lang === 'sk' ? 'Vyplň údaje manuálne nižšie.' : 'Please fill in your details manually below.'
      ]);
      setParsingProgress(100);
      setTimeout(() => setPhase('review'), 400);
    }
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
        // Map work model back to DB format
        const workModelDbMap = { 'Na mieste': 'on-site', 'On-site': 'on-site', 'Hybrid': 'hybrid', 'Remote': 'remote' };
        // Parse salary from option string
        const salaryMap = { '400-600€': 500, '€400-600': 500, '600-900€': 750, '€600-900': 750, '900-1200€': 1050, '€900-1200': 1050, '1200+€': 1400, '€1200+': 1400 };

        const profileData = {
          user_id: session.user.id,
          email: session.user.email,
          first_name: nameParts[0] || '',
          last_name: nameParts.slice(1).join(' ') || '',
          education: data.edu || '',
          location: data.loc || '',
          skills: data.skills || [],
          job_preferences: data.jobType || [],
          work_model_preference: workModelDbMap[data.workModel] || null,
          languages_spoken: data.languages || [],
          availability_hours: parseInt(data.availHours) || null,
          salary_expectation: salaryMap[data.salaryExpect] || null,
          ...(data.cv_id && !data.cv_id.startsWith('mock-') ? { cv_id: data.cv_id } : {}),
        };

        // Try server-side API first (bypasses RLS)
        try {
          const token = (await supabase.auth.getSession()).data.session?.access_token;
          const res = await fetch('/api/student/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(profileData),
          });
          if (res.ok) {
            console.log('Profile saved via server API.');
          } else {
            throw new Error('Server API failed');
          }
        } catch {
          // Fallback to direct Supabase upsert
          const { error } = await supabase.from('profiles').upsert(profileData, { onConflict: 'user_id' });
          if (!error) console.log('Profile saved via Supabase.');
          else console.error('Profile save error:', error);
        }
      }
      // Mark onboarding complete in localStorage
      const uid = (await supabase.auth.getSession()).data.session?.user?.id;
      if (uid) localStorage.setItem('unemployed_onboarding_complete', uid);
      localStorage.setItem('unemployed_profile', JSON.stringify(data));
    } catch (err) { console.error('Error during finalizeMatching:', err); }

    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step >= 1) {
        clearInterval(interval);
        // Show the verification boost prompt instead of immediately calling onComplete
        setTimeout(() => setPhase('boost-profile'), 1500);
      }
    }, 1000);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: isMobile ? 'auto' : '100vh',
      minHeight: '100vh',
      background: 'var(--bg)',
      overflowY: isMobile ? 'auto' : 'hidden'
    }}>
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
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 400, letterSpacing: '-1px', marginBottom: 16 }}>
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
            style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '40px 24px', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, #ff5c0008, transparent), #050505', minHeight: 'min-content' }}
          >
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ 
                fontFamily: 'var(--font-display)', 
                fontSize: '1.4rem', 
                color: 'var(--text)',
                display: 'inline-flex',
                alignItems: 'center',
                cursor: 'default',
                whiteSpace: 'nowrap',
                marginBottom: 16,
                opacity: 0.8
              }}>
                <span style={{ position: 'relative' }}>
                  un
                  <span style={{ position: 'absolute', left: '-1px', right: '-1px', top: '50%', height: '2px', background: 'var(--accent)', borderRadius: '2px' }} />
                </span>
                employed.sk
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 400, letterSpacing: '-1.5px', lineHeight: 0.9, color: '#fff' }}>
                Vytvor si profil.
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, marginTop: 12, maxWidth: 420, margin: '12px auto 0', lineHeight: 1.5 }}>
                Nahraj svoje CV a nechaj našu AI <br/>extrahovať tvoju expertízu.
              </p>
            </div>

            <label
              onDragOver={handleDragOver} onDrop={handleDrop}
              style={{ 
                width: '100%', maxWidth: 480, minHeight: 200, 
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 36, 
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
                background: 'rgba(255,255,255,0.01)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', 
                cursor: 'pointer', transition: 'all 0.5s cubic-bezier(0.2, 1, 0.2, 1)',
                padding: '24px', textAlign: 'center', position: 'relative', overflow: 'hidden',
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
                width: 64, height: 64, borderRadius: 24, 
                background: 'linear-gradient(135deg, var(--accent), #FF8C32)', color: '#fff', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                marginBottom: 16, boxShadow: '0 16px 40px rgba(255,92,0,0.4)', zIndex: 1 
              }}>
                <UploadCloud size={32} />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.5px', zIndex: 1, color: '#fff' }}>Presuň životopis sem</h3>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, zIndex: 1, fontWeight: 500 }}>PDF alebo DOCX (max 10MB)</p>
            </label>

            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>Nemáš po ruke súbor?</p>
              <motion.button 
                whileHover={{ scale: 1.05, background: 'rgba(255,255,255,0.05)' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setPhase('manual')}
                style={{ 
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', 
                  color: '#fff', fontSize: 13, fontWeight: 700, padding: '12px 28px', 
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
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 400, marginBottom: 12 }}>{t('ob.parsing')}</h2>
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
            style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 20px', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 18, background: 'rgba(52,211,153,0.1)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={24} />
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 400, letterSpacing: '-0.5px' }}>{t('ob.reviewTitle')}</h2>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: parseWarnings.length > 0 ? 16 : 32 }}>{t('ob.reviewSub')}</p>

            {parseWarnings.length > 0 && (
              <div style={{
                background: 'rgba(255,170,0,0.08)', border: '1px solid rgba(255,170,0,0.25)',
                borderRadius: 12, padding: '12px 16px', marginBottom: 24,
                display: 'flex', alignItems: 'center', gap: 10,
                fontSize: 13, color: '#ffaa00', fontWeight: 600
              }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <span>{parseWarnings[0]}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Name Input */}
              <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 16, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('ob.reviewName')}</span>
                <input value={data.name} onChange={e => setData({ ...data, name: e.target.value })}
                  placeholder={t('ob.reviewNamePlaceholder')}
                  style={{ background: 'transparent', border: 'none', color: data.name ? 'var(--text)' : 'var(--text-muted)', fontSize: 18, fontWeight: 700, width: '100%', marginTop: 8, outline: 'none' }}
                />
              </div>

              {/* Education & Location */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200, background: 'var(--bg-card)', padding: 16, borderRadius: 16, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>{t('ob.reviewEdu')}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(lang === 'en' ? ['High school', 'University', 'Graduate'] : ['Stredná škola', 'Vysoká škola', 'Absolvent']).map(opt => (
                      <span key={opt} onClick={() => setData(prev => ({ ...prev, edu: opt }))}
                        style={{ padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                          background: data.edu === opt ? 'var(--accent)' : 'var(--bg)', color: data.edu === opt ? '#fff' : 'var(--text-muted)',
                          border: `1px solid ${data.edu === opt ? 'var(--accent)' : 'var(--border)'}` }}>{opt}</span>
                    ))}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 200, background: 'var(--bg-card)', padding: 16, borderRadius: 16, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>{t('ob.reviewLoc')}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {['Bratislava', 'Košice', 'Žilina', 'B. Bystrica', 'Nitra'].map(opt => (
                      <span key={opt} onClick={() => setData(prev => ({ ...prev, loc: opt }))}
                        style={{ padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                          background: data.loc === opt ? 'var(--accent)' : 'var(--bg)', color: data.loc === opt ? '#fff' : 'var(--text-muted)',
                          border: `1px solid ${data.loc === opt ? 'var(--accent)' : 'var(--border)'}` }}>{opt}</span>
                    ))}
                    <input value={!['Bratislava','Košice','Žilina','B. Bystrica','Nitra'].includes(data.loc) ? data.loc : ''} 
                      onChange={e => setData(prev => ({ ...prev, loc: e.target.value }))}
                      placeholder={lang === 'en' ? 'Other...' : 'Iné...'}
                      style={{ padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none', width: 80 }} />
                  </div>
                </div>
              </div>

              {/* Job Preferences & Work Model */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200, background: 'var(--bg-card)', padding: 16, borderRadius: 16, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
                    {lang === 'en' ? 'Preferred Job Types' : 'Preferovaný typ úväzku'}
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(lang === 'en' ? ['Part-time', 'Internship', 'Full-time'] : ['Brigáda', 'Stáž', 'Plný úväzok']).map(opt => {
                      const isSel = data.jobType.includes(opt);
                      return (
                        <span key={opt} onClick={() => setData(prev => ({
                          ...prev,
                          jobType: isSel ? prev.jobType.filter(x => x !== opt) : [...prev.jobType, opt]
                        }))}
                          style={{ padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                            background: isSel ? 'var(--accent)' : 'var(--bg)', color: isSel ? '#fff' : 'var(--text-muted)',
                            border: `1px solid ${isSel ? 'var(--accent)' : 'var(--border)'}` }}>{opt}</span>
                      );
                    })}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 200, background: 'var(--bg-card)', padding: 16, borderRadius: 16, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
                    {lang === 'en' ? 'Work Model Preference' : 'Model práce'}
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(lang === 'en' ? ['On-site', 'Hybrid', 'Remote'] : ['Na mieste', 'Hybrid', 'Remote']).map(opt => (
                      <span key={opt} onClick={() => setData(prev => ({ ...prev, workModel: opt }))}
                        style={{ padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                          background: data.workModel === opt ? 'var(--accent)' : 'var(--bg)', color: data.workModel === opt ? '#fff' : 'var(--text-muted)',
                          border: `1px solid ${data.workModel === opt ? 'var(--accent)' : 'var(--border)'}` }}>{opt}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Weekly Availability & Salary Expectation */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200, background: 'var(--bg-card)', padding: 16, borderRadius: 16, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
                    {lang === 'en' ? 'Hours / Week' : 'Dostupnosť (hod/týždeň)'}
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {['10', '20', '30', '40+'].map(opt => (
                      <span key={opt} onClick={() => setData(prev => ({ ...prev, availHours: opt }))}
                        style={{ padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                          background: data.availHours === opt ? 'var(--accent)' : 'var(--bg)', color: data.availHours === opt ? '#fff' : 'var(--text-muted)',
                          border: `1px solid ${data.availHours === opt ? 'var(--accent)' : 'var(--border)'}` }}>{opt}</span>
                    ))}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 200, background: 'var(--bg-card)', padding: 16, borderRadius: 16, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
                    {lang === 'en' ? 'Salary Expectation' : 'Platové očakávania'}
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(lang === 'en' ? ['€400-600', '€600-900', '€900-1200', '€1200+'] : ['400-600€', '600-900€', '900-1200€', '1200+€']).map(opt => (
                      <span key={opt} onClick={() => setData(prev => ({ ...prev, salaryExpect: opt }))}
                        style={{ padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                          background: data.salaryExpect === opt ? 'var(--accent)' : 'var(--bg)', color: data.salaryExpect === opt ? '#fff' : 'var(--text-muted)',
                          border: `1px solid ${data.salaryExpect === opt ? 'var(--accent)' : 'var(--border)'}` }}>{opt}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Languages spoken */}
              <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 16, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
                  {lang === 'en' ? 'Languages spoken' : 'Jazyky, ktoré ovládaš'}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {['Slovenčina', 'Angličtina', 'Nemčina', 'Čeština', 'Maďarčina', 'Francúzština', 'Španielčina', 'Iné'].map(opt => {
                    const isSel = data.languages.includes(opt);
                    return (
                      <span key={opt} onClick={() => setData(prev => ({
                        ...prev,
                        languages: isSel ? prev.languages.filter(x => x !== opt) : [...prev.languages, opt]
                      }))}
                        style={{ padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                          background: isSel ? 'var(--accent)' : 'var(--bg)', color: isSel ? '#fff' : 'var(--text-muted)',
                          border: `1px solid ${isSel ? 'var(--accent)' : 'var(--border)'}` }}>{opt}</span>
                    );
                  })}
                </div>
              </div>

              {/* Skills review */}
              <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 16, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12, display: 'block' }}>{t('ob.reviewSkills')}</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {data.skills.map(s => (
                    <span key={s} onClick={() => setData(prev => ({ ...prev, skills: prev.skills.filter(x => x !== s) }))} style={{ background: 'var(--accent-light)', color: 'var(--accent)', padding: '6px 12px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.2s' }} title={lang === 'en' ? 'Click to remove' : 'Klikni na odstránenie'}>{s} ✕</span>
                  ))}
                  {addingSkillReview ? (
                    <>
                      {(lang === 'en' ? SKILLS_POOL_EN : SKILLS_POOL_SK).filter(s => !data.skills.includes(s)).map(s => (
                        <span key={s} onClick={() => { setData(prev => ({ ...prev, skills: [...prev.skills, s] })); }} style={{ background: 'var(--bg)', color: 'var(--text-muted)', padding: '6px 12px', borderRadius: 100, fontSize: 13, fontWeight: 600, border: '1px dashed var(--border)', cursor: 'pointer', transition: 'all 0.2s' }}>{s}</span>
                      ))}
                      <span onClick={() => setAddingSkillReview(false)} style={{ background: 'transparent', color: 'var(--text-muted)', padding: '6px 12px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✕ {lang === 'en' ? 'Close' : 'Zavrieť'}</span>
                    </>
                  ) : (
                    <span onClick={() => setAddingSkillReview(true)} style={{ background: 'var(--border)', color: 'var(--text-muted)', padding: '6px 12px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}>
                      {t('ob.reviewAddMore')}
                    </span>
                  )}
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
            style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 20px', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, #ff5c0008, transparent), #050505' }}
          >
            <div style={{ 
              width: '100%', maxWidth: 540, minHeight: 0, 
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 36, 
              display: 'flex', flexDirection: 'column', 
              background: 'rgba(255,255,255,0.01)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', 
              boxShadow: '0 40px 100px rgba(0,0,0,0.5)'
            }}>
              <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <button onClick={() => manualStep === 0 ? setPhase('upload') : setManualStep(s => s - 1)}
                  style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 10, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                >←</button>
                <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${((manualStep + 1) / MANUAL_STEPS.length) * 100}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s ease' }} />
                </div>
              </div>

              <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <AnimatePresence mode="wait">
                  {(() => {
                    const s = MANUAL_STEPS[manualStep];
                    return (
                      <motion.div key={manualStep} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 400, marginBottom: 6, letterSpacing: '-0.5px', color: '#fff', lineHeight: 1.1 }}>{s.title}</h2>
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 20 }}>{s.sub}</p>

                        {s.type === 'text' && (
                          <input type="text" placeholder={s.placeholder} value={data[s.id]}
                            onChange={e => setData({ ...data, [s.id]: e.target.value })}
                            onKeyDown={e => e.key === 'Enter' && data[s.id].trim() && (manualStep < MANUAL_STEPS.length - 1 ? setManualStep(x => x + 1) : setPhase('review'))}
                            style={{ width: '100%', padding: '16px 20px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: '#fff', fontSize: 16, fontWeight: 600, outline: 'none', transition: 'border 0.2s', boxSizing: 'border-box' }}
                            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                            autoFocus
                          />
                        )}

                      {(s.type === 'single' || s.type === 'multi') && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {s.options.map(opt => {
                            const isSelected = s.type === 'multi' ? data[s.id].includes(opt) : data[s.id] === opt;
                            return (
                              <button key={opt} onClick={() => typeof handleManualAction === 'function' && handleManualAction(s.id, opt, s.type === 'multi')}
                                style={{ padding: '10px 18px', borderRadius: 100, border: '1px solid', borderColor: isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.1)', background: isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.03)', color: isSelected ? '#fff' : 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
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

            <div style={{ padding: '20px 24px' }}>
              <button onClick={() => manualStep < MANUAL_STEPS.length - 1 ? setManualStep(x => x + 1) : setPhase('review')}
                disabled={MANUAL_STEPS[manualStep].type === 'text' && !data.name.trim()}
                style={{ width: '100%', padding: '14px', fontSize: 15, fontWeight: 800, borderRadius: 16, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', opacity: (MANUAL_STEPS[manualStep].type === 'text' && !data.name.trim()) ? 0.5 : 1, transition: 'transform 0.2s, opacity 0.2s' }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                {manualStep < MANUAL_STEPS.length - 1 ? (lang === 'en' ? 'Continue' : 'Ďalej') : (lang === 'en' ? 'Review Profile' : 'Skontrolovať profil')}
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

        {/* BOOST PROFILE — Verification prompt */}
        {phase === 'boost-profile' && (
          <motion.div
            key="boost-profile"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: 40, textAlign: 'center', background: 'var(--bg)',
            }}
          >
            {/* Green success pulse */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200 }}
              style={{
                width: 72, height: 72, borderRadius: 24,
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 20,
                boxShadow: '0 12px 40px rgba(34,197,94,0.35)',
              }}
            >
              <CheckCircle2 size={36} color="#fff" />
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              style={{ fontSize: '1.7rem', fontWeight: 800, margin: '0 0 10px', letterSpacing: '-0.5px' }}
            >
              {lang === 'sk' ? 'Profil je pripravený!' : 'Profile is ready!'}
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={{ fontSize: 15, color: 'var(--text-muted)', maxWidth: 400, lineHeight: 1.6, margin: '0 0 28px' }}
            >
              {lang === 'sk'
                ? 'Teraz môžeš absolvovať krátky 2-3 minútový AI pohovor. Overeným kandidátom zamestnávatelia dôverujú viac.'
                : 'Now you can complete a short 2-3 minute AI interview. Verified candidates get more trust from employers.'}
            </motion.p>

            {/* Feature chips */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.38 }}
              style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 28 }}
            >
              {[
                { icon: '🌍', label: lang === 'sk' ? 'Jazyky' : 'Languages' },
                { icon: '💻', label: lang === 'sk' ? 'Zručnosti' : 'Skills' },
                { icon: '💼', label: lang === 'sk' ? 'Skúsenosti' : 'Experience' },
                { icon: '🤝', label: lang === 'sk' ? 'Soft skills' : 'Soft skills' },
              ].map(chip => (
                <span
                  key={chip.label}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 12px', borderRadius: 100,
                    background: 'rgba(255,92,0,0.08)', border: '1px solid rgba(255,92,0,0.2)',
                    fontSize: 12, fontWeight: 700, color: 'var(--accent)',
                  }}
                >
                  {chip.icon} {chip.label}
                </span>
              ))}
            </motion.div>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.46 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 340 }}
            >
              <button
                onClick={() => {
                  if (typeof onComplete === 'function') onComplete();
                  setTimeout(() => navigate('/messages', { state: { openVerification: true } }), 200);
                }}
                style={{
                  padding: '16px', borderRadius: 16, border: 'none',
                  background: 'linear-gradient(135deg, var(--accent), #FF8C32)',
                  color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 8px 24px rgba(255,92,0,0.3)', fontFamily: 'var(--font-body)',
                }}
              >
                <Mic size={18} />
                {lang === 'sk' ? 'Začať overenie teraz' : 'Start verification now'}
              </button>

              <button
                onClick={() => typeof onComplete === 'function' && onComplete()}
                style={{
                  padding: '14px', borderRadius: 16,
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text-muted)', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'var(--font-body)',
                }}
              >
                {lang === 'sk' ? 'Preskočiť — spraviť neskôr' : 'Skip — do it later'}
              </button>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55 }}
              style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 16, maxWidth: 300 }}
            >
              {lang === 'sk'
                ? '⚠️ Jedno pokus. Pohovor nie je možné opakovať.'
                : '⚠️ One attempt only. The interview cannot be repeated.'}
            </motion.p>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
