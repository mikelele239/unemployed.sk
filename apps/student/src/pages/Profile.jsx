import { useState, useEffect } from 'react';
import { Settings, LogOut, CheckCircle, Shield } from 'lucide-react';
import { getAccessToken } from '../supabase';
import { useTranslation } from '../I18nContext';
import { isDemoMode } from '../demoMode';

export default function Profile() {
  const { lang, t } = useTranslation();
  const [profile, setProfile] = useState({ name: '', edu: '', loc: '', bio: '', skills: [] });
  const [isEditing, setIsEditing] = useState(false);
  const [cvs, setCvs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (isDemoMode()) {
        const local = JSON.parse(localStorage.getItem('unemployed_profile')) || { name: 'Demo Užívateľ', edu: 'VŠ', loc: 'Bratislava', skills: ['React', 'Design'] };
        setProfile(local);
        return;
      }
      try {
        const token = getAccessToken();
        const res = await fetch('/api/profile', {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          setProfile({
            ...data,
            name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
            edu: data.education || '',
            loc: data.location || '',
            bio: data.bio || '',
            skills: data.skills || []
          });
        }
      } catch (err) {
        console.error('Profile fetch error:', err);
      }
    };
    
    const fetchCvs = async () => {
      if (isDemoMode()) return;
      try {
        const token = getAccessToken();
        const res = await fetch('/api/cvs', {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          setCvs(data);
        }
      } catch (err) { console.error('CV fetch error:', err); }
    };

    fetchProfile();
    fetchCvs();
  }, []);

  const handleSave = async () => {
    if (isDemoMode()) {
      localStorage.setItem('unemployed_profile', JSON.stringify(profile));
      setIsEditing(false);
      return;
    }
    try {
      setSaving(true);
      const token = getAccessToken();
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: profile.name,
          education: profile.edu,
          location: profile.loc,
          bio: profile.bio,
          skills: profile.skills
        })
      });
      if (res.ok) setIsEditing(false);
    } catch (err) { console.error('Save error:', err); }
    finally { setSaving(false); }
  };

  const handleCvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const token = getAccessToken();
      const formData = new FormData();
      formData.append('cv', file);

      const res = await fetch('/api/cvs/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setCvs(prev => [data.cv, ...prev]);
      }
    } catch (err) { console.error('Upload error:', err); }
    finally { setUploading(false); }
  };

  const handleCvPreview = async (cvId) => {
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/cvs/download/${cvId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        window.open(data.url, '_blank');
      }
    } catch (err) { console.error('CV preview error:', err); }
  };

  const completionPercent = profile.name && profile.skills?.length > 0 ? 85 : 40;

  return (
    <div style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800 }}>{t('nav.profile')}</h1>
        <button 
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          disabled={saving}
          style={{ background: 'var(--accent)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          {saving ? '...' : (isEditing ? t('profile.save') : (lang === 'en' ? 'Edit' : 'Upraviť'))}
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
            {isEditing ? (
              <input 
                value={profile.name} 
                onChange={e => setProfile({...profile, name: e.target.value})}
                style={{ fontSize: 18, fontWeight: 800, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 8px', color: 'var(--text)', width: '100%' }}
              />
            ) : (
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>{profile.name || (lang === 'en' ? 'User' : 'Užívateľ')}</h2>
            )}
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              {isEditing ? (
                <input 
                  value={profile.loc} 
                  onChange={e => setProfile({...profile, loc: e.target.value})}
                  placeholder="Lokalita"
                  style={{ fontSize: 13, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 8px', color: 'var(--text)', width: '100%', marginTop: 4 }}
                />
              ) : (
                <>{profile.loc || (lang === 'en' ? 'Location not set' : 'Lokalita nenastavená')} · {profile.edu}</>
              )}
            </div>
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

        <div style={{ marginBottom: 24, padding: '0 20px 24px' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
            {lang === 'en' ? 'Your CVs' : 'Tvoje životopisy'}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cvs.map(cv => (
              <div 
                key={cv.id} 
                onClick={() => handleCvPreview(cv.id)}
                style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                  padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', 
                  borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s ease'
                }}
                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>📄</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{cv.original_filename}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(cv.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                  {lang === 'en' ? 'Preview' : 'Prezrieť'}
                </div>
              </div>
            ))}
            <label style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, 
              padding: '14px', borderRadius: 12, border: '2px dashed var(--border)', 
              color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: uploading ? 'default' : 'pointer' 
            }}>
              <input type="file" onChange={handleCvUpload} hidden disabled={uploading} accept=".pdf,.doc,.docx" />
              {uploading ? '...' : (lang === 'en' ? '+ Upload CV' : '+ Nahrať životopis')}
            </label>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, paddingBottom: 24 }}>
          <button 
            onClick={() => {
              localStorage.clear();
              window.location.href = '/app';
            }}
            style={{ width: '100%', padding: '14px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            <LogOut size={16} /> {lang === 'en' ? 'Log out' : 'Odhlásiť sa'}
          </button>
        </div>
      </div>


    </div>
  );
}
