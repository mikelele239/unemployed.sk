import React from 'react';
import { useI18n, useTheme, useAppState } from '../contexts';

const Profile = () => {
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { companyProfile } = useAppState();

  const initials = companyProfile?.name ? companyProfile.name.substring(0, 2).toUpperCase() : 'CO';

  return (
    <div style={{ animation: 'tabSlideIn 0.3s cubic-bezier(0.4, 0, 0.15, 1)' }}>
      <div style={{ padding: '20px 18px 14px', textAlign: 'center', background: 'linear-gradient(180deg, var(--accent-lighter) 0%, var(--bg) 100%)' }}>
        <div style={{
          width: '60px', height: '60px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', 
          alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', fontSize: '24px', fontWeight: '700', color: '#fff'
        }}>
          {initials}
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700' }}>{companyProfile?.name || 'Company'}</h2>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>📍 {(companyProfile?.locations || []).join(', ')}</div>
      </div>

      <div style={{ margin: '12px 18px', padding: '10px 14px', background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
          <span>{t('profComplete')}</span><span>100%</span>
        </div>
        <div style={{ height: '5px', background: 'var(--border)', borderRadius: '5px', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'var(--accent)', borderRadius: '5px', width: '100%' }}></div>
        </div>
      </div>

      <div style={{ padding: '0 18px', marginBottom: '16px' }}>
        <h4 style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
          {t('profDetails')}
        </h4>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: '12px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Odvietvie</span><span>{companyProfile?.industry || 'Neuvedené'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: '12px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Hľadáme</span><span>{(companyProfile?.hiring || []).join(', ')}</span>
        </div>
      </div>

      <div style={{ padding: '0 18px', marginBottom: '16px' }}>
        <h4 style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
          Nastavenia
        </h4>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-muted)' }}>{theme === 'dark' ? t('themeLight') : t('themeDark')}</span>
          <button onClick={toggleTheme} style={{ 
            padding: '6px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '100px', color: 'var(--text)' 
          }}>
            Prepnúť
          </button>
        </div>
      </div>

    </div>
  );
};

export default Profile;
