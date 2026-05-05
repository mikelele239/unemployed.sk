import React, { useState, useEffect } from 'react';
import { useI18n, useAppState } from '../contexts';
import { supabase } from '../supabase';

const Profile = () => {
  const { t, lang, setLang } = useI18n();
  const { companyProfile, setCompanyProfile } = useAppState();

  const [theme, setTheme] = useState(() => {
    return document.documentElement.classList.contains('light') ? 'light' : 'dark';
  });

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    website: '',
  });

  useEffect(() => {
    setForm({
      name: companyProfile?.name || '',
      description: companyProfile?.industry || '',
      website: companyProfile?.website || '',
    });
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
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          website: form.website,
        })
      });

      if (res.ok) {
        setCompanyProfile({
          name: form.name,
          industry: form.description,
          website: form.website,
          logo_url: companyProfile?.logo_url || '',
          cover_url: companyProfile?.cover_url || '',
        });
        setEditing(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        alert(lang === 'sk' ? 'Nepodarilo sa uložiť zmeny.' : 'Failed to save changes.');
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
    border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)',
    color: 'var(--text)', fontSize: '14px', outline: 'none', transition: 'border 0.2s',
  };
  const readOnlyStyle = { ...inputStyle, background: 'transparent', border: '1px solid transparent', cursor: 'default', padding: '8px 0' };

  return (
    <div style={{ animation: 'tabSlideIn 0.4s ease' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '800', letterSpacing: '-0.5px' }}>
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
          color: '#22c55e', fontSize: '13px', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '8px',
          animation: 'tabSlideIn 0.3s ease'
        }}>
          ✓ {lang === 'sk' ? 'Zmeny boli úspešne uložené' : 'Changes saved successfully'}
        </div>
      )}

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px', alignItems: 'start' }} className="flex-responsive">
        {/* LEFT: Company Profile Card */}
        <div style={{ ...sectionStyle, padding: '28px' }}>
          {/* Company Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{
              width: '60px', height: '60px', borderRadius: '16px', flexShrink: 0,
              background: 'linear-gradient(135deg, #FF8C32, #FF5C00)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '26px', fontWeight: 900, color: '#fff',
              boxShadow: '0 6px 20px rgba(255, 92, 0, 0.2)'
            }}>
              {(form.name || 'C').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '18px', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.name || (lang === 'sk' ? 'Vaša firma' : 'Your company')}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.description || (lang === 'sk' ? 'Pridajte popis' : 'Add description')}</div>
            </div>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                style={{
                  padding: '8px 16px', borderRadius: '10px', flexShrink: 0,
                  border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)',
                  color: 'var(--text)', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                {lang === 'sk' ? 'Upraviť' : 'Edit'}
              </button>
            )}
          </div>

          {/* Form Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={labelStyle}>{lang === 'sk' ? 'Názov spoločnosti' : 'Company Name'}</label>
              {editing ? (
                <input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder={lang === 'sk' ? 'Vaša firma s.r.o.' : 'Your Company LLC'} />
              ) : (
                <div style={readOnlyStyle}>
                  {form.name || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle}>{lang === 'sk' ? 'Popis / Odvetvie' : 'Description / Industry'}</label>
              {editing ? (
                <textarea style={{ ...inputStyle, minHeight: '100px', resize: 'vertical', lineHeight: '1.5' }}
                  value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder={lang === 'sk' ? 'Krátky popis vašej firmy...' : 'Short company description...'} />
              ) : (
                <div style={{ ...readOnlyStyle, minHeight: 'auto' }}>
                  {form.description || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle}>{lang === 'sk' ? 'Webstránka' : 'Website'}</label>
              {editing ? (
                <input style={inputStyle} value={form.website} onChange={e => setForm({ ...form, website: e.target.value })}
                  placeholder="https://www.vasafirma.sk" />
              ) : (
                <div style={readOnlyStyle}>
                  {form.website ? (
                    <a href={form.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>{form.website}</a>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons — only visible when editing */}
          {editing && (
            <div style={{ marginTop: '24px', display: 'flex', gap: '10px' }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                  background: 'linear-gradient(135deg, #FF8C32, #FF5C00)', color: '#fff',
                  fontWeight: 700, fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1, transition: 'all 0.2s'
                }}
              >
                {saving ? (lang === 'sk' ? 'Ukladám...' : 'Saving...') : (lang === 'sk' ? 'Uložiť zmeny' : 'Save Changes')}
              </button>
              <button
                onClick={() => { setEditing(false); setForm({ name: companyProfile?.name || '', description: companyProfile?.industry || '', website: companyProfile?.website || '' }); }}
                style={{
                  padding: '12px 20px', borderRadius: '12px',
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text)', fontWeight: 600, fontSize: '14px', cursor: 'pointer'
                }}
              >
                {lang === 'sk' ? 'Zrušiť' : 'Cancel'}
              </button>
            </div>
          )}
        </div>

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
        </div>
      </div>
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
