'use strict';

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

  // ── Landing Page Signup ──────────────────────────────────────────────────
  app.post('/api/submit', rateLimit, async (req, res) => {
    const { email, phonePrefix, phone, userType, consented, marketingConsent } = req.body;

    // ── Validation ──
    if (!email || !EMAIL_RE.test(email.trim()))
      return res.status(400).json({ error: 'Platný e-mail je povinný.' });
    if (!userType || !VALID_TYPES.has(userType))
      return res.status(400).json({ error: 'Neplatný typ používateľa.' });
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
      const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
        email, password,
        email_confirm: false,
        user_metadata: { role: 'candidate', full_name: fullName }
      });
      if (createError) {
        return res.status(createError.status || 500).json({
          error: createError.message,
          details: createError.code === 'user_already_exists'
            ? 'Užívateľ s týmto emailom už existuje.'
            : createError.message
        });
      }
      await supabase.from('user_roles').upsert({ user_id: user.id, role: 'candidate' });
      await supabase.from('profiles').upsert({ user_id: user.id, first_name: fullName });
      res.json({ success: true, message: 'Check your email for the confirmation link.' });
    } catch (err) {
      console.error('Registration error:', err);
      res.status(500).json({ error: 'Interná chyba servera.', details: err.message });
    }
  });

  // ── Employer Auth ────────────────────────────────────────────────────────

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
        .from('employer_profiles')
        .select('*')
        .eq('user_id', user.id)
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
      const { data: profile } = await supabase
        .from('employer_profiles').select('name').eq('user_id', user.id).single();
      const companyName = profile?.name || '';
      const { data: jobs } = await supabase.from('jobs').select('id').eq('company', companyName);
      const jobIds = (jobs || []).map(j => j.id);
      const { data: apps } = await supabase
        .from('applications').select('*')
        .in('job_id', jobIds.length > 0 ? jobIds : ['00000000-0000-0000-0000-000000000000']);

      const allApps = apps || [];
      const pipeline = { Pending: 0, Viewed: 0, Interview: 0, Hired: 0, Rejected: 0 };
      allApps.forEach(a => {
        const s = a.status || 'Pending';
        if (pipeline[s] !== undefined) pipeline[s]++;
        else pipeline.Pending++;
      });

      res.json({
        total_views: jobIds.length * 120,
        total_applications: allApps.length,
        active_jobs: jobIds.length,
        avg_match_score: allApps.length > 0
          ? Math.round(allApps.reduce((s, a) => s + (a.ai_score || 50), 0) / allApps.length) : 0,
        pipeline_stats: pipeline,
        recent_candidates: allApps.slice(0, 5),
        recent_apps_trend: [0, 0, 0, 0, 0, 0, allApps.length]
      });
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
