import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase';

export default function CandidateAuth({ onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
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
        // Register directly via Supabase Auth — no Express server needed
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { role: 'candidate', full_name: fullName }
          }
        });
        if (signUpError) throw signUpError;

        // If email confirmation is disabled in Supabase, session is returned immediately
        if (data.session) {
          if (onLoginSuccess) onLoginSuccess(data.session);
        } else {
          setMessage('Váš účet bol vytvorený! Skontrolujte si e-mail a potvrďte registráciu.');
          setMode('login');
        }
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

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0a',
      padding: 20,
      position: 'relative',
      overflow: 'hidden'
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
          maxWidth: 440,
          background: 'rgba(20, 20, 20, 0.7)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 32,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '48px 40px',
          boxShadow: '0 32px 100px rgba(0,0,0,0.5)',
          zIndex: 1
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <motion.div 
            whileHover={{ scale: 1.05, rotate: 5 }}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 64, height: 64, borderRadius: 20,
              background: 'linear-gradient(135deg, var(--accent), #ff8c00)',
              marginBottom: 20, fontSize: 32,
              boxShadow: '0 8px 24px rgba(255, 92, 0, 0.3)',
            }}>
            🎓
          </motion.div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 500, margin: 0, letterSpacing: '-0.03em', color: '#fff' }}>
            {mode === 'login' ? 'Vitaj späť' : 'Začni svoju cestu'}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, marginTop: 10, lineHeight: 1.5 }}>
            {mode === 'login' ? 'Tvoj dream job je na dosah ruky.' : 'Vytvor si účet a získaj prístup k top ponukám.'}
          </p>
        </div>

        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 16,
          padding: 6,
          marginBottom: 32,
          gap: 6,
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          {['login', 'register'].map((m) => (
            <button
              key={m}
              onClick={() => reset(m)}
              style={{
                flex: 1, padding: '12px', borderRadius: 12, border: 'none',
                background: mode === m ? 'var(--accent)' : 'transparent',
                color: mode === m ? '#fff' : 'rgba(255,255,255,0.4)',
                fontWeight: 600, fontSize: 14, cursor: 'pointer',
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
              <div style={{ color: '#ff4d4d', background: 'rgba(255, 77, 77, 0.1)', padding: '14px 18px', borderRadius: 16, marginBottom: 24, fontSize: 14, border: '1px solid rgba(255, 77, 77, 0.2)' }}>
                {error}
              </div>
            )}
            {message && (
              <div style={{ color: '#00e676', background: 'rgba(0, 230, 118, 0.1)', padding: '14px 18px', borderRadius: 16, marginBottom: 24, fontSize: 14, border: '1px solid rgba(0, 230, 118, 0.2)' }}>
                {message}
              </div>
            )}

            <form onSubmit={handleCandidateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {mode === 'register' && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Meno a priezvisko</label>
                  <input type="text" placeholder="Janko Hraško" value={fullName}
                    onChange={(e) => setFullName(e.target.value)} required 
                    style={{ width: '100%', padding: '16px 20px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)', color: '#fff', fontSize: 15, outline: 'none' }} 
                  />
                </motion.div>
              )}
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>E-mailová adresa</label>
                <input type="email" placeholder="meno@priklad.sk" value={email}
                  onChange={(e) => setEmail(e.target.value)} required 
                  style={{ width: '100%', padding: '16px 20px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)', color: '#fff', fontSize: 15, outline: 'none', transition: 'all 0.2s' }} 
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Heslo</label>
                <input type="password" placeholder="••••••••" value={password}
                  onChange={(e) => setPassword(e.target.value)} required 
                  style={{ width: '100%', padding: '16px 20px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)', color: '#fff', fontSize: 15, outline: 'none', transition: 'all 0.2s' }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
              {mode === 'register' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Potvrdenie hesla</label>
                  <input type="password" placeholder="••••••••" value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)} required 
                    style={{ width: '100%', padding: '16px 20px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)', color: '#fff', fontSize: 15, outline: 'none' }} 
                  />
                </motion.div>
              )}
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit" 
                disabled={loading} 
                style={{
                  width: '100%', padding: '18px', borderRadius: 16, border: 'none',
                  background: loading ? 'rgba(255,255,255,0.1)' : 'var(--accent)',
                  color: '#fff', fontWeight: 700, fontSize: 16,
                  cursor: loading ? 'not-allowed' : 'pointer', marginTop: 12, 
                  boxShadow: loading ? 'none' : '0 12px 32px rgba(255, 92, 0, 0.2)',
                  transition: 'all 0.3s',
                }}>
                {loading ? 'Pracujem...' : (mode === 'login' ? 'Prihlásiť sa' : 'Vytvoriť účet')}
              </motion.button>
            </form>
          </motion.div>
        </AnimatePresence>

        <div style={{ marginTop: 40, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 24 }}>
          <a href="/login" style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.target.style.color = '#fff'} onMouseLeave={(e) => e.target.style.color = 'rgba(255,255,255,0.4)'}>
            ← Späť na výber portálu
          </a>
        </div>
      </motion.div>
    </div>
  );
}
