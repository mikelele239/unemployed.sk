import React, { useState } from 'react';
import { supabase } from '../supabase';

export default function CandidateAuth({ onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'employer'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
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
    setCompanyName('');
  };

  const handleCandidateSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

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
        const res = await fetch('/api/auth/student/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registrácia zlyhala.');
        
        setMessage('Váš účet bol vytvorený! Teraz sa môžete prihlásiť.');
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

  const handleEmployerSubmit = async (e) => {
    e.preventDefault();
    if (!email || !companyName) return;

    try {
      setLoading(true);
      setError('');
      setMessage('');

      const res = await fetch('/api/auth/employer/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, companyName }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Nepodarilo sa odoslať záujem.');
      
      setMessage('Váš záujem bol odoslaný! Administrátor vás bude čoskoro kontaktovať.');
      setTimeout(() => reset('login'), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: 15,
    boxSizing: 'border-box',
    outline: 'none',
  };

  const labelStyle = {
    display: 'block',
    marginBottom: 6,
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const isEmployer = mode === 'employer';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: 20,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: 'var(--bg-card)',
        borderRadius: 20,
        border: '1px solid var(--border)',
        padding: '40px 36px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
      }}>
        {/* Icon + Title */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 52, height: 52, borderRadius: 14,
            background: isEmployer ? '#6366f1' : 'var(--accent)',
            marginBottom: 16, fontSize: 24,
            transition: 'background 0.3s',
          }}>
            {isEmployer ? '🏢' : '🎓'}
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>
            {isEmployer ? 'Portál zamestnávateľa' : (mode === 'login' ? 'Vitaj späť' : 'Vytvor účet')}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 6 }}>
            {isEmployer
              ? 'Zaregistrujte svoju firmu a začnite hľadať talenty.'
              : (mode === 'login' ? 'Prihlás sa do svojho kandidátského účtu.' : 'Zaregistruj sa a začni hľadať prácu.')}
          </p>
        </div>

        {/* Candidate Toggle */}
        {!isEmployer && (
          <div style={{
            display: 'flex',
            background: 'var(--bg)',
            borderRadius: 12,
            padding: 4,
            marginBottom: 24,
            gap: 4,
          }}>
            {['login', 'register'].map((m) => (
              <button
                key={m}
                onClick={() => reset(m)}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10, border: 'none',
                  background: mode === m ? 'var(--accent)' : 'transparent',
                  color: mode === m ? '#fff' : 'var(--text-muted)',
                  fontWeight: 600, fontSize: 14, cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {m === 'login' ? 'Prihlásiť sa' : 'Registrovať sa'}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div style={{ color: '#ef4444', background: '#fee2e2', padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: 14 }}>
            {error}
          </div>
        )}
        {message && (
          <div style={{ color: '#16a34a', background: '#dcfce7', padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: 14 }}>
            {message}
          </div>
        )}

        {/* Candidate Form */}
        {!isEmployer && (
          <form onSubmit={handleCandidateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={labelStyle}>E-mail</label>
              <input type="email" placeholder="vas@email.sk" value={email}
                onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Heslo</label>
              <input type="password" placeholder="••••••••" value={password}
                onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />
            </div>
            {mode === 'register' && (
              <div>
                <label style={labelStyle}>Potvrď heslo</label>
                <input type="password" placeholder="••••••••" value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)} required style={inputStyle} />
              </div>
            )}
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '16px', borderRadius: 12, border: 'none',
              background: loading ? 'var(--border)' : 'var(--accent)',
              color: '#fff', fontWeight: 700, fontSize: 15,
              cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4, transition: 'all 0.2s',
            }}>
              {loading ? 'Spracováva sa...' : (mode === 'login' ? 'Prihlásiť sa' : 'Vytvoriť účet')}
            </button>
          </form>
        )}

        {/* Employer Form */}
        {isEmployer && (
          <form onSubmit={handleEmployerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={labelStyle}>Názov firmy</label>
              <input type="text" placeholder="Firma s.r.o." value={companyName}
                onChange={(e) => setCompanyName(e.target.value)} required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Pracovný e-mail</label>
              <input type="email" placeholder="vas@email.sk" value={email}
                onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
            </div>
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '16px', borderRadius: 12, border: 'none',
              background: loading ? 'var(--border)' : '#6366f1',
              color: '#fff', fontWeight: 700, fontSize: 15,
              cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4, transition: 'all 0.2s',
            }}>
              {loading ? 'Odosiela sa...' : 'Požiadať o prístup'}
            </button>
            <button type="button" onClick={() => reset('login')} style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
            }}>
              ← Späť na prihlásenie kandidáta
            </button>
          </form>
        )}

        {/* Employer Switch Link */}
        {!isEmployer && (
          <div style={{ marginTop: 24, textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: 20 }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>Ste zamestnávateľ?</p>
            <button onClick={() => reset('employer')} style={{
              background: 'none', border: '1px solid #6366f1', color: '#6366f1',
              padding: '10px 20px', borderRadius: 10, fontSize: 13,
              fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
            }}>
              🏢 Zaregistrovať firmu
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
