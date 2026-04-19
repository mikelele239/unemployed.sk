import React from 'react';
import { useI18n } from '../contexts';

const CandidateCard = ({ candidate, isInvited, onInvite }) => {
  const { t } = useI18n();

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 0',
      borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'opacity 0.2s'
    }}>
      <div style={{
        width: '42px', height: '42px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: '700', fontSize: '14px', color: '#fff', flexShrink: 0, background: candidate.color
      }}>
        {candidate.initials}
      </div>
      <div style={{ flex: 1 }}>
        <h4 style={{ fontSize: '13px', fontWeight: '600' }}>{candidate.name}</h4>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
          {candidate.school} • {candidate.field}
        </div>
      </div>
      <div style={{
        background: 'var(--green-light)', color: 'var(--green)', padding: '3px 8px', 
        borderRadius: '100px', fontSize: '10px', fontWeight: '600', flexShrink: 0
      }}>
        {candidate.match}%
      </div>
      <button 
        style={{
          padding: '5px 10px', border: `1px solid ${isInvited ? 'var(--green)' : 'var(--accent)'}`, 
          borderRadius: '6px', background: isInvited ? 'var(--green-light)' : 'transparent',
          color: isInvited ? 'var(--green)' : 'var(--accent)', fontSize: '10px', fontWeight: '600', 
          cursor: isInvited ? 'default' : 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.2s', flexShrink: 0
        }}
        onClick={(e) => { e.stopPropagation(); if (!isInvited) onInvite(candidate.id); }}
      >
        {isInvited ? t('invited') : t('invite')}
      </button>
    </div>
  );
};

export default CandidateCard;
