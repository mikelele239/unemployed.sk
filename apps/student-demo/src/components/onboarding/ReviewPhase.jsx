import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { useTranslation } from '../../I18nContext';

export default function ReviewPhase({ data, setData, onConfirm }) {
  const { t } = useTranslation();

  const fieldStyle = {
    background: 'var(--bg-card)', padding: 16, borderRadius: 16, border: '1px solid var(--border)'
  };
  const labelStyle = {
    fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px'
  };

  return (
    <motion.div key="review"
      initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '40px 20px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 48, height: 48, borderRadius: 24, background: 'rgba(52,211,153,0.1)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckCircle2 size={24} />
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-0.5px' }}>{t('ob.reviewTitle')}</h2>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 32 }}>{t('ob.reviewSub')}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={fieldStyle}>
          <span style={labelStyle}>{t('ob.reviewName')}</span>
          <input value={data.name} onChange={e => setData({ ...data, name: e.target.value })}
            placeholder={t('ob.reviewNamePlaceholder')}
            style={{ background: 'transparent', border: 'none', color: data.name ? 'var(--text)' : 'var(--text-muted)', fontSize: 18, fontWeight: 700, width: '100%', marginTop: 8, outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ ...fieldStyle, flex: 1 }}>
            <span style={labelStyle}>{t('ob.reviewEdu')}</span>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 8 }}>{data.edu}</div>
          </div>
          <div style={{ ...fieldStyle, flex: 1 }}>
            <span style={labelStyle}>{t('ob.reviewLoc')}</span>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 8 }}>{data.loc}</div>
          </div>
        </div>
        <div style={fieldStyle}>
          <span style={{ ...labelStyle, marginBottom: 12, display: 'block' }}>{t('ob.reviewSkills')}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {data.skills.map(s => (
              <span key={s} style={{ background: 'var(--accent-light)', color: 'var(--accent)', padding: '6px 12px', borderRadius: 100, fontSize: 13, fontWeight: 600 }}>{s}</span>
            ))}
            <span style={{ background: 'var(--border)', color: 'var(--text-muted)', padding: '6px 12px', borderRadius: 100, fontSize: 13, fontWeight: 600 }}>
              {t('ob.reviewAddMore')}
            </span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 32 }}>
        <button className="btn-primary" onClick={onConfirm}
          style={{ width: '100%', padding: 18, borderRadius: 16, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {t('ob.reviewConfirm')} <Sparkles size={18} />
        </button>
      </div>
    </motion.div>
  );
}
