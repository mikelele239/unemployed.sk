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

  // ── Student Profile ──────────────────────────────────────────────────────

  app.get('/api/profile', async (req, res) => {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
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
      const { name, ...rest } = req.body;
      const finalProfile = { ...rest, user_id: user.id };
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

      console.log(`✅ New signup: ${cleanEmail} (${userType})`);
      res.json({ success: true });
    } catch (err) {
      console.error('Submit error:', err);
      res.status(500).json({ error: 'Chyba pri spracovaní.' });
    }
  });

  // ── Student Registration ─────────────────────────────────────────────────

  app.post('/api/auth/student/register', async (req, res) => {
    const { email, password, fullName } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    try {
      // email_confirm: true auto-confirms via admin API without sending email
      // This avoids Supabase's email rate limits on the free tier
      const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
        email, password,
        email_confirm: false,
        user_metadata: { role: 'candidate', full_name: fullName }
      });
      if (createError) {
        const msg = (createError.message || '').toLowerCase();
        if (createError.code === 'user_already_exists' || msg.includes('already') || msg.includes('exists')) {
          return res.status(409).json({
            error: 'Účet s týmto emailom už existuje.',
            details: 'Užívateľ s týmto emailom už existuje. Prihláste sa namiesto registrácie.'
          });
        }
        if (msg.includes('rate') || msg.includes('limit') || msg.includes('exceeded') || createError.status === 429) {
          return res.status(429).json({
            error: 'Dočasný limit registrácií.',
            details: 'Skúste to prosím o niekoľko minút.'
          });
        }
        return res.status(createError.status || 500).json({
          error: createError.message,
          details: createError.message
        });
      }
      // Self-heal: ensure role + profile rows exist even if DB triggers failed
      try { await supabase.from('user_roles').upsert({ user_id: user.id, role: 'candidate' }); } catch (_) {}
      try { await supabase.from('profiles').upsert({ user_id: user.id, first_name: fullName, email }); } catch (_) {}
      res.json({ success: true, message: 'Account created successfully.' });
    } catch (err) {
      console.error('Registration error:', err);
      res.status(500).json({ error: 'Interná chyba servera.', details: err.message });
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

  app.post('/api/auth/employer/register', async (req, res) => {
    const { email, password, companyName } = req.body;
    if (!email || !password || !companyName) return res.status(400).json({ error: 'Všetky polia (email, heslo, názov firmy) sú povinné.' });

    try {
      // Use admin API to create user — email_confirm: true auto-confirms
      // without sending a confirmation email (avoids Supabase email rate limits)
      const { data, error: signUpError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: 'employer', company_name: companyName }
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

  app.post('/api/auth/employer/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email a heslo sú povinné.' });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const role = data.user.user_metadata?.role || data.user.app_metadata?.role;
      if (role === 'candidate')
        return res.status(403).json({ error: 'Tento účet je kandidátsky, nie zamestnávateľský.' });
      res.json({ session: data.session });
    } catch (err) {
      console.error('Employer login error:', err);
      res.status(401).json({ error: err.message });
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
        .select('*')
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
};
