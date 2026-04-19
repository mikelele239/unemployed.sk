import { motion, useMotionValue, useTransform } from 'framer-motion';

export default function SwipeCard({ job, index, total, onSwipe, onClick }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);
  
  // Calculate depth styles based on index (0 is top card)
  const isTop = index === 0;
  const scale = Math.max(1 - index * 0.05, 0.85);
  const yOffset = index * 8;
  const isHidden = index > 2;

  const handleDragEnd = (event, info) => {
    if (info.offset.x > 100) {
      onSwipe('right', job);
    } else if (info.offset.x < -100) {
      onSwipe('left', job);
    }
  };

  if (isHidden) return null;

  return (
    <motion.div
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        opacity: isTop ? opacity : 1 - index * 0.2,
        position: 'absolute',
        inset: 0,
        zIndex: total - index,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: '20px 18px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: index === 0 ? '0 12px 40px rgba(0,0,0,0.3)' : '0 4px 15px rgba(0,0,0,0.1)',
        cursor: isTop ? 'grab' : 'default',
        touchAction: 'none'
      }}
      initial={{ scale: scale, y: yOffset }}
      animate={{ scale: scale, y: yOffset }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      whileDrag={{ cursor: 'grabbing' }}
    >
      <div onClick={() => isTop && onClick(job)} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ 
            width: 48, height: 48, borderRadius: 14, background: job.color, 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            fontWeight: 700, color: '#fff', fontSize: 18, flexShrink: 0 
          }}>
            {job.logo}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{job.company}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{job.location}</div>
          </div>
        </div>

        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 12 }}>
          {job.title}
        </h3>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {job.tags.map((tag, i) => (
            <span key={tag} style={{
              padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600,
              background: i === 0 ? 'var(--accent)' : 'transparent',
              color: i === 0 ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${i === 0 ? 'var(--accent)' : 'var(--border)'}`
            }}>
              {tag}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 'auto', marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>
            {job.rate} <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>{job.rateUnit}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{job.hours}</div>
        </div>
      </div>

      {isTop && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 'auto' }}>
          <button 
            onClick={(e) => { e.stopPropagation(); onSwipe('left', job); }}
            style={{ width: 56, height: 56, borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ✕
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onSwipe('right', job); }}
            style={{ width: 56, height: 56, borderRadius: '50%', border: '1.5px solid var(--accent)', background: 'var(--bg-card)', color: 'var(--accent)', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ♥
          </button>
        </div>
      )}
    </motion.div>
  );
}
