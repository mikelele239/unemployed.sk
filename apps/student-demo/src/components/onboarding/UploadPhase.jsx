import { motion } from 'framer-motion';
import { UploadCloud, ChevronRight } from 'lucide-react';
import { useTranslation } from '../../I18nContext';

export default function UploadPhase({ onFile, onSkip }) {
  const { t } = useTranslation();

  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.dataTransfer.files?.[0]) onFile(e.dataTransfer.files[0]);
  };
  const handleFileChange = (e) => {
    if (e.target.files?.[0]) onFile(e.target.files[0]);
  };

  return (
    <motion.div key="upload"
      initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '40px 20px', alignItems: 'center', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
    >
      <div style={{ alignSelf: 'flex-start', marginBottom: 40 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-0.5px', marginBottom: 8, lineHeight: 1.1 }}>
          {t('ob.uploadTitle')} <br />{t('ob.uploadTitle2')}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>{t('ob.uploadSub')}</p>
      </div>

      <label
        onDragOver={handleDragOver} onDrop={handleDrop}
        style={{
          width: '100%', maxWidth: 440, flex: 1, maxHeight: 320,
          border: '2px dashed var(--border)', borderRadius: 32,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-card)', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          padding: '40px 24px', textAlign: 'center'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-lighter)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)'; }}
      >
        <input type="file" accept=".pdf,.doc,.docx" onChange={handleFileChange} style={{ display: 'none' }} />
        <div style={{
          width: 72, height: 72, borderRadius: 24,
          background: 'var(--accent)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20, boxShadow: '0 8px 24px rgba(255,92,0,0.25)'
        }}>
          <UploadCloud size={36} />
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.3px' }}>{t('ob.uploadCta')}</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: '240px', lineHeight: 1.5 }}>{t('ob.uploadFormats')}</p>
      </label>

      <button onClick={onSkip}
        style={{
          marginTop: 'auto', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
          color: 'var(--text)', fontSize: 14, fontWeight: 600, padding: '12px 24px',
          borderRadius: 100, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
      >
        {t('ob.noCV')} <ChevronRight size={16} />
      </button>
    </motion.div>
  );
}
