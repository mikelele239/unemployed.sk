import React, { useEffect, useState } from 'react';

const Toast = ({ message, show, onHide }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onHide();
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [show, onHide]);

  return (
    <div style={{
      position: 'fixed', bottom: '72px', left: '16px', right: '16px',
      background: 'var(--green)', color: '#fff', padding: '12px 14px', borderRadius: '10px',
      fontSize: '12px', fontWeight: '500', textAlign: 'center',
      transform: show ? 'translateY(0)' : 'translateY(80px)', 
      opacity: show ? 1 : 0, transition: 'all 0.3s ease', zIndex: 60,
      pointerEvents: 'none'
    }}>
      {message}
    </div>
  );
};

export default Toast;
