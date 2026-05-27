import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n, useAppState } from '../contexts';
import StatCard from '../components/StatCard';
import Chart from '../components/Chart';
import { supabase } from '../supabase';

const Dashboard = () => {
  const { t, lang } = useI18n();
  const { companyProfile, analytics, refreshAnalytics, listings } = useAppState();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoadingTasks(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const jobIds = (listings || []).map(j => j.id);
        if (jobIds.length === 0) {
          setTasks([]);
          setLoadingTasks(false);
          return;
        }

        const { data: apps, error: appsErr } = await supabase
          .from('applications')
          .select('*')
          .in('job_id', jobIds)
          .order('created_at', { ascending: false });

        if (appsErr || !apps || apps.length === 0) {
          const coldJobs = (listings || []).map(j => ({
            type: 'cold_job',
            id: `cold_${j.id}`,
            jobId: j.id,
            title: lang === 'sk' ? `Zvýšiť dosah ponuky` : `Boost job listing`,
            desc: lang === 'sk' 
              ? `Pozícia "${j.title}" nemá zatiaľ žiadnych záujemcov. Skontrolujte kľúčové slová alebo upravte popis.`
              : `Listing "${j.title}" has no applicants yet. Review description or adjust details.`,
            actionLabel: lang === 'sk' ? 'Upraviť' : 'Edit Listing',
            targetPath: '/listings'
          }));
          setTasks(coldJobs);
          setLoadingTasks(false);
          return;
        }

        const candidateIds = [...new Set(apps.map(a => a.candidate_id))];

        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, location')
          .in('user_id', candidateIds);

        const profilesMap = {};
        (profilesData || []).forEach(p => {
          profilesMap[p.user_id] = p;
        });

        let scoresMap = {};
        try {
          const msRes = await fetch('/api/employer/match-scores-bulk', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ candidate_ids: candidateIds, job_ids: jobIds })
          });
          if (msRes.ok) {
            const msData = await msRes.json();
            scoresMap = msData.scores || {};
          }
        } catch (e) {
          console.warn('Failed to fetch match scores in dashboard:', e.message);
        }

        const list = [];

        // 1. Screen new high-match candidates (match score >= 80%)
        apps.forEach(app => {
          const status = app.status || 'Pending';
          if (status === 'Pending' || status === 'Viewed') {
            const scoreKey = `${app.candidate_id}_${app.job_id}`;
            const scoreData = scoresMap[scoreKey];
            const score = scoreData ? Math.round(scoreData.overall_score * 100) : null;
            if (score && score >= 80) {
              const profile = profilesMap[app.candidate_id] || {};
              const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || (lang === 'sk' ? 'Uchádzač' : 'Candidate');
              const job = (listings || []).find(j => j.id === app.job_id) || {};
              list.push({
                type: 'screen_candidate',
                id: `screen_${app.id}`,
                appId: app.id,
                jobId: app.job_id,
                title: lang === 'sk' ? `Nový uchádzač s vysokou zhodou (${score}%)` : `New high-match candidate (${score}%)`,
                desc: lang === 'sk' 
                  ? `${name} sa prihlásil/a na pozíciu ${job.title || 'vašu ponuku'}.`
                  : `${name} applied for ${job.title || 'your listing'}.`,
                actionLabel: lang === 'sk' ? 'Prezrieť uchádzača' : 'Screen Candidate',
                targetPath: '/candidates',
                targetState: { activeJobId: app.job_id }
              });
            }
          }
        });

        // 2. Action needed for Interview confirmation/counter-offer
        apps.forEach(app => {
          const status = app.status || 'Pending';
          if (status === 'Interview' && app.selected_date) {
            const profile = profilesMap[app.candidate_id] || {};
            const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || (lang === 'sk' ? 'Uchádzač' : 'Candidate');
            const job = (listings || []).find(j => j.id === app.job_id) || {};
            list.push({
              type: 'interview_confirmed',
              id: `interview_conf_${app.id}`,
              appId: app.id,
              jobId: app.job_id,
              title: lang === 'sk' ? 'Pohovor bol potvrdený kandidátom' : 'Interview confirmed by candidate',
              desc: lang === 'sk'
                ? `${name} potvrdil termín pohovoru pre pozíciu ${job.title || ''}: ${new Date(app.selected_date).toLocaleString('sk-SK')}`
                : `${name} confirmed interview for ${job.title || ''}: ${new Date(app.selected_date).toLocaleString()}`,
              actionLabel: lang === 'sk' ? 'Ísť do chatu' : 'Go to Chat',
              targetPath: '/messages',
              targetState: { activeAppId: app.id }
            });
          } else if (status === 'Counter-Offer') {
            const profile = profilesMap[app.candidate_id] || {};
            const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || (lang === 'sk' ? 'Uchádzač' : 'Candidate');
            const job = (listings || []).find(j => j.id === app.job_id) || {};
            list.push({
              type: 'interview_counter',
              id: `interview_count_${app.id}`,
              appId: app.id,
              jobId: app.job_id,
              title: lang === 'sk' ? 'Nový protinávrh termínu pohovoru' : 'New interview counter-offer',
              desc: lang === 'sk'
                ? `${name} navrhol iný termín pre pozíciu ${job.title || ''}: ${new Date(app.selected_date).toLocaleString('sk-SK')}`
                : `${name} suggested another date for ${job.title || ''}: ${new Date(app.selected_date).toLocaleString()}`,
              actionLabel: lang === 'sk' ? 'Odpovedať' : 'Respond',
              targetPath: '/messages',
              targetState: { activeAppId: app.id }
            });
          }
        });

        // 3. Cold jobs (no applications)
        const activeJobIds = [...new Set(apps.map(a => a.job_id))];
        const coldJobs = (listings || []).filter(j => !activeJobIds.includes(j.id));
        coldJobs.forEach(j => {
          list.push({
            type: 'cold_job',
            id: `cold_${j.id}`,
            jobId: j.id,
            title: lang === 'sk' ? `Zvýšiť dosah ponuky` : `Boost job listing`,
            desc: lang === 'sk'
              ? `Pozícia "${j.title}" nemá zatiaľ žiadnych záujemcov. Skontrolujte kľúčové slová alebo upravte popis.`
              : `Listing "${j.title}" has no applicants yet. Review description or adjust details.`,
            actionLabel: lang === 'sk' ? 'Upraviť' : 'Edit Listing',
            targetPath: '/listings'
          });
        });

        setTasks(list.slice(0, 5));
      } catch (err) {
        console.error('Error compiling tasks:', err);
      } finally {
        setLoadingTasks(false);
      }
    };

    if (listings && listings.length > 0) {
      fetchTasks();
    }
  }, [listings, lang]);

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
      </div>

      {/* Recruitment Task Center */}
      {tasks.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, var(--bg-card), rgba(99,102,241,0.02))',
          border: '1.5px solid var(--border)',
          borderRadius: 'var(--radius, 16px)',
          padding: '24px',
          marginBottom: '32px',
          boxShadow: 'var(--shadow)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🎯</span> {lang === 'sk' ? 'Centrum náborových úloh' : 'Recruitment Task Center'}
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                {lang === 'sk' 
                  ? `Máte ${tasks.length} ${tasks.length === 1 ? 'úlohu' : (tasks.length >= 2 && tasks.length <= 4) ? 'úlohy' : 'úloh'} vyžadujúce vašu pozornosť.`
                  : `You have ${tasks.length} task${tasks.length === 1 ? '' : 's'} requiring attention.`}
              </p>
            </div>
            <span style={{ 
              fontSize: '11px', 
              fontWeight: 800, 
              background: 'var(--accent-light)', 
              color: 'var(--accent)', 
              padding: '4px 10px', 
              borderRadius: '20px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {lang === 'sk' ? 'Aktívne' : 'Active'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {tasks.map(task => (
              <div 
                key={task.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.015)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  transition: 'all 0.2s',
                  cursor: 'pointer'
                }}
                onClick={() => navigate(task.targetPath, { state: task.targetState })}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.background = 'rgba(255,92,0,0.02)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: task.type === 'screen_candidate' 
                      ? 'rgba(34,197,94,0.1)' 
                      : task.type === 'cold_job' 
                        ? 'rgba(239,68,68,0.1)' 
                        : 'rgba(99,102,241,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    flexShrink: 0
                  }}>
                    {task.type === 'screen_candidate' ? '👤' : task.type === 'cold_job' ? '🔥' : '📅'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)' }}>
                      {task.title}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {task.desc}
                    </div>
                  </div>
                </div>
                
                <button
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--accent)',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    marginLeft: '16px',
                    flexShrink: 0,
                    transition: 'opacity 0.2s'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(task.targetPath, { state: task.targetState });
                  }}
                >
                  {task.actionLabel}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="dashboard-grid">
        <StatCard label={t('statApps')} value={stats.apps} unit="" changeText={appsSubtext} changeType="neutral" />
        <StatCard 
          label={lang === 'sk' ? 'Pohovory' : 'Interviews'} 
          value={interviewsActive} 
          unit="" 
          changeText={interviewsSubtext} 
          changeType="neutral" 
        />
        <StatCard 
          label={lang === 'sk' ? 'Konverzia' : 'Conversion'} 
          value={`${conversionRate}%`} 
          unit="" 
          changeText={conversionSubtext} 
          changeType="neutral" 
        />
        <StatCard 
          label={lang === 'sk' ? 'Spracované' : 'Processed'} 
          value={`${processedCount}/${stats.apps}`} 
          unit="" 
          changeText={processedSubtext} 
          changeType="neutral" 
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
