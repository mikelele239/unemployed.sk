import { useState, useEffect, useRef } from 'react';
import { Settings, LogOut, CheckCircle, Shield } from 'lucide-react';
import { supabase, getAccessToken } from '../supabase';
import { useTranslation } from '../I18nContext';

export default function Profile() {
  const { lang, setLang, theme, setTheme, t } = useTranslation();
  const [profile, setProfile] = useState({ name: '', edu: '', loc: '', bio: '', skills: [] });
  const [isEditing, setIsEditing] = useState(false);
  const [cvs, setCvs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingSkill, setAddingSkill] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const skillInputRef = useRef(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (data) {
          setProfile({
            ...data,
            name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
            edu: data.education || '',
            loc: data.location || '',
            bio: '',
            skills: data.skills || [],
            avatar_url: data.avatar_url || '',
          });
        }
      } catch (err) {
        console.error('Profile fetch error:', err);
      }
    };
    fetchProfile();
  }, []);

  // Load CVs on mount
  useEffect(() => {
    const loadCvs = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const uid = session.user.id;
        const { data: files } = await supabase.storage
          .from('cvs')
          .list(uid, { limit: 20, sortBy: { column: 'created_at', order: 'desc' } });
        setCvs((files || []).map(f => ({
          id: `${uid}/${f.name}`,
          path: `${uid}/${f.name}`,
          original_filename: f.name,
          created_at: f.created_at,
        })));
      } catch (err) { console.error('Load CVs error:', err); }
    };
    loadCvs();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const nameParts = (profile.name || '').trim().split(' ');
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: session.user.id,
          first_name: nameParts[0] || '',
          last_name: nameParts.slice(1).join(' ') || '',
          education: profile.edu,
          location: profile.loc,
          skills: profile.skills,
        }, { onConflict: 'user_id' });
      if (!error) setIsEditing(false);
      else console.error('Profile save error:', error);
    } catch (err) { console.error('Save error:', err); }
    finally { setSaving(false); }
  };

  const handleCvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const uid = session.user.id;
      const fileName = `${uid}/${Date.now()}_${file.name}`;

      const { data, error } = await supabase.storage
        .from('cvs')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'application/pdf',
        });

      if (error) {
        console.error('Upload error:', error);
      } else {
        // Update profile with CV path
        await supabase.from('profiles').update({
          cv_id: data.path,
          original_filename: file.name,
        }).eq('user_id', uid);

        setCvs(prev => [{
          id: data.path,
          path: data.path,
          original_filename: file.name,
          created_at: new Date().toISOString(),
        }, ...prev]);
      }
    } catch (err) { console.error('Upload error:', err); }
    finally { setUploading(false); }
  };

  const handleCvPreview = async (cvPath) => {
    try {
      const { data, error } = await supabase.storage
        .from('cvs')
        .createSignedUrl(cvPath, 3600);
      if (!error && data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err) { console.error('CV preview error:', err); }
  };

  const handleAddSkill = () => {
    if (newSkill.trim() && !profile.skills.includes(newSkill.trim())) {
      setProfile(prev => ({ ...prev, skills: [...(prev.skills || []), newSkill.trim()] }));
      setNewSkill('');
      setAddingSkill(false);
    }
  };

  const handleRemoveSkill = (skill) => {
    setProfile(prev => ({ ...prev, skills: (prev.skills || []).filter(s => s !== skill) }));
  };

  // Profile strength: name, location, profile pic, CV, 3+ skills
  const strengthItems = [
    { key: 'name', label: lang === 'sk' ? 'Meno' : 'Name', done: !!profile.name?.trim() },
    { key: 'loc', label: lang === 'sk' ? 'Lokalita' : 'Location', done: !!profile.loc?.trim() },
    { key: 'avatar', label: lang === 'sk' ? 'Profilová fotka' : 'Profile picture', done: !!profile.avatar_url },
    { key: 'cv', label: lang === 'sk' ? 'Životopis' : 'CV', done: cvs.length > 0 },
    { key: 'skills', label: lang === 'sk' ? '3+ zručnosti' : '3+ skills', done: (profile.skills || []).length >= 3 },
  ];
  const completionPercent = Math.round((strengthItems.filter(i => i.done).length / strengthItems.length) * 100);
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const ext = file.name.split('.').pop();
      const path = `${session.user.id}/avatar.${ext}`;
      const { error } = await supabase.storage.from('cvs').upload(path, file, { upsert: true, contentType: file.type });
      if (!error) {
        const { data: urlData } = supabase.storage.from('cvs').getPublicUrl(path);
        const avatarUrl = urlData?.publicUrl ? `${urlData.publicUrl}?t=${Date.now()}` : '';
        await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('user_id', session.user.id);
        setProfile(prev => ({ ...prev, avatar_url: avatarUrl }));
      }
    } catch (err) { console.error('Avatar upload error:', err); }
  };

  return (
    <div style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800 }}>{t('nav.profile')}</h1>
        <button 
          onClick={() => setIsEditing(true)}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 18px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s' }}
          onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          {lang === 'sk' ? 'Upraviť profil' : 'Edit Profile'}
        </button>
      </div>

      <div style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-card)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              profile.name ? profile.name.charAt(0).toUpperCase() : 'U'
            )}
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>{profile.name || (lang === 'en' ? 'User' : 'Užívateľ')}</h2>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              {profile.loc || (lang === 'en' ? 'Location not set' : 'Lokalita nenastavená')} {profile.edu ? `· ${profile.edu}` : ''}
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
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
            {completionPercent === 100 
              ? (lang === 'sk' ? 'Tvoj profil je kompletný! 🎉' : 'Your profile is complete! 🎉')
              : (lang === 'sk' ? 'Doplň chýbajúce položky:' : 'Complete missing items:')}
          </p>
          {completionPercent < 100 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {strengthItems.map(item => (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, background: item.done ? 'var(--green)' : 'var(--bg)', border: item.done ? 'none' : '1.5px solid var(--border)', color: '#fff' }}>
                    {item.done ? '✓' : ''}
                  </span>
                  <span style={{ color: item.done ? 'var(--text-muted)' : 'var(--text)', fontWeight: item.done ? 500 : 700, textDecoration: item.done ? 'line-through' : 'none' }}>{item.label}</span>
                </div>
              ))}
            </div>
          )}
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
            {isEditing && (profile.skills || []).map(skill => (
              <button key={`rm-${skill}`} onClick={() => handleRemoveSkill(skill)} style={{ position: 'relative' }} title={lang === 'en' ? 'Remove' : 'Odstrániť'}>
              </button>
            ))}
            {addingSkill ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  ref={skillInputRef}
                  type="text"
                  value={newSkill}
                  onChange={e => setNewSkill(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddSkill(); if (e.key === 'Escape') { setAddingSkill(false); setNewSkill(''); } }}
                  placeholder={lang === 'en' ? 'Skill name...' : 'Názov skill-u...'}
                  autoFocus
                  style={{ padding: '6px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--accent)', outline: 'none', width: 120 }}
                />
                <button onClick={handleAddSkill} style={{ padding: '6px 12px', borderRadius: 100, fontSize: 12, fontWeight: 700, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}>✓</button>
                <button onClick={() => { setAddingSkill(false); setNewSkill(''); }} style={{ padding: '6px 10px', borderRadius: 100, fontSize: 12, fontWeight: 600, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>✕</button>
              </div>
            ) : (
              <button onClick={() => setAddingSkill(true)} style={{ padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600, background: 'transparent', color: 'var(--text-muted)', border: '1px dashed var(--text-muted)', cursor: 'pointer' }}>{lang === 'en' ? '+ Add' : '+ Pridať'}</button>
            )}
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

        {/* Settings */}
        <div style={{ marginBottom: 24, padding: '0 20px' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
            {lang === 'en' ? 'Settings' : 'Nastavenia'}
          </h3>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
            {/* Language Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{lang === 'en' ? 'Language' : 'Jazyk'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{lang === 'en' ? 'Interface language' : 'Jazyk rozhrania'}</div>
              </div>
              <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <button
                  onClick={() => setLang('sk')}
                  style={{
                    padding: '7px 14px', border: 'none', fontSize: 12, fontWeight: 700,
                    background: lang === 'sk' ? 'var(--accent)' : 'transparent',
                    color: lang === 'sk' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >SK</button>
                <button
                  onClick={() => setLang('en')}
                  style={{
                    padding: '7px 14px', border: 'none', fontSize: 12, fontWeight: 700,
                    background: lang === 'en' ? 'var(--accent)' : 'transparent',
                    color: lang === 'en' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >EN</button>
              </div>
            </div>

            {/* Theme Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{lang === 'en' ? 'Appearance' : 'Vzhľad'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{lang === 'en' ? 'Dark or light mode' : 'Tmavý alebo svetlý režim'}</div>
              </div>
              <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <button
                  onClick={() => setTheme('dark')}
                  style={{
                    padding: '7px 12px', border: 'none', fontSize: 13, fontWeight: 600,
                    background: theme === 'dark' ? 'var(--accent)' : 'transparent',
                    color: theme === 'dark' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 4
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                  {lang === 'en' ? 'Dark' : 'Tmavý'}
                </button>
                <button
                  onClick={() => setTheme('light')}
                  style={{
                    padding: '7px 12px', border: 'none', fontSize: 13, fontWeight: 600,
                    background: theme === 'light' ? 'var(--accent)' : 'transparent',
                    color: theme === 'light' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 4
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                  {lang === 'en' ? 'Light' : 'Svetlý'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, paddingBottom: 24 }}>
          <button 
            onClick={async () => {
              await supabase.auth.signOut();
              localStorage.removeItem('unemployed_apps');
              localStorage.removeItem('unemployed_profile');
              window.location.href = '/app';
            }}
            style={{ width: '100%', padding: '14px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            <LogOut size={16} /> {lang === 'en' ? 'Log out' : 'Odhlásiť sa'}
          </button>
        </div>
      </div>
      {/* Edit Profile Modal */}
      {isEditing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setIsEditing(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, maxHeight: '85vh', background: 'var(--bg-card)', borderRadius: 24, border: '1px solid var(--border)', padding: 28, overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800 }}>{lang === 'sk' ? 'Upraviť profil' : 'Edit Profile'}</h2>
              <button onClick={() => setIsEditing(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>

            {/* Avatar Upload */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ width: 90, height: 90, borderRadius: '50%', background: 'var(--bg)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, overflow: 'hidden', position: 'relative', cursor: 'pointer', marginBottom: 8 }}>
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  profile.name ? profile.name.charAt(0).toUpperCase() : 'U'
                )}
                <label style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', opacity: 0, cursor: 'pointer', transition: 'opacity 0.2s', color: '#fff', fontSize: 12, fontWeight: 700 }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                  <input type="file" accept="image/*" hidden onChange={handleAvatarUpload} />
                  📷
                </label>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lang === 'sk' ? 'Klikni pre zmenu fotky' : 'Click to change photo'}</span>
            </div>

            {/* Name */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>{lang === 'sk' ? 'Meno a priezvisko' : 'Full Name'}</label>
              <input value={profile.name || ''} onChange={e => setProfile({...profile, name: e.target.value})}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {/* Location */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>{lang === 'sk' ? 'Lokalita' : 'Location'}</label>
              <input value={profile.loc || ''} onChange={e => setProfile({...profile, loc: e.target.value})} placeholder={lang === 'sk' ? 'napr. Bratislava' : 'e.g. Bratislava'}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {/* Education */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>{lang === 'sk' ? 'Vzdelanie' : 'Education'}</label>
              <input value={profile.edu || ''} onChange={e => setProfile({...profile, edu: e.target.value})} placeholder={lang === 'sk' ? 'napr. STU Bratislava' : 'e.g. STU Bratislava'}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {/* CV Upload */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>{lang === 'sk' ? 'Životopis' : 'CV'}</label>
              {cvs.length > 0 && (
                <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'var(--green)' }}>✓</span> {cvs[0].original_filename}
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 10, border: '2px dashed var(--border)', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: uploading ? 'default' : 'pointer', transition: 'all 0.2s' }}
                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                <input type="file" onChange={handleCvUpload} hidden disabled={uploading} accept=".pdf,.doc,.docx" />
                {uploading ? '...' : (lang === 'sk' ? '📎 Nahrať nový životopis' : '📎 Upload new CV')}
              </label>
            </div>

            {/* Skills */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>{lang === 'sk' ? 'Zručnosti' : 'Skills'}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {(profile.skills || []).map(skill => (
                  <span key={skill} style={{ padding: '5px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600, background: 'var(--accent-lighter)', color: 'var(--accent)', border: '1px solid var(--accent-light)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {skill}
                    <span onClick={() => handleRemoveSkill(skill)} style={{ cursor: 'pointer', fontSize: 14, lineHeight: 1, opacity: 0.7 }}>×</span>
                  </span>
                ))}
              </div>
              {addingSkill ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input ref={skillInputRef} type="text" value={newSkill} onChange={e => setNewSkill(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddSkill(); if (e.key === 'Escape') { setAddingSkill(false); setNewSkill(''); } }}
                    placeholder={lang === 'sk' ? 'Názov...' : 'Skill name...'} autoFocus
                    style={{ flex: 1, padding: '6px 12px', borderRadius: 100, fontSize: 12, border: '1px solid var(--accent)', background: 'var(--bg)', color: 'var(--text)', outline: 'none' }} />
                  <button onClick={handleAddSkill} style={{ padding: '6px 12px', borderRadius: 100, fontSize: 12, fontWeight: 700, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}>✓</button>
                </div>
              ) : (
                <button onClick={() => setAddingSkill(true)} style={{ padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600, background: 'transparent', color: 'var(--text-muted)', border: '1px dashed var(--text-muted)', cursor: 'pointer' }}>+ {lang === 'sk' ? 'Pridať' : 'Add'}</button>
              )}
            </div>

            {/* Save button */}
            <button onClick={handleSave} disabled={saving}
              style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', transition: 'opacity 0.2s' }}
              onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
              onMouseOut={e => e.currentTarget.style.opacity = '1'}>
              {saving ? '...' : (lang === 'sk' ? 'Uložiť zmeny' : 'Save Changes')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
