import React from 'react';
import { useI18n, useAppState } from '../contexts';

const Profile = () => {
  const { t } = useI18n();
  const { companyProfile } = useAppState();

  return (
    <div style={{ 
      animation: 'tabSlideIn 0.3s cubic-bezier(0.4, 0, 0.15, 1)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '40px 24px'
    }}>
      <div style={{ flex: 1 }}>
        <h1 style={{ 
          fontFamily: 'var(--font-display)', 
          fontSize: '32px', 
          fontWeight: '800',
          marginBottom: '8px'
        }}>
          {companyProfile?.name || 'Company Name'}
        </h1>
        <p style={{ 
          fontSize: '16px', 
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          {(companyProfile?.locations || []).join(', ') || 'Lokalita'}
        </p>
      </div>

      <button style={{
        width: '100%',
        padding: '16px',
        background: 'var(--accent)',
        color: '#fff',
        border: 'none',
        borderRadius: 'var(--radius)',
        fontWeight: '700',
        fontSize: '16px',
        cursor: 'pointer',
        marginTop: 'auto',
        transition: 'transform 0.2s'
      }}
      onMouseDown={(e) => e.target.style.transform = 'scale(0.98)'}
      onMouseUp={(e) => e.target.style.transform = 'scale(1)'}
      >
        {t('contactUs')}
      </button>
    </div>
  );
};

export default Profile;
