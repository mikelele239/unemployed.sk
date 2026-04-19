import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n, useAppState } from '../contexts';

const CreateListing = () => {
  const { t, lang } = useI18n();
  const { listings, setListings, companyProfile } = useAppState();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: 'Marketingový stážista',
    type: 'internship',
    location: 'Bratislava'
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState(false);

  const handleGenerate = () => {
    setIsGenerating(true);
    setResult(true);

    const descText = lang === 'sk'
      ? `Hľadáme motivovaného študenta alebo absolventa na pozíciu ${formData.title} v ${formData.location}. Pridajte sa k nášmu tímu a získajte cenné skúsenosti v dynamickom prostredí.`
      : `We are looking for a motivated student or graduate for the position of ${formData.title} in ${formData.location}. Join our team and gain valuable experience in a dynamic environment.`;
    
    setTimeout(() => {
      setIsGenerating(false);
    }, 1500); // Simulate API latency
  };

  const handleSave = () => {
    const newItem = {
      id: Date.now(),
      title: formData.title,
      title_en: formData.title,
      type: formData.type,
      location: formData.location,
      status: 'Active',
      views: 0,
      applications: 0,
      date: new Date().toISOString()
    };
    setListings([...listings, newItem]);
    navigate('/listings');
  };

  return (
    <div style={{ animation: 'tabSlideIn 0.3s cubic-bezier(0.4, 0, 0.15, 1)', paddingBottom: '30px' }}>
      <div style={{ padding: '16px 18px 10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button onClick={() => navigate(-1)} style={{ width: '32px', height: '32px', border: 'none', background: 'var(--bg-card)', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)' }}>
          ←
        </button>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700' }}>{t('aiTitle')}</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('aiSub')}</p>
        </div>
      </div>

      <div style={{ padding: '0 18px' }}>
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>{t('aiPos')}</label>
          <input className="text-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="napr. Marketingový stážista" />
        </div>
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>{t('aiType')}</label>
          <select className="text-input" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
            <option value="internship">Stáž</option>
            <option value="part-time">Brigáda</option>
            <option value="full-time">Plný úväzok</option>
          </select>
        </div>
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>{t('aiLoc')}</label>
          <input className="text-input" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="napr. Bratislava" />
        </div>

        <button 
          className="btn-main" 
          onClick={handleGenerate}
          disabled={isGenerating}
          style={{
            background: 'linear-gradient(135deg, #FF8C32 0%, #FF5C00 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            marginTop: '18px', opacity: isGenerating ? 0.6 : 1
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          <span>{isGenerating ? 'Generujem...' : t('aiGen')}</span>
        </button>

        {result && (
          <div style={{ marginTop: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', animation: 'fadeUp 0.4s ease' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>{formData.title}</h3>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>{companyProfile?.name || 'Compx'} • {formData.location}</div>
            
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--accent)', marginBottom: '4px' }}>{t('aiDescTitle')}</h4>
              <p style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--text-muted)' }}>
                {isGenerating ? <span className="typing-cursor"></span> : 
                  (lang === 'sk' ? `Hľadáme motivovaného kandidáta na pozíciu ${formData.title} v lokalite ${formData.location}.` : `Looking for a motivated candidate...`)
                }
              </p>
            </div>
            
            <button className="btn-main" onClick={handleSave} style={{ marginTop: '16px' }}>Uložiť a Publikovať</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateListing;
