import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n, useAppState } from '../contexts';
import { supabase } from '../supabase';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import SkillChipInput from '../components/SkillChipInput';

// Fix for default marker icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const LocationMarker = ({ position, setPosition }) => {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : (
    <Marker position={position} />
  );
};

const LABEL = { display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' };

const CreateListing = () => {
  const { t, lang } = useI18n();
  const { listings, setListings, companyProfile } = useAppState();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: 'Marketingový stážista',
    type: 'internship',
    workModel: 'Hybrid',
    location: 'Bratislava',
    duration: '3 months',
    startDate: new Date().toISOString().split('T')[0],
    rate: '8.00',
    rateUnit: '/hod',
    hours: '20 hod/týždenne',
    description: '',
    requirements: '',
    lat: 48.1486,
    lng: 17.1077
  });

  // AI Matching Criteria state
  const [criteria, setCriteria] = useState({
    required_skills: [],
    preferred_skills: [],
    min_education_level: 'none',
    preferred_fields: [],
    min_experience_years: 0,
    required_languages: [],
    location_strict: false,
    team_size: '',
    pace: '',
    industry: '',
    weight_skills: 3,
    weight_education: 2,
    weight_experience: 2,
    weight_location: 3,
    weight_languages: 2,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const setCoords = async (latlng) => {
    setFormData(prev => ({ ...prev, lat: latlng.lat, lng: latlng.lng }));
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}&zoom=18&addressdetails=1`);
      const data = await response.json();
      if (data && data.address) {
        const city = data.address.city || data.address.town || data.address.village || '';
        const street = data.address.road || '';
        const displayLoc = street ? `${street}, ${city}` : city;
        setFormData(prev => ({ ...prev, location: displayLoc }));
      }
    } catch (err) { console.error(err); }
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Language input helpers
  const addLanguage = () => {
    setCriteria(prev => ({
      ...prev,
      required_languages: [...prev.required_languages, { lang: 'Angličtina', min_level: 'B1' }],
    }));
  };
  const updateLanguage = (idx, field, value) => {
    setCriteria(prev => ({
      ...prev,
      required_languages: prev.required_languages.map((l, i) => i === idx ? { ...l, [field]: value } : l),
    }));
  };
  const removeLanguage = (idx) => {
    setCriteria(prev => ({
      ...prev,
      required_languages: prev.required_languages.filter((_, i) => i !== idx),
    }));
  };

  const handleSave = async () => {
    if (!formData.title || !formData.description) {
      setError(t('clFillFields'));
      return;
    }
    try {
      setLoading(true);
      setError('');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError(t('clNotLoggedIn')); return; }

      const uid = session.user.id;

      // Ensure employer row exists via direct query
      try {
        await supabase.from('employers').upsert({
          id: uid,
          name: companyProfile?.name || session.user.email?.split('@')[0] || 'Firma',
        }, { onConflict: 'id', ignoreDuplicates: true });
      } catch (e) {
        console.warn('Profile ensure non-fatal error:', e);
      }

      const payload = {
        title: formData.title,
        company: companyProfile?.name || 'Vaša Firma',
        employer_id: uid,
        location: formData.location,
        rate: formData.rate + '€',
        rate_unit: formData.rateUnit,
        hours: formData.hours,
        type: formData.type,
        work_model: formData.workModel,
        duration: formData.duration,
        start_date: formData.startDate,
        description: formData.description,
        requirements: formData.requirements,
        lat: formData.lat,
        lng: formData.lng,
        tags: [formData.type, formData.workModel, 'Nástup: ' + formData.startDate],
        logo: 'CX',
        color: '#FF5C00',
      };

      const { data, error: insertError } = await supabase.from('jobs').insert([payload]).select().single();
      if (insertError) throw insertError;

      // ── Save AI matching criteria ──
      try {
        await fetch('/api/job-criteria', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({
            job_id: data.id,
            ...criteria,
            work_model: formData.workModel,
          }),
        });
      } catch (critErr) {
        console.warn('Job criteria save non-fatal:', critErr.message);
      }

      setListings(prev => [{ ...payload, id: data.id }, ...prev]);
      navigate('/listings');
    } catch (err) {
      console.error(err);
      setError(err.message || t('clSaveError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ animation: 'tabSlideIn 0.4s ease' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: '400' }}>{t('newListing')}</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{t('clSub')}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '32px', alignItems: 'start' }}>
        {/* Form Side */}
        <div>
          <div style={{ background: 'var(--bg-card)', padding: '32px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', marginBottom: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={LABEL}>{t('aiPos')}</label>
                <input className="text-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>
              
              <div>
                <label style={LABEL}>{t('aiType')}</label>
                <select className="text-input" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                  <option value="internship">{t('clInternship')}</option>
                  <option value="part-time">{t('clPartTime')}</option>
                  <option value="full-time">{t('clFullTime')}</option>
                </select>
              </div>

              <div>
                <label style={LABEL}>{t('clWorkModel')}</label>
                <select className="text-input" value={formData.workModel} onChange={e => setFormData({...formData, workModel: e.target.value})}>
                  <option value="On-site">{t('clOnSite')}</option>
                  <option value="Hybrid">{t('clHybrid')}</option>
                  <option value="Remote">Remote</option>
                </select>
              </div>

              <div>
                <label style={LABEL}>{t('clDuration')}</label>
                <select className="text-input" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})}>
                  <option value="1 week">{t('cl1w')}</option>
                  <option value="1 month">{t('cl1m')}</option>
                  <option value="3 months">{t('cl3m')}</option>
                  <option value="6 months">{t('cl6m')}</option>
                  <option value="Long-term">{t('clLongTerm')}</option>
                </select>
              </div>

              <div>
                <label style={LABEL}>{t('clStartDate')}</label>
                <input type="date" className="text-input" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
              </div>

              <div>
                <label style={LABEL}>{t('clRate')}</label>
                <input className="text-input" type="number" step="0.01" value={formData.rate} onChange={e => setFormData({...formData, rate: e.target.value})} />
              </div>

              <div>
                <label style={LABEL}>{t('clHours')}</label>
                <select className="text-input" value={formData.hours} onChange={e => setFormData({...formData, hours: e.target.value})}>
                  <option value="10 hod/týždenne">10h / {lang === 'sk' ? 'týždenne' : 'week'}</option>
                  <option value="20 hod/týždenne">20h / {lang === 'sk' ? 'týždenne' : 'week'}</option>
                  <option value="30 hod/týždenne">30h / {lang === 'sk' ? 'týždenne' : 'week'}</option>
                  <option value="40 hod/týždenne">40h / {lang === 'sk' ? 'týždenne' : 'week'}</option>
                  <option value="Flexibilne / Dohodou">{t('clFlexible')}</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={LABEL}>{t('clDesc')}</label>
              <textarea 
                className="text-input" 
                style={{ minHeight: '120px', resize: 'vertical', lineHeight: '1.6' }} 
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder={t('clDescPh')}
              />
            </div>

            <div style={{ marginBottom: '32px' }}>
              <label style={LABEL}>{t('clReqs')}</label>
              <textarea 
                className="text-input" 
                style={{ minHeight: '100px', resize: 'vertical', lineHeight: '1.6' }} 
                value={formData.requirements} 
                onChange={e => setFormData({...formData, requirements: e.target.value})}
                placeholder={t('clReqsPh')}
              />
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* AI MATCHING CRITERIA SECTION                                      */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <div style={{ background: 'var(--bg-card)', padding: '32px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🤖</div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>
                  {lang === 'sk' ? 'AI Matching kritériá' : 'AI Matching Criteria'}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                  {lang === 'sk' ? 'Pomôžu nájsť najlepších kandidátov' : 'Helps find the best candidates'}
                </p>
              </div>
            </div>

            {/* Required Skills */}
            <div style={{ marginBottom: '20px' }}>
              <SkillChipInput
                value={criteria.required_skills}
                onChange={v => setCriteria({ ...criteria, required_skills: v })}
                label={lang === 'sk' ? 'Povinné zručnosti' : 'Required Skills'}
                placeholder={lang === 'sk' ? 'Hľadať zručnosti...' : 'Search skills...'}
              />
            </div>

            {/* Preferred Skills */}
            <div style={{ marginBottom: '20px' }}>
              <SkillChipInput
                value={criteria.preferred_skills}
                onChange={v => setCriteria({ ...criteria, preferred_skills: v })}
                label={lang === 'sk' ? 'Výhodou (nepovinné)' : 'Nice to Have (optional)'}
                placeholder={lang === 'sk' ? 'Bonusové zručnosti...' : 'Bonus skills...'}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              {/* Min Education */}
              <div>
                <label style={LABEL}>{lang === 'sk' ? 'Min. vzdelanie' : 'Min. Education'}</label>
                <select className="text-input" value={criteria.min_education_level} onChange={e => setCriteria({...criteria, min_education_level: e.target.value})}>
                  <option value="none">{lang === 'sk' ? 'Bez požiadavky' : 'No requirement'}</option>
                  <option value="high_school">{lang === 'sk' ? 'Stredná škola' : 'High School'}</option>
                  <option value="bachelors">{lang === 'sk' ? 'Bakalár (Bc.)' : "Bachelor's"}</option>
                  <option value="masters">{lang === 'sk' ? 'Magister (Mgr./Ing.)' : "Master's"}</option>
                </select>
              </div>

              {/* Min Experience */}
              <div>
                <label style={LABEL}>{lang === 'sk' ? 'Min. roky skúseností' : 'Min. Years Experience'}</label>
                <input className="text-input" type="number" min="0" max="20" value={criteria.min_experience_years} onChange={e => setCriteria({...criteria, min_experience_years: parseInt(e.target.value) || 0})} />
              </div>
            </div>

            {/* Languages */}
            <div style={{ marginBottom: '20px' }}>
              <label style={LABEL}>{lang === 'sk' ? 'Jazykové požiadavky' : 'Language Requirements'}</label>
              {criteria.required_languages.map((l, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                  <select className="text-input" style={{ flex: 1 }} value={l.lang} onChange={e => updateLanguage(idx, 'lang', e.target.value)}>
                    <option value="Angličtina">Angličtina</option>
                    <option value="Nemčina">Nemčina</option>
                    <option value="Francúzština">Francúzština</option>
                    <option value="Španielčina">Španielčina</option>
                    <option value="Slovenčina">Slovenčina</option>
                    <option value="Čeština">Čeština</option>
                    <option value="Maďarčina">Maďarčina</option>
                  </select>
                  <select className="text-input" style={{ width: '100px' }} value={l.min_level} onChange={e => updateLanguage(idx, 'min_level', e.target.value)}>
                    <option value="A1">A1</option>
                    <option value="A2">A2</option>
                    <option value="B1">B1</option>
                    <option value="B2">B2</option>
                    <option value="C1">C1</option>
                    <option value="C2">C2</option>
                  </select>
                  <button onClick={() => removeLanguage(idx)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>×</button>
                </div>
              ))}
              <button onClick={addLanguage} style={{ padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600, background: 'transparent', color: 'var(--text-muted)', border: '1px dashed var(--text-muted)', cursor: 'pointer' }}>
                + {lang === 'sk' ? 'Pridať jazyk' : 'Add language'}
              </button>
            </div>

            {/* Location strict toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', padding: '12px 16px', background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <input type="checkbox" checked={criteria.location_strict} onChange={e => setCriteria({...criteria, location_strict: e.target.checked})} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{lang === 'sk' ? 'Striktná lokalita' : 'Strict Location'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lang === 'sk' ? 'Kandidát musí byť v rovnakom meste' : 'Candidate must be in the same city'}</div>
              </div>
            </div>

            {/* Advanced toggle */}
            <button onClick={() => setShowAdvanced(!showAdvanced)} style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: 0, marginBottom: showAdvanced ? 16 : 0 }}>
              {showAdvanced ? '▾' : '▸'} {lang === 'sk' ? 'Rozšírené nastavenia' : 'Advanced Settings'}
            </button>

            {showAdvanced && (
              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={LABEL}>{lang === 'sk' ? 'Veľkosť tímu' : 'Team Size'}</label>
                    <select className="text-input" value={criteria.team_size} onChange={e => setCriteria({...criteria, team_size: e.target.value})}>
                      <option value="">—</option>
                      <option value="solo">{lang === 'sk' ? 'Jednotlivec' : 'Solo'}</option>
                      <option value="small">{lang === 'sk' ? 'Malý (2-5)' : 'Small (2-5)'}</option>
                      <option value="medium">{lang === 'sk' ? 'Stredný (6-15)' : 'Medium (6-15)'}</option>
                      <option value="large">{lang === 'sk' ? 'Veľký (15+)' : 'Large (15+)'}</option>
                    </select>
                  </div>
                  <div>
                    <label style={LABEL}>{lang === 'sk' ? 'Tempo práce' : 'Work Pace'}</label>
                    <select className="text-input" value={criteria.pace} onChange={e => setCriteria({...criteria, pace: e.target.value})}>
                      <option value="">—</option>
                      <option value="relaxed">{lang === 'sk' ? 'Pokojné' : 'Relaxed'}</option>
                      <option value="moderate">{lang === 'sk' ? 'Stredné' : 'Moderate'}</option>
                      <option value="fast-paced">{lang === 'sk' ? 'Rýchle' : 'Fast-paced'}</option>
                    </select>
                  </div>
                  <div>
                    <label style={LABEL}>{lang === 'sk' ? 'Odvetvie' : 'Industry'}</label>
                    <select className="text-input" value={criteria.industry} onChange={e => setCriteria({...criteria, industry: e.target.value})}>
                      <option value="">—</option>
                      <option value="tech">Tech / IT</option>
                      <option value="marketing">Marketing</option>
                      <option value="finance">{lang === 'sk' ? 'Financie' : 'Finance'}</option>
                      <option value="retail">{lang === 'sk' ? 'Obchod' : 'Retail'}</option>
                      <option value="other">{lang === 'sk' ? 'Iné' : 'Other'}</option>
                    </select>
                  </div>
                </div>

                {/* Weights */}
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>
                  {lang === 'sk' ? 'Váhy hodnotenia (1–5)' : 'Scoring Weights (1–5)'}
                </div>
                {[
                  { key: 'weight_skills', label: lang === 'sk' ? 'Zručnosti' : 'Skills' },
                  { key: 'weight_education', label: lang === 'sk' ? 'Vzdelanie' : 'Education' },
                  { key: 'weight_experience', label: lang === 'sk' ? 'Skúsenosti' : 'Experience' },
                  { key: 'weight_location', label: lang === 'sk' ? 'Lokalita' : 'Location' },
                  { key: 'weight_languages', label: lang === 'sk' ? 'Jazyky' : 'Languages' },
                ].map(w => (
                  <div key={w.key} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, width: 80, color: 'var(--text)' }}>{w.label}</span>
                    <input type="range" min={1} max={5} value={criteria[w.key]} onChange={e => setCriteria({...criteria, [w.key]: parseInt(e.target.value)})} style={{ flex: 1, accentColor: 'var(--accent)' }} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)', width: 20, textAlign: 'center' }}>{criteria[w.key]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div style={{ color: '#ef4444', background: '#fee2e2', padding: '12px', borderRadius: '12px', marginBottom: '20px', fontSize: '13px', border: '1px solid #fecaca' }}>
              ⚠️ {error}
            </div>
          )}

          <button 
            className="btn-main" 
            onClick={handleSave} 
            disabled={loading}
            style={{ 
              height: '52px', fontSize: '16px', width: '100%',
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer' 
            }}
          >
            {loading ? t('clPublishing') : t('clPublish')}
          </button>
        </div>

        {/* Info/Map Side */}
        <div style={{ position: 'sticky', top: '24px' }}>
          <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: '24px' }}>
            <label style={LABEL}>{t('aiLoc')}</label>
            <input className="text-input" value={formData.location} readOnly style={{ marginBottom: '16px', opacity: 0.8 }} />
            
            <div style={{ height: '260px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <MapContainer center={[formData.lat, formData.lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="&copy; OSM" />
                <LocationMarker position={{ lat: formData.lat, lng: formData.lng }} setPosition={setCoords} />
              </MapContainer>
            </div>
          </div>
          
          <div style={{ padding: '0 12px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            <p>💡 {t('clTip')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateListing;
