import React, { useState } from 'react';
import { useI18n, useAppState } from '../contexts';
import QuizStep from '../components/QuizStep';
import { useNavigate } from 'react-router-dom';

const Onboarding = () => {
  const { t, lang } = useI18n();
  const { setCompanyProfile } = useAppState();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [obData, setObData] = useState({
    name: '',
    industry: '',
    locations: [],
    hiring: []
  });

  const nextStep = () => {
    if (step < 3) setStep(step + 1);
    else finishOnboarding();
  };

  const prevStep = () => {
    if (step > 0) setStep(step - 1);
  };

  const finishOnboarding = () => {
    setCompanyProfile(obData);
    navigate('/dashboard');
  };

  const industryOpts = ['IT', 'Financie', 'Obchod', 'Gastro', 'Marketing', 'Iné'];
  const locOpts = ['Bratislava', 'Košice', 'Žilina', 'Trnava', 'Zvolen', 'Iné'];
  const hiringOpts = ['Stáž', 'Brigáda', 'Plný úväzok', 'Jednorázovky'];

  const handleMulti = (key, val) => {
    const arr = [...obData[key]];
    if (arr.includes(val)) setObData({...obData, [key]: arr.filter(x => x !== val)});
    else setObData({...obData, [key]: [...arr, val]});
  };

  return (
    <div style={{ height: '100vh' }}>
      {step === 0 && (
        <QuizStep step={1} total={4} label={t('ob1')} subtitle={t('ob1s')} pFill="25%" onNext={nextStep} onBack={() => {}}>
          <input className="text-input" placeholder="Názov firmy" value={obData.name} onChange={e => setObData({...obData, name: e.target.value})} />
        </QuizStep>
      )}
      
      {step === 1 && (
        <QuizStep step={2} total={4} label={t('ob2')} subtitle={t('ob2s')} pFill="50%" onNext={nextStep} onBack={prevStep}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {industryOpts.map(o => (
              <div 
                key={o} 
                onClick={() => setObData({...obData, industry: o})}
                style={{
                  padding: '9px 16px', border: `1.5px solid ${obData.industry === o ? 'var(--accent)' : 'var(--border)'}`, 
                  borderRadius: '100px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s',
                  background: obData.industry === o ? 'var(--accent)' : 'var(--bg)', color: obData.industry === o ? '#fff' : 'var(--text)'
                }}
              >{o}</div>
            ))}
          </div>
        </QuizStep>
      )}

      {step === 2 && (
        <QuizStep step={3} total={4} label={t('ob3')} subtitle={t('ob3s')} pFill="75%" onNext={nextStep} onBack={prevStep}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {locOpts.map(o => (
              <div 
                key={o} 
                onClick={() => handleMulti('locations', o)}
                style={{
                  padding: '9px 16px', border: `1.5px solid ${obData.locations.includes(o) ? 'var(--accent)' : 'var(--border)'}`, 
                  borderRadius: '100px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s',
                  background: obData.locations.includes(o) ? 'var(--accent)' : 'var(--bg)', color: obData.locations.includes(o) ? '#fff' : 'var(--text)'
                }}
              >{o}</div>
            ))}
          </div>
        </QuizStep>
      )}

      {step === 3 && (
        <QuizStep step={4} total={4} label={t('ob4')} subtitle={t('ob4s')} pFill="100%" onNext={nextStep} onBack={prevStep}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {hiringOpts.map(o => (
              <div 
                key={o} 
                onClick={() => handleMulti('hiring', o)}
                style={{
                  padding: '9px 16px', border: `1.5px solid ${obData.hiring.includes(o) ? 'var(--accent)' : 'var(--border)'}`, 
                  borderRadius: '100px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s',
                  background: obData.hiring.includes(o) ? 'var(--accent)' : 'var(--bg)', color: obData.hiring.includes(o) ? '#fff' : 'var(--text)'
                }}
              >{o}</div>
            ))}
          </div>
        </QuizStep>
      )}
    </div>
  );
};

export default Onboarding;
