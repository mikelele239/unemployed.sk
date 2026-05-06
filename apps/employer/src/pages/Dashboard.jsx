import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n, useAppState } from '../contexts';
import StatCard from '../components/StatCard';
import Chart from '../components/Chart';

const Dashboard = () => {
  const { t, lang } = useI18n();
  const { companyProfile, analytics, liveViewers, refreshAnalytics } = useAppState();
  const navigate = useNavigate();

  useEffect(() => {
    refreshAnalytics();
    const interval = setInterval(refreshAnalytics, 15000);
    return () => clearInterval(interval);
  }, [lang]);

  // Loading / Blank Screen Guard
  if (!analytics || !analytics.pipeline_stats) {
    return (
      <div style={{ height: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.05)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: 20, color: 'var(--text-muted)', fontSize: 14, fontWeight: 600 }}>{lang === 'sk' ? 'Načítavam analytiku centrály...' : 'Loading analytics...'}</p>
      </div>
    );
  }

  const stats = { 
    views: analytics.total_views || 0, 
    likes: analytics.total_likes || 0,
    apps: analytics.total_applications || 0, 
    active: analytics.active_jobs || 0 
  };

  const totalLiveViewers = Object.values(liveViewers || {}).reduce((a, b) => a + b, 0);

  const pipeline = analytics.pipeline_stats || {};
  const chartData = analytics.recent_apps_trend || [0,0,0,0,0,0,0];

  // Compute live sub-text for each stat card
  const todayApps = chartData[6] || 0;
  const yesterdayApps = chartData[5] || 0;
  const weekTotal = chartData.reduce((a, b) => a + b, 0);

  const viewsSubtext = stats.views > 0
    ? (lang === 'sk' ? `${stats.views} celkovo zo všetkých ponúk` : `${stats.views} total across all listings`)
    : (lang === 'sk' ? 'Zatiaľ žiadne zobrazenia' : 'No views yet');

  const appsSubtext = todayApps > 0
    ? (lang === 'sk' ? `+${todayApps} dnes · ${weekTotal} za 7 dní` : `+${todayApps} today · ${weekTotal} in 7 days`)
    : weekTotal > 0
      ? (lang === 'sk' ? `${weekTotal} za posledných 7 dní` : `${weekTotal} in last 7 days`)
      : (lang === 'sk' ? 'Zatiaľ žiadne prihlášky' : 'No applications yet');

  const processedCount = stats.apps - (pipeline.Pending || 0);
  const processedSubtext = pipeline.Pending > 0
    ? (lang === 'sk' ? `${pipeline.Pending} čaká na vyjadrenie` : `${pipeline.Pending} pending decision`)
    : stats.apps > 0
      ? (lang === 'sk' ? 'Všetko vybavené ✓' : 'All addressed ✓')
      : (lang === 'sk' ? 'Žiadne prihlášky' : 'No applications');

  const activeSubtext = stats.active > 0
    ? (lang === 'sk' ? `${stats.active} ${stats.active === 1 ? 'ponuka' : 'ponuky'} aktívne` : `${stats.active} listing${stats.active === 1 ? '' : 's'} active`)
    : (lang === 'sk' ? 'Žiadne aktívne ponuky' : 'No active listings');

  return (
    <div style={{ animation: 'tabSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}>
      <div className="flex-responsive" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: '800', letterSpacing: '-0.5px' }}>{t('dashTitle')}</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {lang === 'sk' ? 'Správa pre spoločnosť' : 'Management for'} <span style={{ color: 'var(--text)', fontWeight: 600 }}>{companyProfile?.name}</span>
          </p>
        </div>
        {totalLiveViewers > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 16px', borderRadius: '20px',
            background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)',
          }}>
            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e', animation: 'blink 1.5s infinite', boxShadow: '0 0 10px rgba(34,197,94,0.5)' }}></span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#22c55e' }}>
              {totalLiveViewers} {lang === 'sk' ? 'živý' : 'live'} {lang === 'sk' ? (totalLiveViewers === 1 ? 'návštevník' : 'návštevníci') : (totalLiveViewers === 1 ? 'viewer' : 'viewers')}
            </span>
          </div>
        )}
      </div>

      <div className="dashboard-grid">
        <StatCard label={t('statViews')} value={stats.views} unit="" changeText={viewsSubtext} changeType={stats.views > 0 ? 'neutral' : 'neutral'} />
        <StatCard label={lang === 'sk' ? 'Záujem' : 'Likes'} value={stats.likes} unit="" changeText={stats.likes > 0 ? (lang === 'sk' ? `${stats.likes} celkovo` : `${stats.likes} total`) : (lang === 'sk' ? 'Zatiaľ žiadne lajky' : 'No likes yet')} changeType={stats.likes > 0 ? 'up' : 'neutral'} />
        <StatCard label={t('statApps')} value={stats.apps} unit="" changeText={appsSubtext} changeType={todayApps > 0 ? 'up' : 'neutral'} />
        <StatCard 
          label={lang === 'sk' ? 'Stav náborového procesu' : 'Recruitment Process State'} 
          value={`${processedCount}/${stats.apps}`} 
          unit="" 
          changeText={processedSubtext} 
          changeType={pipeline.Pending === 0 && stats.apps > 0 ? 'up' : 'neutral'} 
        />
        <StatCard label={t('statActive')} value={stats.active} unit="" changeText={activeSubtext} changeType={stats.active > 0 ? 'up' : 'neutral'} />
      </div>

      <div className="dashboard-main-grid">
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
              const count = pipeline[status] || 0;
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
