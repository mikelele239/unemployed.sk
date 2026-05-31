'use strict';
// ══════════════════════════════════════════════════════════════════════════════
// ██████████████████████████████████████████████████████████████████████████████
// ██                                                                        ██
// ██  ⚠️  CRITICAL DISCLAIMER — DO NOT REMOVE /api/submit ENDPOINT  ⚠️      ██
// ██                                                                        ██
// ██  The /api/submit route below is the ONLY way the landing page signup   ██
// ██  form (email + phone number) saves data to the Supabase "submissions"  ██
// ██  table. This is CRUCIAL for user acquisition.                          ██
// ██                                                                        ██
// ██  ANY future code changes, refactors, or SQL migrations MUST:           ██
// ██    1. Keep the POST /api/submit route functional                       ██
// ██    2. Keep the "submissions" table in Supabase intact                  ██
// ██    3. Keep the Supabase connection alive in server.js                  ██
// ██    4. Preserve the RLS policies that allow INSERT + SELECT on          ██
// ██       the "submissions" table                                          ██
// ██                                                                        ██
// ██  DO NOT disconnect, remove, comment out, or bypass this endpoint.      ██
// ██  Losing signups = losing real users = losing the company.              ██
// ██                                                                        ██
// ██████████████████████████████████████████████████████████████████████████████
// ══════════════════════════════════════════════════════════════════════════════

// ── Auth & Profile Routes ────────────────────────────────────────────────────
module.exports = function authRouter(app, supabase, { hashIp, getUserFromToken, rateLimit, VALID_TYPES, EMAIL_RE }) {

  // ── Auth-specific Rate Limiter (stricter: 10 attempts per 15 min window) ──
  const authRateMap = new Map();
  const AUTH_WINDOW_MS = 15 * 60_000; // 15 minutes
  const AUTH_MAX_PER_WINDOW = 10;
  function authRateLimit(req, res, next) {
    const ip = req.ip || '';
    const now = Date.now();
    const entry = authRateMap.get(ip);
    if (!entry || now > entry.resetAt) {
      if (authRateMap.size > 500) {
        for (const [key, value] of authRateMap.entries()) {
          if (now > value.resetAt) authRateMap.delete(key);
        }
      }
      authRateMap.set(ip, { count: 1, resetAt: now + AUTH_WINDOW_MS });
      return next();
    }
    if (entry.count >= AUTH_MAX_PER_WINDOW) {
      return res.status(429).json({
        error: 'Príliš veľa pokusov o prihlásenie. Skúste to o 15 minút.',
        error_en: 'Too many login attempts. Try again in 15 minutes.'
      });
    }
    entry.count += 1;
    next();
  }

  // ── Password Strength Validator ──
  function validatePassword(password) {
    if (!password || password.length < 8) return 'Heslo musí mať aspoň 8 znakov.';
    if (!/[A-Z]/.test(password)) return 'Heslo musí obsahovať aspoň jedno veľké písmeno.';
    if (!/[a-z]/.test(password)) return 'Heslo musí obsahovať aspoň jedno malé písmeno.';
    if (!/[0-9]/.test(password)) return 'Heslo musí obsahovať aspoň jednu číslicu.';
    return null;
  }

  // ── PII Masking Helper ──
  function maskEmail(email) {
    if (!email || !email.includes('@')) return '***';
    const [user, domain] = email.split('@');
    return `${user.charAt(0)}***@${domain}`;
  }

  // ── Student Profile ──────────────────────────────────────────────────────

  app.get('/api/profile', async (req, res) => {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, bio, location, education, skills, job_preferences, phone, linkedin_url, avatar_url, cover_photo_url, university, field_of_study, availability, preferred_job_type, hourly_rate_min, created_at')
        .eq('user_id', user.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      res.json(data || {});
    } catch (err) {
      console.error('Profile fetch error:', err);
      res.status(500).json({ error: 'Chyba pri načítaní profilu.' });
    }
  });

  app.post('/api/profile', async (req, res) => {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    try {
      // Whitelist allowed fields to prevent arbitrary column injection
      const ALLOWED_FIELDS = [
        'first_name', 'last_name', 'bio', 'location', 'education',
        'skills', 'job_preferences', 'phone', 'linkedin_url',
        'avatar_url', 'cover_photo_url', 'university', 'field_of_study',
        'availability', 'preferred_job_type', 'hourly_rate_min',
      ];
      const { name, ...body } = req.body;
      const finalProfile = { user_id: user.id };
      for (const key of ALLOWED_FIELDS) {
        if (body[key] !== undefined) finalProfile[key] = body[key];
      }
      if (name) {
        const parts = name.trim().split(' ');
        finalProfile.first_name = parts[0];
        finalProfile.last_name = parts.slice(1).join(' ') || '';
      }
      const { error } = await supabase
        .from('profiles')
        .upsert(finalProfile, { onConflict: 'user_id' });
      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      console.error('Profile save error:', err);
      res.status(500).json({ error: 'Chyba pri ukladaní profilu.' });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ██  LANDING PAGE SIGNUP — DO NOT REMOVE (see disclaimer at top)        ██
  // ══════════════════════════════════════════════════════════════════════════

  app.post('/api/submit', rateLimit, async (req, res) => {
    const { email, phonePrefix, phone, userType, consented, marketingConsent } = req.body;

    // ── Validation ──
    if (!email || !EMAIL_RE.test(email.trim()))
      return res.status(400).json({ error: 'Platný e-mail je povinný.' });
    if (!userType || !VALID_TYPES.has(userType))
      return res.status(400).json({ error: 'Neplatný typ používateľa.' });
    // consented arrives as string '1' or '0' from URL-encoded form data
    if (!consented || consented === '0' || consented === 'false')
      return res.status(400).json({ error: 'Súhlas so spracovaním údajov je povinný.' });

    try {
      const cleanEmail = email.toLowerCase().trim();
      const ipHash = hashIp(req.ip || '');

      // Check for duplicate email or IP (requires SELECT policy on submissions)
      const { data: existing } = await supabase
        .from('submissions')
        .select('id')
        .or(`email.eq.${cleanEmail},ip_hash.eq.${ipHash}`)
        .single();
      if (existing) return res.status(429).json({ error: 'Už ste registrovaný.' });

      // ██ INSERT INTO SUPABASE — THE CORE OF USER ACQUISITION ██
      const { error } = await supabase.from('submissions').insert([{
        email: cleanEmail,
        phone_prefix: phonePrefix || null,
        phone: phone || null,
        user_type: userType,
        consented: true,
        marketing_consent: !!marketingConsent,
        ip_hash: ipHash
      }]);
      if (error) {
        // Postgres 23505 = unique constraint violation (email already exists)
        if (error.code === '23505') {
          return res.status(429).json({ error: 'Už ste registrovaný.' });
        }
        throw error;
      }

      console.log(`✅ New signup: ${maskEmail(cleanEmail)} (${userType})`);
      res.json({ success: true });
    } catch (err) {
      console.error('Submit error:', err);
      res.status(500).json({ error: 'Chyba pri spracovaní.' });
    }
  });

  // ── Student Registration ─────────────────────────────────────────────────

  app.post('/api/auth/student/register', authRateLimit, async (req, res) => {
    const { email, password, fullName } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    // Validate password strength
    const pwErr = validatePassword(password);
    if (pwErr) return res.status(400).json({ error: pwErr });
    try {
      // Use standard signUp to require email verification (not admin.createUser which auto-confirms)
      const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) {
        console.error('[Auth] Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
        return res.status(500).json({ error: 'Chyba konfigurácie servera.' });
      }
      const anonSupabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);

      const redirectBase = req.headers.origin || 'https://unemployed.sk';
      const { data, error: signUpError } = await anonSupabase.auth.signUp({
        email,
        password,
        options: {
          data: { role: 'candidate', full_name: fullName },
          emailRedirectTo: `${redirectBase}/app/`
        }
      });

      if (signUpError) {
        const msg = (signUpError.message || '').toLowerCase();
        if (signUpError.code === 'user_already_exists' || msg.includes('already') || msg.includes('exists')) {
          return res.status(409).json({
            error: 'Účet s týmto emailom už existuje.',
            details: 'Užívateľ s týmto emailom už existuje. Prihláste sa namiesto registrácie.'
          });
        }
        if (msg.includes('rate') || msg.includes('limit') || msg.includes('exceeded') || signUpError.status === 429) {
          return res.status(429).json({
            error: 'Dočasný limit registrácií.',
            details: 'Skúste to prosím o niekoľko minút.'
          });
        }
        return res.status(signUpError.status || 500).json({
          error: signUpError.message,
          details: signUpError.message
        });
      }

      // Check if user already exists (prevent enumeration on client but handle it on server)
      if (data && data.user && (!data.user.identities || data.user.identities.length === 0)) {
        return res.status(409).json({
          error: 'Účet s týmto emailom už existuje.',
          details: 'Užívateľ s týmto emailom už existuje. Prihláste sa namiesto registrácie.'
        });
      }

      const user = data.user;

      // Self-heal: ensure role + profile rows exist even if DB triggers failed
      try { await supabase.from('user_roles').upsert({ user_id: user.id, role: 'candidate' }); } catch (_) {}
      try { await supabase.from('profiles').upsert({ user_id: user.id, first_name: fullName, email }); } catch (_) {}
      res.json({ success: true, message: 'Účet bol vytvorený. Skontrolujte si e-mail pre potvrdenie registrácie.' });
    } catch (err) {
      console.error('Registration error:', err);
      res.status(500).json({ error: 'Interná chyba servera.' });
    }
  });

  // ── Forgot Password ─────────────────────────────────────────────────────

  app.post('/api/auth/forgot-password', async (req, res) => {
    const { email, portal } = req.body;
    if (!email) return res.status(400).json({ error: 'E-mail je povinný.' });

    try {
      // Determine redirect URL based on which portal requested the reset
      const redirectBase = portal === 'employer' ? '/employer' : '/app';
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `https://unemployed.sk${redirectBase}#reset-password`,
      });
      if (error) throw error;

      // Always return success to prevent email enumeration
      res.json({ success: true, message: 'Ak existuje účet s týmto e-mailom, odoslali sme vám odkaz na obnovenie hesla.' });
    } catch (err) {
      console.error('Password reset error:', err);
      // Still return success to prevent enumeration
      res.json({ success: true, message: 'Ak existuje účet s týmto e-mailom, odoslali sme vám odkaz na obnovenie hesla.' });
    }
  });

  app.post('/api/auth/update-password', async (req, res) => {
    const { access_token, new_password } = req.body;
    if (!access_token || !new_password) return res.status(400).json({ error: 'Token a nové heslo sú povinné.' });

    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser(access_token);
      if (authErr || !user) return res.status(401).json({ error: 'Neplatný alebo expirovaný token.' });

      const { error } = await supabase.auth.admin.updateUserById(user.id, {
        password: new_password,
      });
      if (error) throw error;

      res.json({ success: true });
    } catch (err) {
      console.error('Update password error:', err);
      res.status(500).json({ error: 'Nepodarilo sa zmeniť heslo.' });
    }
  });

  // ── Employer Auth ────────────────────────────────────────────────────────

  app.post('/api/auth/employer/register', authRateLimit, async (req, res) => {
    const { email, password, companyName } = req.body;
    if (!email || !password || !companyName) return res.status(400).json({ error: 'Všetky polia (email, heslo, názov firmy) sú povinné.' });

    // Validate password strength
    const pwErr = validatePassword(password);
    if (pwErr) return res.status(400).json({ error: pwErr });

    try {
      // Use standard signUp to trigger email confirmation flow
      const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) {
        console.error('[Auth] Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
        return res.status(500).json({ error: 'Chyba konfigurácie servera.' });
      }
      const anonSupabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);

      const redirectBase = req.headers.origin || 'http://localhost:3000';
      const { data, error: signUpError } = await anonSupabase.auth.signUp({
        email,
        password,
        options: {
          data: { role: 'employer', company_name: companyName },
          emailRedirectTo: `${redirectBase}/employer/`
        }
      });

      if (signUpError) {
        // Handle specific Supabase errors with user-friendly messages
        const msg = (signUpError.message || '').toLowerCase();
        if (signUpError.code === 'user_already_exists' || msg.includes('already') || msg.includes('exists')) {
          return res.status(409).json({ error: 'Účet s týmto e-mailom už existuje. Prihláste sa namiesto registrácie.' });
        }
        if (msg.includes('rate') || msg.includes('limit') || msg.includes('exceeded') || signUpError.status === 429) {
          return res.status(429).json({ error: 'Dočasný limit registrácií bol dosiahnutý. Skúste to prosím o niekoľko minút.' });
        }
        throw signUpError;
      }

      // Check if user already exists (prevent user enumeration on client but handle it on server if identities are empty)
      if (data && data.user && (!data.user.identities || data.user.identities.length === 0)) {
        return res.status(409).json({ error: 'Účet s týmto e-mailom už existuje. Prihláste sa namiesto registrácie.' });
      }

      const user = data.user;

      // Ensure employer table entry exists
      const { error: dbError } = await supabase.from('employers').upsert([{
        id: user.id,
        name: companyName,
      }], { onConflict: 'id' });
      if (dbError) {
        console.warn('Employer profile creation non-fatal error:', dbError.message);
      }

      // Also ensure user_roles entry
      try { await supabase.from('user_roles').upsert({ user_id: user.id, role: 'employer' }); } catch (_) {}

      res.json({ success: true });
    } catch (err) {
      console.error('Employer registration error:', err);
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Registrácia zlyhala. Skúste to znova.' });
    }
  });

  app.post('/api/auth/employer/login', authRateLimit, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email a heslo sú povinné.' });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // H-4: Read role from authoritative user_roles table, not client-editable user_metadata
      const { data: roleRow } = await supabase.from('user_roles')
        .select('role').eq('user_id', data.user.id).maybeSingle();
      const role = roleRow?.role || data.user.app_metadata?.role || data.user.user_metadata?.role;
      if (role === 'candidate')
        return res.status(403).json({ error: 'Tento účet je kandidátsky, nie zamestnávateľský.' });
      res.json({ session: data.session });
    } catch (err) {
      console.error('Employer login error:', err);
      // M-2: Don't leak raw Supabase error messages
      res.status(401).json({ error: 'Nesprávny e-mail alebo heslo.' });
    }
  });

  app.post('/api/auth/employer/inquiry', async (req, res) => {
    const { email, companyName } = req.body;
    if (!email || !companyName) return res.status(400).json({ error: 'Email a názov firmy sú povinné.' });
    try {
      const ipHash = hashIp(req.ip || '');
      const { error } = await supabase.from('submissions').insert([{
        email, user_type: 'Zamestnávateľ', company_name: companyName,
        consented: true, ip_hash: ipHash
      }]);
      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      console.error('Employer inquiry error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Employer Profile & Analytics ─────────────────────────────────────────

  app.get('/api/auth/employer/profile', async (req, res) => {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const { data, error } = await supabase
        .from('employers')
        .select('id, name, industry, location, bio, logo_url, cover_url, onboarding_complete, created_at')
        .eq('id', user.id)
        .single();
      if (error && error.code !== 'PGRST116') {
        console.warn('Employer profile DB error (falling back):', error);
      }
      res.json(data || { name: 'Vaša Firma', industry: 'Hľadáme talenty' });
    } catch (err) {
      console.error('Employer profile error:', err);
      res.json({ name: 'Vaša Firma', industry: 'Hľadáme talenty' });
    }
  });

  app.get('/api/employer/analytics', async (req, res) => {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const { data, error } = await supabase.rpc('get_employer_analytics', { target_employer_id: user.id });
      
      if (error) {
        console.warn('Analytics RPC error, falling back to empty stats:', error.message);
        throw error;
      }
      
      res.json(data);
    } catch (err) {
      console.error('Analytics error:', err);
      res.json({
        total_views: 0, total_applications: 0, active_jobs: 0, avg_match_score: 0,
        pipeline_stats: { Pending: 0, Viewed: 0, Interview: 0, Hired: 0, Rejected: 0 },
        recent_candidates: [], recent_apps_trend: [0, 0, 0, 0, 0, 0, 0]
      });
    }
  });

  // ── Account Deletion ──────────────────────────────────────────────────────

  app.delete('/api/auth/delete-account', async (req, res) => {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { confirmation } = req.body;
    if (!confirmation || confirmation.toLowerCase().trim() !== 'delete my account') {
      return res.status(400).json({
        error: 'Pre potvrdenie vymazania účtu napíšte presne: delete my account',
        error_en: 'To confirm account deletion, type exactly: delete my account'
      });
    }

    const userId = user.id;
    console.log(`[Account Deletion] Starting for user ${userId}`);

    try {
      // H-4: Read role from authoritative user_roles table, not client-editable user_metadata
      const { data: roleRow } = await supabase.from('user_roles')
        .select('role').eq('user_id', userId).maybeSingle();
      const role = roleRow?.role || user.app_metadata?.role || user.user_metadata?.role || 'candidate';
      const isEmployer = role === 'employer';

      // Cascading delete — order matters (foreign keys)
      // 1. Match scores
      try { await supabase.from('match_scores').delete().eq('user_id', userId); } catch (e) { console.warn('[Delete] match_scores:', e.message); }

      // 2. Application messages (both sender and receiver)
      try { await supabase.from('application_messages').delete().eq('sender_id', userId); } catch (e) { console.warn('[Delete] application_messages sender:', e.message); }

      // 3. Notifications
      try { await supabase.from('notifications').delete().eq('user_id', userId); } catch (e) { console.warn('[Delete] notifications:', e.message); }

      if (isEmployer) {
        // 4a. Get all employer's job IDs first
        const { data: jobs } = await supabase.from('jobs').select('id').eq('employer_id', userId);
        const jobIds = (jobs || []).map(j => j.id);

        if (jobIds.length > 0) {
          // Delete applications for employer's jobs
          try { await supabase.from('applications').delete().in('job_id', jobIds); } catch (e) { console.warn('[Delete] applications:', e.message); }
          // Delete job criteria
          try { await supabase.from('job_criteria').delete().in('job_id', jobIds); } catch (e) { console.warn('[Delete] job_criteria:', e.message); }
        }

        // 5a. Delete jobs
        try { await supabase.from('jobs').delete().eq('employer_id', userId); } catch (e) { console.warn('[Delete] jobs:', e.message); }

        // 6a. Delete employer profile
        try { await supabase.from('employers').delete().eq('id', userId); } catch (e) { console.warn('[Delete] employers:', e.message); }
      } else {
        // 4b. Delete candidate applications
        try { await supabase.from('applications').delete().eq('candidate_id', userId); } catch (e) { console.warn('[Delete] applications:', e.message); }

        // 5b. Delete AI profile
        try { await supabase.from('ai_profiles').delete().eq('user_id', userId); } catch (e) { console.warn('[Delete] ai_profiles:', e.message); }

        // 6b. Delete CV verifications
        try { await supabase.from('cv_verifications').delete().eq('user_id', userId); } catch (e) { console.warn('[Delete] cv_verifications:', e.message); }

        // 7b. Delete profile
        try { await supabase.from('profiles').delete().eq('user_id', userId); } catch (e) { console.warn('[Delete] profiles:', e.message); }
      }

      // 8. Delete user role
      try { await supabase.from('user_roles').delete().eq('user_id', userId); } catch (e) { console.warn('[Delete] user_roles:', e.message); }

      // 8b. Delete landing page submissions (by email for full GDPR erasure)
      try {
        const email = user.email;
        if (email) {
          await supabase.from('submissions').delete().eq('email', email);
        }
      } catch (e) { console.warn('[Delete] submissions:', e.message); }

      // 9. Delete storage files (CVs, avatars, covers)
      try {
        const { data: files } = await supabase.storage.from('cvs').list(userId, { limit: 100 });
        if (files && files.length > 0) {
          const paths = files.map(f => `${userId}/${f.name}`);
          await supabase.storage.from('cvs').remove(paths);
        }
      } catch (e) { console.warn('[Delete] storage:', e.message); }

      // 10. Finally delete the auth user
      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
      if (deleteError) {
        console.error('[Account Deletion] Auth user delete failed:', deleteError);
        return res.status(500).json({ error: 'Nepodarilo sa vymazať účet. Skúste to znova.' });
      }

      console.log(`[Account Deletion] Successfully deleted user ${userId} (${role})`);
      res.json({ success: true, message: 'Váš účet bol úspešne vymazaný.' });

    } catch (err) {
      console.error('[Account Deletion] Error:', err);
      res.status(500).json({ error: 'Vymazanie účtu zlyhalo. Skúste to znova.' });
    }
  });

  // ── GDPR Data Export (Right to Access, Art. 15) ──────────────────────────

  app.get('/api/auth/export-data', async (req, res) => {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const userId = user.id;
    // H-4: Read role from authoritative user_roles table
    const { data: roleRow } = await supabase.from('user_roles')
      .select('role').eq('user_id', userId).maybeSingle();
    const role = roleRow?.role || user.app_metadata?.role || user.user_metadata?.role || 'candidate';

    try {
      const exportData = {
        _meta: {
          export_date: new Date().toISOString(),
          user_id: userId,
          role,
          gdpr_article: 'Art. 15 GDPR — Right of Access',
        },
        account: {
          email: user.email,
          created_at: user.created_at,
          last_sign_in: user.last_sign_in_at,
        },
      };

      if (role === 'employer') {
        // Employer data
        const { data: employer } = await supabase.from('employers').select('name, industry, location, bio, logo_url, onboarding_complete, created_at').eq('id', userId).maybeSingle();
        exportData.employer_profile = employer || {};

        const { data: jobs } = await supabase.from('jobs').select('id, title, company, location, status, created_at, views').eq('employer_id', userId);
        exportData.jobs = jobs || [];

        const jobIds = (jobs || []).map(j => j.id);
        if (jobIds.length > 0) {
          const { data: apps } = await supabase.from('applications').select('id, candidate_id, status, created_at').in('job_id', jobIds);
          exportData.received_applications = (apps || []).map(a => ({ id: a.id, status: a.status, created_at: a.created_at }));
        }
      } else {
        // Student data
        const { data: profile } = await supabase.from('profiles').select('first_name, last_name, bio, location, education, skills, job_preferences, phone, university, field_of_study, availability, preferred_job_type, created_at').eq('user_id', userId).maybeSingle();
        exportData.profile = profile || {};

        const { data: apps } = await supabase.from('applications').select('id, job_id, status, created_at').eq('candidate_id', userId);
        exportData.applications = apps || [];

        const { data: scores } = await supabase.from('match_scores').select('job_id, overall_score, created_at').eq('user_id', userId);
        exportData.match_scores = scores || [];

        const { data: aiProfile } = await supabase.from('ai_profiles').select('strengths, work_style, verified, created_at').eq('user_id', userId).maybeSingle();
        exportData.ai_profile = aiProfile || {};

        const { data: notifications } = await supabase.from('notifications').select('type, title, message, read, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(100);
        exportData.notifications = notifications || [];
      }

      // Set download headers
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="unemployed-data-export-${userId.slice(0,8)}.json"`);
      res.json(exportData);
    } catch (err) {
      console.error('[GDPR Export] Error:', err);
      res.status(500).json({ error: 'Export dát zlyhal. Skúste to znova.' });
    }
  });
};
