import { useEffect } from 'react';
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

  // Interviews in progress = Interview + Interview-Confirmed + Counter-Offer
  const interviewsActive = (pipeline.Interview || 0) + (pipeline['Interview-Confirmed'] || 0) + (pipeline['Counter-Offer'] || 0);
  const confirmed = pipeline['Interview-Confirmed'] || 0;
  const countered = pipeline['Counter-Offer'] || 0;
  const skPlural = (n, one, few, many) => n === 1 ? one : (n >= 2 && n <= 4) ? few : many;
  const interviewsSubtext = interviewsActive > 0
    ? (lang === 'sk' 
        ? `${confirmed} ${skPlural(confirmed, 'potvrdený', 'potvrdené', 'potvrdených')} · ${countered} ${skPlural(countered, 'protinávrh', 'protinávrhy', 'protinávrhov')}`
        : `${confirmed} confirmed · ${countered} counter-offer${countered === 1 ? '' : 's'}`)
    : (lang === 'sk' ? 'Žiadne aktívne pohovory' : 'No active interviews');

  // Conversion rate = Hired / total apps
  const conversionRate = stats.apps > 0 ? Math.round(((pipeline.Hired || 0) / stats.apps) * 100) : 0;
  const conversionSubtext = stats.apps > 0
    ? (lang === 'sk' 
        ? `${pipeline.Hired || 0} prijatí z ${stats.apps} prihlášok`
        : `${pipeline.Hired || 0} hired from ${stats.apps} applications`)
    : (lang === 'sk' ? 'Zatiaľ žiadne prihlášky' : 'No applications yet');

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
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: '400', letterSpacing: '-0.5px' }}>{t('dashTitle')}</h1>
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
        <StatCard label={t('statApps')} value={stats.apps} unit="" changeText={appsSubtext} changeType="neutral" />
        <StatCard 
          label={lang === 'sk' ? 'Pohovory' : 'Interviews'} 
          value={interviewsActive} 
          unit="" 
          changeText={interviewsSubtext} 
          changeType={interviewsActive > 0 ? 'up' : 'neutral'} 
        />
        <StatCard 
          label={lang === 'sk' ? 'Konverzia' : 'Conversion'} 
          value={`${conversionRate}%`} 
          unit="" 
          changeText={conversionSubtext} 
          changeType={conversionRate > 0 ? 'up' : 'neutral'} 
        />
        <StatCard 
          label={lang === 'sk' ? 'Spracované' : 'Processed'} 
          value={`${processedCount}/${stats.apps}`} 
          unit="" 
          changeText={processedSubtext} 
          changeType={pipeline.Pending === 0 && stats.apps > 0 ? 'up' : 'neutral'} 
        />
        <StatCard label={t('statActive')} value={stats.active} unit="" changeText={activeSubtext} changeType="neutral" />
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
            {[
              { key: 'Pending', sk: 'Čakajúci', color: '#94a3b8' },
              { key: 'Viewed', sk: 'Zobrazení', color: '#3b82f6' },
              { key: 'Interview', sk: 'Pohovor', color: '#6366f1' },
              { key: 'Interview-Confirmed', sk: 'Potvrdený pohovor', color: '#8b5cf6' },
              { key: 'Counter-Offer', sk: 'Protinávrh', color: '#f59e0b' },
              { key: 'Hired', sk: 'Prijatí', color: '#22c55e' },
              { key: 'Rejected', sk: 'Odmietnutí', color: '#ef4444' },
            ].map(({ key, sk, color }) => {
              const count = pipeline[key] || 0;
              const total = stats.apps || 1;
              const percent = Math.round((count / total) * 100);

              return (
                <div key={key} style={{ 
                  padding: '10px 14px', background: 'rgba(255,255,255,0.015)', borderRadius: '6px', 
                  border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '14px',
                  position: 'relative', overflow: 'hidden'
                }}>
                  {/* The Fill Bar */}
                  <div style={{ 
                    position: 'absolute', left: 0, top: 0, height: '100%', width: `${percent}%`, 
                    background: `${color}11`, transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)', zIndex: 0,
                    borderRight: percent > 0 ? `2px solid ${color}` : 'none'
                  }} />
                  
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, zIndex: 1 }} />
                  <div style={{ flex: 1, zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>
                      {lang === 'sk' ? sk : key}
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
