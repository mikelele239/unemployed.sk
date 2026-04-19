import React, { useEffect, useState } from 'react';
import { useI18n } from '../contexts';

const Chart = ({ data, title }) => {
  const { t } = useI18n();
  const days = t('days');
  const [active, setActive] = useState(false);
  const max = Math.max(...data, 1);

  useEffect(() => {
    setTimeout(() => setActive(true), 100);
  }, []);

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
      padding: '16px', position: 'relative', overflow: 'hidden'
    }}>
      <h3 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '12px' }}>{title}</h3>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '80px' }}>
        {data.map((val, i) => (
          <div key={i} style={{
            flex: 1, background: 'var(--accent)', borderRadius: '3px 3px 0 0', minHeight: '4px',
            opacity: 0.7, transition: 'height 0.6s cubic-bezier(0.4,0,0.2,1)',
            height: active ? `${Math.round((val / max) * 100)}%` : '0px'
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
        {data.map((_, i) => (
          <span key={i} style={{ flex: 1, textAlign: 'center', fontSize: '8px', color: 'var(--text-muted)' }}>
            {days[i]}
          </span>
        ))}
      </div>
    </div>
  );
};

export default Chart;
