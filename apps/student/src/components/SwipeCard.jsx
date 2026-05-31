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
  const scale = Math.max(0.85, 1 - index * 0.05);
  const yOffset = Math.min(3, index) * 10;
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
        boxShadow: isTop ? '0 20px 60px var(--overlay-darker)' : 'none',
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
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '28%', pointerEvents: 'none' }}>
        {isTop && job.lat && job.lng ? (
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
          <div style={{ height: '100%', background: isTop ? 'var(--border)' : 'var(--bg-card-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            {isTop ? t('card.unknownLocation') : ''}
          </div>
        )}
        <div style={{
          position: 'absolute', bottom: 10, left: 10, zIndex: 10,
          background: 'var(--bg-card)', backdropFilter: 'blur(12px)', opacity: 0.95,
          padding: '4px 10px', borderRadius: 8,
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 11, fontWeight: 700, color: 'var(--text)',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          {job.location}
        </div>
        {/* ── AI Match Score Badge ── */}
        {isTop && job.match && typeof job.match.overall_score === 'number' && (
          <div style={{
            position: 'absolute', top: 10, right: 10, zIndex: 10,
            background: job.match.overall_score >= 70 ? 'var(--color-success-bg)' : job.match.overall_score >= 40 ? 'var(--color-warning-bg)' : 'var(--color-error-bg)',
            backdropFilter: 'blur(12px)',
            padding: '4px 8px', borderRadius: 8,
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11, fontWeight: 800, color: '#fff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            letterSpacing: '-0.3px',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            {job.match.overall_score}%
          </div>
        )}
      </div>

      {/* ── CONTENT (Only fully visible for top/active card to prevent overlap ghosting) ── */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '10px 14px 62px', background: 'var(--bg-card)',
        borderTop: '1px solid var(--border)', top: '28%',
        display: 'flex', flexDirection: 'column', gap: 5,
        visibility: index > 1 ? 'hidden' : 'visible' // Performance & anti-glitch
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {job.logo_url ? (
            <img src={job.logo_url} alt={job.company} style={{
              width: 36, height: 36, borderRadius: 10, objectFit: 'cover', flexShrink: 0,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
            }} />
          ) : (
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: job.color || 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 850, color: '#fff', fontSize: 16, flexShrink: 0,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
            }}>{job.logo || job.company?.charAt(0) || '?'}</div>
          )}
          <div>
            <div 
              onClick={(e) => { e.stopPropagation(); navigate(`/company/${encodeURIComponent(job.company)}`); }}
              style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent)', cursor: 'pointer', transition: 'all 0.2s', textDecoration: 'underline', textDecorationColor: 'transparent', textUnderlineOffset: '2px' }}
              onMouseEnter={e => { e.target.style.textDecorationColor = 'var(--accent)'; e.target.style.opacity = '0.8'; }}
              onMouseLeave={e => { e.target.style.textDecorationColor = 'transparent'; e.target.style.opacity = '1'; }}
            >{job.company}</div>
            <div style={{ fontSize: 10, color: 'var(--green)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{t('card.verified')}</div>
          </div>
        </div>

        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 400, lineHeight: 1.1, margin: 0, letterSpacing: '-0.3px', marginBottom: 4 }}>
          {job.title}
        </h3>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(job.tags || []).slice(0, 3).map((tag, i) => (
            <span key={tag} style={{
              padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700,
              background: i === 0 ? 'var(--accent)' : 'var(--bg-card-hover)',
              color: i === 0 ? '#fff' : 'var(--text-muted)',
              border: i === 0 ? 'none' : '1px solid var(--border)'
            }}>{tag}</span>
          ))}
        </div>

        {/* ── AI Match compact row (mobile) ── */}
        {job.match && typeof job.match.overall_score === 'number' && (() => {
          const score = job.match.overall_score;
          const bandKey = job.match.match_band || (score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 20 ? 'D' : 'E');
          const bc = { A: { label: 'Strong fit', sk: 'Silná zhoda', color: 'var(--color-success)', icon: '🟢' }, B: { label: 'Good fit', sk: 'Dobrá zhoda', color: 'var(--color-info)', icon: '🔵' }, C: { label: 'Potential', sk: 'Potenciálna', color: 'var(--color-warning)', icon: '🟡' }, D: { label: 'Partial', sk: 'Čiastočná', color: '#f97316', icon: '🟠' }, E: { label: 'Low', sk: 'Nízka', color: 'var(--color-error)', icon: '🔴' } }[bandKey] || { label: 'Match', color: 'var(--color-warning)', icon: '🟡' };
          const tier = job.match.eligibility_tier || (job.match.eligible !== false ? 'eligible' : 'not_eligible');
          const tierEmoji = tier === 'eligible' ? '✅' : tier === 'near_miss' ? '🔶' : '❌';

          // Pick the best insight or first reason to show
          const insightText = (job.match.insights || []).find(i => i.type === 'strength' || i.type === 'moderate')?.text;
          const displayText = insightText || (job.match.match_reasons || [])[0];

          return (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 10px', borderRadius: 10,
              background: `linear-gradient(135deg, ${bc.color}12, ${bc.color}06)`,
              border: `1px solid ${bc.color}22`,
              marginTop: 0,
            }}>
              {/* Score circle */}
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: `conic-gradient(${bc.color} ${score * 3.6}deg, var(--bg-card-hover) 0deg)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, position: 'relative',
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-card)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 800, color: bc.color,
                }}>{score}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700 }}>
                  <span style={{ color: bc.color }}>{bc.icon} {bc.sk || bc.label}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 8, marginLeft: 'auto' }}>{tierEmoji}</span>
                </div>
                {displayText && (
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {typeof displayText === 'string' ? (() => {
                      try { const p = JSON.parse(displayText); return p.sk || p.en || displayText; } catch { return displayText; }
                    })() : displayText}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent)' }}>
            {job.rate} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{job.rateUnit}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{job.hours}</div>
        </div>
      </div>

      {/* ── ACTION BUTTONS ── */}
      {isTop && (
        <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, display: 'flex', justifyContent: 'center', gap: 10, zIndex: 100 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onSwipe('left', job); }}
            style={{ 
              flex: 1, height: 44, borderRadius: 12, 
              border: '1px solid var(--border)', background: 'var(--bg-card)', 
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)', color: 'var(--text-muted)', 
              cursor: 'pointer', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            {t('foryou.skip') || 'Preskočiť'}
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onSwipe('right', job); }}
            style={{ 
              flex: 2, height: 44, borderRadius: 12, 
              border: 'none', background: 'linear-gradient(135deg, #FF8C32, #FF5C00)', 
              boxShadow: '0 6px 20px var(--shadow-accent)', color: '#fff', 
              cursor: 'pointer', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            {t('foryou.interested') || 'Mám záujem'}
          </button>
        </div>
      )}
    </motion.div>
  );
}
