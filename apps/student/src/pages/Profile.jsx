import { useState, useEffect, useRef } from 'react';
import { Settings, LogOut, CheckCircle, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, getAccessToken, getAccessTokenAsync } from '../supabase';
import { useTranslation } from '../I18nContext';

// Helper: parse bilingual JSON strings {sk,en} — returns the right language
function biLang(val, lang) {
  if (!val) return '';
  if (typeof val === 'object' && (val.sk || val.en)) return val[lang] || val.en || val.sk || '';
  if (typeof val !== 'string') return String(val);
  try {
    const parsed = JSON.parse(val);
    if (parsed && typeof parsed === 'object' && (parsed.sk || parsed.en)) return parsed[lang] || parsed.en || parsed.sk || '';
    return val;
  } catch { return val; }
}
function biLangArr(arr, lang) {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => biLang(item, lang)).filter(Boolean);
}

export default function Profile() {
  const { lang, setLang, theme, setTheme, t } = useTranslation();
  const [profile, setProfile] = useState({ name: '', edu: '', loc: '', bio: '', skills: [], email: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [cvs, setCvs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingSkill, setAddingSkill] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const skillInputRef = useRef(null);
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [aiProfile, setAiProfile] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const uid = session.user.id;
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', uid)
          .maybeSingle();
        if (data) {
          setProfile({
            ...data,
            name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
            edu: data.education || '',
            loc: data.location || '',
            bio: data.bio || '',
            skills: data.skills || [],
            avatar_url: data.avatar_url || '',
            email: session.user.email || data.email || '',
          });
        }

        // Resolve avatar from storage with a fresh signed URL
        try {
          const { data: files } = await supabase.storage.from('cvs').list(uid, { limit: 20 });
          const avatarFile = (files || []).find(f => f.name.toLowerCase().startsWith('avatar.'));
          if (avatarFile) {
            const { data: signedData } = await supabase.storage.from('cvs').createSignedUrl(`${uid}/${avatarFile.name}`, 3600);
            if (signedData?.signedUrl) {
              setResolvedAvatarUrl(signedData.signedUrl);
              setAvatarFailed(false);
            }
          }
        } catch (avatarErr) {
          console.error('Avatar resolve error:', avatarErr);
        }
      } catch (err) {
        console.error('Profile fetch error:', err);
      }
    };
    fetchProfile();
  }, []);

  // Load AI profile
  useEffect(() => {
    const loadAiProfile = async () => {
      try {
        const token = await getAccessTokenAsync() || getAccessToken();
        if (!token) return;
        const res = await fetch('/api/ai-profile', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            setAiProfile(data.profile);
            // Sync AI-extracted location to profile display if profiles.location is stale/different
            if (data.profile.location) {
              setProfile(prev => ({
                ...prev,
                loc: data.profile.location,
              }));
            }
          }
        }
      } catch (e) { console.warn('AI profile fetch:', e.message); }
    };
    loadAiProfile();
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
        // Filter out avatar/logo files — only keep actual CVs
        const cvFiles = (files || []).filter(f => {
          const name = f.name.toLowerCase();
          return !name.startsWith('avatar.') && !name.startsWith('logo.');
        });
        setCvs(cvFiles.map(f => ({
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
      const token = session.access_token;

      // Save via server API (bypasses RLS)
      const res = await fetch('/api/student/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          first_name: nameParts[0] || '',
          last_name: nameParts.slice(1).join(' ') || '',
          education: profile.edu || '',
          location: profile.loc || '',
          bio: profile.bio || '',
          skills: profile.skills || [],
          avatar_url: profile.avatar_url || '',
        }),
      });

      if (res.ok) {
        // Also sync location to ai_profiles so it persists across CV re-parses
        try {
          await fetch('/api/ai-profile', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ location: profile.loc || '' }),
          });
        } catch (e) { console.warn('AI profile location sync:', e.message); }
        setIsEditing(false);
      } else {
        const err = await res.json().catch(() => ({}));
        console.error('Profile save error:', err);
      }
    } catch (err) { console.error('Save error:', err); }
    finally { setSaving(false); }
  };

  const handleCvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().match(/\.(pdf|doc|docx)$/)) {
      alert(lang === 'en' ? 'Only PDF and DOC/DOCX files are accepted' : 'Akceptujeme len PDF a DOC/DOCX súbory');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert(lang === 'en' ? 'File too large (max 10 MB)' : 'Súbor je príliš veľký (max 10 MB)');
      return;
    }

    try {
      setUploading(true);
      const token = await getAccessTokenAsync() || getAccessToken();
      if (!token) {
        alert(lang === 'en' ? 'Authentication error — please log in again.' : 'Chyba overenia — prihláste sa znova.');
        return;
      }

      // Upload via server endpoint — file storage is instant, AI parsing runs in background
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/cvs/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('Upload error:', err);
        alert(err.error || 'Upload failed');
        return;
      }

      const result = await res.json();
      console.log('[Profile] CV uploaded. Status:', result.parse_status);

      // Update local CV list
      if (result.cv?.id) {
        setCvs([{
          id: result.cv.id,
          path: result.cv.id,
          original_filename: result.cv.original_filename || file.name,
          created_at: new Date().toISOString(),
        }]);
      }

      // If AI profile was returned immediately, use it
      if (result.ai_profile) {
        setAiProfile(result.ai_profile);
      }

      // AI parsing runs in the background — poll for the updated AI profile
      // with multiple retries at increasing intervals
      const pollDelays = [3000, 6000, 12000]; // 3s, 6s, 12s
      for (const delay of pollDelays) {
        await new Promise(resolve => setTimeout(resolve, delay));
        try {
          const freshToken = await getAccessTokenAsync() || getAccessToken();
          const aiRes = await fetch('/api/ai-profile', { headers: { 'Authorization': `Bearer ${freshToken}` } });
          if (aiRes.ok) {
            const aiData = await aiRes.json();
            if (aiData.profile && aiData.profile.parse_status !== 'processing') {
              setAiProfile(aiData.profile);
              console.log('[Profile] AI profile loaded after background processing');
              break;
            }
          }
        } catch (e) { console.warn('AI profile poll:', e.message); }
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

  const getProfileRank = (pct) => {
    if (pct < 40) return lang === 'sk' ? 'Nový Hrdina 🌟' : 'New Hero 🌟';
    if (pct < 80) return lang === 'sk' ? 'Kariérny Cestovateľ 🚀' : 'Career Explorer 🚀';
    if (pct < 100) return lang === 'sk' ? 'Profi Kandidát 🏆' : 'Pro Candidate 🏆';
    return lang === 'sk' ? 'Legenda Trhu 👑' : 'Market Legend 👑';
  };

  const handleSuggestionClick = (key) => {
    if (key === 'cv') {
      document.getElementById('cv-file-input')?.click();
    } else if (key === 'avatar') {
      document.getElementById('avatar-file-input')?.click();
    } else if (key === 'skills') {
      setAddingSkill(true);
      setTimeout(() => {
        skillInputRef.current?.focus();
      }, 100);
    } else {
      setIsEditing(true);
      setTimeout(() => {
        if (key === 'name') {
          document.getElementById('profile-name-input')?.focus();
        } else if (key === 'loc') {
          document.getElementById('profile-loc-input')?.focus();
        }
      }, 150);
    }
  };
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const uid = session.user.id;

      // Remove any existing avatar files first
      const { data: existingFiles } = await supabase.storage.from('cvs').list(uid, { limit: 20 });
      const oldAvatars = (existingFiles || []).filter(f => f.name.toLowerCase().startsWith('avatar.'));
      if (oldAvatars.length > 0) {
        await supabase.storage.from('cvs').remove(oldAvatars.map(f => `${uid}/${f.name}`));
      }

      const ext = file.name.split('.').pop();
      const path = `${uid}/avatar.${ext}`;
      const { error } = await supabase.storage.from('cvs').upload(path, file, { upsert: true, contentType: file.type });
      if (!error) {
        // Always use a signed URL since the 'cvs' bucket is private
        const { data: signedData } = await supabase.storage.from('cvs').createSignedUrl(path, 60 * 60 * 24 * 365);
        const avatarUrl = signedData?.signedUrl || '';

        // Update avatar_url via server proxy to bypass RLS
        await fetch('/api/student/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            first_name: profile.name?.split(' ')[0] || '',
            last_name: profile.name?.split(' ').slice(1).join(' ') || '',
            education: profile.edu || '',
            location: profile.loc || '',
            skills: profile.skills || [],
            avatar_url: avatarUrl,
          }),
        });

        setProfile(prev => ({ ...prev, avatar_url: avatarUrl }));
        setResolvedAvatarUrl(avatarUrl);
        setAvatarFailed(false);
      }
    } catch (err) { console.error('Avatar upload error:', err); }
  };

  return (
    <div style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      <div style={{ padding: '16px 56px 0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400 }}>{t('nav.profile')}</h1>
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
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-card)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, flexShrink: 0, overflow: 'hidden', position: 'relative', cursor: 'pointer' }}>
            {(resolvedAvatarUrl || profile.avatar_url) && !avatarFailed ? (
              <img src={resolvedAvatarUrl || profile.avatar_url} alt="" onError={() => setAvatarFailed(true)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block', borderRadius: '50%' }} />
            ) : (
              profile.name ? profile.name.charAt(0).toUpperCase() : 'U'
            )}
            <label 
              style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', opacity: 0, cursor: 'pointer', transition: 'opacity 0.2s', color: '#fff', fontSize: 20, borderRadius: '50%' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0'}
            >
              <input type="file" id="avatar-file-input" accept="image/*" hidden onChange={handleAvatarUpload} />
              📷
            </label>
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>{profile.name || (lang === 'en' ? 'User' : 'Užívateľ')}</h2>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              {profile.loc || (lang === 'en' ? 'Location not set' : 'Lokalita nenastavená')} {profile.edu ? `· ${profile.edu}` : ''}
            </div>
            {profile.email && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                {profile.email}
              </div>
            )}
          </div>
        </div>

        <div style={{ 
          background: 'linear-gradient(135deg, var(--bg-card), rgba(255,92,0,0.02))', 
          border: '1.5px solid var(--border)', 
          borderRadius: 20, 
          padding: '20px', 
          marginBottom: 24,
          position: 'relative',
          overflow: 'hidden'
        }}>
          {completionPercent === 100 && (
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 10, stiffness: 100 }}
              style={{ position: 'absolute', top: 12, right: 12, fontSize: 24 }}
            >
              🎉
            </motion.div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>
                {lang === 'en' ? 'Profile Level' : 'Úroveň profilu'}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>
                {getProfileRank(completionPercent)}
              </span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--accent)', background: 'var(--accent-lighter)', padding: '4px 10px', borderRadius: 8 }}>
              {completionPercent}%
            </span>
          </div>
          <div style={{ height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
            <motion.div 
              initial={{ width: 0 }} 
              animate={{ width: `${completionPercent}%` }} 
              transition={{ type: 'spring', stiffness: 60, damping: 12 }} 
              style={{ height: '100%', background: 'linear-gradient(90deg, var(--accent) 0%, #a855f7 100%)', borderRadius: 4 }} 
            />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, fontWeight: 600 }}>
            {completionPercent === 100 
              ? (lang === 'sk' ? 'Gratulujeme! Tvoj profil je 100% kompletný a pripravený na hľadanie práce. 🚀' : 'Congratulations! Your profile is 100% complete and job-ready. 🚀')
              : (lang === 'sk' ? 'Zlepši si profil pre lepšie pracovné ponuky:' : 'Boost your profile for better matching jobs:')}
          </p>
          {completionPercent < 100 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {strengthItems.map(item => (
                <motion.div 
                  layout
                  key={item.key} 
                  onClick={() => !item.done && handleSuggestionClick(item.key)}
                  whileHover={!item.done ? { x: 4, background: 'rgba(255,92,0,0.03)' } : {}}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 10, 
                    fontSize: 12,
                    cursor: item.done ? 'default' : 'pointer',
                    padding: '6px 8px',
                    borderRadius: 8,
                    background: item.done ? 'transparent' : 'rgba(0,0,0,0.01)',
                    border: item.done ? '1px solid transparent' : '1px dashed var(--border)',
                    transition: 'all 0.2s'
                  }}
                >
                  <span style={{ 
                    width: 18, 
                    height: 18, 
                    borderRadius: '50%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontSize: 11, 
                    background: item.done ? 'var(--green)' : 'var(--bg)', 
                    border: item.done ? 'none' : '1.5px solid var(--border)', 
                    color: '#fff',
                    flexShrink: 0
                  }}>
                    {item.done ? '✓' : ''}
                  </span>
                  <span style={{ 
                    color: item.done ? 'var(--text-muted)' : 'var(--text)', 
                    fontWeight: item.done ? 500 : 700, 
                    textDecoration: item.done ? 'line-through' : 'none',
                    flex: 1
                  }}>
                    {item.label}
                  </span>
                  {!item.done && (
                    <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', opacity: 0.8 }}>
                      {lang === 'sk' ? 'DOPLNIŤ +' : 'COMPLETE +'}
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* AI Profile Summary Card */}
        {aiProfile && aiProfile.parse_status !== 'failed' && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(255,92,0,0.04))',
            border: '1px solid rgba(99,102,241,0.15)',
            borderRadius: 20, padding: '20px', marginBottom: 24,
            position: 'relative', overflow: 'hidden'
          }}>
            {/* Subtle glow */}
            <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, background: 'rgba(99,102,241,0.08)', borderRadius: '50%', filter: 'blur(40px)' }} />
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, position: 'relative' }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{lang === 'sk' ? 'AI Profil' : 'AI Profile'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {aiProfile.parse_status === 'ready'
                    ? (lang === 'sk' ? 'Extrahované z tvojho CV' : 'Extracted from your CV')
                    : (lang === 'sk' ? 'Vyžaduje kontrolu' : 'Needs review')}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                {aiProfile.ai_profile_approved && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                    ✓ {lang === 'sk' ? 'Schválené' : 'Approved'}
                  </span>
                )}
                {aiProfile.confidence_score && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                    background: aiProfile.confidence_score >= 0.6 ? 'rgba(34,197,94,0.1)' : 'rgba(255,170,0,0.1)',
                    color: aiProfile.confidence_score >= 0.6 ? '#22c55e' : '#ffaa00' }}>
                    {Math.round(aiProfile.confidence_score * 100)}%
                  </span>
                )}
              </div>
            </div>

            {/* AI Headline */}
            {aiProfile.ai_headline && (
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 8, lineHeight: 1.3 }}>
                {biLang(aiProfile.ai_headline, lang)}
              </div>
            )}

            {/* AI Summary */}
            {aiProfile.ai_summary && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5, fontStyle: 'italic' }}>
                {biLang(aiProfile.ai_summary, lang)}
              </div>
            )}

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '10px', textAlign: 'center', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>
                  {(aiProfile.hard_skills?.length || 0) + (aiProfile.soft_skills?.length || 0)}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                  {lang === 'sk' ? 'Zručnosti' : 'Skills'}
                </div>
              </div>
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '10px', textAlign: 'center', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#6366f1', lineHeight: 1 }}>
                  {aiProfile.languages?.length || 0}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                  {lang === 'sk' ? 'Jazyky' : 'Languages'}
                </div>
              </div>
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '10px', textAlign: 'center', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#22c55e', lineHeight: 1 }}>
                  {aiProfile.experience_years || 0}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                  {lang === 'sk' ? 'Roky praxe' : 'Yrs exp'}
                </div>
              </div>
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '10px', textAlign: 'center', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#a855f7', lineHeight: 1 }}>
                  {aiProfile.profile_completion_score || 0}%
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                  {lang === 'sk' ? 'Kompletnosť' : 'Complete'}
                </div>
              </div>
            </div>

            {/* AI Strengths */}
            {biLangArr(aiProfile.ai_strengths, lang).length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                  💪 {lang === 'sk' ? 'Silné stránky' : 'Strengths'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {biLangArr(aiProfile.ai_strengths, lang).map(s => (
                    <span key={s} style={{
                      padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                      background: 'rgba(34,197,94,0.08)', color: '#22c55e',
                      border: '1px solid rgba(34,197,94,0.12)'
                    }}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Hard Skills */}
            {aiProfile.hard_skills?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                  {lang === 'sk' ? 'Technické zručnosti' : 'Technical Skills'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {aiProfile.hard_skills.map(s => (
                    <span key={s} style={{
                      padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                      background: 'rgba(255,92,0,0.08)', color: 'var(--accent)',
                      border: '1px solid rgba(255,92,0,0.12)'
                    }}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested Roles */}
            {aiProfile.ai_suggested_roles?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                  🎯 {lang === 'sk' ? 'Odporúčané pozície' : 'Suggested Roles'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {aiProfile.ai_suggested_roles.map(r => (
                    <span key={r} style={{
                      padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                      background: 'rgba(99,102,241,0.08)', color: '#6366f1',
                      border: '1px solid rgba(99,102,241,0.12)'
                    }}>{r}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Languages */}
            {aiProfile.languages?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                  🌐 {lang === 'sk' ? 'Jazyky' : 'Languages'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {aiProfile.languages.map((l, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                    }}>
                      <span style={{ color: 'var(--text)' }}>{l.lang}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                        background: l.level === 'C2' || l.level === 'C1' ? 'rgba(34,197,94,0.12)' : l.level === 'B2' || l.level === 'B1' ? 'rgba(99,102,241,0.12)' : 'rgba(255,170,0,0.12)',
                        color: l.level === 'C2' || l.level === 'C1' ? '#22c55e' : l.level === 'B2' || l.level === 'B1' ? '#6366f1' : '#ffaa00',
                      }}>{l.level}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Education */}
            {aiProfile.education_level && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 12,
                background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)',
                fontSize: 12, color: 'var(--text)'
              }}>
                <span>🎓</span>
                <span style={{ fontWeight: 700 }}>
                  {{
                    high_school: lang === 'sk' ? 'Stredná škola' : 'High School',
                    bachelors: lang === 'sk' ? 'Bakalár' : 'Bachelor\'s',
                    masters: lang === 'sk' ? 'Magister / Inžinier' : 'Master\'s',
                    phd: 'PhD',
                  }[aiProfile.education_level] || aiProfile.education_level}
                </span>
                {aiProfile.education_field && (
                  <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>· {aiProfile.education_field}</span>
                )}
              </div>
            )}

            {/* Missing Fields */}
            {aiProfile.ai_missing_fields?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#ffaa00', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                  ⚠️ {lang === 'sk' ? 'Chýbajúce údaje' : 'Missing Fields'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {aiProfile.ai_missing_fields.map(f => (
                    <span key={f} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: 'rgba(255,170,0,0.08)', color: '#ffaa00', border: '1px solid rgba(255,170,0,0.12)' }}>{f}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Approve Button */}
            {!aiProfile.ai_profile_approved && aiProfile.ai_headline && (
              <button
                onClick={async () => {
                  try {
                    const token = await getAccessToken();
                    const res = await fetch('/api/ai-profile/approve', {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({}),
                    });
                    if (res.ok) {
                      setAiProfile(prev => ({ ...prev, ai_profile_approved: true }));
                    }
                  } catch (e) { console.warn('Approve error:', e); }
                }}
                style={{
                  width: '100%', padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: '#fff',
                  fontSize: 13, fontWeight: 700, marginTop: 4,
                }}
              >
                ✓ {lang === 'sk' ? 'Schváliť AI profil pre zamestnávateľov' : 'Approve AI profile for employers'}
              </button>
            )}
          </div>
        )}

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
              <button key={`rm-${skill}`} onClick={() => handleRemoveSkill(skill)} style={{ padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', transition: 'all 0.2s' }} title={lang === 'en' ? 'Remove' : 'Odstrániť'}>
                ✕ {skill}
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



        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
            {lang === 'en' ? 'Your CV' : 'Tvoj životopis'}
          </h3>
          {cvs.length > 0 ? (
            <div 
              style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', 
                borderRadius: 14 
              }}
            >
              <div 
                onClick={() => handleCvPreview(cvs[0].id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flex: 1, minWidth: 0 }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,92,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📄</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cvs[0].original_filename}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{new Date(cvs[0].created_at).toLocaleDateString()}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button 
                  onClick={() => handleCvPreview(cvs[0].id)}
                  style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  {lang === 'en' ? 'Preview' : 'Prezrieť'}
                </button>
                <label style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: uploading ? 'default' : 'pointer' }}>
                  <input type="file" id="cv-file-input" onChange={handleCvUpload} hidden disabled={uploading} accept=".pdf,.doc,.docx" />
                  {uploading ? '...' : (lang === 'en' ? 'Change' : 'Zmeniť')}
                </label>
              </div>
            </div>
          ) : (
            <label style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, 
              padding: '14px', borderRadius: 12, border: '2px dashed var(--border)', 
              color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: uploading ? 'default' : 'pointer' 
            }}>
              <input type="file" id="cv-file-input" onChange={handleCvUpload} hidden disabled={uploading} accept=".pdf,.doc,.docx" />
              {uploading ? '...' : (lang === 'en' ? '+ Upload CV' : '+ Nahrať životopis')}
            </label>
          )}
        </div>

        {/* Settings */}
        <div style={{ marginBottom: 24 }}>
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
                {(resolvedAvatarUrl || profile.avatar_url) && !avatarFailed ? (
                  <img src={resolvedAvatarUrl || profile.avatar_url} alt="" onError={() => setAvatarFailed(true)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block', borderRadius: '50%' }} />
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
              <input id="profile-name-input" value={profile.name || ''} onChange={e => setProfile({...profile, name: e.target.value})}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
            </div>
 
            {/* Location */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>{lang === 'sk' ? 'Lokalita' : 'Location'}</label>
              <input id="profile-loc-input" value={profile.loc || ''} onChange={e => setProfile({...profile, loc: e.target.value})} placeholder={lang === 'sk' ? 'napr. Bratislava' : 'e.g. Bratislava'}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {/* Education */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>{lang === 'sk' ? 'Vzdelanie' : 'Education'}</label>
              <input value={profile.edu || ''} onChange={e => setProfile({...profile, edu: e.target.value})} placeholder={lang === 'sk' ? 'napr. STU Bratislava' : 'e.g. STU Bratislava'}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {/* Bio / About */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>{lang === 'sk' ? 'O mne' : 'About Me'}</label>
              <textarea value={profile.bio || ''} onChange={e => setProfile({...profile, bio: e.target.value})} placeholder={lang === 'sk' ? 'Napíš niečo o sebe...' : 'Tell us about yourself...'}
                rows={3}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, fontWeight: 500, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
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
