import { useState } from 'react';
import { useApplications } from '../hooks/useApplications';
import JobDetail from '../components/JobDetail';
import { useTranslation } from '../I18nContext';

export default function Applications() {
  const { t } = useTranslation();
  const { applications } = useApplications();
  const [selectedJob, setSelectedJob] = useState(null);

  const getStatusColor = (status) => {
    switch(status) {
      case 'Pending': return 'var(--text-muted)';
      case 'Viewed': return 'var(--blue)';
      case 'Interview': return 'var(--accent)';
      case 'Hired': return 'var(--green)';
      default: return 'var(--text-muted)';
    }
  };

  return (
    <div style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 20px 10px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800 }}>{t('apps.title') || 'Prihlášky'}</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('apps.subtitle') || 'Sleduj stav svojich žiadostí.'}</p>
      </div>

      <div style={{ padding: '20px', flex: 1 }}>
        {applications.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 60 }}>
            <span style={{ fontSize: 40, marginBottom: 12, display: 'block' }}>📄</span>
            <p>{t('apps.empty') || 'Zatiaľ si sa nikam neprihlásil/a.'}</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>{t('apps.emptyDesc') || 'Potiahni doprava na karte práce, o ktorú máš záujem.'}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {applications.map(app => (
              <div 
                key={app.id} 
                onClick={() => setSelectedJob(app)}
                style={{ 
                  background: 'var(--bg-card)', 
                  border: '1px solid var(--border)', 
                  borderRadius: 16, 
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  cursor: 'pointer'
                }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: app.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
                  {app.logo}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.title}</h3>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{app.company}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: getStatusColor(app.status), display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: getStatusColor(app.status) }} />
                    {app.status === 'Pending' ? (t('apps.pending') || 'Čaká sa') : (t(`apps.${app.status.toLowerCase()}`) || app.status)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {new Date(app.timestamp).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <JobDetail 
        job={selectedJob} 
        isOpen={!!selectedJob} 
        onClose={() => setSelectedJob(null)}
        onApply={() => {}} // Disabled inside detail anyway since hasApplied is true
        hasApplied={true}
      />
    </div>
  );
}
