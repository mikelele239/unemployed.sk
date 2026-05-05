import { motion } from 'framer-motion';
import { FileText } from 'lucide-react';
import { useTranslation } from '../../I18nContext';

export default function ParsingPhase({ progress }) {
  const { t } = useTranslation();
  return (
    <motion.div key="parsing"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}
    >
      <div style={{ position: 'relative', width: 120, height: 120, marginBottom: 32 }}>
        <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }}
          style={{ position: 'absolute', inset: -20, background: 'var(--accent)', borderRadius: '50%', filter: 'blur(20px)' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-card)', borderRadius: 24, border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FileText size={48} color="var(--accent)" />
        </div>
        <motion.div initial={{ top: '0%' }} animate={{ top: '100%' }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          style={{ position: 'absolute', left: -10, right: -10, height: 2, background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)' }}
        />
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 900, marginBottom: 12 }}>{t('ob.parsing')}</h2>
      <div style={{ width: '100%', maxWidth: 240, height: 6, background: 'var(--bg-card)', borderRadius: 3, overflow: 'hidden', marginBottom: 16 }}>
        <motion.div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)' }} />
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('ob.parsingSub')}</p>
    </motion.div>
  );
}
