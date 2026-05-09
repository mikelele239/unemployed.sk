import React, { useState, useRef, useEffect } from 'react';

const SKILL_SUGGESTIONS = [
  'Python','JavaScript','TypeScript','React','Node.js','SQL','HTML','CSS','Git',
  'Docker','AWS','Figma','Photoshop','Excel','Word','PowerPoint','Google Analytics',
  'SEO','Java','C++','C#','.NET','PHP','Angular','Vue','MongoDB','PostgreSQL',
  'Social Media','Copywriting','Content Marketing','PPC','Google Ads','Facebook Ads',
  'Email Marketing','Branding','UI/UX','Adobe Illustrator','InDesign','Canva',
  'Accounting','SAP','Financial Analysis','Data Analysis','Machine Learning',
  'Programovanie','Grafický dizajn','Účtovníctvo','Marketing',
  'Správa sociálnych sietí','Predaj','Zákaznícky servis','Administratíva',
  'Projektový manažment','Komunikácia','Tímová práca','Vodcovstvo',
  'Riešenie problémov','Manažment času','Kreativita','Spoľahlivosť',
  'Analytické myslenie','Samostatnosť','Flexibilita','Organizácia',
];

/**
 * SkillChipInput — typeahead chip-input for selecting skills.
 * Props:
 *   value: string[]
 *   onChange: (skills: string[]) => void
 *   label: string
 *   placeholder: string
 */
export default function SkillChipInput({ value = [], onChange, label, placeholder }) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const filtered = SKILL_SUGGESTIONS
    .filter(s => !value.includes(s))
    .filter(s => input.length === 0 || s.toLowerCase().includes(input.toLowerCase()))
    .slice(0, 8);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addSkill = (skill) => {
    if (skill.trim() && !value.includes(skill.trim())) {
      onChange([...value, skill.trim()]);
    }
    setInput('');
    setShowSuggestions(false);
  };

  const removeSkill = (skill) => {
    onChange(value.filter(s => s !== skill));
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {label && (
        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
          {label}
        </label>
      )}
      
      {/* Selected chips */}
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
          {value.map(skill => (
            <span key={skill} style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '4px 12px', borderRadius: 100, fontSize: '12px', fontWeight: 600,
              background: 'rgba(255,92,0,0.08)', color: 'var(--accent)',
              border: '1px solid rgba(255,92,0,0.15)',
            }}>
              {skill}
              <span onClick={() => removeSkill(skill)} style={{
                cursor: 'pointer', fontSize: '14px', lineHeight: 1, opacity: 0.7,
                transition: 'opacity 0.15s',
              }} onMouseEnter={e => e.target.style.opacity = '1'} onMouseLeave={e => e.target.style.opacity = '0.7'}>
                ×
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <input
        ref={inputRef}
        className="text-input"
        value={input}
        onChange={e => { setInput(e.target.value); setShowSuggestions(true); }}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={e => {
          if (e.key === 'Enter' && input.trim()) { e.preventDefault(); addSkill(input); }
          if (e.key === 'Backspace' && !input && value.length > 0) removeSkill(value[value.length - 1]);
        }}
        placeholder={placeholder || 'Type to search...'}
        style={{ width: '100%' }}
      />

      {/* Suggestions dropdown */}
      {showSuggestions && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '12px', marginTop: '4px', maxHeight: '200px', overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        }}>
          {filtered.map(s => (
            <div key={s} onClick={() => addSkill(s)} style={{
              padding: '10px 14px', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', transition: 'background 0.15s', color: 'var(--text)',
            }}
            onMouseEnter={e => e.target.style.background = 'rgba(255,92,0,0.06)'}
            onMouseLeave={e => e.target.style.background = 'transparent'}>
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
