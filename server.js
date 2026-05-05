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
    const { first_name, last_name, education, location, skills, job_preferences, cv_id, original_filename } = req.body;
    const upsertData = {
      user_id: user.id,
      email: user.email,
      first_name: first_name || '',
      last_name: last_name || '',
      education: education || '',
      location: location || '',
      skills: skills || [],
      job_preferences: job_preferences || [],
    };
    if (cv_id !== undefined) upsertData.cv_id = cv_id;
    if (original_filename !== undefined) upsertData.original_filename = original_filename;
    const { data, error } = await supabase.from('profiles').upsert(upsertData, { onConflict: 'user_id' }).select().single();
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

// ── CV Signed URL for Employers ─────────────────────────────────────────────
app.get('/api/employer/cv/:cvId/signed-url', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const { cvId } = req.params;
    const { data, error } = await supabase.storage.from('cvs').createSignedUrl(cvId, 3600);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ url: data.signedUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Employer Candidates API (server-side, bypasses RLS) ─────────────────────
app.get('/api/employer/candidates', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // Get employer's job IDs
    const { data: jobs, error: jobsErr } = await supabase
      .from('jobs')
      .select('id')
      .eq('employer_id', user.id);
    if (jobsErr) return res.status(500).json({ error: jobsErr.message });

    const jobIds = (jobs || []).map(j => j.id);
    if (jobIds.length === 0) return res.json({ candidates: [] });

    // Fetch applications for those jobs
    const { data: apps, error: appsErr } = await supabase
      .from('applications')
      .select('*, job:job_id(title, company)')
      .in('job_id', jobIds)
      .order('created_at', { ascending: false });
    if (appsErr) return res.status(500).json({ error: appsErr.message });

    res.json({ candidates: apps || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Employer Update Application Status (server-side, bypasses RLS) ──────────
app.patch('/api/employer/candidates/:id', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const { status, interview_dates } = req.body;
    const updatePayload = {};
    if (status) updatePayload.status = status;
    if (interview_dates) updatePayload.interview_dates = interview_dates;
    const { error } = await supabase
      .from('applications')
      .update(updatePayload)
      .eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Employer Job Update (server-side, bypasses RLS) ─────────────────────────
app.patch('/api/employer/jobs/:id', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const { title, description, requirements, rate, rate_unit, work_model, location, hours, type, duration, start_date, tags } = req.body;
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (requirements !== undefined) updateData.requirements = requirements;
    if (rate !== undefined) updateData.rate = rate;
    if (rate_unit !== undefined) updateData.rate_unit = rate_unit;
    if (work_model !== undefined) updateData.work_model = work_model;
    if (location !== undefined) updateData.location = location;
    if (hours !== undefined) updateData.hours = hours;
    if (type !== undefined) updateData.type = type;
    if (duration !== undefined) updateData.duration = duration;
    if (start_date !== undefined) updateData.start_date = start_date;
    if (tags !== undefined) updateData.tags = tags;
    const { error } = await supabase
      .from('jobs')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('employer_id', user.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CV Upload/Download API (server-side, Supabase Storage) ──────────────────
app.post('/api/cvs/upload', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // Read raw body for file upload
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const body = Buffer.concat(chunks);
        const contentType = req.headers['content-type'] || '';

        // Parse multipart form data manually (simple boundary parser)
        const boundaryMatch = contentType.match(/boundary=(.+)/);
        if (!boundaryMatch) return res.status(400).json({ error: 'Invalid content type, expected multipart/form-data' });

        const boundary = boundaryMatch[1];
        const parts = body.toString('binary').split('--' + boundary);

        let fileBuffer = null;
        let fileName = 'cv.pdf';
        let fileMime = 'application/pdf';

        for (const part of parts) {
          if (part.includes('filename=')) {
            const nameMatch = part.match(/filename="([^"]+)"/);
            if (nameMatch) fileName = nameMatch[1];
            const mimeMatch = part.match(/Content-Type:\s*(.+)\r?\n/);
            if (mimeMatch) fileMime = mimeMatch[1].trim();
            // Extract file content after double newline
            const headerEnd = part.indexOf('\r\n\r\n');
            if (headerEnd !== -1) {
              const fileContent = part.substring(headerEnd + 4).replace(/\r\n$/, '');
              fileBuffer = Buffer.from(fileContent, 'binary');
            }
          }
        }

        if (!fileBuffer) return res.status(400).json({ error: 'No file found in request' });

        // Upload to Supabase Storage
        const storagePath = `${user.id}/${Date.now()}_${fileName}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('cvs')
          .upload(storagePath, fileBuffer, { contentType: fileMime, upsert: false });

        if (uploadErr) {
          console.error('[CV Upload] Storage error:', uploadErr);
          return res.status(500).json({ error: uploadErr.message });
        }

        // Update profile with cv_id
        await supabase.from('profiles')
          .update({ cv_id: storagePath, original_filename: fileName })
          .eq('user_id', user.id);

        res.json({ cv: { id: storagePath, original_filename: fileName, created_at: new Date().toISOString() } });
      } catch (err) {
        console.error('[CV Upload] Parse error:', err);
        res.status(500).json({ error: err.message });
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/cvs', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // Get CV info from profile
    const { data: profile } = await supabase.from('profiles').select('cv_id, original_filename').eq('user_id', user.id).maybeSingle();
    if (!profile || !profile.cv_id) return res.json([]);

    res.json([{ id: profile.cv_id, original_filename: profile.original_filename || 'CV.pdf', created_at: new Date().toISOString() }]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/cvs/download/:cvId(*)', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await supabase.storage.from('cvs').createSignedUrl(req.params.cvId, 3600);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ url: data.signedUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/cvs/:cvId(*)', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    await supabase.storage.from('cvs').remove([req.params.cvId]);
    await supabase.from('profiles').update({ cv_id: null, original_filename: null }).eq('user_id', user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Company Pages API (public) ──────────────────────────────────────────────
app.get('/api/company/:name', async (req, res) => {
  try {
    const companyName = decodeURIComponent(req.params.name);

    // Fetch all jobs by this company
    const { data: jobs, error: jobsErr } = await supabase
      .from('jobs')
      .select('*')
      .ilike('company', companyName)
      .order('created_at', { ascending: false });

    if (jobsErr) throw jobsErr;
    if (!jobs || jobs.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Try to find the employer profile for richer info
    const employerId = jobs[0].employer_id;
    let companyProfile = null;
    if (employerId) {
      const { data: emp } = await supabase
        .from('employers')
        .select('name, description, website, logo_url, cover_url')
        .eq('user_id', employerId)
        .maybeSingle();
      if (emp) companyProfile = emp;
    }

    // Get application counts per job
    const jobIds = jobs.map(j => j.id);
    const { data: apps } = await supabase
      .from('applications')
      .select('job_id')
      .in('job_id', jobIds);

    const appCountByJob = {};
    (apps || []).forEach(a => { appCountByJob[a.job_id] = (appCountByJob[a.job_id] || 0) + 1; });

    // Compute stats
    const totalApps = (apps || []).length;
    const avgMatch = jobs.reduce((sum, j) => sum + (j.match_score || 0), 0) / jobs.length;

    // Parse jobs like the /api/jobs route does
    const parsedJobs = jobs.map(j => ({
      ...j,
      match: j.match_score,
      rateUnit: j.rate_unit,
      startDate: j.start_date,
      workModel: j.work_model,
      applications: appCountByJob[j.id] || 0,
    }));

    res.json({
      company: {
        name: companyProfile?.name || companyName,
        description: companyProfile?.description || '',
        website: companyProfile?.website || '',
        logo_url: companyProfile?.logo_url || '',
        cover_url: companyProfile?.cover_url || '',
        color: jobs[0].color || '#FF5C00',
        logo: jobs[0].logo || companyName.charAt(0).toUpperCase(),
      },
      stats: {
        activeJobs: jobs.length,
        totalApplications: totalApps,
        avgMatchScore: Math.round(avgMatch),
      },
      jobs: parsedJobs,
    });
  } catch (err) {
    console.error('[Company API] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Job View Tracking (server-side) ─────────────────────────────────────────
app.post('/api/job-view', async (req, res) => {
  try {
    const { job_id } = req.body;
    if (!job_id) return res.status(400).json({ error: 'job_id required' });
    // Try to increment views column directly
    const { data: job } = await supabase.from('jobs').select('views').eq('id', job_id).single();
    await supabase.from('jobs').update({ views: (job?.views || 0) + 1 }).eq('id', job_id);
    res.json({ ok: true });
  } catch {
    res.json({ ok: true }); // Non-fatal, don't break the UI
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

    if (!job_id) return res.status(400).json({ error: 'job_id is required' });

    // Try full insert first
    const insertData = {
      job_id,
      student_name: student_name || user.email,
      student_email: user.email,
      status: 'Pending',
    };

    // Optionally add columns that may or may not exist
    // We try with all columns, then fall back to minimal if it fails
    const fullInsert = {
      ...insertData,
      student_profile: student_profile || {},
      ai_score: ai_score || 50,
      ai_reasoning: ai_reasoning || 'Submitted via Unemployed.sk',
      candidate_id: user.id,
    };

    let { data, error } = await supabase.from('applications').insert([fullInsert]).select().single();

    // If full insert fails (missing columns), try minimal insert
    if (error) {
      console.warn('[POST /api/applications] Full insert failed:', error.message, '— trying minimal insert');
      const minResult = await supabase.from('applications').insert([insertData]).select().single();
      data = minResult.data;
      error = minResult.error;
    }

    if (error) {
      console.error('[POST /api/applications] Insert failed:', error);
      if (error.code === '23505') return res.status(409).json({ error: 'Already applied' });
      return res.status(400).json({ error: error.message, details: error.details, hint: error.hint });
    }

    console.log('[POST /api/applications] Success:', data?.id, 'for job', job_id);
    res.json({ application: data });
  } catch (err) {
    console.error('[POST /api/applications] Exception:', err);
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
