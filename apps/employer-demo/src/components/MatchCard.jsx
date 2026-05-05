import React from 'react';
import { useI18n } from '../contexts';

const MatchCard = ({ match, isAccepted, onAccept, onSkip }) => {
  const { t, lang } = useI18n();

  return (
    <div style={{
      background: 'var(--bg-card)', border: `1px solid ${isAccepted ? 'var(--green)' : 'var(--border)'}`, 
      borderRadius: 'var(--radius)', padding: '16px', marginBottom: '10px', 
      transition: 'border-color 0.2s', opacity: isAccepted ? 0.85 : 1
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: '700', color: '#fff', fontSize: '13px', flexShrink: 0, background: match.color
        }}>
          {match.initials}
        </div>
        <div>
          <h4 style={{ fontSize: '13px', fontWeight: '600' }}>{match.name}</h4>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{match.position}</div>
          {match.student_profile?.badges && match.student_profile.badges.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
              {match.student_profile.badges.map(b => (
                <div 
                  key={b.id} 
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '3px', 
                    padding: '2px 5px', borderRadius: '4px', 
                    background: `${b.color}15`, color: b.color, 
                    fontSize: '9px', fontWeight: '600', border: `1px solid ${b.color}30`
                  }}
                >
                  {b.id === 'verified' && (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                  )}
                  {b.id === 'top_match' && (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  )}
                  {b.label}
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', color: isAccepted ? 'var(--green)' : 'var(--accent)' }}>
          {match.score}<span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>%</span>
        </div>
      </div>
      
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5, padding: '8px 10px', background: 'var(--accent-lighter)', borderRadius: '8px', borderLeft: '3px solid var(--accent)' }}>
        {lang === 'sk' ? match.reason_sk : match.reason_en}
      </div>

      {isAccepted ? (
        <div style={{ marginTop: '10px', fontSize: '11px', fontWeight: '600', color: 'var(--green)', textAlign: 'right' }}>
          ✓ {t('accepted')}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          <button 
            style={{
              flex: 1, padding: '8px', border: 'none', borderRadius: '8px', background: 'var(--accent)',
              color: '#fff', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onClick={() => onAccept(match.id)}
          >
            {t('accept')}
          </button>
          <button 
            style={{
              padding: '8px 14px', border: '1px solid var(--border)', borderRadius: '8px', background: 'transparent',
              color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: '500', cursor: 'pointer',
              transition: 'border-color 0.2s'
            }}
            onClick={() => onSkip(match.id)}
          >
            {t('skip')}
          </button>
        </div>
      )}
    </div>
  );
};

export default MatchCard;
