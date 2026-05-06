import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useTranslation } from '../I18nContext';
import { cvApi } from '../services/cvApi';
import { getAccessToken } from '../supabase';
import { isDemoMode } from '../demoMode';

import WelcomePhase  from '../components/onboarding/WelcomePhase';
import UploadPhase   from '../components/onboarding/UploadPhase';
import ParsingPhase  from '../components/onboarding/ParsingPhase';
import ReviewPhase   from '../components/onboarding/ReviewPhase';
import ManualPhase   from '../components/onboarding/ManualPhase';
import ClimaxPhase   from '../components/onboarding/ClimaxPhase';

const SKILLS_POOL_SK = ['Komunikatívny', 'Tímový hráč', 'Spoľahlivý', 'Rýchlo sa učí', 'Kreatívny', 'Detailista', 'Líder', 'Riešiteľ', 'Organizovaný', 'Angličtina B2'];
const SKILLS_POOL_EN = ['Communicative', 'Team player', 'Reliable', 'Fast learner', 'Creative', 'Detail-oriented', 'Leader', 'Problem solver', 'Organised', 'English B2'];
const JOB_TYPES_SK   = ['Brigáda', 'Stáž', 'Plný úväzok', 'Jednorázovky', 'Remote'];
const JOB_TYPES_EN   = ['Part-time', 'Internship', 'Full-time', 'One-off gigs', 'Remote'];

export default function Onboarding({ onComplete }) {
  const { t, lang } = useTranslation();

  const [phase, setPhase] = useState('welcome');
  const [parsingProgress, setParsingProgress] = useState(0);
  const [data, setData] = useState({ name: '', edu: '', loc: '', avail: [], jobType: [], skills: [], cv_id: null });
  const [manualStep, setManualStep] = useState(0);

  const MANUAL_STEPS = [
    { id: 'name',    type: 'text',   title: t('ob.manualName'),  sub: t('ob.manualNameSub'), placeholder: t('ob.manualNamePh') },
    { id: 'edu',     type: 'single', title: t('ob.manualEdu'),   sub: t('ob.manualEduSub'),  options: lang === 'en' ? ['High school', 'University', 'Graduate'] : ['Stredná škola', 'Vysoká škola', 'Absolvent'] },
    { id: 'loc',     type: 'single', title: t('ob.manualLoc'),   sub: t('ob.manualLocSub'),  options: ['Bratislava', 'Košice', 'Žilina', 'B. Bystrica', 'Nitra', lang === 'en' ? 'Other' : 'Iné'] },
    { id: 'jobType', type: 'multi',  title: t('ob.manualType'),  sub: t('ob.manualTypeSub'), options: lang === 'en' ? JOB_TYPES_EN : JOB_TYPES_SK },
  ];

  // Auto-advance from welcome screen
  useEffect(() => {
    if (phase !== 'welcome') return;
    const t = setTimeout(() => setPhase('upload'), 3000);
    return () => clearTimeout(t);
  }, [phase]);

  // CV file handler
  const handleFile = async (fileObj) => {
    try {
      const cvData = await cvApi.uploadCV(fileObj);
      setData(prev => ({ ...prev, cv_id: cvData.id }));
    } catch (err) {
      console.error('CV upload failed:', err);
    }

    // Extract name from filename heuristically
    let name = fileObj.name.replace(/\.[^/.]+$/, '')
      .replace(/_|-|cv|resume|životopis|zivotopis/gi, ' ')
      .replace(/\s+/g, ' ').trim();
    if (name) name = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    setData(prev => ({ ...prev, name: name || '' }));

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
      jobType: [...jobPool].sort(() => 0.5 - Math.random()).slice(0, 2),
      skills: [...skillsPool].sort(() => 0.5 - Math.random()).slice(0, 3),
    }));
    setTimeout(() => setPhase('review'), 600);
  };

  const finalizeMatching = async () => {
    setPhase('climax');
    const payload = { name: data.name, education: data.edu, location: data.loc, skills: data.skills, jobPreferences: data.jobType, cv_id: data.cv_id };
    try {
      if (isDemoMode()) {
        localStorage.setItem('unemployed_profile', JSON.stringify(data));
        localStorage.setItem('unemployed_profile_started', 'true');
      } else {
        const token = getAccessToken();
        await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
        localStorage.setItem('unemployed_profile', JSON.stringify(data));
        localStorage.setItem('unemployed_profile_started', 'true');
      }
    } catch (err) {
      console.error('Failed to save profile:', err);
    }

    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step >= 4) { clearInterval(interval); setTimeout(() => onComplete(), 1200); }
    }, 900);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', minHeight: 0, background: 'var(--bg)', overflow: 'hidden' }}>
      <AnimatePresence mode="wait">
        {phase === 'welcome' && <WelcomePhase />}
        {phase === 'upload'  && <UploadPhase onFile={handleFile} onSkip={() => setPhase('manual')} />}
        {phase === 'parsing' && <ParsingPhase progress={parsingProgress} />}
        {phase === 'review'  && <ReviewPhase data={data} setData={setData} onConfirm={finalizeMatching} />}
        {phase === 'manual'  && (
          <ManualPhase
            data={data} setData={setData}
            manualStep={manualStep} setManualStep={setManualStep}
            steps={MANUAL_STEPS}
            onBack={() => manualStep === 0 ? setPhase('upload') : setManualStep(s => s - 1)}
            onNext={() => setManualStep(s => s + 1)}
            onFinish={finalizeMatching}
          />
        )}
        {phase === 'climax'  && <ClimaxPhase />}
      </AnimatePresence>
    </div>
  );
}
