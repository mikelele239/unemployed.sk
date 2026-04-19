import React, { useEffect, useState } from 'react';

const StatCard = ({ label, value, unit = '', changeText, changeType = 'neutral' }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (typeof value !== 'number') {
      setDisplayValue(value);
      return;
    }

    let start = 0;
    const duration = 1200;
    let startTime = null;

    const animateNum = (ts) => {
      if (!startTime) startTime = ts;
      const p = Math.min((ts - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplayValue(Math.round(ease * value));
      if (p < 1) requestAnimationFrame(animateNum);
    };

    requestAnimationFrame(animateNum);
  }, [value]);

  const changeColor = changeType === 'up' ? 'var(--green)' : changeType === 'down' ? '#EF4444' : 'var(--blue)';

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
      padding: '14px', transition: 'border-color 0.2s', display: 'flex', flexDirection: 'column'
    }}>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '700', letterSpacing: '-0.5px' }}>
        {typeof value === 'number' ? displayValue.toLocaleString('sk') : displayValue}{unit}
      </div>
      <div style={{ fontSize: '10px', fontWeight: '600', marginTop: '3px', color: changeColor }}>
        {changeText}
      </div>
    </div>
  );
};

export default StatCard;
