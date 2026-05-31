import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n, useAppState } from '../contexts';
import { supabase } from '../supabase';

const Profile = () => {
  const { t, lang, setLang } = useI18n();
  const { companyProfile, setCompanyProfile } = useAppState();
  const location = useLocation();

  const [theme, setTheme] = useState(() => {
    return document.documentElement.classList.contains('light') ? 'light' : 'dark';
  });

  const [editing, setEditing] = useState(false);
  const [editingRecently, setEditingRecently] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    website: '',
    location: '',
  });

  useEffect(() => {
    setForm({
      name: companyProfile?.name || '',
      description: companyProfile?.industry || '',
      website: companyProfile?.website || '',
      location: companyProfile?.location || '',
    });
  }, [companyProfile]);

  useEffect(() => {
    if (editing) {
      setEditingRecently(true);
    } else {
      const timer = setTimeout(() => setEditingRecently(false), 600);
      return () => clearTimeout(timer);
    }
  }, [editing]);

  useEffect(() => {
    setEditing(false);
  }, [location.key]);

  useEffect(() => {
    const handleActiveClick = (e) => {
      if (e.detail?.path === '/profile') {
        setEditing(false);
        setForm({
          name: companyProfile?.name || '',
          description: companyProfile?.industry || '',
          website: companyProfile?.website || '',
          location: companyProfile?.location || '',
        });
      }
    };
    window.addEventListener('active-nav-click', handleActiveClick);
    return () => window.removeEventListener('active-nav-click', handleActiveClick);
  }, [companyProfile]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/employer/ensure-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          website: form.website,
          location: form.location,
        }),
      });

      const result = await res.json();

      if (res.ok) {
        setCompanyProfile({
          name: form.name,
          industry: form.description,
          website: form.website,
          location: form.location,
          logo_url: companyProfile?.logo_url || '',
          cover_url: companyProfile?.cover_url || '',
        });
        setEditing(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        alert(result.error || (lang === 'sk' ? 'Nepodarilo sa uložiť zmeny.' : 'Failed to save changes.'));
      }

    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const sectionStyle = {
    background: 'var(--bg-card)', borderRadius: 'var(--radius)',
    border: '1px solid var(--border)', boxShadow: 'var(--shadow)',
  };
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' };
  const inputStyle = {
    width: '100%', padding: '12px 16px', borderRadius: '12px',
    border: '1px solid var(--border)', background: 'var(--overlay-light)',
    color: 'var(--text)', fontSize: '14px', outline: 'none', transition: 'border 0.2s',
  };
  const readOnlyStyle = { ...inputStyle, background: 'transparent', border: '1px solid transparent', cursor: 'default', padding: '8px 0', wordWrap: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap' };

  return (
    <div style={{ animation: 'tabSlideIn 0.4s ease', paddingTop: '12px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '400', letterSpacing: '-0.5px' }}>
          {lang === 'sk' ? 'Profil & Nastavenia' : 'Profile & Settings'}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
          {lang === 'sk' ? 'Informácie o firme, vzhľad a účet' : 'Company info, appearance & account'}
        </p>
      </div>

      {/* Saved Toast */}
      {saved && (
        <div style={{
          padding: '12px 16px', borderRadius: '12px', marginBottom: '20px',
          background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)',
          color: 'var(--color-success)', fontSize: '13px', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '8px',
          animation: 'tabSlideIn 0.3s ease'
        }}>
          ✓ {lang === 'sk' ? 'Zmeny boli úspešne uložené' : 'Changes saved successfully'}
        </div>
      )}

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px', alignItems: 'start' }} className="flex-responsive profile-grid">
        {/* LEFT: Company Profile Card */}
        <motion.div 
          layoutId={editing || editingRecently ? "employer-profile-pill" : undefined}
          style={{ ...sectionStyle, padding: '28px', minWidth: 0, overflow: 'hidden', borderRadius: 24, transition: 'border-color 0.3s ease, box-shadow 0.3s ease, background-color 0.3s ease' }}
        >
          {/* Company Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{
              width: '60px', height: '60px', borderRadius: '16px', flexShrink: 0,
              background: 'linear-gradient(135deg, #FF8C32, #FF5C00)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '26px', fontWeight: 900, color: '#fff',
              boxShadow: '0 6px 20px rgba(255, 92, 0, 0.2)',
              overflow: 'hidden', position: 'relative', cursor: 'pointer'
            }}>
              {companyProfile?.logo_url ? (
                <img src={companyProfile.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                (form.name || 'C').charAt(0).toUpperCase()
              )}
              <label style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--overlay-dark)', opacity: 0, cursor: 'pointer', transition: 'opacity 0.2s', color: '#fff', fontSize: 14, fontWeight: 700, borderRadius: '16px' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                <input type="file" accept="image/*" hidden onChange={async (ev) => {
                  const file = ev.target.files?.[0];
                  if (!file) return;
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) return;

                    const formData = new FormData();
                    formData.append('logo', file);

                    const res = await fetch('/api/employer/logo-upload', {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${session.access_token}` },
                      body: formData,
                    });

                    const result = await res.json();
                    if (res.ok && result.logo_url) {
                      setCompanyProfile(prev => ({ ...prev, logo_url: result.logo_url }));
                    } else {
                      console.error('[Logo Upload] Server error:', result.error);
                      alert(lang === 'sk' ? 'Nepodarilo sa nahrať logo.' : 'Failed to upload logo.');
                    }
                  } catch (err) {
                    console.error('[Logo Upload] Error:', err);
                    alert(lang === 'sk' ? 'Nepodarilo sa nahrať logo.' : 'Failed to upload logo.');
                  }
                  ev.target.value = '';
                }} />
                📷
              </label>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '18px', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{companyProfile?.name || (lang === 'sk' ? 'Vaša firma' : 'Your company')}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{companyProfile?.industry || (lang === 'sk' ? 'Pridajte popis' : 'Add description')}</div>
            </div>
            <button
              onClick={() => setEditing(true)}
              style={{
                padding: '8px 16px', borderRadius: '10px', flexShrink: 0,
                border: '1px solid var(--border)', background: 'var(--overlay-light)',
                color: 'var(--text)', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              {lang === 'sk' ? 'Upraviť' : 'Edit'}
            </button>
          </div>

          {/* Form Fields (Read-only) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={labelStyle}>{lang === 'sk' ? 'Názov spoločnosti' : 'Company Name'}</label>
              <div style={readOnlyStyle}>
                {companyProfile?.name || <span style={{ color: 'var(--text-muted)' }}>—</span>}
              </div>
            </div>

            <div>
              <label style={labelStyle}>{lang === 'sk' ? 'Popis / Odvetvie' : 'Description / Industry'}</label>
              <div style={readOnlyStyle}>
                {companyProfile?.industry || <span style={{ color: 'var(--text-muted)' }}>—</span>}
              </div>
            </div>

            <div>
              <label style={labelStyle}>{lang === 'sk' ? 'Webstránka' : 'Website'}</label>
              <div style={readOnlyStyle}>
                {companyProfile?.website ? (
                  <a href={companyProfile.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>{companyProfile.website}</a>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                )}
              </div>
            </div>

            <div>
              <label style={labelStyle}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {lang === 'sk' ? 'Lokalita' : 'Location'}
                </span>
              </label>
              <div style={readOnlyStyle}>
                {companyProfile?.location ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {companyProfile.location}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* RIGHT: Account + Settings + Logout */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Account */}
          <div style={{ ...sectionStyle, padding: '20px' }}>
            <h3 style={{ fontSize: '12px', fontWeight: 700, marginBottom: '14px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {lang === 'sk' ? 'Účet' : 'Account'}
            </h3>
            <AccountInfo lang={lang} />
          </div>

          {/* Settings */}
          <div style={{ ...sectionStyle, padding: '20px' }}>
            <h3 style={{ fontSize: '12px', fontWeight: 700, marginBottom: '14px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {lang === 'sk' ? 'Nastavenia' : 'Settings'}
            </h3>

            {/* Language Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{lang === 'sk' ? 'Jazyk' : 'Language'}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{lang === 'sk' ? 'Jazyk rozhrania' : 'Interface language'}</div>
              </div>
              <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <button
                  onClick={() => setLang('sk')}
                  style={{
                    padding: '7px 14px', border: 'none', fontSize: '12px', fontWeight: 700,
                    background: lang === 'sk' ? 'var(--accent)' : 'transparent',
                    color: lang === 'sk' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >SK</button>
                <button
                  onClick={() => setLang('en')}
                  style={{
                    padding: '7px 14px', border: 'none', fontSize: '12px', fontWeight: 700,
                    background: lang === 'en' ? 'var(--accent)' : 'transparent',
                    color: lang === 'en' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >EN</button>
              </div>
            </div>

            {/* Theme Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{lang === 'sk' ? 'Vzhľad' : 'Appearance'}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{lang === 'sk' ? 'Tmavý alebo svetlý' : 'Dark or light mode'}</div>
              </div>
              <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <button
                  onClick={() => {
                    document.documentElement.classList.remove('light');
                    setTheme('dark');
                    localStorage.setItem('employer_theme', 'dark');
                  }}
                  style={{
                    padding: '7px 12px', border: 'none', fontSize: '13px', fontWeight: 600,
                    background: theme === 'dark' ? 'var(--accent)' : 'transparent',
                    color: theme === 'dark' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                  {lang === 'sk' ? 'Tmavý' : 'Dark'}
                </button>
                <button
                  onClick={() => {
                    document.documentElement.classList.add('light');
                    setTheme('light');
                    localStorage.setItem('employer_theme', 'light');
                  }}
                  style={{
                    padding: '7px 12px', border: 'none', fontSize: '13px', fontWeight: 600,
                    background: theme === 'light' ? 'var(--accent)' : 'transparent',
                    color: theme === 'light' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                  {lang === 'sk' ? 'Svetlý' : 'Light'}
                </button>
              </div>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              localStorage.removeItem('employer_theme');
              window.location.href = '/employer';
            }}
            style={{
              width: '100%', padding: '12px', borderRadius: '12px',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text)', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            {lang === 'sk' ? 'Odhlásiť sa' : 'Log out'}
          </button>

          {/* Privacy & Data — GDPR Compliance */}
          <div style={{ marginTop: 8, padding: 20, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {lang === 'sk' ? 'Súkromie a dáta' : 'Privacy & Data'}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 14, margin: '0 0 14px' }}>
              {lang === 'sk'
                ? 'Stiahnite si kópiu všetkých vašich firemných údajov (GDPR čl. 15).'
                : 'Download a copy of all your company data (GDPR Art. 15).'}
            </p>
            <button
              onClick={async () => {
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) return;
                  const res = await fetch('/api/auth/export-data', {
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                  });
                  if (!res.ok) throw new Error('Export failed');
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'unemployed-employer-data-export.json';
                  a.click();
                  URL.revokeObjectURL(url);
                } catch {
                  alert(lang === 'sk' ? 'Export dát zlyhal.' : 'Failed to export data.');
                }
              }}
              style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onMouseOver={e => { e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
              onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {lang === 'sk' ? 'Stiahnuť moje dáta' : 'Download My Data'}
            </button>
          </div>

          {/* Danger Zone — Account Deletion */}
          <div style={{ marginTop: 8, padding: 20, borderRadius: 12, border: '1px solid rgba(239, 68, 68, 0.25)', background: 'rgba(239, 68, 68, 0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <AlertTriangle size={16} style={{ color: '#ef4444' }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {lang === 'sk' ? 'Nebezpečná zóna' : 'Danger Zone'}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 14, margin: '0 0 14px' }}>
              {lang === 'sk'
                ? 'Natrvalo vymazať váš firemnmý účet, všetky inšeráty, kandidátov a súvisiace údaje. Túto akciu nie je možné vrátiť späť.'
                : 'Permanently delete your company account, all listings, candidates, and associated data. This action cannot be undone.'}
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid rgba(239, 68, 68, 0.3)', background: 'transparent', color: '#ef4444', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onMouseOver={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.borderColor = '#ef4444'; }}
              onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)'; }}
            >
              <Trash2 size={14} />
              {lang === 'sk' ? 'Vymazať účet' : 'Delete Account'}
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={() => { if (!deleting) { setShowDeleteModal(false); setDeleteConfirmText(''); } }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: 420, background: 'var(--bg-card)', borderRadius: 24, border: '1px solid rgba(239, 68, 68, 0.3)', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertTriangle size={22} style={{ color: '#ef4444' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#ef4444' }}>
                    {lang === 'sk' ? 'Vymazať účet' : 'Delete Account'}
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    {lang === 'sk' ? 'Táto akcia je trvalá a nezvratná' : 'This action is permanent and irreversible'}
                  </p>
                </div>
              </div>

              <div style={{ background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: 14, padding: 16, marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>
                  {lang === 'sk'
                    ? 'Tým sa natrvalo vymaže váš firemný účet, všetky pracovné ponuky, dáta o kandidátoch, správy a všetky súvisiace údaje.'
                    : 'This will permanently delete your company account, all job listings, candidate data, messages, and all associated data.'}
                </p>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
                  {lang === 'sk'
                    ? 'Pre potvrdenie napíšte "delete my account":'
                    : 'Type "delete my account" to confirm:'}
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder="delete my account"
                  autoFocus
                  disabled={deleting}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: deleteConfirmText.toLowerCase().trim() === 'delete my account' ? '2px solid #ef4444' : '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box', transition: 'border 0.2s' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  disabled={deleteConfirmText.toLowerCase().trim() !== 'delete my account' || deleting}
                  onClick={async () => {
                    try {
                      setDeleting(true);
                      const { data: { session } } = await supabase.auth.getSession();
                      if (!session) return;
                      const res = await fetch('/api/auth/delete-account', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                        body: JSON.stringify({ confirmation: deleteConfirmText }),
                      });
                      if (res.ok) {
                        await supabase.auth.signOut();
                        localStorage.clear();
                        window.location.href = '/';
                      } else {
                        const err = await res.json().catch(() => ({}));
                        alert(err.error || 'Failed to delete account');
                      }
                    } catch (err) {
                      console.error('Delete account error:', err);
                      alert(lang === 'sk' ? 'Nepodarilo sa vymazať účet. Skúste to znova.' : 'Failed to delete account. Try again.');
                    } finally {
                      setDeleting(false);
                    }
                  }}
                  style={{ flex: 1, padding: '14px', borderRadius: 14, border: 'none', background: deleteConfirmText.toLowerCase().trim() === 'delete my account' && !deleting ? '#ef4444' : 'rgba(239, 68, 68, 0.2)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: deleteConfirmText.toLowerCase().trim() === 'delete my account' && !deleting ? 'pointer' : 'not-allowed', transition: 'all 0.2s', opacity: deleteConfirmText.toLowerCase().trim() === 'delete my account' && !deleting ? 1 : 0.5 }}
                >
                  {deleting ? (lang === 'sk' ? 'Mazanie...' : 'Deleting...') : (lang === 'sk' ? 'Vymazať môj účet' : 'Delete My Account')}
                </button>
                <button
                  onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
                  disabled={deleting}
                  style={{ padding: '14px 24px', borderRadius: 14, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 14, fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer' }}
                >
                  {lang === 'sk' ? 'Zrušiť' : 'Cancel'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Company Profile Modal */}
      <AnimatePresence>
        {editing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ position: 'fixed', inset: 0, background: 'var(--overlay-darker)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={() => { setEditing(false); setForm({ name: companyProfile?.name || '', description: companyProfile?.industry || '', website: companyProfile?.website || '', location: companyProfile?.location || '' }); }}
          >
            <motion.div
              layoutId="employer-profile-pill"
              transition={{ type: 'spring', damping: 30, stiffness: 200 }}
              onClick={e => e.stopPropagation()} 
              style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', background: 'var(--bg-card)', borderRadius: 24, border: '1px solid var(--border)', padding: 28, overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', position: 'relative', transition: 'none' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800 }}>{lang === 'sk' ? 'Upraviť profil firmy' : 'Edit Company Profile'}</h2>
                <button onClick={() => { setEditing(false); setForm({ name: companyProfile?.name || '', description: companyProfile?.industry || '', website: companyProfile?.website || '', location: companyProfile?.location || '' }); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>✕</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={labelStyle}>{lang === 'sk' ? 'Názov spoločnosti' : 'Company Name'}</label>
                  <input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder={lang === 'sk' ? 'Vaša firma s.r.o.' : 'Your Company LLC'} />
                </div>

                <div>
                  <label style={labelStyle}>{lang === 'sk' ? 'Popis / Odvetvie' : 'Description / Industry'}</label>
                  <textarea style={{ ...inputStyle, minHeight: '100px', resize: 'vertical', lineHeight: '1.5' }}
                    value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder={lang === 'sk' ? 'Krátky popis vašej firmy...' : 'Short company description...'} />
                </div>

                <div>
                  <label style={labelStyle}>{lang === 'sk' ? 'Webstránka' : 'Website'}</label>
                  <input style={inputStyle} value={form.website} onChange={e => setForm({ ...form, website: e.target.value })}
                    placeholder="https://www.vasafirma.sk" />
                </div>

                <div>
                  <label style={labelStyle}>{lang === 'sk' ? 'Lokalita' : 'Location'}</label>
                  <input style={inputStyle} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                    placeholder={lang === 'sk' ? 'napr. Bratislava' : 'e.g. Bratislava'} />
                </div>
              </div>

              <div style={{ marginTop: '28px', display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                    background: 'var(--accent)', color: '#fff',
                    fontWeight: 700, fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  {saving ? (lang === 'sk' ? 'Ukladám...' : 'Saving...') : (lang === 'sk' ? 'Uložiť zmeny' : 'Save Changes')}
                </button>
                <button
                  onClick={() => { setEditing(false); setForm({ name: companyProfile?.name || '', description: companyProfile?.industry || '', website: companyProfile?.website || '', location: companyProfile?.location || '' }); }}
                  style={{
                    padding: '12px 20px', borderRadius: '12px',
                    border: '1px solid var(--border)', background: 'transparent',
                    color: 'var(--text)', fontWeight: 600, fontSize: '14px', cursor: 'pointer'
                  }}
                >
                  {lang === 'sk' ? 'Zrušiť' : 'Cancel'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AccountInfo = ({ lang }) => {
  const [email, setEmail] = useState('...');
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setEmail(session.user.email || '—');
    });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>E-mail</span>
        <span style={{ fontSize: '13px', fontWeight: 600 }}>{email}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{lang === 'sk' ? 'Plán' : 'Plan'}</span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>Pro</span>
      </div>
    </div>
  );
};

export default Profile;
