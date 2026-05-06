import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n, useAppState } from '../contexts';
import { supabase } from '../supabase';
import StatCard from '../components/StatCard';
import Chart from '../components/Chart';

const Dashboard = () => {
  const { t, lang } = useI18n();
  const { companyProfile } = useAppState();
  const navigate = useNavigate();

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnalytics = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError('No session'); setLoading(false); return; }

      const analyticsRes = await fetch('/api/employer/analytics', { headers: { 'Authorization': `Bearer ${session.access_token}` } });

      if (!analyticsRes.ok) {
        const body = await analyticsRes.text();
        console.error('[Dashboard] analytics failed:', analyticsRes.status, body);
        setError(`Analytics API error ${analyticsRes.status}`);
        setLoading(false);
        return;
      }

      const payload = await analyticsRes.json();
      console.log('[Dashboard] analytics payload:', payload);
      setAnalytics({
        total_views:        payload.total_views        ?? 0,
        total_applications: payload.total_applications ?? 0,
        active_jobs:        payload.active_jobs        ?? 0,
        avg_match_score:    payload.avg_match_score    ?? 0,
        pipeline_stats:     payload.pipeline_stats     ?? { Pending:0, Viewed:0, Interview:0, Hired:0, Rejected:0 },
        recent_apps_trend:  payload.recent_apps_trend  ?? [0,0,0,0,0,0,0],
      });
      setError('');
    } catch (err) {
      console.error('[Dashboard] fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 20000);
    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ animation: 'tabSlideIn 0.4s ease' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ width: '40%', height: 32, borderRadius: 8, background: 'var(--border)', animation: 'shimmer 1.5s ease-in-out infinite alternate', marginBottom: 8 }} />
          <div style={{ width: '25%', height: 16, borderRadius: 6, background: 'var(--border)', animation: 'shimmer 1.5s ease-in-out 0.1s infinite alternate' }} />
        </div>
        <div className="dashboard-grid" style={{ marginBottom: 24 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ height: 96, borderRadius: 'var(--radius)', background: 'var(--border)', animation: `shimmer 1.5s ease-in-out ${i*0.1}s infinite alternate` }} />
          ))}
        </div>
        <div style={{ height: 240, borderRadius: 'var(--radius)', background: 'var(--border)', animation: 'shimmer 1.5s ease-in-out 0.4s infinite alternate' }} />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error || !analytics) {
    return (
      <div style={{ padding: '48px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <h3 style={{ color: 'var(--text)', marginBottom: 8 }}>
          {lang === 'sk' ? 'Chyba pri načítaní analytiky' : 'Failed to load analytics'}
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>{error}</p>
        <button onClick={fetchAnalytics}
          style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          {lang === 'sk' ? 'Skúsiť znova' : 'Retry'}
        </button>
      </div>
    );
  }

  // ── Data ─────────────────────────────────────────────────────────────────────
  const stats = {
    views:  analytics.total_views,
    apps:   analytics.total_applications,
    active: analytics.active_jobs,
  };
  const pipeline  = analytics.pipeline_stats;
  const chartData = analytics.recent_apps_trend;

  const todayApps = chartData[6] || 0;
  const weekTotal = chartData.reduce((a, b) => a + b, 0);

  const viewsSubtext = stats.views > 0
    ? (lang === 'sk' ? `${stats.views} celkovo zo všetkých ponúk` : `${stats.views} total across all listings`)
    : (lang === 'sk' ? 'Zatiaľ žiadne zobrazenia' : 'No views yet');

  const appsSubtext = todayApps > 0
    ? (lang === 'sk' ? `+${todayApps} dnes · ${weekTotal} za 7 dní` : `+${todayApps} today · ${weekTotal} in 7 days`)
    : weekTotal > 0
      ? (lang === 'sk' ? `${weekTotal} za posledných 7 dní` : `${weekTotal} in last 7 days`)
      : (lang === 'sk' ? 'Zatiaľ žiadne prihlášky' : 'No applications yet');

  const processedCount  = stats.apps - (pipeline.Pending || 0);
  const pipelineDisplay = stats.apps === 0 ? '—' : `${processedCount}/${stats.apps}`;
  const processedSubtext = stats.apps === 0
    ? (lang === 'sk' ? 'Žiadne prihlášky' : 'No applications')
    : pipeline.Pending > 0
      ? (lang === 'sk' ? `${pipeline.Pending} čaká na vyjadrenie` : `${pipeline.Pending} pending decision`)
      : (lang === 'sk' ? 'Všetko vybavené ✓' : 'All addressed ✓');

  const activeSubtext = stats.active > 0
    ? (lang === 'sk' ? `${stats.active} ${stats.active === 1 ? 'ponuka' : 'ponuky'} aktívne` : `${stats.active} listing${stats.active === 1 ? '' : 's'} active`)
    : (lang === 'sk' ? 'Žiadne aktívne ponuky' : 'No active listings');

  return (
    <div style={{ animation: 'tabSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}>
      <div className="flex-responsive" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: '800', letterSpacing: '-0.5px' }}>{t('dashTitle')}</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {lang === 'sk' ? 'Správa pre spoločnosť' : 'Management for'}{' '}
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{companyProfile?.name || 'Firma'}</span>
          </p>
        </div>
        <button onClick={fetchAnalytics}
          style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          {lang === 'sk' ? 'Obnoviť' : 'Refresh'}
        </button>
      </div>

      <div className="dashboard-grid">
        <StatCard label={t('statViews')}  value={stats.views}       unit="" changeText={viewsSubtext}     changeType={stats.views > 0 ? 'up' : 'neutral'} />
        <StatCard label={t('statApps')}   value={stats.apps}        unit="" changeText={appsSubtext}      changeType={todayApps > 0 ? 'up' : 'neutral'} />
        <StatCard
          label={lang === 'sk' ? 'Stav náborového procesu' : 'Recruitment Process State'}
          value={pipelineDisplay}
          unit=""
          changeText={processedSubtext}
          changeType={pipeline.Pending === 0 && stats.apps > 0 ? 'up' : 'neutral'}
        />
        <StatCard label={t('statActive')} value={stats.active}      unit="" changeText={activeSubtext}    changeType={stats.active > 0 ? 'up' : 'neutral'} />
      </div>

      <div className="dashboard-main-grid">
        {/* Recruitment Funnel */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '24px', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.2px' }}>
              {lang === 'sk' ? 'Distribúcia náborového procesu' : 'Recruitment Distribution'}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {lang === 'sk' ? 'Vypočítané z celkového počtu' : 'Calculated from total of'}{' '}
              <span style={{ color: 'var(--text)', fontWeight: 700 }}>{stats.apps}</span>{' '}
              {lang === 'sk' ? 'prihlášok' : 'applications'}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            {['Pending', 'Viewed', 'Interview', 'Hired', 'Rejected'].map(status => {
              const count = pipeline[status] || 0;
              const total = stats.apps || 1;
              const percent = Math.round((count / total) * 100);
              const colors = {
                Pending:  ['#94a3b8', 'rgba(148,163,184,0.08)'],
                Viewed:   ['#3b82f6', 'rgba(59,130,246,0.08)'],
                Interview:['#6366f1', 'rgba(99,102,241,0.08)'],
                Hired:    ['#22c55e', 'rgba(34,197,94,0.08)'],
                Rejected: ['#ef4444', 'rgba(239,68,68,0.08)'],
              };
              const labelMap = { Pending:'Čakajúci', Viewed:'Zobrazení', Interview:'Pohovor', Hired:'Prijatí', Rejected:'Odmietnutí' };

              return (
                <div key={status} style={{ padding:'10px 14px', background:'rgba(255,255,255,0.015)', borderRadius:'6px', border:'1px solid var(--border)', display:'flex', alignItems:'center', gap:'14px', position:'relative', overflow:'hidden' }}>
                  <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${percent}%`, background:colors[status][1], transition:'width 1s cubic-bezier(0.4,0,0.2,1)', zIndex:0, borderRight:percent>0?`2px solid ${colors[status][0]}`:'none' }} />
                  <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:colors[status][0], zIndex:1 }} />
                  <div style={{ flex:1, zIndex:1, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:'13px', fontWeight:'700', color:'var(--text)' }}>{lang==='sk' ? labelMap[status] : status}</span>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      <span style={{ fontSize:'13px', fontWeight:'900', color:'var(--text)' }}>{count}</span>
                      <span style={{ fontSize:'11px', fontWeight:'600', color:'var(--text-muted)', background:'rgba(255,255,255,0.05)', padding:'2px 6px', borderRadius:'4px' }}>{percent}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Trend Chart */}
        <Chart data={chartData} title={t('chartTitle')} />
      </div>
    </div>
  );
};

export default Dashboard;
