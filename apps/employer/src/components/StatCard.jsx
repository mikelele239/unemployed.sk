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

  const isSuccess = changeType === 'up';
  const changeColor = isSuccess ? '#22c55e' : changeType === 'down' ? '#EF4444' : 'var(--text-muted)';
  const mainColor = isSuccess ? '#22c55e' : 'var(--text)';

  return (
    <div style={{
      background: 'var(--bg-card)', 
      border: isSuccess ? '1px solid rgba(34, 197, 94, 0.5)' : '1px solid var(--border)', 
      borderRadius: 'var(--radius)',
      padding: '20px', 
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
      display: 'flex', 
      flexDirection: 'column',
      boxShadow: isSuccess ? '0 8px 30px rgba(34, 197, 94, 0.12)' : 'none',
      transform: isSuccess ? 'translateY(-2px)' : 'none'
    }}>
      <div className="stat-label" style={{ opacity: isSuccess ? 0.8 : 1 }}>
        {label}
      </div>
      <div className="stat-value" style={{ color: mainColor }}>
        {typeof value === 'number' ? displayValue.toLocaleString('sk') : displayValue}{unit}
      </div>
      <div style={{ fontSize: '11px', fontWeight: '800', marginTop: '6px', color: changeColor, letterSpacing: '0.4px' }}>
        {changeText}
      </div>
    </div>
  );
};

export default StatCard;
