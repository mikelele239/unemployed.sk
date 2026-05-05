import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ModernDatePicker = ({ onSelect, onCancel }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [offeredDates, setOfferedDates] = useState([]);

  // Generate current month days
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
    if (!offeredDates.includes(isoString)) {
      setOfferedDates([...offeredDates, isoString]);
    }
  };

  const removeDate = (iso) => {
    setOfferedDates(offeredDates.filter(d => d !== iso));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      style={{
        background: '#000', color: '#fff', 
        padding: window.innerWidth <= 900 ? '20px' : '28px', 
        borderRadius: '16px',
        border: '1px solid #333', boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
        width: 'min(calc(100vw - 32px), 360px)', zIndex: 1000, position: 'relative',
        fontFamily: 'var(--font-body)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--accent)' }}>Plánovač Pohovorov</h3>
        <button onClick={onCancel} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&times;</button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ fontSize: '15px', fontWeight: '800', textTransform: 'capitalize' }}>{monthName} {year}</span>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setSelectedDate(new Date(year, month - 1, 1))} style={{ background: '#222', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>&lsaquo;</button>
            <button onClick={() => setSelectedDate(new Date(year, month + 1, 1))} style={{ background: '#222', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>&rsaquo;</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center', marginBottom: '10px' }}>
          {['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne'].map(d => (
            <div key={d} style={{ fontSize: '11px', color: '#555', fontWeight: '900' }}>{d}</div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
          {Array.from({ length: (firstDay + 6) % 7 }).map((_, i) => <div key={`empty-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const isSelected = selectedDay === day;
            const isoCheck = new Date(year, month, day).toISOString().split('T')[0];
            const isActive = offeredDates.some(od => od.startsWith(isoCheck));

            return (
              <div 
                key={day}
                onClick={() => setSelectedDay(day)}
                style={{
                  height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: '800', borderRadius: '8px', cursor: 'pointer',
                  background: isSelected ? 'var(--accent)' : isActive ? '#333' : 'transparent',
                  color: '#fff',
                  border: isSelected ? '1px solid var(--accent)' : '1px solid #222',
                  transition: 'all 0.2s'
                }}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>

      {selectedDay && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          style={{ marginBottom: '20px', padding: '16px', background: '#111', borderRadius: '12px', border: '1px solid #222' }}
        >
          <div style={{ fontSize: '11px', fontWeight: '900', color: '#666', marginBottom: '12px', textTransform: 'uppercase' }}>Vybrať Čas</div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select value={hour} onChange={(e) => setHour(e.target.value)} style={{ flex: 1, background: '#222', color: '#fff', border: '1px solid #333', padding: '8px', borderRadius: '6px', fontSize: '14px', fontWeight: '700' }}>
              {Array.from({ length: 24 }).map((_, i) => <option key={i} value={String(i).padStart(2, '0')}>{String(i).padStart(2, '0')}:00</option>)}
            </select>
            <span style={{ fontWeight: '900' }}>:</span>
            <select value={minute} onChange={(e) => setMinute(e.target.value)} style={{ flex: 1, background: '#222', color: '#fff', border: '1px solid #333', padding: '8px', borderRadius: '6px', fontSize: '14px', fontWeight: '700' }}>
              {['00', '15', '30', '45'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <button 
              onClick={addDate}
              style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: '900', fontSize: '12px', cursor: 'pointer' }}
            >
              PRIDAŤ
            </button>
          </div>
        </motion.div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '10px', fontWeight: '900', color: '#555', marginBottom: '10px', textTransform: 'uppercase' }}>Ponúkané termíny</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {offeredDates.length === 0 && <span style={{ fontSize: '12px', color: '#333', fontStyle: 'italic' }}>Kliknite na deň a pridajte čas...</span>}
          {offeredDates.map(iso => (
            <div key={iso} style={{ background: '#111', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #222' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: 'var(--accent)' }}>●</span>
                <span style={{ fontWeight: '800' }}>{new Date(iso).toLocaleString('sk-SK', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
              <span onClick={() => removeDate(iso)} style={{ cursor: 'pointer', color: '#ef4444', fontWeight: '900', fontSize: '18px' }}>&times;</span>
            </div>
          ))}
        </div>
      </div>

      <button
        disabled={offeredDates.length === 0}
        onClick={() => onSelect(offeredDates)}
        style={{
          width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
          background: offeredDates.length === 0 ? '#222' : 'var(--accent)',
          color: offeredDates.length === 0 ? '#444' : '#fff',
          fontSize: '12px', fontWeight: '900', cursor: 'pointer',
          transition: 'all 0.2s'
        }}
      >
        POTVRDIŤ A ODOSLAŤ
      </button>
    </motion.div>
  );
};

export default ModernDatePicker;
