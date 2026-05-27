import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase';

export default function CandidateAuth({ onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const reset = (newMode) => {
    setMode(newMode);
    setError('');
    setMessage('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
  };

  const handleCandidateSubmit = async (e) => {
    e.preventDefault();

    if (mode === 'forgot') {
      if (!email) return;
      try {
        setLoading(true);
        setError('');
        setMessage('');
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, portal: 'student' }),
        });
        const result = await res.json();
        setMessage(result.message || 'Odkaz na obnovenie hesla bol odoslaný.');
      } catch (err) {
        setMessage('Odkaz na obnovenie hesla bol odoslaný.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email || !password) return;
    if (mode === 'register' && !fullName) return setError('Prosím zadajte svoje meno.');

    if (mode === 'register' && password !== confirmPassword) {
      return setError('Heslá sa nezhodujú.');
    }
    if (mode === 'register' && password.length < 8) {
      return setError('Heslo musí mať aspoň 8 znakov.');
    }

    try {
      setLoading(true);
      setError('');
      setMessage('');

      if (mode === 'register') {
        // Register via server-side admin API to avoid Supabase email rate limits
        const res = await fetch('/api/auth/student/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, fullName }),
        });
        const result = await res.json();
        if (!res.ok) {
          throw new Error(result.details || result.error || 'Registrácia zlyhala.');
        }

        // Do NOT auto-login since email verification is required.
        // Prompt them to check their email and switch to login mode.
        setMessage('Registrácia bola úspešná! Na váš e-mail sme odoslali overovací odkaz. Pred prvým prihlásením prosím kliknite na odkaz v správe (skontrolujte aj SPAM).');
        setPassword('');
        setConfirmPassword('');
        setMode('login');
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        if (onLoginSuccess) onLoginSuccess(data.session);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 480);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 480);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0a',
      padding: isMobile ? '12px' : '16px',
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
      <div style={{ position: 'absolute', width: '50vw', height: '50vw', background: 'var(--accent)', filter: 'blur(200px)', opacity: 0.04, top: '-20%', right: '-15%', borderRadius: '50%', zIndex: 0 }} />
      <div style={{ position: 'absolute', width: '35vw', height: '35vw', background: '#0070f3', filter: 'blur(150px)', opacity: 0.03, bottom: '-10%', left: '-10%', borderRadius: '50%', zIndex: 0 }} />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'rgba(20, 20, 20, 0.7)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 28,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: isMobile ? '24px 20px 20px' : '28px 28px 24px',
          boxShadow: '0 32px 100px rgba(0,0,0,0.5)',
          zIndex: 1
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <motion.div 
            whileHover={{ scale: 1.05, rotate: 5 }}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 48, height: 48, borderRadius: 16,
              background: 'linear-gradient(135deg, var(--accent), #ff8c00)',
              marginBottom: 12, fontSize: 24,
              boxShadow: '0 8px 24px rgba(255, 92, 0, 0.3)',
            }}>
            🎓
          </motion.div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 400, margin: 0, letterSpacing: '-0.03em', color: '#fff' }}>
            {mode === 'forgot' ? 'Zabudnuté heslo' : mode === 'login' ? 'Vitaj späť' : 'Začni svoju cestu'}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 6, lineHeight: 1.4 }}>
            {mode === 'forgot' ? 'Zadajte e-mail a pošleme vám odkaz na obnovenie.' : mode === 'login' ? 'Tvoj dream job je na dosah ruky.' : 'Vytvor si účet a získaj prístup k top ponukám.'}
          </p>
        </div>

        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 16,
          padding: 6,
          marginBottom: 16,
          gap: 6,
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          {['login', 'register'].map((m) => (
            <button
              key={m}
              onClick={() => reset(m)}
              style={{
                flex: 1, padding: '10px', borderRadius: 10, border: 'none',
                background: mode === m ? 'var(--accent)' : 'transparent',
                color: mode === m ? '#fff' : 'rgba(255,255,255,0.4)',
                fontWeight: 600, fontSize: 13, cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              {m === 'login' ? 'Prihlásiť sa' : 'Registrovať sa'}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {error && (
              <div style={{ color: '#ff4d4d', background: 'rgba(255, 77, 77, 0.1)', padding: '10px 14px', borderRadius: 12, marginBottom: 12, fontSize: 13, border: '1px solid rgba(255, 77, 77, 0.2)' }}>
                {error}
              </div>
            )}
            {message && (
              <div style={{ color: '#00e676', background: 'rgba(0, 230, 118, 0.1)', padding: '10px 14px', borderRadius: 12, marginBottom: 12, fontSize: 13, border: '1px solid rgba(0, 230, 118, 0.2)' }}>
                {message}
              </div>
            )}

            <form onSubmit={handleCandidateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {mode === 'register' && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                  <label style={{ display: 'block', marginBottom: 5, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Meno a priezvisko</label>
                  <input type="text" placeholder="Janko Hraško" value={fullName}
                    onChange={(e) => setFullName(e.target.value)} required 
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} 
                  />
                </motion.div>
              )}
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>E-mailová adresa</label>
                <input type="email" placeholder="meno@priklad.sk" value={email}
                  onChange={(e) => setEmail(e.target.value)} required 
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)', color: '#fff', fontSize: 14, outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box' }} 
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Heslo</label>
                <input type="password" placeholder="••••••••" value={password}
                  onChange={(e) => setPassword(e.target.value)} required 
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)', color: '#fff', fontSize: 14, outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box' }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
              {mode === 'register' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <label style={{ display: 'block', marginBottom: 5, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Potvrdenie hesla</label>
                  <input type="password" placeholder="••••••••" value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)} required 
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} 
                  />
                </motion.div>
              )}
              {mode === 'login' && (
                <div style={{ textAlign: 'right', marginTop: -8 }}>
                  <span onClick={() => reset('forgot')} style={{ fontSize: 13, color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>Zabudli ste heslo?</span>
                </div>
              )}
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit" 
                disabled={loading} 
                style={{
                  width: '100%', padding: '16px', borderRadius: 14, border: 'none',
                  background: loading ? 'rgba(255,255,255,0.1)' : 'var(--accent)',
                  color: '#fff', fontWeight: 700, fontSize: 16,
                  cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4, 
                  boxShadow: loading ? 'none' : '0 12px 32px rgba(255, 92, 0, 0.2)',
                  transition: 'all 0.3s',
                }}>
                {loading ? 'Pracujem...' : (mode === 'forgot' ? 'Odoslať odkaz' : mode === 'login' ? 'Prihlásiť sa' : 'Vytvoriť účet')}
              </motion.button>
              {mode === 'forgot' && (
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <span onClick={() => reset('login')} style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>← Späť na prihlásenie</span>
                </div>
              )}
            </form>
          </motion.div>
        </AnimatePresence>

        <div style={{ marginTop: 16, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 14 }}>
          <a href="/login" style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.target.style.color = '#fff'} onMouseLeave={(e) => e.target.style.color = 'rgba(255,255,255,0.4)'}>
            ← Späť na výber portálu
          </a>
        </div>
      </motion.div>
    </div>
  );
}
