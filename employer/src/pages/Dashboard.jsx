import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n, useAppState } from '../contexts';
import StatCard from '../components/StatCard';
import Chart from '../components/Chart';
import Toast from '../components/Toast';

const Dashboard = () => {
  const { t, lang } = useI18n();
  const { companyProfile } = useAppState();
  const navigate = useNavigate();

  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Mock data for Dashboard
  const stats = { views: 2847, apps: 184, match: 73, active: 6 };
  const chartData = [12, 18, 9, 24, 31, 22, 16];

  return (
    <div style={{ animation: 'tabSlideIn 0.3s cubic-bezier(0.4, 0, 0.15, 1)' }}>
      <div style={{ padding: '16px 18px 10px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700' }}>{t('dashTitle')}</h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {lang === 'sk' ? 'Vaša firma:' : 'Your company:'} {companyProfile?.name || 'Compx'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '12px 18px' }}>
        <StatCard label={t('statViews')} value={stats.views} changeText={t('statViewsChange')} changeType="up" />
        <StatCard label={t('statApps')} value={stats.apps} changeText={t('statAppsChange')} changeType="up" />
        <StatCard label={t('statMatch')} value={stats.match} unit="%" changeText={t('statMatchChange')} changeType="up" />
        <StatCard label={t('statActive')} value={stats.active} changeText={t('statActiveChange')} changeType="neutral" />
      </div>

      <div style={{ padding: '0 18px 10px' }}>
        <button 
          className="btn-main" 
          onClick={() => navigate('/create-listing')}
          style={{
            background: 'linear-gradient(135deg, #FF8C32 0%, #FF5C00 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>{t('dashCreate')}</span>
        </button>
      </div>

      <div style={{ padding: '0 18px 14px' }}>
        <Chart data={chartData} title={t('chartTitle')} />
      </div>

      <Toast message={toastMsg} show={showToast} onHide={() => setShowToast(false)} />
    </div>
  );
};

export default Dashboard;
