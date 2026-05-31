import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const AnimatedEye = ({ isOpen }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <motion.path
      animate={{
        d: isOpen 
          ? "M3 12C7 5 17 5 21 12" 
          : "M3 12C7 16 17 16 21 12"
      }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
    />
    <motion.path
      animate={{
        d: isOpen 
          ? "M3 12C7 19 17 19 21 12" 
          : "M3 12C7 16 17 16 21 12"
      }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
    />
    <motion.circle
      cx="12"
      cy="12"
      fill="var(--accent)"
      animate={{
        r: isOpen ? 3.5 : 0,
        opacity: isOpen ? 1 : 0
      }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
    />
    <AnimatePresence>
      {!isOpen && (
        <motion.g
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -2 }}
          transition={{ duration: 0.15 }}
        >
          <line x1="7" y1="14.5" x2="5.5" y2="18.5" />
          <line x1="12" y1="16.2" x2="12" y2="20.7" />
          <line x1="17" y1="14.5" x2="18.5" y2="18.5" />
        </motion.g>
      )}
    </AnimatePresence>
  </svg>
);

export default function Inquiry() {
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 480);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 480);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const emailError = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Neplatný formát e-mailu.' : '';
  
  const getPasswordError = () => {
    if (!password) return '';
    const errors = [];
    if (password.length < 8) errors.push('aspoň 8 znakov');
    if (!/[A-Z]/.test(password)) errors.push('veľké písmeno');
    if (!/[a-z]/.test(password)) errors.push('malé písmeno');
    if (!/[0-9]/.test(password)) errors.push('číslo');
    if (!/[^A-Za-z0-9]/.test(password)) errors.push('špeciálny znak');
    
    if (errors.length > 0) {
      return `Heslo musí obsahovať: ${errors.join(', ')}.`;
    }
    return '';
  };
  const passwordError = getPasswordError();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !companyName || !password) return;

    if (passwordError) {
      setError(passwordError);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const res = await fetch('/api/auth/employer/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, companyName }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Registrácia zlyhala.');
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
  };

  if (success) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#050505',
        padding: isMobile ? 12 : 20,
        position: 'relative',
        overflowY: 'auto'
      }}>
        {/* Grid lines */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }} />

        <motion.div
           variants={containerVariants} initial="hidden" animate="visible"
           style={{
             width: '100%',
             maxWidth: 480,
             background: 'rgba(15, 15, 15, 0.7)',
             backdropFilter: 'blur(30px)',
             WebkitBackdropFilter: 'blur(30px)',
             borderRadius: 32,
             border: '1px solid rgba(255,255,255,0.08)',
             padding: isMobile ? '32px 20px' : '60px 50px',
             textAlign: 'center',
             boxShadow: '0 50px 150px var(--overlay-darker)',
             zIndex: 1
           }}
        >
           <div style={{ fontSize: 54, marginBottom: 24 }}>✉️</div>
           <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 400, color: '#fff', marginBottom: 16, letterSpacing: '-0.02em' }}>
             Overte svoj e-mail
           </h2>
           <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16, lineHeight: 1.5, marginBottom: 40 }}>
             Na váš e-mail sme odoslali overovací odkaz. Kliknite naň, aby ste aktivovali svoj účet a mohli sa prihlásiť.
           </p>
          <button onClick={() => navigate('/')} style={{
            width: '100%', padding: '20px', borderRadius: 18, border: 'none',
            background: 'var(--accent)', color: '#fff', fontWeight: 700,
            cursor: 'pointer', fontSize: 16, transition: 'all 0.3s'
          }}>
            Prihlásiť sa
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#050505',
      padding: isMobile ? 12 : 20,
      position: 'relative',
      overflowY: 'auto'
    }}>
      {/* Crosshatch Grid Background — matches landing page */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)
        `,
        backgroundSize: '80px 80px',
      }} />

      {/* Subtle accent glow */}
      <div style={{ position: 'absolute', width: '50vw', height: '50vw', background: 'var(--accent)', filter: 'blur(200px)', opacity: 0.04, top: '-15%', left: '-15%', borderRadius: '50%', zIndex: 0 }} />
      <div style={{ position: 'absolute', width: '35vw', height: '35vw', background: '#0070f3', filter: 'blur(150px)', opacity: 0.03, bottom: '-10%', right: '-10%', borderRadius: '50%', zIndex: 0 }} />

      <motion.div
        variants={containerVariants} initial="hidden" animate="visible"
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'rgba(15, 15, 15, 0.7)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          borderRadius: 32,
          border: '1px solid rgba(255,255,255,0.08)',
          padding: isMobile ? '32px 20px' : '60px 50px',
          boxShadow: '0 50px 150px var(--overlay-darker)',
          zIndex: 1,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <motion.div 
            whileHover={{ scale: 1.1, rotate: 5 }}
            style={{ 
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', 
              width: 72, height: 72, borderRadius: 22, 
              background: 'linear-gradient(135deg, #1a1a1a, #2a2a2a)', 
              border: '1px solid rgba(255,255,255,0.1)', 
              fontSize: 32, marginBottom: 28, 
              boxShadow: '0 20px 40px var(--overlay-dark)' 
            }}>
            🏢
          </motion.div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.6rem', fontWeight: 400, margin: 0, color: '#fff', letterSpacing: '-0.03em' }}>
            Registrácia Firmy
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: 12, fontSize: 16, fontWeight: 400, lineHeight: 1.5 }}>
            Vytvorte si účet a začnite <br/>hľadať mladé talenty.
          </p>
        </div>

        {error && (
          <div style={{ color: '#ff8c00', background: 'rgba(255, 140, 0, 0.1)', padding: '16px 20px', borderRadius: 18, marginBottom: 28, fontSize: 14, border: '1px solid rgba(255, 140, 0, 0.2)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 18 }}>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 10, fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Názov Firmy</label>
            <input 
              type="text" placeholder="Vaša firma, s.r.o." value={companyName} onChange={(e) => setCompanyName(e.target.value)} required autoFocus
              style={{ width: '100%', padding: '18px 22px', borderRadius: 18, border: '1px solid rgba(255,255,255,0.1)', background: 'var(--overlay-light)', color: '#fff', fontSize: 15, outline: 'none', transition: 'all 0.3s', boxSizing: 'border-box' }}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.3)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 10, fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Pracovný E-mail</label>
            <input 
              type="email" placeholder="hr@vasafirma.sk" value={email} onChange={(e) => setEmail(e.target.value)} required
              style={{ width: '100%', padding: '18px 22px', borderRadius: 18, border: '1px solid rgba(255,255,255,0.1)', background: 'var(--overlay-light)', color: '#fff', fontSize: 15, outline: 'none', transition: 'all 0.3s', boxSizing: 'border-box' }}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.3)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            />
            {emailError && (
              <div style={{ color: '#ff8c00', fontSize: 12, marginTop: 6, textAlign: 'left' }}>{emailError}</div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 10, fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Heslo</label>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                style={{ width: '100%', padding: '18px 60px 18px 22px', borderRadius: 18, border: '1px solid rgba(255,255,255,0.1)', background: 'var(--overlay-light)', color: '#fff', fontSize: 15, outline: 'none', transition: 'all 0.3s', boxSizing: 'border-box' }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.3)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AnimatedEye isOpen={showPassword} />
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 8, textAlign: 'left', lineHeight: 1.4 }}>
              🔒 Heslo musí mať aspoň 8 znakov, veľké a malé písmeno, číslo a špeciálny znak.
            </div>
            {passwordError && (
              <div style={{ color: '#ff8c00', fontSize: 12, marginTop: 6, textAlign: 'left' }}>{passwordError}</div>
            )}
          </div>

          <motion.button 
            whileHover={{ scale: 1.02, boxShadow: '0 20px 40px rgba(255, 92, 0, 0.2)' }}
            whileTap={{ scale: 0.98 }}
            type="submit" 
            disabled={loading}
            style={{ width: '100%', padding: '20px', borderRadius: 18, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 12, transition: 'all 0.3s' }}
          >
            {loading ? 'Vytváram účet...' : 'Vytvoriť účet'}
          </motion.button>
        </form>

        <div style={{ marginTop: 48, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 36 }}>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>
             Už máte firemný prístup? <span onClick={() => navigate('/')} style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 700, marginLeft: 4 }}>Prihláste sa</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
