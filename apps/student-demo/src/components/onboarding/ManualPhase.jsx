import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { useTranslation } from '../../I18nContext';

export default function ManualPhase({ data, setData, manualStep, setManualStep, steps, onBack, onNext, onFinish }) {
  const { t } = useTranslation();
  const s = steps[manualStep];

  const handleChip = (id, val, isMulti) => {
    if (isMulti) {
      setData(prev => ({ ...prev, [id]: prev[id].includes(val) ? prev[id].filter(o => o !== val) : [...prev[id], val] }));
    } else {
      setData(prev => ({ ...prev, [id]: val }));
    }
  };

  const canAdvance = s.type !== 'text' || data[s.id]?.trim();

  return (
    <motion.div key="manual"
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '16px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
    >
      {/* Progress bar */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={onBack}
          style={{ width: 40, height: 40, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >←</button>
        <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${((manualStep + 1) / steps.length) * 100}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }} />
        </div>
      </div>

      {/* Step content */}
      <div style={{ flex: 1 }}>
        <AnimatePresence mode="wait">
          <motion.div key={manualStep}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 900, marginBottom: 8, letterSpacing: '-0.5px', lineHeight: 1.1 }}>{s.title}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24, lineHeight: 1.4 }}>{s.sub}</p>

            {s.type === 'text' && (
              <input type="text" placeholder={s.placeholder} value={data[s.id]}
                onChange={e => setData({ ...data, [s.id]: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && canAdvance && (manualStep < steps.length - 1 ? onNext() : onFinish())}
                style={{ width: '100%', padding: '16px 20px', borderRadius: 16, border: '2px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 16, fontWeight: 700, outline: 'none', transition: 'border-color 0.2s' }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                autoFocus
              />
            )}

            {(s.type === 'single' || s.type === 'multi') && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                {s.options.map(opt => {
                  const selected = s.type === 'multi' ? data[s.id].includes(opt) : data[s.id] === opt;
                  return (
                    <button key={opt} onClick={() => handleChip(s.id, opt, s.type === 'multi')}
                      style={{
                        padding: '16px 20px', borderRadius: 16, border: '1px solid',
                        borderColor: selected ? 'var(--accent)' : 'var(--border)',
                        background: selected ? 'var(--accent-light)' : 'var(--bg-card)',
                        color: selected ? 'var(--accent)' : 'var(--text)',
                        fontSize: 16, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                      }}
                    >
                      {opt}
                      {selected && <CheckCircle2 size={20} />}
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* CTA */}
      <div style={{ paddingTop: 20, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <button
          onClick={() => manualStep < steps.length - 1 ? onNext() : onFinish()}
          disabled={!canAdvance}
          className="btn-primary"
          style={{ width: '100%', padding: 20, fontSize: 17, fontWeight: 800, borderRadius: 20, opacity: canAdvance ? 1 : 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
        >
          {manualStep < steps.length - 1 ? t('ob.next') : t('ob.finish')}
          <ChevronRight size={20} />
        </button>
      </div>
    </motion.div>
  );
}
