import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';


export default function Inquiry() {
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !companyName) return;

    try {
      setLoading(true);
      setError('');
      
      const { error: sbError } = await supabase.from('submissions').insert([{
        email,
        company_name: companyName,
        user_type: 'Zamestnávateľ',
        consented: true
      }]);

      if (sbError) {
        if (sbError.code === '23505') throw new Error('Tento e-mail už je zaregistrovaný.');
        throw new Error(sbError.message || 'Nepodarilo sa odoslať záujem.');
      }

      setSuccess(true);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
  };

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
        <motion.div
           variants={containerVariants} initial="hidden" animate="visible"
           style={{ width: '100%', maxWidth: 420, background: 'var(--bg-card)', borderRadius: 24, border: '1px solid var(--border)', padding: '48px 40px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}
        >
          <div style={{ fontSize: 48, marginBottom: 20 }}>📬</div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 12 }}>Záujem bol odoslaný!</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>Ďakujeme za záujem. Budeme vás čoskoro kontaktovať ohľadom vytvorenia prístupu.</p>
          <button onClick={() => navigate('/')} style={{ width: '100%', padding: '16px', borderRadius: 14, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
             Späť na prihlásenie
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
        <motion.div
          variants={containerVariants} initial="hidden" animate="visible"
          style={{ width: '100%', maxWidth: 420, background: 'var(--bg-card)', borderRadius: 24, border: '1px solid var(--border)', padding: '48px 40px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', position: 'relative', overflow: 'hidden' }}
        >
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 60, height: 60, borderRadius: 16, background: 'var(--accent)', fontSize: 28, marginBottom: 20, boxShadow: '0 8px 16px rgba(0,0,0,0.2)' }}>
              🏢
            </div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Chcem sa registrovať
            </h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: 14 }}>
              Zanechajte nám kontakt a my sa ozveme.
            </p>
          </div>

          {error && (
            <div style={{ color: '#ef4444', background: '#fee2e2', padding: 14, borderRadius: 12, marginBottom: 24, fontSize: 13, fontWeight: 500 }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Názov Firmy</label>
              <input 
                type="text" placeholder="Vaša firma, s.r.o." value={companyName} onChange={(e) => setCompanyName(e.target.value)} required
                style={{ width: '100%', padding: '16px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>E-mail</label>
              <input 
                type="email" placeholder="hr@firma.sk" value={email} onChange={(e) => setEmail(e.target.value)} required
                style={{ width: '100%', padding: '16px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', outline: 'none' }}
              />
            </div>

            <motion.button 
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={loading}
              style={{ width: '100%', padding: '18px', borderRadius: 14, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 12 }}
            >
              {loading ? 'Spracovávam...' : 'Odoslať záujem'}
            </motion.button>
          </form>

          <div style={{ marginTop: 32, textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>
             Už máte prístup? <span onClick={() => navigate('/')} style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 700, marginLeft: 4 }}>Prihláste sa</span>
          </div>
        </motion.div>
    </div>
  );
}
