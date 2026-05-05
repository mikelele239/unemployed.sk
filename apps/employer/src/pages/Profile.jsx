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

  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' };
  const inputStyle = {
    width: '100%', padding: '14px 18px', borderRadius: '14px',
    border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)',
    color: 'var(--text)', fontSize: '14px', outline: 'none', transition: 'border 0.2s',
  };

  return (
    <div style={{ animation: 'tabSlideIn 0.4s ease', maxWidth: '700px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: '800', letterSpacing: '-0.5px' }}>
          {lang === 'sk' ? 'Profil spoločnosti' : 'Company Profile'}
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
          {lang === 'sk' ? 'Upravte informácie o vašej firme' : 'Edit your company information'}
        </p>
      </div>

      {/* Saved Toast */}
      {saved && (
        <div style={{
          padding: '14px 20px', borderRadius: '14px', marginBottom: '24px',
          background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)',
          color: '#22c55e', fontSize: '14px', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '8px',
          animation: 'tabSlideIn 0.3s ease'
        }}>
          ✓ {lang === 'sk' ? 'Zmeny boli úspešne uložené' : 'Changes saved successfully'}
        </div>
      )}

      <div style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius)',
        border: '1px solid var(--border)', padding: '32px',
        boxShadow: 'var(--shadow)'
      }}>
        {/* Company Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px', paddingBottom: '24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '18px',
            background: 'linear-gradient(135deg, #FF8C32, #FF5C00)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', fontWeight: 900, color: '#fff',
            boxShadow: '0 8px 24px rgba(255, 92, 0, 0.2)'
          }}>
            {(form.name || 'C').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 800 }}>{form.name || (lang === 'sk' ? 'Vaša firma' : 'Your company')}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>{form.description || (lang === 'sk' ? 'Pridajte popis' : 'Add description')}</div>
          </div>
        </div>

        {/* Form Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <label style={labelStyle}>{lang === 'sk' ? 'Názov spoločnosti' : 'Company Name'}</label>
            {editing ? (
              <input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder={lang === 'sk' ? 'Vaša firma s.r.o.' : 'Your Company LLC'} />
            ) : (
              <div style={{ ...inputStyle, background: 'transparent', border: '1px solid transparent', cursor: 'default' }}>
                {form.name || <span style={{ color: 'var(--text-muted)' }}>—</span>}
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>{lang === 'sk' ? 'Popis / Odvetvie' : 'Description / Industry'}</label>
            {editing ? (
              <textarea style={{ ...inputStyle, minHeight: '100px', resize: 'vertical', lineHeight: '1.6' }}
                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder={lang === 'sk' ? 'Krátky popis vašej firmy...' : 'Short company description...'} />
            ) : (
              <div style={{ ...inputStyle, background: 'transparent', border: '1px solid transparent', minHeight: '60px', cursor: 'default' }}>
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
              <div style={{ ...inputStyle, background: 'transparent', border: '1px solid transparent', cursor: 'default' }}>
                {form.website ? (
                  <a href={form.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>{form.website}</a>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ marginTop: '32px', display: 'flex', gap: '12px' }}>
          {editing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  flex: 1, padding: '14px', borderRadius: '14px', border: 'none',
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
                  padding: '14px 24px', borderRadius: '14px',
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text)', fontWeight: 600, fontSize: '14px', cursor: 'pointer'
                }}
              >
                {lang === 'sk' ? 'Zrušiť' : 'Cancel'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              style={{
                flex: 1, padding: '14px', borderRadius: '14px',
                border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)',
                color: 'var(--text)', fontWeight: 700, fontSize: '14px', cursor: 'pointer',
                transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              {lang === 'sk' ? 'Upraviť profil' : 'Edit Profile'}
            </button>
          )}
        </div>
      </div>

      {/* Account Info */}
      <div style={{
        marginTop: '24px', background: 'var(--bg-card)', borderRadius: 'var(--radius)',
        border: '1px solid var(--border)', padding: '24px',
        boxShadow: 'var(--shadow)'
      }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {lang === 'sk' ? 'Informácie o účte' : 'Account Information'}
        </h3>
        <AccountInfo lang={lang} />
      </div>

      {/* Preferences */}
      <div style={{
        marginTop: '24px', background: 'var(--bg-card)', borderRadius: 'var(--radius)',
        border: '1px solid var(--border)', padding: '24px',
        boxShadow: 'var(--shadow)'
      }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '20px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {lang === 'sk' ? 'Nastavenia' : 'Settings'}
        </h3>

        {/* Language Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{lang === 'sk' ? 'Jazyk' : 'Language'}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{lang === 'sk' ? 'Zmeniť jazyk rozhrania' : 'Change interface language'}</div>
          </div>
          <div style={{ display: 'flex', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <button
              onClick={() => setLang('sk')}
              style={{
                padding: '8px 16px', border: 'none', fontSize: '12px', fontWeight: 700,
                background: lang === 'sk' ? 'var(--accent)' : 'transparent',
                color: lang === 'sk' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.2s'
              }}
            >SK</button>
            <button
              onClick={() => setLang('en')}
              style={{
                padding: '8px 16px', border: 'none', fontSize: '12px', fontWeight: 700,
                background: lang === 'en' ? 'var(--accent)' : 'transparent',
                color: lang === 'en' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.2s'
              }}
            >EN</button>
          </div>
        </div>

        {/* Theme Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{lang === 'sk' ? 'Vzhľad' : 'Appearance'}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{lang === 'sk' ? 'Prepnúť medzi tmavým a svetlým režimom' : 'Switch between dark and light mode'}</div>
          </div>
          <div style={{ display: 'flex', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <button
              onClick={() => {
                document.documentElement.classList.remove('light');
                setTheme('dark');
                localStorage.setItem('employer_theme', 'dark');
              }}
              style={{
                padding: '8px 14px', border: 'none', fontSize: '14px', fontWeight: 600,
                background: theme === 'dark' ? 'var(--accent)' : 'transparent',
                color: theme === 'dark' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '5px'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              {lang === 'sk' ? 'Tmavý' : 'Dark'}
            </button>
            <button
              onClick={() => {
                document.documentElement.classList.add('light');
                setTheme('light');
                localStorage.setItem('employer_theme', 'light');
              }}
              style={{
                padding: '8px 14px', border: 'none', fontSize: '14px', fontWeight: 600,
                background: theme === 'light' ? 'var(--accent)' : 'transparent',
                color: theme === 'light' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '5px'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              {lang === 'sk' ? 'Svetlý' : 'Light'}
            </button>
          </div>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>E-mail</span>
        <span style={{ fontSize: '13px', fontWeight: 600 }}>{email}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{lang === 'sk' ? 'Plán' : 'Plan'}</span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>Pro</span>
      </div>
    </div>
  );
};

export default Profile;
