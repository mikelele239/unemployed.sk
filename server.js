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

// Content Security Policy for Framer Motion and Leaflet
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: https:; connect-src 'self' https://jofrxyimqhbgxwwbqyvs.supabase.co;"
  );
  next();
});

app.use(express.static(path.join(__dirname, 'website')));
app.use('/app', express.static(path.join(__dirname, 'employee', 'dist')));
app.use('/employer', express.static(path.join(__dirname, 'employer', 'dist')));


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
    const jobIds = jobs.map(j => j.id);

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

// SPA Fallback for /app
app.get('/app/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'employee', 'dist', 'index.html'));
});

// SPA Fallback for /employer
app.get('/employer/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'employer', 'dist', 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`unemployed.sk running on http://localhost:${PORT}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
