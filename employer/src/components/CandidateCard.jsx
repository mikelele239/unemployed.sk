import React from 'react';
import { useI18n } from '../contexts';

const CandidateCard = ({ candidate, isInvited, onInvite }) => {
  const { t } = useI18n();
  const initials = candidate.student_name.split(' ').map(n => n[0]).join('').toUpperCase();
  const profile = candidate.student_profile || {};

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 0',
      borderBottom: '1px solid var(--border)', transition: 'opacity 0.2s'
    }}>
      <div style={{
        width: '42px', height: '42px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: '700', fontSize: '14px', color: '#fff', flexShrink: 0, 
        background: 'linear-gradient(135deg, #333, #000)', border: '1px solid var(--border)'
      }}>
        {initials}
      </div>
      <div style={{ flex: 1 }}>
        <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>{candidate.student_name}</h4>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
          {profile.school || 'Univerzita'} • {profile.field || 'Študent'}
        </div>
      </div>
      
      {/* AI Score Badge */}
      <div 
        title={candidate.ai_reasoning}
        style={{
          background: candidate.ai_score > 70 ? 'var(--green-light)' : 'rgba(255,255,255,0.05)', 
          color: candidate.ai_score > 70 ? 'var(--green)' : 'var(--text-muted)', 
          padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', 
          flexShrink: 0, border: '1px solid var(--border)', cursor: 'help',
          display: 'flex', flexDirection: 'column', alignItems: 'center'
        }}
      >
        <span style={{ fontSize: '10px', fontWeight: 500, opacity: 0.7, marginBottom: '-2px' }}>AI SCORE</span>
        {candidate.ai_score}%
      </div>

      <button 
        style={{
          padding: '8px 16px', border: `1px solid ${isInvited ? 'var(--pro-border)' : 'var(--accent)'}`, 
          borderRadius: '8px', background: isInvited ? 'var(--bg-card)' : 'transparent',
          color: isInvited ? 'var(--text-muted)' : 'var(--accent)', fontSize: '11px', fontWeight: '600', 
          cursor: isInvited ? 'default' : 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.2s', flexShrink: 0
        }}
        onClick={(e) => { e.stopPropagation(); if (!isInvited) onInvite(candidate.id); }}
      >
        {isInvited ? t('invited') : t('accept')}
      </button>
    </div>
  );
};

export default CandidateCard;
