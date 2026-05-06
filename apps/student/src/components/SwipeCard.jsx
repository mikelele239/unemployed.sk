import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../I18nContext';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function SwipeCard({ job, index, total, onSwipe, onClick, onLike, isLiked }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-30, 30]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);
  
  const dragStartPos = useRef({ x: 0, y: 0 });
  const isTop = index === 0;

  const handleDragStart = (event, info) => {
    dragStartPos.current = { x: info.point.x, y: info.point.y };
  };

  const handleDragEnd = (event, info) => {
    if (info.offset.x > 150) {
      onSwipe('right', job);
    } else if (info.offset.x < -150) {
      onSwipe('left', job);
    }
  };

  const handeCardTap = (e, info) => {
    const dist = Math.sqrt(
      Math.pow(info.point.x - dragStartPos.current.x, 2) + 
      Math.pow(info.point.y - dragStartPos.current.y, 2)
    );
    if (dist < 5 && isTop) {
      onClick(job);
    }
  };

  // Stack styling logic
  const scale = 1 - index * 0.05;
  const yOffset = index * 12;
  const cardOpacity = index === 0 ? 1 : index === 1 ? 0.8 : 0.5;

  return (
    <motion.div
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        opacity: isTop ? opacity : cardOpacity,
        position: 'absolute',
        inset: 0,
        zIndex: total - index,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 24,
        overflow: 'hidden',
        boxShadow: isTop ? '0 20px 60px rgba(0,0,0,0.6)' : 'none',
        cursor: isTop ? 'grab' : 'default',
        touchAction: 'none',
        willChange: 'transform, opacity'
      }}
      initial={{ scale: 0.9, opacity: 0, y: 20 }}
      animate={{ 
        scale, 
        y: yOffset,
        opacity: cardOpacity
      }}
      exit={{ 
        x: x.get() > 0 ? 1000 : x.get() < 0 ? -1000 : 0,
        opacity: 0,
        scale: 0.8,
        transition: { duration: 0.3 }
      }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onTap={handeCardTap}
      whileDrag={{ scale: 1.02 }}
    >
      {/* ── MAP HERO ── */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '35%', pointerEvents: 'none' }}>
        {job.lat && job.lng ? (
          <MapContainer
            center={[Number(job.lat), Number(job.lng)]}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
            dragging={false}
            scrollWheelZoom={false}
            attributionControl={false}
          >
            <TileLayer url={document.documentElement.getAttribute('data-theme') === 'light' ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'} />
            <Marker position={[Number(job.lat), Number(job.lng)]} />
          </MapContainer>
        ) : (
          <div style={{ height: '100%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            {t('card.unknownLocation')}
          </div>
        )}
        <div style={{
          position: 'absolute', bottom: 12, left: 12, zIndex: 10,
          background: 'var(--bg-card)', backdropFilter: 'blur(12px)', opacity: 0.95,
          padding: '6px 12px', borderRadius: 10,
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, fontWeight: 700, color: 'var(--text)',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          {job.location}
        </div>
      </div>

      {/* ── CONTENT (Only fully visible for top/active card to prevent overlap ghosting) ── */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          padding: '14px 18px 64px', background: 'var(--bg-card)',
          borderTop: '1px solid var(--border)', top: '35%',
          display: 'flex', flexDirection: 'column', gap: 8,
          visibility: index > 1 ? 'hidden' : 'visible' // Performance & anti-glitch
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: job.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 850, color: '#fff', fontSize: 18
          }}>{job.logo}</div>
          <div>
            <div 
              onClick={(e) => { e.stopPropagation(); navigate(`/company/${encodeURIComponent(job.company)}`); }}
              style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text)', cursor: 'pointer', transition: 'color 0.2s' }}
              onMouseEnter={e => e.target.style.color = 'var(--accent)'}
              onMouseLeave={e => e.target.style.color = 'var(--text)'}
            >{job.company}</div>
            <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{t('card.verified')}</div>
          </div>
        </div>

        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 800, lineHeight: 1.1, margin: 0, letterSpacing: '-0.3px', marginBottom: 6 }}>
          {job.title}
        </h3>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(job.tags || []).map((tag, i) => (
            <span key={tag} style={{
              padding: '5px 14px', borderRadius: 100, fontSize: 12, fontWeight: 700,
              background: i === 0 ? 'var(--accent)' : 'var(--bg-card-hover)',
              color: i === 0 ? '#fff' : 'var(--text-muted)',
              border: i === 0 ? 'none' : '1px solid var(--border)'
            }}>{tag}</span>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent)' }}>
            {job.rate} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{job.rateUnit}</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{job.hours}</div>
        </div>
      </div>

      {/* ── ACTION BUTTONS ── */}
      {isTop && (
        <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 20, zIndex: 100 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onSwipe('left', job); }}
            style={{ 
              width: 48, height: 48, borderRadius: 24, 
              border: '1px solid var(--border)', background: 'var(--bg-card)', 
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)', color: 'var(--text-muted)', 
              fontSize: 16, cursor: 'pointer', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >✕</button>
          {onLike && (
            <button
              onClick={(e) => { e.stopPropagation(); onLike(job.id); }}
              style={{ 
                width: 48, height: 48, borderRadius: 24, 
                border: isLiked ? '2px solid #ef4444' : '1px solid var(--border)',
                background: isLiked ? 'rgba(239,68,68,0.1)' : 'var(--bg-card)', 
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)', 
                color: isLiked ? '#ef4444' : 'var(--text-muted)', 
                fontSize: 16, cursor: 'pointer', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={isLiked ? '#ef4444' : 'none'} stroke="currentColor" strokeWidth="2.5">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onSwipe('right', job); }}
            style={{ 
              width: 56, height: 56, borderRadius: 28, 
              border: 'none', background: 'var(--accent)', 
              boxShadow: '0 8px 24px rgba(255,92,0,0.4)', color: '#fff', 
              fontSize: 22, cursor: 'pointer', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >♥</button>
        </div>
      )}
    </motion.div>
  );
}
