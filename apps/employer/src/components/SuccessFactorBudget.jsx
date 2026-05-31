import React, { useState, useEffect } from 'react';

// Available success factors with labels
const FACTOR_OPTIONS = [
  { key: 'technical_skills', sk: 'Technické zručnosti', en: 'Technical Skills', icon: '⚙️' },
  { key: 'communication',    sk: 'Komunikácia a tímovosť', en: 'Communication & Teamwork', icon: '💬' },
  { key: 'education',        sk: 'Vzdelanie v odbore', en: 'Relevant Education', icon: '🎓' },
  { key: 'portfolio',        sk: 'Projekty / portfólio', en: 'Portfolio / Projects', icon: '📁' },
  { key: 'availability',     sk: 'Dostupnosť a úväzok', en: 'Availability & Schedule', icon: '🕐' },
  { key: 'location',         sk: 'Blízkosť lokality', en: 'Location Proximity', icon: '📍' },
  { key: 'language',         sk: 'Jazyková úroveň', en: 'Language Proficiency', icon: '🌍' },
  { key: 'industry_exp',     sk: 'Odborové skúsenosti', en: 'Industry Experience', icon: '🏢' },
];

const BUDGET = 100;

const SuccessFactorBudget = ({ factors, onChange, lang = 'sk' }) => {
  const [items, setItems] = useState(() => {
    if (factors && factors.length > 0) return factors;
    return [
      { factor: 'technical_skills', points: 30 },
      { factor: 'communication', points: 25 },
      { factor: 'education', points: 20 },
      { factor: 'language', points: 15 },
      { factor: 'availability', points: 10 },
    ];
  });

  useEffect(() => {
    if (factors && factors.length > 0 && JSON.stringify(factors) !== JSON.stringify(items)) {
      setItems(factors);
    }
  }, [factors]);

  const total = items.reduce((s, i) => s + i.points, 0);
  const remaining = BUDGET - total;

  const updatePoints = (idx, newPoints) => {
    // Compute how much budget the OTHER sliders use (not this one)
    const othersTotal = items.reduce((sum, item, i) => i === idx ? sum : sum + item.points, 0);
    const maxForThis = BUDGET - othersTotal;
    const clamped = Math.max(0, Math.min(maxForThis, newPoints));
    const updated = items.map((item, i) => i === idx ? { ...item, points: clamped } : item);
    setItems(updated);
    onChange(updated);
  };

  const addFactor = (factorKey) => {
    if (items.some(i => i.factor === factorKey)) return;
    const pts = Math.min(Math.max(remaining, 0), 5);
    const updated = [...items, { factor: factorKey, points: pts }];
    setItems(updated);
    onChange(updated);
  };

  const removeFactor = (idx) => {
    const updated = items.filter((_, i) => i !== idx);
    setItems(updated);
    onChange(updated);
  };

  const unusedFactors = FACTOR_OPTIONS.filter(f => !items.some(i => i.factor === f.key));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
          {lang === 'sk' ? 'Faktory úspechu (rozdeľte 100 bodov)' : 'Success Factors (distribute 100 points)'}
        </div>
        <div style={{
          fontSize: '12px', fontWeight: 800,
          color: remaining === 0 ? 'var(--color-success)' : 'var(--color-warning)',
          padding: '4px 10px', borderRadius: '6px',
          background: remaining === 0 ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
        }}>
          {total}/100 {remaining === 0 ? '✓' : `(${remaining} ${lang === 'sk' ? 'zostáva' : 'left'})`}
        </div>
      </div>

      {/* Factor rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map((item, idx) => {
          const factorDef = FACTOR_OPTIONS.find(f => f.key === item.factor) || { sk: item.factor, en: item.factor, icon: '📌' };
          const pct = (item.points / BUDGET) * 100;
          return (
            <div key={item.factor} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px 12px', borderRadius: '10px',
              background: 'var(--bg)', border: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: '16px', width: '24px', textAlign: 'center' }}>{factorDef.icon}</span>
              <span style={{ fontSize: '12px', fontWeight: 600, width: '140px', color: 'var(--text)' }}>
                {factorDef[lang] || factorDef.sk}
              </span>
              <div style={{ flex: 1, position: 'relative', height: '6px', background: 'var(--border)', borderRadius: '3px' }}>
                <div style={{
                  width: `${Math.min(pct, 100)}%`, height: '100%', borderRadius: '3px',
                  background: pct > 40 ? 'var(--accent)' : pct > 20 ? 'var(--color-info)' : '#94a3b8',
                  transition: 'width 0.2s',
                }} />
              </div>
              <input
                type="range" min={0} max={100} step={5}
                value={item.points}
                onChange={e => updatePoints(idx, parseInt(e.target.value))}
                style={{ width: '80px', accentColor: 'var(--accent)' }}
              />
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--accent)', width: '28px', textAlign: 'center' }}>
                {item.points}
              </span>
              {items.length > 2 && (
                <button onClick={() => removeFactor(idx)} style={{
                  width: '20px', height: '20px', borderRadius: '50%',
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--color-error)'; e.currentTarget.style.color = 'var(--color-error)'; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                >×</button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add factor button */}
      {unusedFactors.length > 0 && items.length < 6 && (
        <div style={{ marginTop: '8px' }}>
          <select
            onChange={e => { if (e.target.value) { addFactor(e.target.value); e.target.value = ''; } }}
            defaultValue=""
            style={{
              padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
              background: 'transparent', color: 'var(--text-muted)',
              border: '1px dashed var(--text-muted)', cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            <option value="">+ {lang === 'sk' ? 'Pridať faktor' : 'Add factor'}</option>
            {unusedFactors.map(f => (
              <option key={f.key} value={f.key}>{f.icon} {f[lang] || f.sk}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

export default SuccessFactorBudget;
