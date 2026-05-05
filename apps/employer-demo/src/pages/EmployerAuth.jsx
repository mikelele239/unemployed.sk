import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function EmployerAuth({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

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
      else window.location.href = '/employer/dashboard';

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
      <AnimatePresence mode="wait">
        <motion.div
          key="login" variants={containerVariants} initial="hidden" animate="visible" exit="exit"
          style={{ width: '100%', maxWidth: 420, background: 'var(--bg-card)', borderRadius: 24, border: '1px solid var(--border)', padding: '48px 40px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', position: 'relative', overflow: 'hidden' }}
        >
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 60, height: 60, borderRadius: 16, background: 'var(--accent)', fontSize: 28, marginBottom: 20, boxShadow: '0 8px 16px rgba(0,0,0,0.2)' }}>
              🏢
            </div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Portál Zamestnávateľa
            </h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: 14 }}>
              Vitajte spät! Spravujte svoje ponuky.
            </p>
          </div>

          {error && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} style={{ color: '#ef4444', background: '#fee2e2', padding: 14, borderRadius: 12, marginBottom: 24, fontSize: 13, fontWeight: 500 }}>
              ⚠️ {error}
            </motion.div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>E-mail</label>
              <input 
                type="email" placeholder="hr@firma.sk" value={email} onChange={(e) => setEmail(e.target.value)} required
                style={{ width: '100%', padding: '16px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Heslo</label>
              <input 
                type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required
                style={{ width: '100%', padding: '16px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', outline: 'none' }}
              />
            </div>

            <motion.button 
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={loading}
              style={{ width: '100%', padding: '18px', borderRadius: 14, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 12 }}
            >
              {loading ? 'Pracujem...' : 'Prihlásiť sa'}
            </motion.button>
          </form>

          <div style={{ marginTop: 32, textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>
            Hľadáte talenty? <span onClick={() => navigate('/inquiry')} style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 700, marginLeft: 4 }}>Zaregistrujte firmu</span>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
