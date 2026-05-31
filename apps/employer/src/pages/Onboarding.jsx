import React, { useState, useEffect, useRef } from 'react';
import { useI18n, useAppState } from '../contexts';
import { supabase } from '../supabase';
import QuizStep from '../components/QuizStep';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Globe, MapPin, Users, Briefcase, Check, Sparkles, Camera, Upload, X, Image as ImageIcon } from 'lucide-react';

const Onboarding = ({ onComplete }) => {
  const { t, lang } = useI18n();
  const { setCompanyProfile } = useAppState();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 480);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 480);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [obData, setObData] = useState({
    name: '',
    industry: '',
    website: '',
    location: '',
    hiring_types: [],
    team_size: '',
  });

  // Logo upload state
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef(null);

  const totalSteps = 5;

  const industryOpts = [
    { sk: 'IT & Technológie', en: 'IT & Technology', emoji: '💻' },
    { sk: 'Marketing', en: 'Marketing', emoji: '📣' },
    { sk: 'Financie', en: 'Finance', emoji: '💰' },
    { sk: 'Obchod & Retail', en: 'Sales & Retail', emoji: '🛍️' },
    { sk: 'Gastronómia & Hotelierstvo', en: 'Gastronomy & Hospitality', emoji: '🍽️' },
    { sk: 'Stavebníctvo', en: 'Construction', emoji: '🏗️' },
    { sk: 'Zdravotníctvo', en: 'Healthcare', emoji: '🏥' },
    { sk: 'Vzdelávanie', en: 'Education', emoji: '📚' },
    { sk: 'Iné', en: 'Other', emoji: '🔹' },
  ];

  const cityOpts = ['Bratislava', 'Košice', 'Žilina', 'Trnava', 'Nitra', 'Banská Bystrica', 'Prešov', 'Trenčín'];

  const hiringOpts = [
    { sk: 'Stáž', en: 'Internship', emoji: '🎓' },
    { sk: 'Brigáda', en: 'Part-time', emoji: '⏰' },
    { sk: 'Plný úväzok', en: 'Full-time', emoji: '💼' },
    { sk: 'Jednorázovky', en: 'Gig work', emoji: '⚡' },
  ];

  const teamSizeOpts = [
    { value: '1-5', emoji: '👤' },
    { value: '6-20', emoji: '👥' },
    { value: '21-50', emoji: '🏢' },
    { value: '51-200', emoji: '🏬' },
    { value: '200+', emoji: '🏙️' },
  ];

  const nextStep = () => {
    if (step < totalSteps - 1) setStep(step + 1);
    else finishOnboarding();
  };

  const prevStep = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleHiringToggle = (val) => {
    const arr = [...obData.hiring_types];
    if (arr.includes(val)) setObData({ ...obData, hiring_types: arr.filter(x => x !== val) });
    else setObData({ ...obData, hiring_types: [...arr, val] });
  };

  // Logo upload handler
  const handleLogoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const uploadLogo = async (session) => {
    if (!logoFile || !session) return null;
    try {
      setLogoUploading(true);
      const formData = new FormData();
      formData.append('logo', logoFile);
      const res = await fetch('/api/employer/logo-upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        return data.logo_url;
      }
    } catch (err) {
      console.warn('Logo upload non-fatal:', err);
    } finally {
      setLogoUploading(false);
    }
    return null;
  };

  const skipOnboarding = () => {
    if (onComplete) onComplete();
    else navigate('/dashboard');
  };

  const finishOnboarding = async () => {
    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Upload logo first if selected
        let logoUrl = null;
        if (logoFile) {
          logoUrl = await uploadLogo(session);
        }

        const body = {
          name: obData.name,
          industry: obData.industry,
          description: obData.industry, // Save industry also as description for backward compat
          website: obData.website,
          location: obData.location,
          hiring_types: JSON.stringify(obData.hiring_types),
          team_size: obData.team_size,
        };
        const res = await fetch('/api/employer/ensure-profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          // Fallback: direct upsert with ALL fields
          await supabase.from('employers').upsert({
            id: session.user.id,
            name: obData.name,
            description: obData.industry,
            industry: obData.industry,
            website: obData.website,
            location: obData.location,
            hiring_types: JSON.stringify(obData.hiring_types),
            team_size: obData.team_size,
            onboarding_complete: true,
          }, { onConflict: 'id' });
        } else {
          // Also set the onboarding_complete flag explicitly
          try {
            await supabase.from('employers')
              .update({ onboarding_complete: true })
              .eq('id', session.user.id);
          } catch {} // Non-fatal
        }

        // Set localStorage flag so onboarding check skips DB call next time
        localStorage.setItem(`employer_onboarded_${session.user.id}`, 'true');
      }
      setCompanyProfile({
        name: obData.name,
        industry: obData.industry,
        website: obData.website,
        location: obData.location,
      });
    } catch (err) {
      console.error('Onboarding save error:', err);
      // Attempt fallback save with ALL fields
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.from('employers').upsert({
            id: session.user.id,
            name: obData.name,
            description: obData.industry,
            industry: obData.industry,
            website: obData.website,
            location: obData.location,
            hiring_types: JSON.stringify(obData.hiring_types),
            team_size: obData.team_size,
            onboarding_complete: true,
          }, { onConflict: 'id' });
          localStorage.setItem(`employer_onboarded_${session.user.id}`, 'true');
        }
      } catch (e2) {
        console.error('Fallback save also failed:', e2);
      }
    } finally {
      setSaving(false);
    }
    if (onComplete) onComplete();
    else navigate('/dashboard');
  };

  // ── Animated pill button ──────────────────────────────────────────────────
  const Pill = ({ active, onClick, children }) => (
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      animate={{
        background: active ? 'var(--accent)' : 'transparent',
        borderColor: active ? 'var(--accent)' : 'var(--border)',
        color: active ? '#fff' : 'var(--text)',
      }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{
        padding: '10px 18px',
        border: '1.5px solid',
        borderRadius: '100px',
        fontSize: '13px',
        fontWeight: '500',
        cursor: 'pointer',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <AnimatePresence>
        {active && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Check size={13} strokeWidth={3} />
          </motion.span>
        )}
      </AnimatePresence>
      {children}
    </motion.div>
  );

  // ── Input style ───────────────────────────────────────────────────────────
  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    background: 'var(--bg-card)',
    border: '1.5px solid var(--border)',
    borderRadius: '10px',
    color: 'var(--text)',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  };

  // ── Label style ───────────────────────────────────────────────────────────
  const labelStyle = {
    fontSize: '12px',
    fontWeight: '500',
    color: 'var(--text-muted)',
    marginBottom: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  };

  // ── Section style ─────────────────────────────────────────────────────────
  const sectionStyle = {
    marginBottom: '20px',
  };

  // ── Step labels ───────────────────────────────────────────────────────────
  const stepLabels = [
    { label: lang === 'sk' ? 'Základy firmy' : 'Company Basics', subtitle: lang === 'sk' ? 'Povedzte nám o vašej firme' : 'Tell us about your company' },
    { label: lang === 'sk' ? 'Detaily firmy' : 'Company Details', subtitle: lang === 'sk' ? 'Kde vás ľudia nájdu?' : 'Where can people find you?' },
    { label: lang === 'sk' ? 'Logo firmy' : 'Company Logo', subtitle: lang === 'sk' ? 'Pomôže kandidátom spoznať vašu značku' : 'Helps candidates recognize your brand' },
    { label: lang === 'sk' ? 'Čo hľadáte?' : 'What are you hiring for?', subtitle: lang === 'sk' ? 'Pomôže nám to nájsť správnych kandidátov' : 'This helps us find the right candidates' },
    { label: lang === 'sk' ? 'Takmer hotovo!' : 'Almost done!', subtitle: lang === 'sk' ? 'Skontrolujte údaje a začnite' : 'Review your info and get started' },
  ];

  const pFills = ['20%', '40%', '60%', '80%', '100%'];

  // ── Can proceed? ──────────────────────────────────────────────────────────
  const canProceed = () => {
    if (step === 0) return obData.name.trim().length > 0;
    return true;
  };

  // ── Button label ──────────────────────────────────────────────────────────
  const getNextLabel = () => {
    if (step === totalSteps - 1) {
      return saving
        ? (lang === 'sk' ? 'Ukladám...' : 'Saving...')
        : (lang === 'sk' ? 'Dokončiť a začať' : 'Finish & Get Started');
    }
    return lang === 'sk' ? 'Pokračovať' : 'Continue';
  };

  // ── Summary item ──────────────────────────────────────────────────────────
  const SummaryRow = ({ icon: Icon, label, value }) => (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '12px',
        padding: '12px 14px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        marginBottom: '8px',
      }}
    >
      <Icon size={16} style={{ color: 'var(--accent)', marginTop: '2px', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>{label}</div>
        <div style={{ fontSize: '14px', color: 'var(--text)', fontWeight: '500' }}>{value || '—'}</div>
      </div>
    </motion.div>
  );

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: isMobile ? 'auto' : '100vh',
      minHeight: '100vh',
      background: 'var(--bg)',
      overflowY: isMobile ? 'auto' : 'hidden',
    }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        >
          <QuizStep
            step={step + 1}
            total={totalSteps}
            label={stepLabels[step].label}
            subtitle={stepLabels[step].subtitle}
            pFill={pFills[step]}
            nextLabel={getNextLabel()}
            hideBack={step === 0}
            disabled={!canProceed() || saving}
            onNext={canProceed() && !saving ? (step === totalSteps - 1 ? finishOnboarding : nextStep) : undefined}
            onBack={step === 0 ? () => {} : prevStep}
          >
            {/* ── Step 0: Company Basics ──────────────────────────────────── */}
            {step === 0 && (
              <div>
                <div style={sectionStyle}>
                  <div style={labelStyle}>
                    <Building2 size={14} />
                    {lang === 'sk' ? 'Názov firmy' : 'Company name'} <span style={{ color: 'var(--accent)' }}>*</span>
                  </div>
                  <input
                    style={inputStyle}
                    placeholder={lang === 'sk' ? 'Vaša firma s.r.o.' : 'Your Company Ltd.'}
                    value={obData.name}
                    onChange={e => setObData({ ...obData, name: e.target.value })}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                    autoFocus
                  />
                </div>

                <div style={sectionStyle}>
                  <div style={labelStyle}>
                    <Briefcase size={14} />
                    {lang === 'sk' ? 'Odvetvie' : 'Industry'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {industryOpts.map(o => (
                      <Pill
                        key={o.sk}
                        active={obData.industry === o.sk}
                        onClick={() => setObData({ ...obData, industry: o.sk })}
                      >
                        <span>{o.emoji}</span> {lang === 'sk' ? o.sk : o.en}
                      </Pill>
                    ))}
                  </div>
                </div>

                {/* Skip link */}
                <div style={{ textAlign: 'center', marginTop: 12 }}>
                  <span
                    onClick={skipOnboarding}
                    style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3, opacity: 0.6, transition: 'opacity 0.2s' }}
                    onMouseOver={e => e.target.style.opacity = 1}
                    onMouseOut={e => e.target.style.opacity = 0.6}
                  >
                    {lang === 'sk' ? 'Preskočiť a vyplniť neskôr' : 'Skip and fill in later'}
                  </span>
                </div>
              </div>
            )}

            {/* ── Step 1: Company Details ─────────────────────────────────── */}
            {step === 1 && (
              <div>
                <div style={sectionStyle}>
                  <div style={labelStyle}>
                    <Globe size={14} />
                    {lang === 'sk' ? 'Webová stránka' : 'Website'}
                    <span style={{ color: 'var(--text-muted)', fontWeight: '400', fontSize: '11px' }}>
                      ({lang === 'sk' ? 'voliteľné' : 'optional'})
                    </span>
                  </div>
                  <input
                    style={inputStyle}
                    placeholder="https://www.example.sk"
                    value={obData.website}
                    onChange={e => setObData({ ...obData, website: e.target.value })}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  />
                </div>

                <div style={sectionStyle}>
                  <div style={labelStyle}>
                    <MapPin size={14} />
                    {lang === 'sk' ? 'Sídlo / Mesto' : 'Location / City'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                    {cityOpts.map(city => (
                      <Pill
                        key={city}
                        active={obData.location === city}
                        onClick={() => setObData({ ...obData, location: city })}
                      >
                        {city}
                      </Pill>
                    ))}
                  </div>
                  <input
                    style={inputStyle}
                    placeholder={lang === 'sk' ? 'Alebo zadajte vlastné mesto...' : 'Or enter custom city...'}
                    value={!cityOpts.includes(obData.location) ? obData.location : ''}
                    onChange={e => setObData({ ...obData, location: e.target.value })}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--accent)';
                      if (cityOpts.includes(obData.location)) setObData({ ...obData, location: '' });
                    }}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  />
                  {!obData.location && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{ fontSize: 11, color: 'var(--accent)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      💡 {lang === 'sk' ? 'Odporúčame vybrať mesto — pomôže kandidátom nájsť vás.' : 'We recommend selecting a city — it helps candidates find you.'}
                    </motion.div>
                  )}
                </div>
              </div>
            )}

            {/* ── Step 2: Logo Upload ────────────────────────────────────── */}
            {step === 2 && (
              <div>
                <div style={sectionStyle}>
                  <div style={labelStyle}>
                    <ImageIcon size={14} />
                    {lang === 'sk' ? 'Logo vašej firmy' : 'Your company logo'}
                    <span style={{ color: 'var(--text-muted)', fontWeight: '400', fontSize: '11px' }}>
                      ({lang === 'sk' ? 'voliteľné' : 'optional'})
                    </span>
                  </div>

                  {logoPreview ? (
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
                        padding: 24, borderRadius: 16, border: '2px solid var(--accent)',
                        background: 'rgba(255, 92, 0, 0.04)',
                      }}
                    >
                      <div style={{
                        width: 96, height: 96, borderRadius: 20, overflow: 'hidden',
                        border: '2px solid var(--border)', background: 'var(--bg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <img src={logoPreview} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => fileInputRef.current?.click()}
                          style={{
                            padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border)',
                            background: 'transparent', color: 'var(--text)', fontSize: 12, fontWeight: 600,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                          }}
                        >
                          <Camera size={13} /> {lang === 'sk' ? 'Zmeniť' : 'Change'}
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                          style={{
                            padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)',
                            background: 'transparent', color: '#ef4444', fontSize: 12, fontWeight: 600,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                          }}
                        >
                          <X size={13} /> {lang === 'sk' ? 'Odstrániť' : 'Remove'}
                        </motion.button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      whileHover={{ borderColor: 'var(--accent)', background: 'rgba(255, 92, 0, 0.02)' }}
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: 12, padding: '40px 20px', borderRadius: 16,
                        border: '2px dashed var(--border)', cursor: 'pointer',
                        transition: 'all 0.2s', textAlign: 'center',
                      }}
                    >
                      <div style={{
                        width: 56, height: 56, borderRadius: 16,
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Upload size={24} style={{ color: 'var(--text-muted)' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                          {lang === 'sk' ? 'Nahrajte logo firmy' : 'Upload company logo'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          PNG, JPG, SVG · max 5MB
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoSelect}
                    hidden
                  />

                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.5, textAlign: 'center' }}>
                    💡 {lang === 'sk'
                      ? 'Logo sa zobrazí vedľa vašich inzerátov a profilu. Kandidáti ľahšie spoznajú vašu značku.'
                      : 'Your logo appears alongside your listings and profile. It helps candidates recognize your brand.'}
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 3: Hiring Preferences ──────────────────────────────── */}
            {step === 3 && (
              <div>
                <div style={sectionStyle}>
                  <div style={labelStyle}>
                    <Briefcase size={14} />
                    {lang === 'sk' ? 'Typ pracovných pozícií' : 'Types of positions'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {hiringOpts.map(o => (
                      <Pill
                        key={o.sk}
                        active={obData.hiring_types.includes(o.sk)}
                        onClick={() => handleHiringToggle(o.sk)}
                      >
                        <span>{o.emoji}</span> {lang === 'sk' ? o.sk : `${o.en}`}
                      </Pill>
                    ))}
                  </div>
                </div>

                <div style={sectionStyle}>
                  <div style={labelStyle}>
                    <Users size={14} />
                    {lang === 'sk' ? 'Veľkosť tímu' : 'Team size'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {teamSizeOpts.map(sz => (
                      <Pill
                        key={sz.value}
                        active={obData.team_size === sz.value}
                        onClick={() => setObData({ ...obData, team_size: sz.value })}
                      >
                        <span>{sz.emoji}</span> {sz.value} {lang === 'sk' ? 'ľudí' : 'people'}
                      </Pill>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 4: Summary ─────────────────────────────────────────── */}
            {step === 4 && (
              <div>
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    marginBottom: '16px', padding: '10px 14px',
                    background: 'linear-gradient(135deg, rgba(255,92,0,0.08), rgba(255,92,0,0.02))',
                    border: '1px solid rgba(255,92,0,0.15)',
                    borderRadius: '10px',
                  }}
                >
                  <Sparkles size={16} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: '13px', color: 'var(--text)' }}>
                    {lang === 'sk'
                      ? 'Všetko môžete neskôr zmeniť v nastaveniach profilu.'
                      : 'You can change everything later in profile settings.'}
                  </span>
                </motion.div>

                <SummaryRow
                  icon={Building2}
                  label={lang === 'sk' ? 'Firma' : 'Company'}
                  value={obData.name}
                />
                <SummaryRow
                  icon={Briefcase}
                  label={lang === 'sk' ? 'Odvetvie' : 'Industry'}
                  value={obData.industry}
                />
                <SummaryRow
                  icon={Globe}
                  label={lang === 'sk' ? 'Web' : 'Website'}
                  value={obData.website}
                />
                <SummaryRow
                  icon={MapPin}
                  label={lang === 'sk' ? 'Sídlo' : 'Location'}
                  value={obData.location}
                />
                {logoPreview && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 14px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      marginBottom: '8px',
                    }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 8, overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)' }}>
                      <img src={logoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Logo</div>
                      <div style={{ fontSize: '14px', color: 'var(--text)', fontWeight: '500' }}>
                        {lang === 'sk' ? 'Nahraté' : 'Uploaded'} ✓
                      </div>
                    </div>
                  </motion.div>
                )}
                <SummaryRow
                  icon={Briefcase}
                  label={lang === 'sk' ? 'Hľadáte' : 'Hiring for'}
                  value={obData.hiring_types.length > 0 ? obData.hiring_types.join(', ') : '—'}
                />
                <SummaryRow
                  icon={Users}
                  label={lang === 'sk' ? 'Veľkosť tímu' : 'Team size'}
                  value={obData.team_size}
                />

                {(saving || logoUploading) && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: '8px', marginTop: '12px', color: 'var(--text-muted)', fontSize: '13px',
                  }}>
                    <div style={{
                      width: 18, height: 18,
                      border: '2px solid var(--border)',
                      borderTopColor: 'var(--accent)',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }} />
                    {logoUploading
                      ? (lang === 'sk' ? 'Nahrávam logo...' : 'Uploading logo...')
                      : (lang === 'sk' ? 'Ukladám...' : 'Saving...')}
                  </div>
                )}
              </div>
            )}
          </QuizStep>
        </motion.div>
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default Onboarding;
