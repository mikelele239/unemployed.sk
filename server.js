'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const { createHash } = require('crypto');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Supabase Setup ─────────────────────────────────────────────────────────────
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ── Helpers ────────────────────────────────────────────────────────────────────

function hashIp(ip) {
  return createHash('sha256').update(ip || '').digest('hex');
}

// Extract user from Bearer token
async function getUserFromToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.replace('Bearer ', '');
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

// ── Middleware ─────────────────────────────────────────────────────────────────

app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: false, limit: '16kb' }));

// Block access to sensitive files
app.use((req, res, next) => {
  const blocked = /\/(server\.js|database\.db|unemployed\.db|package\.json|package-lock\.json|node_modules|\.env|submissions\.db.*|\.claude)(\/|$)/i;
  if (blocked.test(req.path)) return res.status(404).end();
  next();
});

// Trust first proxy
app.set('trust proxy', 1);

// Content Security Policy — allows framing for demos + Supabase connectivity
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' https://*.supabase.co; " +
    "frame-src 'self' https://*.supabase.co blob: data:; " +
    "connect-src 'self' https://*.supabase.co; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https: https://*.supabase.co;"
  );
  res.setHeader("X-Frame-Options", "ALLOWALL");
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

app.use('/app', express.static(path.join(__dirname, 'apps', 'student', 'dist')));
app.use('/employer', express.static(path.join(__dirname, 'apps', 'employer', 'dist')));
app.use('/student-demo', express.static(path.join(__dirname, 'apps', 'student-demo', 'dist')));
app.use('/employer-demo', express.static(path.join(__dirname, 'apps', 'employer-demo', 'dist')));
app.use(express.static(path.join(__dirname, 'apps', 'landing')));

// Simple rate limiter
const rateMap = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

function rateLimit(req, res, next) {
  const ip = req.ip || '';
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }
  if (entry.count >= MAX_PER_WINDOW) {
    return res.status(429).json({ error: 'Príliš veľa požiadaviek. Skúste to neskôr.' });
  }
  entry.count += 1;
  next();
}

// ── API: Jobs ──────────────────────────────────────────────────────────────────

app.get('/api/jobs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Supabase already returns parsed JSON for JSONB columns like 'tags'
    const parsedJobs = data.map(j => ({
      ...j,
      match: j.match_score,
      rateUnit: j.rate_unit,
      startDate: j.start_date,
      workModel: j.work_model
    }));

    res.json(parsedJobs);
  } catch (err) {
    console.error('Fetch jobs error:', err);
    res.status(500).json({ error: 'Chyba pri načítaní ponúk.' });
  }
});

app.post('/api/jobs', async (req, res) => {
  console.log('--- POST /api/jobs payload ---', JSON.stringify(req.body));
  const { 
    title, company, logo, color, location, rate, rateUnit, hours, type, 
    tags, schedule, description, requirements, lat, lng,
    duration, startDate, workModel 
  } = req.body;
  
  if (!title || !company) {
    return res.status(400).json({ error: 'Názov pozície a firma sú povinné.' });
  }

  try {
    const { data, error } = await supabase
      .from('jobs')
      .insert([
        { 
          title, company, logo, color, location, 
          rate, rate_unit: rateUnit, hours, type, 
          tags: tags || [], schedule, match_score: 95, 
          reason: 'Pridané online.', description, requirements,
          lat, lng,
          duration, start_date: startDate, work_model: workModel
        }
      ])
      .select();

    if (error) throw error;
    res.json({ success: true, id: data[0].id });
  } catch (err) {
    console.error('Create job error:', err);
    res.status(500).json({ error: 'Chyba pri ukladaní ponuky.' });
  }
});

app.delete('/api/jobs/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Delete job error:', err);
    res.status(500).json({ error: 'Chyba pri mazaní ponuky.' });
  }
});

// ── API: Job View Tracking ─────────────────────────────────────────────────────

app.post('/api/jobs/:id/view', async (req, res) => {
  const { id } = req.params;
  try {
    // Increment the view count for this job
    const { error } = await supabase.rpc('increment_job_views', { job_id_input: id });
    if (error) {
      // Fallback: just acknowledge if the RPC doesn't exist yet
      console.warn('View tracking RPC error (non-fatal):', error.message);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('View tracking error:', err);
    res.json({ success: true }); // Non-fatal, don't break the frontend
  }
});

// ── API: Student Profile ───────────────────────────────────────────────────────

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
    let finalProfile = { ...rest, user_id: user.id };
    
    // Split name into first and last for the DB schema
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

// ── API: Submissions (landing page signup) ─────────────────────────────────────

const VALID_TYPES = new Set(['Stredoškolák', 'Vysokoškolák', 'Absolvent', 'Zamestnávateľ']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/api/submit', rateLimit, async (req, res) => {
  const { email, phonePrefix, phone, userType, consented, marketingConsent } = req.body;

  if (!email || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Platný e-mail je povinný.' });
  }
  if (!userType || !VALID_TYPES.has(userType)) {
    return res.status(400).json({ error: 'Neplatný typ používateľa.' });
  }
  if (!consented) {
    return res.status(400).json({ error: 'Súhlas so spracovaním údajov je povinný.' });
  }

  try {
    const cleanEmail = email.toLowerCase().trim();
    const ipHash = hashIp(req.ip || '');

    // Check duplicate
    const { data: existing } = await supabase
      .from('submissions')
      .select('id')
      .or(`email.eq.${cleanEmail},ip_hash.eq.${ipHash}`)
      .single();

    if (existing) {
      return res.status(429).json({ error: 'Už ste registrovaný.' });
    }

    const { error } = await supabase
      .from('submissions')
      .insert([
        { 
          email: cleanEmail, phone_prefix: phonePrefix, phone, 
          user_type: userType, consented: true, 
          marketing_consent: !!marketingConsent, ip_hash: ipHash 
        }
      ]);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ error: 'Chyba pri spracovaní.' });
  }
});

// ── AI Pre-screening Logic (Simulated) ──────────────────────────────────────

function calculateAiScore(profile, job) {
  let score = 50; // Base score
  let reasoning = [];

  const textToScan = `${profile.field} ${profile.bio} ${profile.school}`.toLowerCase();
  const searchTerms = `${job.title} ${job.description} ${job.requirements}`.toLowerCase();

  // Keyword Matching (Dummy check)
  const keywords = ['marketing', 'react', 'design', 'student', 'prax', 'stáž', 'intern'];
  keywords.forEach(kw => {
    if (textToScan.includes(kw) && searchTerms.includes(kw)) {
      score += 10;
      reasoning.push(`Zhoda v kľúčovom slove: ${kw}`);
    }
  });

  // School Relevance
  if (textToScan.includes('univerzita') || textToScan.includes('vš')) {
    score += 5;
    reasoning.push('Kandidát je študentom VŠ');
  }

  score = Math.min(score, 100);
  const finalReasoning = reasoning.length > 0 
    ? `Identifikované zhody: ${reasoning.join(', ')}.` 
    : 'Kandidát spĺňa základné požiadavky na pozíciu.';

  return { score, reasoning: finalReasoning };
}

// ── API: Applications & AI Screening ──────────────────────────────────────────

app.post('/api/applications', async (req, res) => {
  const { jobId, studentName, studentEmail, studentProfile } = req.body;

  if (!jobId || !studentName || !studentEmail) {
    return res.status(400).json({ error: 'Chýbajúce údaje o prihláške.' });
  }

  try {
    // 1. Fetch Job Details for AI screening
    const { data: job } = await supabase.from('jobs').select('*').eq('id', jobId).single();
    
    // 2. Run Simulated AI
    const aiResult = calculateAiScore(studentProfile, job);

    // 3. Save Application
    const { error } = await supabase
      .from('applications')
      .insert([{
        job_id: jobId,
        student_name: studentName,
        student_email: studentEmail,
        student_profile: studentProfile,
        ai_score: aiResult.score,
        ai_reasoning: aiResult.reasoning
      }]);

    if (error) throw error;
    res.json({ success: true, aiScore: aiResult.score });
  } catch (err) {
    console.error('Application error:', err);
    res.status(500).json({ error: 'Chyba pri odosielaní prihlášky.' });
  }
});

app.get('/api/applications', async (req, res) => {
  const { company } = req.query; // Auth fallback: Use company name

  try {
    // 1. Get all job IDs for this company
    const { data: jobs } = await supabase.from('jobs').select('id').eq('company', company);
    const jobIds = (jobs || []).map(j => j.id);

    if (jobIds.length === 0) return res.json([]);

    // 2. Fetch applications for these jobs
    const { data: apps, error } = await supabase
      .from('applications')
      .select('*, jobs:job_id(title)')
      .in('job_id', jobIds)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(apps);
  } catch (err) {
    console.error('Fetch apps error:', err);
    res.status(500).json({ error: 'Chyba pri načítaní kandidátov.' });
  }
});

// ── API: Employer Profile & Analytics ──────────────────────────────────────────

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
      return res.json({ name: 'Vaša Firma', industry: 'Hľadáme talenty' });
    }
    res.json(data || { name: 'Vaša Firma', industry: 'Hľadáme talenty' });
  } catch (err) {
    console.error('Employer profile 500 error:', err);
    res.json({ name: 'Vaša Firma', industry: 'Hľadáme talenty' }); // Fallback even on 500
  }
});

app.get('/api/employer/analytics', async (req, res) => {
  const user = await getUserFromToken(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Get employer's company name
    const { data: profile } = await supabase
      .from('employer_profiles')
      .select('name')
      .eq('user_id', user.id)
      .single();

    const companyName = profile?.name || '';

    // Get jobs for this company
    const { data: jobs } = await supabase.from('jobs').select('id').eq('company', companyName);
    const jobIds = (jobs || []).map(j => j.id);

    // Get application stats
    const { data: apps } = await supabase
      .from('applications')
      .select('*')
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
      avg_match_score: allApps.length > 0 ? Math.round(allApps.reduce((s, a) => s + (a.ai_score || 50), 0) / allApps.length) : 0,
      pipeline_stats: pipeline,
      recent_candidates: allApps.slice(0, 5),
      recent_apps_trend: [0, 0, 0, 0, 0, 0, allApps.length]
    });
  } catch (err) {
    console.error('Analytics 500 error:', err);
    res.json({
      total_views: 0,
      total_applications: 0,
      active_jobs: 0,
      avg_match_score: 0,
      pipeline_stats: { Pending: 0, Viewed: 0, Interview: 0, Hired: 0, Rejected: 0 },
      recent_candidates: [],
      recent_apps_trend: [0, 0, 0, 0, 0, 0, 0]
    });
  }
});

// ── API: Auth Proxies ─────────────────────────────────────────────────────────

app.post('/api/auth/student/register', async (req, res) => {
  const { email, password, fullName } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    // We use the admin API to create the user. This bypasses the need for 
    // the user to confirm their email before we can setup their role/profile.
    // It also allows us to manually fix things if the DB triggers fail.
    const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // They still need to verify
      user_metadata: { role: 'candidate', full_name: fullName }
    });

    if (createError) {
      console.error('[AUTH ERROR] Supabase Admin CreateUser failed:', JSON.stringify(createError, null, 2));
      return res.status(createError.status || 500).json({ 
        error: createError.message,
        details: createError.code === 'user_already_exists' ? 'Užívateľ s týmto emailom už existuje.' : createError.message
      });
    }

    // Manual 'Self-Heal': Ensure the role exists even if the trigger failed
    try {
      const { error: roleErr } = await supabase.from('user_roles').upsert({ user_id: user.id, role: 'candidate' });
      if (roleErr) console.error('[DB ERROR] Manual role setup failed:', roleErr);

      const { error: profErr } = await supabase.from('profiles').upsert({ user_id: user.id, first_name: fullName });
      if (profErr) console.error('[DB ERROR] Manual profile setup failed:', profErr);

    } catch (dbErr) {
      console.error('[CRITICAL DB ERROR] Manual self-heal crashed:', dbErr);
    }

    res.json({ success: true, message: 'Check your email for the confirmation link.' });
  } catch (err) {
    console.error('[SERVER CRASH] Registration endpoint failed:', err);
    res.status(500).json({ error: 'Interná chyba servera.', details: err.message });
  }
});

app.post('/api/auth/employer/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email a heslo sú povinné.' });

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Check if the user is actually an employer
    const role = data.user.user_metadata?.role || data.user.app_metadata?.role;
    if (role === 'candidate') {
      return res.status(403).json({ error: 'Tento účet je kandidátsky, nie zamestnávateľský.' });
    }

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
    const { error } = await supabase.from('submissions').insert([
      { 
        email, 
        user_type: 'Zamestnávateľ', 
        company_name: companyName,
        consented: true,
        ip_hash: ipHash
      }
    ]);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Employer inquiry error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── SPA Fallbacks ──────────────────────────────────────────────────────────────
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'apps', 'landing', 'login.html'));
});

app.get('/app(/*)?', (req, res) => {
  res.sendFile(path.join(__dirname, 'apps', 'student', 'dist', 'index.html'));
});

app.get('/employer(/*)?', (req, res) => {
  res.sendFile(path.join(__dirname, 'apps', 'employer', 'dist', 'index.html'));
});

app.get('/student-demo(/*)?', (req, res) => {
  res.sendFile(path.join(__dirname, 'apps', 'student-demo', 'dist', 'index.html'));
});

app.get('/employer-demo(/*)?', (req, res) => {
  res.sendFile(path.join(__dirname, 'apps', 'employer-demo', 'dist', 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`unemployed.sk running on http://localhost:${PORT}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
