'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const { createHash } = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// ══════════════════════════════════════════════════════════════════════════════
// ██████████████████████████████████████████████████████████████████████████████
// ██                                                                        ██
// ██  ⚠️  CRITICAL DISCLAIMER — DO NOT REMOVE SUPABASE FROM THIS FILE  ⚠️    ██
// ██                                                                        ██
// ██  This server.js is the BACKBONE of user acquisition for unemployed.sk.  ██
// ██  The /api/submit route (in routes/auth.js) saves email + phone number   ██
// ██  submissions from the landing page signup form DIRECTLY to Supabase.    ██
// ██                                                                        ██
// ██  ANY future code changes, refactors, or SQL migrations MUST preserve   ██
// ██  the Supabase connection below AND the /api/submit endpoint.            ██
// ██  DO NOT disconnect, remove, or bypass this Supabase integration.        ██
// ██  Losing landing page signups = losing real users = losing the company.  ██
// ██                                                                        ██
// ██████████████████████████████████████████████████████████████████████████████
// ══════════════════════════════════════════════════════════════════════════════

// ── Supabase (Server-Side — uses SERVICE ROLE KEY to bypass RLS) ────────────
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ── Shared Helpers ─────────────────────────────────────────────────────────────
function hashIp(ip) {
  return createHash('sha256').update(ip || '').digest('hex');
}

async function getUserFromToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.replace('Bearer ', '');
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch { return null; }
}

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
  if (entry.count >= MAX_PER_WINDOW)
    return res.status(429).json({ error: 'Príliš veľa požiadaviek. Skúste to neskôr.' });
  entry.count += 1;
  next();
}

const VALID_TYPES = new Set(['Stredoškolák', 'Vysokoškolák', 'Absolvent', 'Zamestnávateľ']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: false, limit: '16kb' }));
app.set('trust proxy', 1);

// Block sensitive file access
app.use((req, res, next) => {
  const blocked = /\/(server\.js|database\.db|unemployed\.db|package\.json|package-lock\.json|node_modules|\.env|submissions\.db.*|\.claude)(\/|$)/i;
  if (blocked.test(req.path)) return res.status(404).end();
  next();
});

// Content Security Policy + CORS headers
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
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// ── Static File Serving (order matters — demos before landing page) ──────────
app.use('/app',          express.static(path.join(__dirname, 'apps', 'student',      'dist')));
app.use('/employer',     express.static(path.join(__dirname, 'apps', 'employer',     'dist')));
app.use('/student-demo', express.static(path.join(__dirname, 'apps', 'student-demo', 'dist')));
app.use('/employer-demo',express.static(path.join(__dirname, 'apps', 'employer-demo','dist')));
app.use(express.static(path.join(__dirname, 'apps', 'landing')));

// ── Route Modules ──────────────────────────────────────────────────────────────
require('./routes/jobs')(app, supabase);
require('./routes/auth')(app, supabase, { hashIp, getUserFromToken, rateLimit, VALID_TYPES, EMAIL_RE });

// ── Employer Profile API (server-side, bypasses RLS) ──────────────────────────
app.post('/api/employer/ensure-profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No auth token' });
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });
    
    const { name, description, website } = req.body;
    
    // Upsert employer row — service key bypasses RLS
    const { data, error } = await supabase.from('employers').upsert({
      id: user.id,
      name: name || user.email?.split('@')[0] || 'Firma',
      description: description || null,
      website: website || null,
    }, { onConflict: 'id' }).select().single();
    
    if (error) return res.status(500).json({ error: error.message });
    res.json({ profile: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/employer/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No auth token' });
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });
    
    const { data, error } = await supabase.from('employers').select('*').eq('id', user.id).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ profile: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ── Student Profile API (server-side, bypasses RLS) ───────────────────────────
app.post('/api/student/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No auth token' });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });
    const { first_name, last_name, education, location, skills, job_preferences } = req.body;
    const { data, error } = await supabase.from('profiles').upsert({
      user_id: user.id,
      first_name: first_name || '',
      last_name: last_name || '',
      education: education || '',
      location: location || '',
      skills: skills || [],
      job_preferences: job_preferences || [],
    }, { onConflict: 'user_id' }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ profile: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/student/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No auth token' });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });
    const { data, error } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ profile: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/applications', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No auth token' });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });
    const { job_id, student_name, student_profile, ai_score, ai_reasoning } = req.body;
    const { data, error } = await supabase.from('applications').insert([{
      job_id,
      student_name: student_name || user.email,
      student_email: user.email,
      student_profile: student_profile || {},
      status: 'Pending',
      ai_score: ai_score || 50,
      ai_reasoning: ai_reasoning || 'Submitted via Unemployed.sk',
      candidate_id: user.id,
    }]).select().single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Already applied' });
      return res.status(500).json({ error: error.message });
    }
    res.json({ application: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/applications', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No auth token' });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });
    const { data, error } = await supabase
      .from('applications')
      .select('*, job:job_id(*)')
      .eq('student_email', user.email)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ applications: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/applications/:id', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No auth token' });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });
    const { status } = req.body;
    const { error } = await supabase
      .from('applications')
      .update({ status })
      .eq('id', req.params.id)
      .eq('student_email', user.email);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SPA Fallbacks ──────────────────────────────────────────────────────────────
const distBase = __dirname;
app.get('/login',               (req, res) => res.sendFile(path.join(distBase, 'apps', 'landing',      'login.html')));
app.get('/app(/*)?',            (req, res) => res.sendFile(path.join(distBase, 'apps', 'student',      'dist', 'index.html')));
app.get('/employer(/*)?',       (req, res) => res.sendFile(path.join(distBase, 'apps', 'employer',     'dist', 'index.html')));
app.get('/student-demo(/*)?',   (req, res) => res.sendFile(path.join(distBase, 'apps', 'student-demo', 'dist', 'index.html')));
app.get('/employer-demo(/*)?',  (req, res) => res.sendFile(path.join(distBase, 'apps', 'employer-demo','dist', 'index.html')));

// ── Start ──────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`unemployed.sk running on http://localhost:${PORT}`);
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT',  () => server.close(() => process.exit(0)));
