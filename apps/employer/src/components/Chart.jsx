import { useEffect, useState } from 'react';
import { useI18n } from '../contexts';

const Chart = ({ data = [], title }) => {
  const { t } = useI18n();
  const days = t('days');
  const [active, setActive] = useState(false);
  
  const paddedData = data.length === 0 ? [0,0,0,0,0,0,0] : data;
  const max = Math.max(...paddedData, 5);
  
  useEffect(() => {
    setTimeout(() => setActive(true), 100);
  }, []);

  const width = 300;
  const height = 150;
  const padding = 20;
  
  const points = paddedData.map((val, i) => {
    const x = (i / (paddedData.length - 1)) * (width - padding * 2) + padding;
    const y = (height - padding) - (val / max) * (height - padding * 2);
    return { x, y, val };
  });

  // Create smooth bezier path
  const createSmoothPath = (points) => {
    if (points.length < 2) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cp1x = p0.x + (p1.x - p0.x) / 2;
      const cp1y = p0.y;
      const cp2x = p0.x + (p1.x - p0.x) / 2;
      const cp2y = p1.y;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  const smoothPath = createSmoothPath(points);

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px',
      padding: '24px', position: 'relative', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.03)',
      display: 'flex', flexDirection: 'column', transition: 'all 0.3s ease'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.2px' }}>{title}</h3>
      </div>
      
      <div style={{ position: 'relative', flex: 1, minHeight: '150px' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="var(--accent)" />
            </linearGradient>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Grid lines */}
          {[0, 0.5, 1].map((p, i) => (
            <line 
              key={i} x1={padding} y1={(height - padding) - p * (height - padding * 2)} 
              x2={width - padding} y2={(height - padding) - p * (height - padding * 2)} 
              stroke="var(--border)" strokeWidth="0.5" strokeDasharray="6 6" opacity="0.5"
            />
          ))}
          
          {/* Subtle Area Fill */}
          <path 
            d={`${smoothPath} L ${points[points.length-1].x} ${height-padding} L ${points[0].x} ${height-padding} Z`}
            fill="url(#areaGradient)" opacity={active ? 1 : 0} style={{ transition: 'opacity 1.5s ease' }}
          />

          {/* The Smooth Line */}
          <path 
            d={smoothPath} fill="none" stroke="url(#lineGradient)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            filter="url(#glow)"
            style={{ 
              transition: 'stroke-dashoffset 2s cubic-bezier(0.4, 0, 0.2, 1)', 
              strokeDasharray: 1000, 
              strokeDashoffset: active ? 0 : 1000 
            }}
          />
          
          {/* Active Points */}
          {points.map((p, i) => (
            <g key={i}>
              <circle 
                cx={p.x} cy={p.y} r="5" fill="#fff" stroke="var(--accent)" strokeWidth="2.5" 
                style={{ 
                  opacity: active ? (p.val > 0 ? 1 : 0.3) : 0, 
                  transition: `opacity 0.5s ease ${i * 0.1}s`,
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                }}
              />
              {p.val > 0 && (
                <text 
                  x={p.x} y={p.y - 14} textAnchor="middle" fontSize="9" fill="var(--text)" fontWeight="800"
                  style={{ opacity: active ? 1 : 0, transition: `opacity 0.5s ease ${i * 0.1}s` }}
                >
                  {p.val}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px', marginTop: '16px' }}>
        {days.map((day, i) => (
          <span key={i} style={{ 
            fontSize: '10px', 
            color: i === days.length - 1 ? 'var(--accent)' : 'var(--text-muted)', 
            fontWeight: '800',
            textTransform: 'uppercase'
          }}>{day}</span>
        ))}
      </div>
    </div>
  );
};

export default Chart;
