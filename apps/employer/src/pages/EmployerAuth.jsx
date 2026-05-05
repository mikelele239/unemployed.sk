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
      
      const res = await fetch('/api/auth/employer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Nesprávne meno alebo heslo.');

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      });

      if (sessionError) throw sessionError;
      localStorage.setItem('employer_token', data.session.access_token);
      
      if (onLoginSuccess) onLoginSuccess(data.session);
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
      background: 'radial-gradient(circle at top left, #ff5c0010, transparent), radial-gradient(circle at bottom right, #0070f308, transparent), #050505',
      padding: 20,
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Dynamic Background Elements */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.03, 0.05, 0.03],
          x: [0, 50, 0],
          y: [0, -30, 0]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        style={{ position: 'absolute', width: '50vw', height: '50vw', background: 'var(--accent)', filter: 'blur(150px)', top: '-10%', left: '-10%', borderRadius: '50%' }} 
      />
      
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
        opacity: 0.3
      }} />

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
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.6rem', fontWeight: 600, margin: 0, color: '#fff', letterSpacing: '-0.03em' }}>
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
