import { useState, useEffect } from 'react';
import { Settings, LogOut, CheckCircle, Shield } from 'lucide-react';
import { useTranslation } from '../I18nContext';

export default function Profile() {
  const { lang } = useTranslation();
  const [profile, setProfile] = useState({ name: '', edu: '', loc: '', avail: [], jobType: [], skills: [] });

  useEffect(() => {
    const p = JSON.parse(localStorage.getItem('unemployed_profile')) || {};
    setProfile(p);
  }, []);

  const completionPercent = profile.name && profile.skills?.length > 0 ? 85 : 40;

  return (
    <div style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800 }}>{lang === 'en' ? 'My Profile' : 'Môj Profil'}</h1>
        <button style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer' }}>
          <Settings size={22} />
        </button>
      </div>

      <div style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-card)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, flexShrink: 0 }}>
            {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: '50%', background: 'var(--green)', border: '2px solid var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <CheckCircle size={12} />
            </div>
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>{profile.name || (lang === 'en' ? 'User' : 'Užívateľ')}</h2>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>{profile.loc || (lang === 'en' ? 'Location not set' : 'Lokalita nenastavená')} · {profile.edu}</div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{lang === 'en' ? 'Profile Strength' : 'Sila profilu'}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{completionPercent}%</span>
          </div>
          <div style={{ height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ width: `${completionPercent}%`, height: '100%', background: 'var(--accent)' }} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lang === 'en' ? 'Add work experience for a 100% match with offers.' : 'Pridaj si pracovné skúsenosti pre 100% zhodu s ponukami.'}</p>
        </div>

        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            {lang === 'en' ? 'Your strengths' : 'Tvoje silné stránky'}
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(profile.skills || []).map(skill => (
              <span key={skill} style={{ padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600, background: 'var(--accent-lighter)', color: 'var(--accent)', border: '1px solid var(--accent-light)' }}>
                {skill}
              </span>
            ))}
            <button style={{ padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600, background: 'transparent', color: 'var(--text-muted)', border: '1px dashed var(--text-muted)', cursor: 'pointer' }}>{lang === 'en' ? '+ Add' : '+ Pridať'}</button>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            {lang === 'en' ? 'Your badges' : 'Tvoje odznaky'}
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
            {/* Verified Student Badge */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--green)', borderRadius: '12px', padding: '12px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '-10px', right: '-10px', width: '40px', height: '40px', background: 'var(--green)', opacity: 0.1, borderRadius: '50%' }} />
              <Shield size={20} color="var(--green)" style={{ marginBottom: '8px' }} />
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)', marginBottom: '2px' }}>{lang === 'en' ? 'Verified student' : 'Overený študent'}</div>
              <div style={{ fontSize: '10px', color: 'var(--green)' }}>{lang === 'en' ? 'ISIC verified' : 'ISIC overený'}</div>
            </div>

            {/* Top Match Badge */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--accent)', borderRadius: '12px', padding: '12px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '-10px', right: '-10px', width: '40px', height: '40px', background: 'var(--accent)', opacity: 0.1, borderRadius: '50%' }} />
              <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--accent)" stroke="none" style={{ marginBottom: '8px' }}>
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)', marginBottom: '2px' }}>{lang === 'en' ? 'Top 10% Match' : 'Top 10% Zhoda'}</div>
              <div style={{ fontSize: '10px', color: 'var(--accent)' }}>{lang === 'en' ? 'High activity' : 'Vysoká aktivita'}</div>
            </div>

            {/* Responsive Badge */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--blue)', borderRadius: '12px', padding: '12px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '-10px', right: '-10px', width: '40px', height: '40px', background: 'var(--blue)', opacity: 0.1, borderRadius: '50%' }} />
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2.5" style={{ marginBottom: '8px' }}>
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)', marginBottom: '2px' }}>{lang === 'en' ? 'Quick response' : 'Rýchla odozva'}</div>
              <div style={{ fontSize: '10px', color: 'var(--blue)' }}>{lang === 'en' ? 'Within 2 hours' : 'Do 2 hodín'}</div>
            </div>
            
            {/* Locked Badge */}
            <div style={{ background: 'var(--bg)', border: '1px dashed var(--border)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}>
              <div style={{ fontSize: '20px', marginBottom: '4px' }}>🔒</div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)' }}>{lang === 'en' ? 'Next level' : 'Ďalší level'}</div>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, paddingBottom: 24 }}>
          <button style={{ width: '100%', padding: '14px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <LogOut size={16} /> {lang === 'en' ? 'Log out' : 'Odhlásiť sa'}
          </button>
        </div>
      </div>
    </div>
  );
}
