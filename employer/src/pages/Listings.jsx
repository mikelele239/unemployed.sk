import React, { useState } from 'react';
import { useI18n, useAppState } from '../contexts';
import { INITIAL_LISTINGS } from '../mockData';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const ListingCard = ({ l, lang, t, onDelete, getStatusColor, translateStatus }) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const title = lang === 'sk' ? (l.title || l.title_en) : (l.title_en || l.title);
  const status = l.status || 'Active';

  return (
    <motion.div 
      layout="position"
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      style={{ 
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', 
        padding: '24px', transition: 'transform 0.2s ease, border-color 0.2s', cursor: 'default',
        boxShadow: 'var(--shadow)', position: 'relative', overflow: 'hidden'
      }} 
      className="listing-card"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div style={{ flex: 1, marginRight: '12px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '6px', color: 'var(--text)' }}>{title}</h3>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            {l.location} • {l.type}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: getStatusColor(status), background: 'var(--bg)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {translateStatus(status)}
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); setIsConfirming(true); }}
            style={{
              padding: '6px', borderRadius: '6px', border: '1px solid var(--border)', 
              background: 'rgba(255, 71, 71, 0.1)', color: '#ff4747', cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title={t('delete')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"></path></svg>
          </button>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '40px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '24px', fontWeight: '800', fontFamily: 'var(--font-display)', color: 'var(--text)' }}>{l.applications || 0}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>{t('applications')}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '24px', fontWeight: '800', fontFamily: 'var(--font-display)', color: 'var(--text)' }}>{l.views || 0}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>{t('views')}</div>
        </div>
      </div>

      {/* Confirmation Overlay */}
      <AnimatePresence>
        {isConfirming && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(4px)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '20px', textAlign: 'center', zIndex: 10
            }}
          >
            <p style={{ color: '#fff', fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>{t('deleteConfirm')}</p>
            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(l.id); }}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#ff4747', color: '#fff', border: 'none', fontWeight: '700', cursor: 'pointer' }}
              >
                {t('delete')}
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsConfirming(false); }}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', fontWeight: '600', cursor: 'pointer' }}
              >
                Zrušiť
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

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

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/jobs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setListings(prev => prev.filter(l => l.id !== id));
      } else {
        alert('Chyba pri mazaní ponuky.');
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Chyba pri spojení so serverom.');
    }
  };

  return (
    <div style={{ animation: 'tabSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: '800', letterSpacing: '-0.5px' }}>{t('listingsTitle')}</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>{t('listingsSub')}</p>
      </div>

      <motion.div 
        layout
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}
      >
        <AnimatePresence mode="popLayout">
          {listings.map(l => (
            <ListingCard 
              key={l.id} 
              l={l} 
              lang={lang} 
              t={t} 
              onDelete={handleDelete} 
              getStatusColor={getStatusColor}
              translateStatus={translateStatus}
            />
          ))}
        </AnimatePresence>
        {listings.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
            <p style={{ fontSize: '13px' }}>{t('noResults')}</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Listings;
