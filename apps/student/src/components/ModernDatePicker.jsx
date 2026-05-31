import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ModernDatePicker = ({ onSelect, onCancel, singleDate = false, title }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [offeredDates, setOfferedDates] = useState([]);
  const [sent, setSent] = useState(false);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth, year, month };
  };

  const [selectedDay, setSelectedDay] = useState(null);
  const [hour, setHour] = useState('10');
  const [minute, setMinute] = useState('00');
  
  const { firstDay, daysInMonth, year, month } = getDaysInMonth(selectedDate);
  const monthName = selectedDate.toLocaleString('sk-SK', { month: 'long' });

  const addDate = () => {
    if (!selectedDay) return;
    const d = new Date(year, month, selectedDay, parseInt(hour), parseInt(minute));
    const isoString = d.toISOString();
    if (singleDate) {
      setOfferedDates([isoString]);
    } else if (!offeredDates.includes(isoString)) {
      setOfferedDates([...offeredDates, isoString]);
    }
  };

  const removeDate = (iso) => {
    setOfferedDates(offeredDates.filter(d => d !== iso));
  };

  // Sent confirmation - simple orange tick with animation
  if (sent) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        style={{
          background: '#000', color: '#fff', padding: 40, borderRadius: 20,
          border: '1px solid #222', boxShadow: '0 30px 60px var(--overlay-darker)',
          width: 'min(calc(100vw - 32px), 300px)', textAlign: 'center',
          fontFamily: 'var(--font-body)'
        }}
      >
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.15 }}
          style={{
            width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #FF8C32, #FF5C00)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 30px var(--shadow-accent)'
          }}
        >
          <motion.svg
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          >
            <motion.path d="M20 6L9 17l-5-5" />
          </motion.svg>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}
        >
          Odoslané!
        </motion.div>
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{ fontSize: 12, color: '#666', marginBottom: 20 }}
        >
          {offeredDates.length} {offeredDates.length === 1 ? 'termín' : 'termíny'} {singleDate ? 'navrhnutý' : 'odoslané'}
        </motion.div>
        <motion.button
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          whileTap={{ scale: 0.95 }}
          onClick={onCancel}
          style={{ padding: '10px 28px', borderRadius: 10, border: '1px solid #333', background: '#111', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
        >
          Zavrieť
        </motion.button>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      style={{
        background: '#000', color: '#fff', 
        padding: window.innerWidth <= 900 ? '20px' : '28px', 
        borderRadius: '20px',
        border: '1px solid #222', boxShadow: '0 30px 60px var(--overlay-darker)',
        width: 'min(calc(100vw - 32px), 360px)', zIndex: 1000, position: 'relative',
        fontFamily: 'var(--font-body)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--accent)' }}>{title || (singleDate ? 'Navrhnúť termín' : 'Plánovač Pohovorov')}</h3>
        <button onClick={onCancel} style={{ background: 'var(--overlay-light)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--overlay-light)'}
        >&times;</button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ fontSize: '15px', fontWeight: '800', textTransform: 'capitalize' }}>{monthName} {year}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <motion.button whileTap={{ scale: 0.85 }} onClick={() => setSelectedDate(new Date(year, month - 1, 1))} style={{ background: '#181818', border: '1px solid #2a2a2a', color: '#fff', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: 14 }}>&lsaquo;</motion.button>
            <motion.button whileTap={{ scale: 0.85 }} onClick={() => setSelectedDate(new Date(year, month + 1, 1))} style={{ background: '#181818', border: '1px solid #2a2a2a', color: '#fff', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: 14 }}>&rsaquo;</motion.button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center', marginBottom: '6px' }}>
          {['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne'].map(d => (
            <div key={d} style={{ fontSize: '10px', color: '#444', fontWeight: '800', padding: '6px 0', letterSpacing: '0.5px' }}>{d}</div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
          {Array.from({ length: (firstDay + 6) % 7 }).map((_, i) => <div key={`empty-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const isSelected = selectedDay === day;
            const isoCheck = new Date(year, month, day).toISOString().split('T')[0];
            const isActive = offeredDates.some(od => od.startsWith(isoCheck));
            const isPast = new Date(year, month, day) < new Date(new Date().setHours(0,0,0,0));

            return (
              <motion.div 
                key={day}
                whileTap={isPast ? {} : { scale: 0.82 }}
                animate={isSelected ? { scale: [1, 1.15, 1], transition: { duration: 0.25 } } : {}}
                onClick={() => !isPast && setSelectedDay(day)}
                style={{
                  height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: isSelected ? '900' : '600', borderRadius: '10px', 
                  cursor: isPast ? 'default' : 'pointer',
                  background: isSelected ? 'var(--accent)' : isActive ? 'var(--accent-light)' : 'transparent',
                  color: isPast ? '#2a2a2a' : isSelected ? '#fff' : isActive ? 'var(--accent)' : '#888',
                  border: 'none',
                  boxShadow: isSelected ? '0 4px 16px var(--shadow-accent)' : 'none',
                  position: 'relative',
                  zIndex: isSelected ? 2 : 1,
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                }}
              >
                {day}
                {isActive && !isSelected && (
                  <div style={{ position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)' }} />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selectedDay && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ marginBottom: '20px', padding: '16px', background: '#0a0a0a', borderRadius: '14px', border: '1px solid #1a1a1a', overflow: 'hidden' }}
          >
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#555', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vybrať čas pre {selectedDay}. {monthName}</div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select value={hour} onChange={(e) => setHour(e.target.value)} style={{ flex: 1, background: '#151515', color: '#fff', border: '1px solid #2a2a2a', padding: '10px', borderRadius: '10px', fontSize: '14px', fontWeight: '700', fontFamily: 'var(--font-body)', appearance: 'none', textAlign: 'center' }}>
                {Array.from({ length: 24 }).map((_, i) => <option key={i} value={String(i).padStart(2, '0')}>{String(i).padStart(2, '0')}</option>)}
              </select>
              <span style={{ fontWeight: '900', color: '#444', fontSize: 18 }}>:</span>
              <select value={minute} onChange={(e) => setMinute(e.target.value)} style={{ flex: 1, background: '#151515', color: '#fff', border: '1px solid #2a2a2a', padding: '10px', borderRadius: '10px', fontSize: '14px', fontWeight: '700', fontFamily: 'var(--font-body)', appearance: 'none', textAlign: 'center' }}>
                {['00', '15', '30', '45'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                onClick={addDate}
                style={{ padding: '10px 18px', background: 'var(--accent)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '800', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-body)', boxShadow: '0 4px 12px var(--shadow-accent)' }}
              >
                +
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '10px', fontWeight: '800', color: '#444', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{singleDate ? 'Vybraný termín' : `Ponúkané termíny (${offeredDates.length})`}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {offeredDates.length === 0 && <span style={{ fontSize: '12px', color: '#333', fontStyle: 'italic' }}>Kliknite na deň a pridajte čas...</span>}
          <AnimatePresence>
            {offeredDates.map(iso => (
              <motion.div 
                key={iso} 
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                style={{ background: '#0a0a0a', padding: '10px 14px', borderRadius: '10px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #1a1a1a' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: 'var(--accent)', fontSize: 8 }}>●</span>
                  <span style={{ fontWeight: '700' }}>{new Date(iso).toLocaleString('sk-SK', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>
                <motion.span 
                  whileHover={{ scale: 1.3 }} whileTap={{ scale: 0.8 }}
                  onClick={() => removeDate(iso)} 
                  style={{ cursor: 'pointer', color: 'var(--color-error)', fontWeight: '900', fontSize: '16px', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}
                >&times;</motion.span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <motion.button
        whileHover={offeredDates.length > 0 ? { scale: 1.02, boxShadow: '0 8px 30px var(--shadow-accent)' } : {}}
        whileTap={offeredDates.length > 0 ? { scale: 0.97 } : {}}
        disabled={offeredDates.length === 0}
        onClick={() => {
          onSelect(offeredDates);
          setSent(true);
        }}
        style={{
          width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
          background: offeredDates.length === 0 ? '#151515' : 'linear-gradient(135deg, #FF8C32, #FF5C00)',
          color: offeredDates.length === 0 ? '#333' : '#fff',
          fontSize: '13px', fontWeight: '800', cursor: offeredDates.length === 0 ? 'default' : 'pointer',
          fontFamily: 'var(--font-body)',
          boxShadow: offeredDates.length > 0 ? '0 6px 20px var(--shadow-accent)' : 'none',
          transition: 'background 0.2s'
        }}
      >
        {offeredDates.length === 0 ? (singleDate ? 'Vyber dátum a čas' : 'Pridajte termíny') : (singleDate ? '📨 Odoslať protinávrh' : '📨 Odoslať pozvánku')}
      </motion.button>
    </motion.div>
  );
};

export default ModernDatePicker;
