import React, { useState } from 'react';
import { useI18n, useAppState } from '../contexts';
import { INITIAL_LISTINGS } from '../mockData';
import { useNavigate } from 'react-router-dom';

const Listings = () => {
  const { t, lang } = useI18n();
  const { listings, setListings } = useAppState();
  const navigate = useNavigate();

  // Initialize if empty
  React.useEffect(() => {
    if (listings.length === 0) {
      setListings(INITIAL_LISTINGS);
    }
  }, []);

  const getStatusColor = (status) => {
    if (status === 'Active') return 'var(--green)';
    if (status === 'Draft') return 'var(--text-muted)';
    return 'var(--accent)';
  };

  const translateStatus = (s) => t(`status${s}`);

  return (
    <div style={{ animation: 'tabSlideIn 0.3s cubic-bezier(0.4, 0, 0.15, 1)' }}>
      <div style={{ padding: '16px 18px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700' }}>{t('listingsTitle')}</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('listingsSub')}</p>
        </div>
        <button 
          onClick={() => navigate('/create-listing')}
          style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', cursor: 'pointer' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>

      <div style={{ padding: '10px 18px' }}>
        {listings.map(l => {
          const title = lang === 'sk' ? (l.title || l.title_en) : (l.title_en || l.title);
          return (
            <div key={l.id} style={{ 
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', 
              padding: '16px', marginBottom: '12px' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>{title}</h3>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{l.location} • {l.type}</div>
                </div>
                <div style={{ fontSize: '10px', fontWeight: '600', color: getStatusColor(l.status), background: 'var(--bg)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  {translateStatus(l.status)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '700', fontFamily: 'var(--font-display)' }}>{l.applications}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('applications')}</div>
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '700', fontFamily: 'var(--font-display)' }}>{l.views}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('views')}</div>
                </div>
              </div>
            </div>
          );
        })}
        {listings.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '13px' }}>{t('noResults')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Listings;
