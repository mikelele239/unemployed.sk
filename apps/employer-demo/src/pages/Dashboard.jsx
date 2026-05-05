import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n, useAppState } from '../contexts';
import StatCard from '../components/StatCard';
import Chart from '../components/Chart';

const Dashboard = () => {
  const { t, lang } = useI18n();
  const { companyProfile, analytics, refreshAnalytics } = useAppState();
  const navigate = useNavigate();

  useEffect(() => {
    refreshAnalytics();
    const interval = setInterval(refreshAnalytics, 10000);
    return () => clearInterval(interval);
  }, [lang]);

  const stats = { 
    views: analytics?.total_views || 0, 
    apps: analytics?.total_applications || 0, 
    match: analytics?.avg_match_score || 0, 
    active: analytics?.active_jobs || 0 
  };

  const pipeline = analytics?.pipeline_stats || {};
  const recentCandidates = analytics?.recent_candidates || [];
  const chartData = analytics?.recent_apps_trend || [0,0,0,0,0,0,0];

  // Logic: Highlight if match is low (< 60%)
  const isMatchLow = stats.match > 0 && stats.match < 60;

  return (
    <div style={{ animation: 'tabSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}>
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: '800', letterSpacing: '-0.5px' }}>{t('dashTitle')}</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {lang === 'sk' ? 'Správa pre spoločnosť' : 'Management for'} <span style={{ color: 'var(--text)', fontWeight: 600 }}>{companyProfile?.name}</span>
          </p>
        </div>
        {/* Removed redundant white button as requested */}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
        <StatCard label={t('statViews')} value={stats.views} unit="" changeText={t('statViewsChange')} changeType="neutral" />
        <StatCard label={t('statApps')} value={stats.apps} unit="" changeText={t('statAppsChange')} changeType="neutral" />
        <StatCard 
          label={lang === 'sk' ? 'Stav náborového procesu' : 'Recruitment Process State'} 
          value={`${stats.apps - (pipeline.pending || 0)}/${stats.apps}`} 
          unit="" 
          changeText={pipeline.pending > 0 
            ? (lang === 'sk' ? `${pipeline.pending} čaká na vyjadrenie` : `${pipeline.pending} pending decision`)
            : (lang === 'sk' ? 'VŠETKO VYBAVENÉ' : 'ALL ADDRESSED')} 
          changeType={pipeline.pending > 0 ? 'neutral' : 'up'} 
        />
        <StatCard label={t('statActive')} value={stats.active} unit="" changeText={t('statActiveChange')} changeType="neutral" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px', marginBottom: '32px' }}>
        {/* Scalable Funnel Section */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '24px', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.2px' }}>
              {lang === 'sk' ? 'Distribúcia náborového procesu' : 'Recruitment Distribution'}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {lang === 'sk' ? 'Vypočítané z celkového počtu' : 'Calculated from total of'} <span style={{ color: 'var(--text)', fontWeight: 700 }}>{stats.apps}</span> {lang === 'sk' ? 'prihlášok' : 'applications'}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            {['Pending', 'Viewed', 'Interview', 'Hired', 'Rejected'].map(status => {
              const count = pipeline[status] || pipeline[status.toLowerCase()] || 0;
              const total = stats.apps || 1;
              const percent = Math.round((count / total) * 100);
              const colors = { 
                Pending: ['#94a3b8', 'rgba(148, 163, 184, 0.08)'], 
                Viewed: ['#3b82f6', 'rgba(59, 130, 246, 0.08)'], 
                Interview: ['#6366f1', 'rgba(99, 102, 241, 0.08)'], 
                Hired: ['#22c55e', 'rgba(34, 197, 94, 0.08)'], 
                Rejected: ['#ef4444', 'rgba(239, 68, 68, 0.08)'] 
              };
              const labelMap = { Pending: 'Čakajúci', Viewed: 'Zobrazení', Interview: 'Pohovor', Hired: 'Prijatí', Rejected: 'Odmietnutí' };

              return (
                <div key={status} style={{ 
                  padding: '10px 14px', background: 'rgba(255,255,255,0.015)', borderRadius: '6px', 
                  border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '14px',
                  position: 'relative', overflow: 'hidden'
                }}>
                  {/* The Fill Bar */}
                  <div style={{ 
                    position: 'absolute', left: 0, top: 0, height: '100%', width: `${percent}%`, 
                    background: colors[status][1], transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)', zIndex: 0,
                    borderRight: percent > 0 ? `2px solid ${colors[status][0]}` : 'none'
                  }} />
                  
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: colors[status][0], zIndex: 1 }} />
                  <div style={{ flex: 1, zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>
                      {lang === 'sk' ? labelMap[status] : status}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '900', color: 'var(--text)' }}>{count}</span>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                        {percent}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Small Trend Chart */}
        <Chart data={chartData} title={t('chartTitle')} />
      </div>

    </div>
  );
};

export default Dashboard;

