import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useTranslation } from '../../I18nContext';

export default function ClimaxPhase() {
  const { t, lang } = useTranslation();
  return (
    <motion.div key="climax"
      initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center', background: 'var(--bg)' }}
    >
      <motion.div
        animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
        transition={{ repeat: Infinity, duration: 3 }}
        style={{ marginBottom: 40 }}
      >
        <div style={{
          width: 100, height: 100, borderRadius: 30, background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 20px 40px rgba(255,92,0,0.3)'
        }}>
          <Sparkles size={48} color="#fff" />
        </div>
      </motion.div>
      <div style={{ height: 100, display: 'flex', alignItems: 'center' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
          {lang === 'en' ? 'Finding your matches...' : 'Hľadám tvoje ponuky...'}
        </h2>
      </div>
    </motion.div>
  );
}
