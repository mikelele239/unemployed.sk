import React from 'react';

const GATE_TYPES = [
  { value: 'language',      sk: 'Jazyková požiadavka',   en: 'Language Requirement', icon: '🌍' },
  { value: 'availability',  sk: 'Minimálna dostupnosť',  en: 'Minimum Availability', icon: '🕐' },
  { value: 'location',      sk: 'Striktná lokalita',     en: 'Strict Location',      icon: '📍' },
  { value: 'education',     sk: 'Minimálne vzdelanie',   en: 'Minimum Education',    icon: '🎓' },
];

const LANG_OPTIONS = ['Angličtina','Nemčina','Francúzština','Španielčina','Slovenčina','Čeština','Maďarčina'];
const LEVEL_OPTIONS = ['A1','A2','B1','B2','C1','C2'];
const EDU_OPTIONS = [
  { value: 'high_school', sk: 'Stredná škola', en: 'High School' },
  { value: 'bachelors',   sk: 'Bakalár (Bc.)', en: "Bachelor's" },
  { value: 'masters',     sk: 'Magister (Mgr./Ing.)', en: "Master's" },
];

const MAX_GATES = 4;

const HardGates = ({ gates, onChange, lang = 'sk' }) => {
  const addGate = (type) => {
    if (gates.length >= MAX_GATES) return;
    let newGate;
    switch (type) {
      case 'language':     newGate = { type, lang: 'Angličtina', min_level: 'B1' }; break;
      case 'availability': newGate = { type, min_hours: 20 }; break;
      case 'location':     newGate = { type, strict: true }; break;
      case 'education':    newGate = { type, min_level: 'bachelors' }; break;
      default:             newGate = { type }; break;
    }
    onChange([...gates, newGate]);
  };

  const updateGate = (idx, updates) => {
    onChange(gates.map((g, i) => i === idx ? { ...g, ...updates } : g));
  };

  const removeGate = (idx) => {
    onChange(gates.filter((_, i) => i !== idx));
  };

  const usedTypes = gates.map(g => g.type);
  const availableTypes = GATE_TYPES.filter(t => {
    // Allow multiple language gates, but only one of each other type
    if (t.value === 'language') return true;
    return !usedTypes.includes(t.value);
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
          {lang === 'sk' ? `Tvrdé podmienky (max ${MAX_GATES})` : `Hard Requirements (max ${MAX_GATES})`}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {gates.length}/{MAX_GATES}
        </div>
      </div>

      {/* Helper text */}
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.4 }}>
        {lang === 'sk'
          ? '⚠️ Kandidáti, ktorí nespĺňajú podmienky, budú označení — ale stále budú viditeľní.'
          : '⚠️ Candidates who fail these will be flagged — but still visible.'}
      </div>

      {/* Gate rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {gates.map((gate, idx) => {
          const typeDef = GATE_TYPES.find(t => t.value === gate.type) || { sk: gate.type, en: gate.type, icon: '📌' };
          return (
            <div key={idx} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 12px', borderRadius: '10px',
              background: 'var(--bg)', border: '1px solid rgba(239,68,68,0.2)',
            }}>
              <span style={{ fontSize: '14px' }}>{typeDef.icon}</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', minWidth: '60px' }}>
                {typeDef[lang] || typeDef.sk}
              </span>

              {/* Type-specific controls */}
              {gate.type === 'language' && (
                <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
                  <select className="text-input" style={{ fontSize: '12px', padding: '4px 8px', flex: 1 }}
                    value={gate.lang} onChange={e => updateGate(idx, { lang: e.target.value })}>
                    {LANG_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <select className="text-input" style={{ fontSize: '12px', padding: '4px 8px', width: '70px' }}
                    value={gate.min_level} onChange={e => updateGate(idx, { min_level: e.target.value })}>
                    {LEVEL_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              )}
              {gate.type === 'availability' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>min.</span>
                  <input className="text-input" type="number" min={5} max={40} step={5}
                    style={{ fontSize: '12px', padding: '4px 8px', width: '60px' }}
                    value={gate.min_hours || 20}
                    onChange={e => updateGate(idx, { min_hours: parseInt(e.target.value) || 0 })} />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>h/{lang === 'sk' ? 'týž.' : 'week'}</span>
                </div>
              )}
              {gate.type === 'location' && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', flex: 1 }}>
                  {lang === 'sk' ? 'Kandidát musí byť v rovnakom meste' : 'Candidate must be in the same city'}
                </span>
              )}
              {gate.type === 'education' && (
                <select className="text-input" style={{ fontSize: '12px', padding: '4px 8px', flex: 1 }}
                  value={gate.min_level} onChange={e => updateGate(idx, { min_level: e.target.value })}>
                  {EDU_OPTIONS.map(o => <option key={o.value} value={o.value}>{o[lang] || o.sk}</option>)}
                </select>
              )}

              <button onClick={() => removeGate(idx)} style={{
                width: '22px', height: '22px', borderRadius: '50%',
                border: '1px solid rgba(239,68,68,0.3)', background: 'transparent',
                color: '#ef4444', fontSize: '13px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>×</button>
            </div>
          );
        })}
      </div>

      {/* Add gate */}
      {gates.length < MAX_GATES && availableTypes.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <select
            onChange={e => { if (e.target.value) { addGate(e.target.value); e.target.value = ''; } }}
            defaultValue=""
            style={{
              padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
              background: 'transparent', color: '#ef4444',
              border: '1px dashed rgba(239,68,68,0.4)', cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            <option value="">+ {lang === 'sk' ? 'Pridať podmienku' : 'Add requirement'}</option>
            {availableTypes.map(t => (
              <option key={t.value} value={t.value}>{t.icon} {t[lang] || t.sk}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

export default HardGates;
