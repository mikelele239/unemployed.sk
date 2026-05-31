import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase';

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

export default function EmployerAuth({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState('login'); // 'login' | 'forgot' | 'reset'
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetSession, setSession] = useState(null);

  const emailError = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Neplatný formát e-mailu.' : '';
  const passwordError = password && password.length < 6 ? 'Heslo musí mať aspoň 6 znakov.' : '';

  useEffect(() => {
    // Detect Supabase PASSWORD_RECOVERY event (user clicked reset link in email)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset');
        setSession(sess);
      }
    });

    // Also check hash on mount
    if (window.location.hash.includes('reset-password') || window.location.hash.includes('type=recovery')) {
      setMode('reset');
    }

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (mode === 'reset') {
      if (!newPassword || !confirmNewPassword) return;
      if (newPassword !== confirmNewPassword) return setError('Heslá sa nezhodujú.');
      if (newPassword.length < 8) return setError('Heslo musí mať aspoň 8 znakov.');
      try {
        setLoading(true);
        setError('');
        setMessage('');
        // Use the recovery session or current session
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        const token = resetSession?.access_token || currentSession?.access_token;
        if (!token) return setError('Neplatný alebo expirovaný odkaz. Skúste požiadať o nový.');
        const res = await fetch('/api/auth/update-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: token, new_password: newPassword }),
        });
        if (res.ok) {
          setMessage('Heslo bolo úspešne zmenené! Môžete sa prihlásiť.');
          setNewPassword('');
          setConfirmNewPassword('');
          // Sign out the recovery session and switch to login
          await supabase.auth.signOut();
          setTimeout(() => {
            setMode('login');
            window.location.hash = '';
          }, 2000);
        } else {
          const result = await res.json();
          setError(result.error || 'Nepodarilo sa zmeniť heslo.');
        }
      } catch (err) {
        setError('Nepodarilo sa zmeniť heslo. Skúste to znova.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === 'forgot') {
      if (!email) return;
      try {
        setLoading(true);
        setError('');
        setMessage('');
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, portal: 'employer' }),
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

    try {
      setLoading(true);
      setError('');
      setMessage('');

      // Direct Supabase auth — no Express needed
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      const session = data.session;
      if (!session) throw new Error('Nepodarilo sa prihlásiť.');

      // Check role — reject candidates
      const role = session.user.user_metadata?.role || session.user.app_metadata?.role;
      if (role === 'candidate') {
        await supabase.auth.signOut();
        throw new Error('Tento účet je registrovaný ako študent. Použite portál pre študentov.');
      }

      // Ensure employer row exists via direct query
      try {
        await supabase.from('employers').upsert({
          id: session.user.id,
          name: email.split('@')[0],
        }, { onConflict: 'id', ignoreDuplicates: true });
      } catch (e) {
        console.warn('Profile ensure non-fatal error:', e);
      }

      if (onLoginSuccess) onLoginSuccess(session);
    } catch (err) {
      setError(err.message || 'Nesprávne meno alebo heslo.');
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
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
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
          zIndex: 1
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
            {mode === 'reset' ? 'Nové heslo' : 'Portál Zamestnávateľa'}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: 12, fontSize: 16, fontWeight: 400, lineHeight: 1.5 }}>
            {mode === 'reset' ? 'Zadajte nové heslo pre váš účet.' : mode === 'forgot' ? 'Zadajte e-mail a pošleme vám odkaz na obnovenie.' : <><span>Profesionálna správa náborov</span><br/><span>a analýza talentov.</span></>}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} 
              animate={{ opacity: 1, height: 'auto' }} 
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ color: '#ff8c00', background: 'rgba(255, 140, 0, 0.1)', padding: '16px 20px', borderRadius: 18, marginBottom: 28, fontSize: 14, border: '1px solid rgba(255, 140, 0, 0.2)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 18 }}>⚠️</span> {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {message && (
          <div style={{ color: '#00e676', background: 'rgba(0, 230, 118, 0.1)', padding: '16px 20px', borderRadius: 18, marginBottom: 28, fontSize: 14, border: '1px solid rgba(0, 230, 118, 0.2)' }}>
            {message}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          {mode !== 'reset' && (
          <div>
            <label style={{ display: 'block', marginBottom: 10, fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Pracovný E-mail</label>
            <input 
              type="email" placeholder="hr@vasafirma.sk" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
              style={{ width: '100%', padding: '18px 22px', borderRadius: 18, border: '1px solid rgba(255,255,255,0.1)', background: 'var(--overlay-light)', color: '#fff', fontSize: 15, outline: 'none', transition: 'all 0.3s' }}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.3)'; e.target.style.background = 'var(--overlay-light)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.background = 'var(--overlay-light)'; }}
            />
            {emailError && (
              <div style={{ color: '#ff8c00', fontSize: 12, marginTop: 6, textAlign: 'left' }}>{emailError}</div>
            )}
          </div>
          )}

          {mode === 'login' && (
            <div>
              <label style={{ display: 'block', marginBottom: 10, fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Heslo</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required
                  style={{ width: '100%', padding: '18px 60px 18px 22px', borderRadius: 18, border: '1px solid rgba(255,255,255,0.1)', background: 'var(--overlay-light)', color: '#fff', fontSize: 15, outline: 'none', transition: 'all 0.3s' }}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.3)'; e.target.style.background = 'var(--overlay-light)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.background = 'var(--overlay-light)'; }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AnimatedEye isOpen={showPassword} />
                </button>
              </div>
              {passwordError && (
                <div style={{ color: '#ff8c00', fontSize: 12, marginTop: 6, textAlign: 'left' }}>{passwordError}</div>
              )}
              <div style={{ textAlign: 'right', marginTop: 10 }}>
                <span onClick={() => { setMode('forgot'); setError(''); setMessage(''); }} style={{ fontSize: 13, color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>Zabudli ste heslo?</span>
              </div>
            </div>
          )}
          {mode === 'reset' && (
          <>
            <div>
              <label style={{ display: 'block', marginBottom: 10, fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Nové heslo</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required autoFocus
                  style={{ width: '100%', padding: '18px 60px 18px 22px', borderRadius: 18, border: '1px solid rgba(255,255,255,0.1)', background: 'var(--overlay-light)', color: '#fff', fontSize: 15, outline: 'none', transition: 'all 0.3s' }}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.3)'; e.target.style.background = 'var(--overlay-light)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.background = 'var(--overlay-light)'; }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AnimatedEye isOpen={showPassword} />
                </button>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 10, fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Potvrdenie nového hesla</label>
              <input 
                type="password" placeholder="••••••••" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required
                style={{ width: '100%', padding: '18px 22px', borderRadius: 18, border: '1px solid rgba(255,255,255,0.1)', background: 'var(--overlay-light)', color: '#fff', fontSize: 15, outline: 'none', transition: 'all 0.3s' }}
              />
            </div>
          </>
          )}

          <motion.button 
            whileHover={{ scale: 1.02, boxShadow: '0 20px 40px rgba(255, 92, 0, 0.2)' }}
            whileTap={{ scale: 0.98 }}
            type="submit" 
            disabled={loading}
            style={{ width: '100%', padding: '20px', borderRadius: 18, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 12, transition: 'all 0.3s' }}
          >
            {loading ? 'Overovanie...' : (mode === 'reset' ? 'Zmeniť heslo' : mode === 'forgot' ? 'Odoslať odkaz na obnovenie' : 'Vstúpiť do centrály')}
          </motion.button>
          {mode === 'forgot' && (
            <div style={{ textAlign: 'center' }}>
              <span onClick={() => { setMode('login'); setError(''); setMessage(''); }} style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>← Späť na prihlásenie</span>
            </div>
          )}
          {mode === 'reset' && (
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <span onClick={() => { setMode('login'); setError(''); setMessage(''); window.location.hash = ''; }} style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>← Späť na prihlásenie</span>
            </div>
          )}
        </form>

        <div style={{ marginTop: 48, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 36 }}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', marginBottom: 20 }}>Nemáte firemný účet?</p>
          <motion.button 
            whileHover={{ background: 'rgba(255,255,255,0.08)' }}
            onClick={() => window.location.href = '/employer/inquiry'}
            style={{ 
              width: '100%', padding: '16px', borderRadius: 18, border: '1px solid rgba(255,255,255,0.15)', 
              background: 'transparent', color: '#fff', fontWeight: 600, fontSize: 14, 
              cursor: 'pointer', transition: 'all 0.2s' 
            }}
          >
            Registrovať firmu
          </motion.button>
          <div style={{ marginTop: 28 }}>
            <a href="/login" style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.target.style.color = '#fff'} onMouseLeave={(e) => e.target.style.color = 'rgba(255,255,255,0.3)'}>
              ← Späť na výber portálu
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
