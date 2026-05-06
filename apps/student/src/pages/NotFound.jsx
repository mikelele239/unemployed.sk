import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 32, textAlign: 'center'
    }}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      >
        <div style={{ fontSize: 80, marginBottom: 24, lineHeight: 1 }}>🔍</div>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(3rem, 8vw, 6rem)',
          fontWeight: 900, color: 'var(--text)', margin: '0 0 16px',
          letterSpacing: '-2px', lineHeight: 1
        }}>
          404
        </h1>
        <p style={{ fontSize: 20, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8 }}>
          Táto stránka neexistuje.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', opacity: 0.7, marginBottom: 40 }}>
          Odkaz mohol byť zmenený alebo stránka bola odstránená.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <motion.button
            whileHover={{ scale: 1.04, boxShadow: '0 12px 30px rgba(255,92,0,0.2)' }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate(-1)}
            style={{ padding: '14px 28px', borderRadius: 14, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
          >
            ← Späť
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/foryou')}
            style={{ padding: '14px 28px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
          >
            🏠 Domov
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
