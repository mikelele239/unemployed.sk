import { motion, AnimatePresence } from 'framer-motion';

export default function JobDetail({ job, isOpen, onClose, onApply, hasApplied }) {
  if (!isOpen || !job) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: '0%' }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          style={{ 
            position: 'absolute', 
            bottom: 0, left: 0, right: 0, 
            height: '92vh',
            background: 'var(--bg)', 
            borderRadius: '24px 24px 0 0',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.3)',
            overflow: 'hidden'
          }}
          onClick={e => e.stopPropagation()}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          onDragEnd={(e, info) => {
            if (info.offset.y > 100) onClose();
          }}
        >
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={onClose} style={{ width: 36, height: 36, background: 'var(--bg-card)', border: 'none', borderRadius: 10, cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↓</button>
            <span style={{ fontWeight: 600, fontSize: 16, fontFamily: 'var(--font-display)' }}>Detail pozície</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{job.title}</h2>
            <div style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>{job.company} · {job.location}</div>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
              {job.tags.map((tag, i) => (
                <span key={tag} style={{ padding: '4px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600, background: i === 0 ? 'var(--accent)' : 'var(--bg-card)', color: i === 0 ? '#fff' : 'var(--text-muted)', border: `1px solid ${i===0?'var(--accent)':'var(--border)'}` }}>{tag}</span>
              ))}
            </div>

            <div style={{ marginBottom: 24 }}>
              <h4 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 8 }}>Odmena</h4>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>
                {job.rate} <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{job.rateUnit}</span>
                <span style={{ fontSize: 14, color: 'var(--text-muted)', marginLeft: 12 }}>{job.hours}</span>
              </p>
            </div>

            {job.reason && (
              <div style={{ marginBottom: 24, padding: '16px', background: 'var(--accent-lighter)', borderLeft: '3px solid var(--accent)', borderRadius: '4px 12px 12px 4px' }}>
                <h4 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 8 }}>Prečo ti to sedí</h4>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)' }}>{job.reason}</p>
              </div>
            )}

            <div style={{ marginBottom: 24 }}>
              <h4 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 8 }}>Popis</h4>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text)' }}>{job.description}</p>
            </div>

            <div style={{ marginBottom: 32 }}>
              <h4 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 8 }}>Požiadavky</h4>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text)', whiteSpace: 'pre-line' }}>{job.requirements}</p>
            </div>
          </div>

          <div style={{ padding: '16px 20px calc(16px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
            <button 
              onClick={() => onApply(job)}
              disabled={hasApplied}
              className="btn-primary"
              style={{ width: '100%', padding: '16px', borderRadius: 12, opacity: hasApplied ? 0.7 : 1, background: hasApplied ? 'var(--bg-card)' : 'var(--accent)', color: hasApplied ? 'var(--text-muted)' : '#fff', border: hasApplied ? '1px solid var(--border)' : 'none' }}
            >
              {hasApplied ? 'Už prihlásený ✓' : 'Mám záujem'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
