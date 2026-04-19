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
    <div style={{ animation: 'tabSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: '800', letterSpacing: '-0.5px' }}>{t('dashTitle')}</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
          {lang === 'sk' ? 'Správa pre spoločnosť' : 'Management for'} <span style={{ color: 'var(--text)', fontWeight: 600 }}>{companyProfile?.name || 'Compx'}</span>
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
        <StatCard label={t('statViews')} value={stats.views} changeText={t('statViewsChange')} changeType="up" />
        <StatCard label={t('statApps')} value={stats.apps} changeText={t('statAppsChange')} changeType="up" />
        <StatCard label={t('statMatch')} value={stats.match} unit="%" changeText={t('statMatchChange')} changeType="up" />
        <StatCard label={t('statActive')} value={stats.active} changeText={t('statActiveChange')} changeType="neutral" />
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '24px', boxShadow: 'var(--shadow)' }}>
        <Chart data={chartData} title={t('chartTitle')} />
      </div>

      <Toast message={toastMsg} show={showToast} onHide={() => setShowToast(false)} />
    </div>
  );
};

export default Dashboard;
