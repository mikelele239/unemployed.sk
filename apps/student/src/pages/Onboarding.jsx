import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STEPS = [
  { id: 'name', type: 'text', title: 'Ako sa voláš?', sub: 'Personalizujeme tvoj zážitok.', placeholder: 'Tvoje celé meno' },
  { id: 'edu', type: 'single', title: 'Stupeň vzdelania?', sub: 'Pomôže nám nájsť správne pozície.', options: ['Stredná škola', 'Vysoká škola', 'Absolvent'] },
  { id: 'loc', type: 'single', title: 'Kde bývaš?', sub: 'Uprednostníme práce v tvojom okolí.', options: ['Bratislava', 'Košice', 'Žilina', 'B. Bystrica', 'Nitra', 'Iné'] },
  { id: 'avail', type: 'multi', title: 'Kedy si dostupný/á?', sub: 'Označ všetko, čo platí.', options: ['Ráno', 'Popoludnie', 'Večer', 'Víkendy', 'Flexibilne'] },
  { id: 'jobType', type: 'multi', title: 'Aký typ práce?', sub: 'Vyber jednu alebo viac.', options: ['Brigáda', 'Stáž', 'Plný úväzok', 'Jednorázovky', 'Remote'] },
  { id: 'skills', type: 'multi', title: 'Tvoje silné stránky?', sub: 'Vyber vlastnosti, ktoré ťa najlepšie vystihujú.', options: ['Komunikatívny', 'Tímový hráč', 'Spoľahlivý', 'Rýchlo sa učí', 'Kreatívny', 'Detailista', 'Líder', 'Riešiteľ'], hasCvUpload: true },
];

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({ name: '', edu: '', loc: '', avail: [], jobType: [], skills: [] });
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState(0);

  const curStep = STEPS[step];

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      // Save data and process
      localStorage.setItem('unemployed_profile', JSON.stringify(data));
      runProcessing();
    }
  };

  const runProcessing = () => {
    setIsProcessing(true);
    let currentProcess = 0;
    const interval = setInterval(() => {
      currentProcess++;
      setProcessStep(currentProcess);
      if (currentProcess >= 4) {
        clearInterval(interval);
        setTimeout(() => onComplete(), 1000);
      }
    }, 800);
  };

  const handleChipClick = (id, option, isMulti) => {
    if (isMulti) {
      setData(prev => ({
        ...prev,
        [id]: prev[id].includes(option) ? prev[id].filter(o => o !== option) : [...prev[id], option]
      }));
    } else {
      setData(prev => ({ ...prev, [id]: option }));
    }
  };

  if (isProcessing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', padding: '24px', textAlign: 'center' }}>
        <motion.div 
          animate={{ rotate: 360 }} 
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', marginBottom: 20 }}
        />
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, marginBottom: 10 }}>Analyzujeme tvoj profil...</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 30 }}>Párujeme tvoje preferencie so stovkami ponúk.</p>
        
        <div style={{ textAlign: 'left', width: '100%', maxWidth: 260 }}>
          {['Kontrola preferencií', 'Párovanie so zamestnávateľmi', 'Hodnotenie najlepších zhôd', 'Príprava tvojho feedu'].map((txt, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', color: processStep > i ? 'var(--accent)' : 'var(--text-muted)', transition: 'color 0.3s' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid', borderColor: processStep > i ? 'var(--accent)' : 'var(--border)', background: processStep > i ? 'var(--accent)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                {processStep > i && '✓'}
              </div>
              <span style={{ fontSize: 14 }}>{txt}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button 
          onClick={() => step > 0 && setStep(s => s - 1)}
          style={{ width: 36, height: 36, background: 'var(--bg-card)', border: 'none', borderRadius: 10, cursor: step > 0 ? 'pointer' : 'default', opacity: step > 0 ? 1 : 0, color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          ←
        </button>
        <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${((step + 1) / STEPS.length) * 100}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s ease' }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{step + 1}/{STEPS.length}</span>
      </div>

      <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.5px' }}>{curStep.title}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>{curStep.sub}</p>

            {curStep.type === 'text' && (
              <input
                type="text"
                placeholder={curStep.placeholder}
                value={data[curStep.id]}
                onChange={(e) => setData({ ...data, [curStep.id]: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && data[curStep.id].trim() && handleNext()}
                style={{ width: '100%', padding: '16px 20px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 16, outline: 'none' }}
                autoFocus
              />
            )}

            {(curStep.type === 'single' || curStep.type === 'multi') && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {curStep.options.map(opt => {
                  const isSelected = curStep.type === 'multi' ? data[curStep.id].includes(opt) : data[curStep.id] === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => handleChipClick(curStep.id, opt, curStep.type === 'multi')}
                      style={{
                        padding: '12px 20px',
                        borderRadius: 100,
                        border: '1.5px solid',
                        borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                        background: isSelected ? 'var(--accent)' : 'var(--bg-card)',
                        color: isSelected ? '#fff' : 'var(--text)',
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            {curStep.hasCvUpload && (
              <div style={{ marginTop: 24, padding: '24px', border: '2px dashed var(--border)', borderRadius: 16, textAlign: 'center', cursor: 'pointer' }}>
                <p style={{ fontSize: 14, color: 'var(--text)' }}>📄 Nahrať CV</p>
                <span style={{ fontSize: 12, background: 'var(--bg-card)', padding: '4px 10px', borderRadius: 100, color: 'var(--text-muted)', display: 'inline-block', marginTop: 8 }}>Voliteľné</span>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div style={{ padding: '20px', paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))', background: 'linear-gradient(transparent, var(--bg) 25%)' }}>
        <button 
          onClick={handleNext}
          disabled={curStep.type === 'text' && !data.name.trim()}
          className="btn-primary"
          style={{ width: '100%', padding: '16px', fontSize: 16, borderRadius: 12, opacity: (curStep.type === 'text' && !data.name.trim()) ? 0.5 : 1 }}
        >
          {step < STEPS.length - 1 ? 'Pokračovať' : 'Dokončiť'}
        </button>
      </div>
    </div>
  );
}
