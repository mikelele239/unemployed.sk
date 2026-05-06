import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase';

export default function EmployerAuth({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    try {
      setLoading(true);
      setError('');

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

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#050505',
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
          padding: '60px 50px',
          boxShadow: '0 50px 150px rgba(0,0,0,0.6)',
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
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)' 
            }}>
            🏢
          </motion.div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.6rem', fontWeight: 400, margin: 0, color: '#fff', letterSpacing: '-0.03em' }}>
            Portál Zamestnávateľa
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: 12, fontSize: 16, fontWeight: 400, lineHeight: 1.5 }}>
            Profesionálna správa náborov <br/>a analýza talentov.
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

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 10, fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Pracovný E-mail</label>
            <input 
              type="email" placeholder="hr@vasafirma.sk" value={email} onChange={(e) => setEmail(e.target.value)} required
              style={{ width: '100%', padding: '18px 22px', borderRadius: 18, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: '#fff', fontSize: 15, outline: 'none', transition: 'all 0.3s' }}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.3)'; e.target.style.background = 'rgba(255,255,255,0.05)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.background = 'rgba(255,255,255,0.03)'; }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 10, fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Heslo</label>
            <input 
              type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required
              style={{ width: '100%', padding: '18px 22px', borderRadius: 18, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: '#fff', fontSize: 15, outline: 'none', transition: 'all 0.3s' }}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.3)'; e.target.style.background = 'rgba(255,255,255,0.05)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.background = 'rgba(255,255,255,0.03)'; }}
            />
          </div>

          <motion.button 
            whileHover={{ scale: 1.02, boxShadow: '0 20px 40px rgba(255, 92, 0, 0.2)' }}
            whileTap={{ scale: 0.98 }}
            type="submit" 
            disabled={loading}
            style={{ width: '100%', padding: '20px', borderRadius: 18, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 12, transition: 'all 0.3s' }}
          >
            {loading ? 'Overovanie...' : 'Vstúpiť do centrály'}
          </motion.button>
        </form>

        <div style={{ marginTop: 48, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 36 }}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', marginBottom: 20 }}>Nemáte prístup k firemnému účtu?</p>
          <motion.button 
            whileHover={{ background: 'rgba(255,255,255,0.08)' }}
            onClick={() => window.location.href = '/employer/inquiry'}
            style={{ 
              width: '100%', padding: '16px', borderRadius: 18, border: '1px solid rgba(255,255,255,0.15)', 
              background: 'transparent', color: '#fff', fontWeight: 600, fontSize: 14, 
              cursor: 'pointer', transition: 'all 0.2s' 
            }}
          >
            Požiadať o konzultáciu
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
