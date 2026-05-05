import React from 'react';

const QuizStep = ({ step, total, label, subtitle, pFill, children, onNext, onBack }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', animation: 'tabSlideIn 0.3s cubic-bezier(0.4, 0, 0.15, 1)' }}>
      <div style={{ padding: '14px 18px 10px', display: 'flex', alignItems: 'center', gap: '10px', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10 }}>
        <button onClick={onBack} style={{ width: '32px', height: '32px', border: 'none', background: 'var(--bg-card)', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', flexShrink: 0 }}>
          ←
        </button>
        <div style={{ flex: 1, height: '3px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'var(--accent)', borderRadius: '3px', transition: 'width 0.4s ease', width: pFill }}></div>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500', flexShrink: 0 }}>
          {step}/{total}
        </span>
      </div>

      <div style={{ padding: '6px 20px 90px', flex: 1 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '4px', letterSpacing: '-0.3px' }}>{label}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '20px', lineHeight: 1.5 }}>{subtitle}</p>
        
        {children}
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 20px 14px', background: 'linear-gradient(transparent, var(--bg) 25%)', zIndex: 10 }}>
        <button className="btn-main" onClick={onNext}>Pokračovať</button>
      </div>
    </div>
  );
};

export default QuizStep;
