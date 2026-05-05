import { motion } from 'framer-motion';
import { useTranslation } from '../../I18nContext';

export default function WelcomePhase() {
  const { t } = useTranslation();
  return (
    <motion.div key="welcome"
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}
    >
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-1px', marginBottom: 16 }}>
          {t('ob.hook')}
        </h1>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>{t('ob.hookSub')}</p>
      </motion.div>
    </motion.div>
  );
}
