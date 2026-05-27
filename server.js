'use strict';

if (!process.env.NETLIFY) require('dotenv').config();
const IS_SERVERLESS = !!process.env.NETLIFY || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const express = require('express');
const path = require('path');
const { createHash } = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');

const app = express();

// ── Multer config for CV file uploads (memory storage) ──────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    const ok = name.endsWith('.pdf') || name.endsWith('.doc') || name.endsWith('.docx')
      || mime.includes('pdf') || mime.includes('msword') || mime.includes('wordprocessingml');
    cb(null, ok);
  },
});
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
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  if (!IS_SERVERLESS) { console.error('❌ Missing Supabase credentials in .env file'); process.exit(1); }
  else console.warn('⚠️ Supabase credentials missing — some endpoints may fail');
}
const supabase = createClient(supabaseUrl || '', supabaseServiceKey || '');

let useDedicatedMessagesTable = false;
let lastDetectTime = 0;

async function checkUseDedicatedMessagesTable() {
  const now = Date.now();
  if (now - lastDetectTime < 10000) { // cache detection for 10 seconds
    return useDedicatedMessagesTable;
  }
  try {
    const { error } = await supabase.from('application_messages').select('id').limit(1);
    useDedicatedMessagesTable = !error;
    lastDetectTime = now;
  } catch (err) {
    useDedicatedMessagesTable = false;
    lastDetectTime = now;
  }
  return useDedicatedMessagesTable;
}

async function getConversationActivity(appId, userId, appCreatedAt) {
  const hasDedicated = await checkUseDedicatedMessagesTable();
  let latestMsg = null;
  let unreadCount = 0;
  let updatedAt = appCreatedAt;

  if (hasDedicated) {
    const { data: dbMsgs } = await supabase
      .from('application_messages')
      .select('*')
      .eq('application_id', appId)
      .order('created_at', { ascending: false });

    unreadCount = (dbMsgs || []).filter(m => m.sender_id !== userId && !m.read_at).length;
    if (dbMsgs && dbMsgs.length > 0) {
      const m = dbMsgs[0];
      latestMsg = {
        id: m.id,
        body: m.body,
        message_type: m.message_type,
        created_at: m.created_at
      };
      updatedAt = m.created_at;
    } else {
      latestMsg = {
        id: 'initial-' + appId,
        body: 'Prihláška odoslaná.',
        message_type: 'system',
        created_at: appCreatedAt
      };
    }
  } else {
    const { data: notifs } = await supabase
      .from('notifications')
      .select('*')
      .eq('related_entity_id', appId)
      .order('created_at', { ascending: false });

    unreadCount = (notifs || []).filter(n => n.user_id === userId && !n.read).length;
    if (notifs && notifs.length > 0) {
      const n = notifs[0];
      latestMsg = {
        id: n.id,
        body: n.message || n.title,
        message_type: n.type === 'general' ? 'text' : 'system',
        created_at: n.created_at
      };
      updatedAt = n.created_at;
    } else {
      latestMsg = {
        id: 'initial-' + appId,
        body: 'Prihláška odoslaná.',
        message_type: 'system',
        created_at: appCreatedAt
      };
    }
  }

  return { latestMsg, unreadCount, updatedAt };
}

// ── Shared Helpers ─────────────────────────────────────────────────────────────
function hashIp(ip) {
  return createHash('sha256').update(ip || '').digest('hex');
}

function decodeJwtFallback(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    if (!payload || !payload.sub) return null;

    // Check expiration if exp claim is present
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSec) {
      console.warn('[decodeJwtFallback] Offline JWT decode fallback: Token has expired');
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role || 'authenticated',
      aud: payload.aud,
      app_metadata: payload.app_metadata || {},
      user_metadata: payload.user_metadata || {},
      is_fallback: true
    };
  } catch (err) {
    console.error('[decodeJwtFallback] Offline JWT decode failed:', err.message);
    return null;
  }
}

async function getUserFromToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.replace('Bearer ', '');

  try {
    // Race the Supabase call against a 3-second timeout
    const result = await Promise.race([
      supabase.auth.getUser(token),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Auth timeout')), 3000))
    ]);
    const { data: { user }, error } = result;
    if (error || !user) return null;
    return user;
  } catch (err) {
    console.error('[getUserFromToken] Auth verification failed:', err.message);
    
    // Check if error is network/connection/timeout related
    const isNetworkError = 
      err.message === 'Auth timeout' ||
      (err.code && (err.code === 'ENOTFOUND' || err.code === 'UND_ERR_CONNECT_TIMEOUT' || err.code === 'ECONNRESET')) ||
      err.message.includes('fetch failed') ||
      err.message.includes('network') ||
      err.message.includes('connect') ||
      err.message.includes('timeout') ||
      err.message.includes('ECONNRESET');

    if (isNetworkError) {
      console.warn('[getUserFromToken] Using offline JWT decode fallback due to connection/timeout error:', err.message);
      const decoded = decodeJwtFallback(token);
      if (decoded) {
        return decoded;
      }
    }
    return null;
  }
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
    // Periodically prune expired entries (amortized cleanup to prevent memory exhaustion)
    if (rateMap.size > 1000) {
      for (const [key, value] of rateMap.entries()) {
        if (now > value.resetAt) {
          rateMap.delete(key);
        }
      }
    }
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
// JSON body parser — skip for multipart file upload routes
app.use((req, res, next) => {
  if (req.path === '/api/cvs/upload' || req.path === '/api/employer/logo-upload') return next();
  express.json({ limit: '16kb' })(req, res, next);
});
app.use((req, res, next) => {
  if (req.path === '/api/cvs/upload' || req.path === '/api/employer/logo-upload') return next();
  express.urlencoded({ extended: false, limit: '16kb' })(req, res, next);
});
app.set('trust proxy', 1);


// Block sensitive file access
app.use((req, res, next) => {
  const blocked = /\/(server\.js|database\.db|unemployed\.db|package\.json|package-lock\.json|node_modules|\.env|submissions\.db.*|\.claude)(\/|$)/i;
  if (blocked.test(req.path)) return res.status(404).end();
  next();
});

// Security headers
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' https://*.supabase.co; " +
    "frame-src 'self' https://*.supabase.co blob: data:; " +
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://nominatim.openstreetmap.org; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: blob: https: https://*.supabase.co;"
  );
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // CORS — restrict to same origin in production
  const origin = req.headers.origin;
  if (origin && (origin.includes('unemployed.sk') || origin.includes('localhost'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// ── Static File Serving (order matters — demos before landing page) ──────────
if (!IS_SERVERLESS) {
  app.use('/app',          express.static(path.join(__dirname, 'apps', 'student',      'dist')));
  app.use('/employer',     express.static(path.join(__dirname, 'apps', 'employer',     'dist')));
  app.use('/student-demo', express.static(path.join(__dirname, 'apps', 'student-demo', 'dist')));
  app.use('/employer-demo',express.static(path.join(__dirname, 'apps', 'employer-demo','dist')));
  app.use(express.static(path.join(__dirname, 'apps', 'landing')));
}

// ── Route Modules ──────────────────────────────────────────────────────────────
require('./routes/jobs')(app, supabase, { getUserFromToken });
require('./routes/auth')(app, supabase, { hashIp, getUserFromToken, rateLimit, VALID_TYPES, EMAIL_RE });
require('./routes/ai-matching')(app, supabase, { getUserFromToken });
require('./routes/ai-verification')(app, supabase, { getUserFromToken });

// ── Employer Profile API (server-side, bypasses RLS) ──────────────────────────
app.post('/api/employer/ensure-profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No auth token' });
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });
    
    const { name, description, website, location } = req.body;
    
    // Upsert employer row — service key bypasses RLS
    const { data, error } = await supabase.from('employers').upsert({
      id: user.id,
      name: name || user.email?.split('@')[0] || 'Firma',
      description: description || null,
      website: website || null,
      location: location || null,
    }, { onConflict: 'id' }).select().single();
    
    if (error) return res.status(500).json({ error: error.message });
    res.json({ profile: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Employer Logo Upload (server-side, bypasses RLS) ────────────────────────
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    const ok = mime.startsWith('image/');
    cb(null, ok);
  },
});

app.post('/api/employer/logo-upload', logoUpload.single('logo'), async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({ error: 'No image file found in request' });
    }

    const uid = user.id;
    const ext = (file.originalname || 'logo.png').split('.').pop() || 'png';

    // Remove old logo files from storage
    try {
      const { data: existingFiles } = await supabase.storage.from('cvs').list(uid, { limit: 50 });
      const oldLogos = (existingFiles || []).filter(f => f.name.toLowerCase().startsWith('logo.'));
      if (oldLogos.length > 0) {
        await supabase.storage.from('cvs').remove(oldLogos.map(f => `${uid}/${f.name}`));
      }
    } catch (cleanErr) {
      console.warn('[Logo Upload] Cleanup non-fatal:', cleanErr.message);
    }

    // Upload new logo
    const storagePath = `${uid}/logo.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from('cvs')
      .upload(storagePath, file.buffer, { upsert: true, contentType: file.mimetype });

    if (uploadErr) {
      console.error('[Logo Upload] Storage error:', uploadErr);
      return res.status(500).json({ error: uploadErr.message });
    }

    // Create a long-lived signed URL (1 year)
    const { data: signedData, error: signErr } = await supabase.storage
      .from('cvs')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

    if (signErr) {
      console.error('[Logo Upload] Signed URL error:', signErr);
      return res.status(500).json({ error: signErr.message });
    }

    const logoUrl = signedData?.signedUrl || '';

    // Update the employers table
    const { error: dbErr } = await supabase
      .from('employers')
      .update({ logo_url: logoUrl })
      .eq('id', uid);

    if (dbErr) {
      console.error('[Logo Upload] DB update error:', dbErr);
      return res.status(500).json({ error: dbErr.message });
    }

    console.log('[Logo Upload] ✅ Logo updated for employer:', uid);
    res.json({ logo_url: logoUrl });
  } catch (err) {
    console.error('[Logo Upload] Critical error:', err);
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
    const { 
      first_name, last_name, education, location, skills, job_preferences, cv_id, original_filename, avatar_url,
      work_model_preference, languages_spoken, availability_hours, salary_expectation 
    } = req.body;

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
    if (avatar_url !== undefined) upsertData.avatar_url = avatar_url;
    
    // Save to standard profiles
    const { data, error } = await supabase.from('profiles').upsert(upsertData, { onConflict: 'user_id' }).select().single();
    if (error) return res.status(500).json({ error: error.message });

    // Parse and map fields for ai_profiles table
    let eduLevel = 'unknown';
    if (education) {
      const eduLower = education.toLowerCase();
      if (eduLower.includes('stredn') || eduLower.includes('high')) {
        eduLevel = 'high_school';
      } else if (eduLower.includes('vysok') || eduLower.includes('university') || eduLower.includes('bachelor')) {
        eduLevel = 'bachelors';
      } else if (eduLower.includes('absolvent') || eduLower.includes('graduate') || eduLower.includes('master')) {
        eduLevel = 'masters';
      }
    }

    let dbWorkModel = null;
    if (work_model_preference) {
      const wmLower = work_model_preference.toLowerCase();
      if (wmLower.includes('remote')) dbWorkModel = 'remote';
      else if (wmLower.includes('hybrid')) dbWorkModel = 'hybrid';
      else if (wmLower.includes('site') || wmLower.includes('mieste')) dbWorkModel = 'on-site';
    }

    let preferredJobTypes = [];
    if (Array.isArray(job_preferences)) {
      preferredJobTypes = job_preferences.map(pref => {
        const pLower = pref.toLowerCase();
        if (pLower.includes('brigád') || pLower.includes('part')) return 'part-time';
        if (pLower.includes('stáž') || pLower.includes('intern')) return 'internship';
        if (pLower.includes('pln') || pLower.includes('full')) return 'full-time';
        return null;
      }).filter(Boolean);
    }

    let dbLanguages = [];
    if (Array.isArray(languages_spoken)) {
      dbLanguages = languages_spoken.map(langName => ({
        lang: langName,
        level: langName === 'Slovenčina' || langName === 'Čeština' ? 'native' : 'professional'
      }));
    }

    const aiProfileUpsert = {
      user_id: user.id,
      full_name: `${first_name || ''} ${last_name || ''}`.trim() || user.email,
      email: user.email,
      location: location || '',
      hard_skills: skills || [],
      education_level: eduLevel,
      preferred_job_types: preferredJobTypes,
      preferred_work_models: dbWorkModel ? [dbWorkModel] : [],
      work_mode_preference: dbWorkModel,
      languages: dbLanguages,
      availability_hours: availability_hours ? parseInt(availability_hours) : null,
      salary_expectation: salary_expectation ? parseInt(salary_expectation) : null,
      parse_status: 'ready',
      extraction_source: 'manual',
      updated_at: new Date().toISOString(),
    };

    // Upsert into ai_profiles
    const { error: aiErr } = await supabase.from('ai_profiles').upsert(aiProfileUpsert, { onConflict: 'user_id' });
    if (aiErr) {
      console.error('[Student Profile API] Error upserting ai_profile:', aiErr.message);
    }

    // Recalculate matching scores immediately
    try {
      const aiMatchingModule = require('./routes/ai-matching');
      if (aiMatchingModule.helpers && typeof aiMatchingModule.helpers.recalculateForStudent === 'function') {
        const matchCount = await aiMatchingModule.helpers.recalculateForStudent(user.id);
        console.log('[Student Profile API] Match scores recalculated for student:', user.id, 'Count:', matchCount);
      }
    } catch (matchErr) {
      console.warn('[Student Profile API] Match recalc error:', matchErr.message);
    }

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
    const candidateId = cvId.split('/')[0];

    let isAuthorized = false;
    if (candidateId === user.id) {
      isAuthorized = true;
    } else {
      // Get the employer's jobs to verify applicants
      const { data: jobs } = await supabase.from('jobs').select('id').eq('employer_id', user.id);
      const jobIds = (jobs || []).map(j => j.id);

      if (jobIds.length > 0) {
        const { data: appData } = await supabase
          .from('applications')
          .select('id')
          .eq('candidate_id', candidateId)
          .or(`employer_id.eq.${user.id},job_id.in.(${jobIds.join(',')})`)
          .limit(1)
          .maybeSingle();
        if (appData) isAuthorized = true;
      } else {
        const { data: appData } = await supabase
          .from('applications')
          .select('id')
          .eq('candidate_id', candidateId)
          .eq('employer_id', user.id)
          .limit(1)
          .maybeSingle();
        if (appData) isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Unauthorized: You do not have access to this candidate\'s CV.' });
    }

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

    // Enrich with profile data for each candidate
    const candidateIds = [...new Set((apps || []).map(a => a.candidate_id).filter(Boolean))];
    let profilesMap = {};
    if (candidateIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, education, location, skills, cv_id, original_filename, bio, avatar_url')
        .in('user_id', candidateIds);
      (profiles || []).forEach(p => { profilesMap[p.user_id] = p; });
    }

    // Merge profile data into each application
    const enrichedCandidates = (apps || []).map(app => {
      const profile = profilesMap[app.candidate_id] || {};
      return {
        ...app,
        // Override student_name with real profile name if available
        student_name: (profile.first_name || profile.last_name)
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
          : app.student_name,
        // Attach full profile for employer UI
        student_profile: {
          ...(app.student_profile || {}),
          ...profile,
        },
      };
    });

    res.json({ candidates: enrichedCandidates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to create notifications and insert system messages into chat
async function createSystemMessageAndNotification({ appId, recipientId, type, title, message, statusChangeValue }) {
  // 1. Insert into notifications
  try {
    await supabase.from('notifications').insert({
      user_id: recipientId,
      type: type || 'general',
      title: title,
      message: message,
      related_entity_id: appId,
      read: false
    });
  } catch (err) {
    console.warn('[createSystemMessageAndNotification] Warning: failed to insert notification bell:', err.message);
  }

  // 2. Insert into application_messages if table exists
  try {
    const hasDedicated = await checkUseDedicatedMessagesTable();
    if (hasDedicated) {
      await supabase.from('application_messages').insert({
        application_id: appId,
        sender_id: null, // NULL represents a system sender
        body: message,
        message_type: statusChangeValue === 'Interview' ? 'interview_invite' : 'system',
        metadata: {
          status: statusChangeValue,
          title: title
        }
      });
    }
  } catch (err) {
    console.warn('[createSystemMessageAndNotification] Warning: failed to insert system chat message:', err.message);
  }
}

// ── Employer Update Application Status (server-side, bypasses RLS) ──────────
app.patch('/api/employer/candidates/:id', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // Verify ownership of this candidate application
    const { data: appData, error: appErr } = await supabase
      .from('applications')
      .select('employer_id, job_id, candidate_id, student_name')
      .eq('id', req.params.id)
      .maybeSingle();

    if (appErr || !appData) {
      return res.status(404).json({ error: 'Application not found' });
    }

    let isAuthorized = false;
    if (appData.employer_id) {
      isAuthorized = (appData.employer_id === user.id);
    } else if (appData.job_id) {
      const { data: jobData } = await supabase
        .from('jobs')
        .select('employer_id')
        .eq('id', appData.job_id)
        .maybeSingle();
      isAuthorized = (jobData && jobData.employer_id === user.id);
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Unauthorized: This candidate application does not belong to your job postings.' });
    }

    const { status, interview_dates, selected_date } = req.body;
    const updatePayload = {};
    if (status) updatePayload.status = status;
    if (interview_dates) updatePayload.interview_dates = interview_dates;
    if (selected_date !== undefined) updatePayload.selected_date = selected_date;

    const { error } = await supabase
      .from('applications')
      .update(updatePayload)
      .eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });

    // Trigger Notification and System message
    if (status && appData.candidate_id) {
      // Get Job Title and Employer Name for rich notifications
      const { data: job } = await supabase.from('jobs').select('title, company').eq('id', appData.job_id).maybeSingle();
      const employerName = job?.company || 'Zamestnávateľ';
      const jobTitle = job?.title || 'Pracovná pozícia';

      const statusLabels = {
        'Viewed': 'Zobrazená',
        'Interview': 'Pozvánka na pohovor',
        'Interview-Confirmed': 'Potvrdený termín pohovoru',
        'Hired': 'Prijatý/á! 🎉',
        'Rejected': 'Ukončený výberový proces',
      };

      const label = statusLabels[status] || status;
      let msgText = `Stav tvojej prihlášky na pozíciu "${jobTitle}" bol zmenený na: ${label}`;
      let notificationType = 'general';

      if (status === 'Interview') {
        msgText = `Firma ${employerName} ti navrhla termíny pre pohovor na pozíciu "${jobTitle}".`;
        notificationType = 'interview_scheduled';
      } else if (status === 'Interview-Confirmed') {
        const dateVal = selected_date || updatePayload.selected_date;
        const dateStr = dateVal ? new Date(dateVal).toLocaleString('sk-SK', { dateStyle: 'short', timeStyle: 'short' }) : '';
        msgText = `Firma ${employerName} potvrdila termín pohovoru na pozíciu "${jobTitle}" dňa: ${dateStr}.`;
        notificationType = 'interview_confirmed';
      } else if (status === 'Hired') {
        msgText = `Gratulujeme! Firma ${employerName} ťa úspešne prijala na pozíciu "${jobTitle}"! 🎉`;
        notificationType = 'hired';
      } else if (status === 'Rejected') {
        msgText = `Ďakujeme za tvoj čas a úsilie. Firma ${employerName} sa rozhodla v tomto výberovom konaní nepokračovať.`;
        notificationType = 'rejected';
      } else if (status === 'Viewed') {
        msgText = `Firma ${employerName} si prezrela tvoju prihlášku na pozíciu "${jobTitle}".`;
        notificationType = 'status_update';
      }

      await createSystemMessageAndNotification({
        appId: req.params.id,
        recipientId: appData.candidate_id,
        type: notificationType,
        title: status === 'Interview' ? 'Pozvánka na pohovor' : `Aktualizácia stavu: ${label}`,
        message: msgText,
        statusChangeValue: status
      });
    }

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
    const { title, description, requirements, rate, rate_unit, work_model, location, hours, type, duration, start_date, tags, status } = req.body;
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
    if (status !== undefined) updateData.status = status;
    let { error } = await supabase
      .from('jobs')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('employer_id', user.id);
    // If status column doesn't exist yet, retry without it
    if (error && error.message && error.message.includes('status') && updateData.status !== undefined) {
      console.warn('[Jobs PATCH] status column not found, retrying without status field');
      delete updateData.status;
      if (Object.keys(updateData).length > 0) {
        const retry = await supabase.from('jobs').update(updateData).eq('id', req.params.id).eq('employer_id', user.id);
        error = retry.error;
      } else {
        error = null;
      }
    }
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CV Upload/Download API (server-side, Supabase Storage) ──────────────────
// NOTE: This endpoint is split into two phases to avoid Netlify's 10s serverless
// timeout (which caused 502 errors). Phase 1 (fast) uploads the file and returns
// immediately. Phase 2 (async) does AI parsing + match recalculation in the background.
app.post('/api/cvs/upload', upload.single('file'), async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // multer parsed the file — check it exists
    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({ error: 'No file found in request' });
    }

    const fileBuffer = file.buffer;
    const fileName = file.originalname || 'cv.pdf';
    const fileMime = file.mimetype || 'application/octet-stream';
    const lowerName = fileName.toLowerCase();

    console.log('[CV Upload] Received file:', fileName, '| Size:', fileBuffer.length, '| MIME:', fileMime, '| User:', user.id);

    const isPdf = fileMime.includes('pdf') || lowerName.endsWith('.pdf');
    const isDocx = fileMime.includes('wordprocessingml') || lowerName.endsWith('.docx');
    const isDoc = fileMime.includes('msword') || lowerName.endsWith('.doc');
    if (!isPdf && !isDocx && !isDoc) {
      return res.status(400).json({ error: 'Only PDF and DOC/DOCX files are accepted' });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 1 — FAST: Upload to storage + update profile (must finish < 10s)
    // ═══════════════════════════════════════════════════════════════════════════

    const storagePath = `${user.id}/${Date.now()}_${fileName}`;
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('cvs')
      .upload(storagePath, fileBuffer, { contentType: fileMime, upsert: false });

    if (uploadErr) {
      console.error('[CV Upload] Storage error:', uploadErr);
      return res.status(500).json({ error: uploadErr.message });
    }

    console.log('[CV Upload] File stored at:', storagePath);

    // Upsert profile with cv_id (creates row for new users who don't have one yet)
    await supabase.from('profiles')
      .upsert({
        user_id: user.id,
        email: user.email,
        cv_id: storagePath,
        original_filename: fileName,
      }, { onConflict: 'user_id' });

    // ═══════════════════════════════════════════════════════════════════════════
    // RESPOND IMMEDIATELY — don't make the client wait for AI parsing
    // ═══════════════════════════════════════════════════════════════════════════
    res.json({
      cv: { id: storagePath, original_filename: fileName, created_at: new Date().toISOString() },
      ai_profile: null,
      parse_status: 'processing',
      warnings: [],
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 2 — ASYNC: Text extraction + AI parsing + match recalc (background)
    // This runs fire-and-forget after the response has been sent.
    // The frontend will re-fetch the AI profile after a short delay.
    // ═══════════════════════════════════════════════════════════════════════════
    (async () => {
      try {
        const { PDFParse } = require('pdf-parse');
        const mammoth = require('mammoth');

        async function extractPdfText(buffer) {
          const parser = new PDFParse({ data: buffer });
          const result = await parser.getText();
          await parser.destroy().catch(() => {});
          return (result.text || '').trim();
        }

        // ── Text extraction (PDF or DOCX) ──
        let rawText = '';
        let extractionWarnings = [];

        try {
          if (isPdf) {
            rawText = await extractPdfText(fileBuffer);
            if (!rawText || rawText.length < 20) {
              extractionWarnings.push('PDF contains too little text — may be scanned/image-based');
            }
          } else if (isDocx) {
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            rawText = (result.value || '').trim();
            if (result.messages && result.messages.length > 0) {
              console.warn('[CV Upload BG] DOCX parse warnings:', result.messages.map(m => m.message).join('; '));
            }
            if (!rawText || rawText.length < 20) {
              extractionWarnings.push('DOCX contains too little text — check file contents');
            }
          } else if (isDoc) {
            try {
              const result = await mammoth.extractRawText({ buffer: fileBuffer });
              rawText = (result.value || '').trim();
            } catch (docErr) {
              extractionWarnings.push('Legacy .doc format — text extraction limited.');
              console.warn('[CV Upload BG] .doc extraction failed:', docErr.message);
            }
          }
        } catch (extractErr) {
          console.error('[CV Upload BG] Text extraction error:', extractErr.message);
          extractionWarnings.push('Text extraction failed: ' + extractErr.message);
        }

        console.log('[CV Upload BG] Extracted text length:', rawText.length, '| Warnings:', extractionWarnings.length);

        // ── AI Profile Extraction (GPT-4o-mini with fallback) ──
        let parseStatus = 'failed';

        if (rawText.length >= 50) {
          try {
            const { data: profile } = await supabase.from('profiles')
              .select('first_name, last_name, location, skills')
              .eq('user_id', user.id).maybeSingle();

            const existingData = {
              full_name: `${profile?.first_name||''} ${profile?.last_name||''}`.trim() || null,
              email: user.email,
              location: profile?.location,
              skills: profile?.skills,
            };

            const { parseWithAI } = require('./lib/ai-cv-parser');
            const { calculateProfileCompletion } = require('./lib/matching-engine');
            const parsed = await parseWithAI(rawText, existingData, user.id);

            if (parsed.hard_skills.length === 0 && (profile?.skills||[]).length > 0) {
              parsed.hard_skills = profile.skills;
            }

            parseStatus = parsed.confidence_score >= 0.5 ? 'ready' : 'needs_review';

            const VALID_EXP_LEVELS = ['no_experience', 'beginner', 'entry', 'junior', 'mid', 'experienced', 'senior', 'unknown'];
            let dbExpLevel = parsed.experience_level || 'unknown';
            if (!VALID_EXP_LEVELS.includes(dbExpLevel)) {
              console.warn('[CV Upload BG] Invalid experience_level "' + dbExpLevel + '" — mapping to "beginner"');
              dbExpLevel = 'beginner';
            }

            console.log('[CV Upload BG] AI parse done. Source:', parsed._source, '| Skills:', (parsed.hard_skills||[]).length, '| Confidence:', parsed.confidence_score);

            const aiData = {
              user_id: user.id,
              full_name: parsed.full_name,
              email: parsed.email || user.email,
              phone: parsed.phone,
              location: parsed.location,
              hard_skills: parsed.hard_skills,
              soft_skills: parsed.soft_skills,
              languages: parsed.languages,
              experience_years: parsed.experience_years,
              education_level: parsed.education_level,
              education_field: parsed.education_field,
              education_school: parsed.education_school,
              certifications: parsed.certifications || [],
              preferred_locations: parsed.preferred_work_locations || (parsed.location ? [parsed.location] : []),
              preferred_job_types: parsed.preferred_job_types || [],
              preferred_work_models: parsed.preferred_work_models || [],
              preferred_categories: parsed.preferred_categories || [],
              work_mode_preference: parsed.work_mode_preference || null,
              availability_hours: parsed.availability_hours_per_week || null,
              salary_expectation: parsed.salary_expectation || null,
              portfolio_links: parsed.portfolio_links || [],
              work_experience: parsed.work_experience || [],
              parse_status: parseStatus,
              extraction_source: parsed._source === 'openai' ? 'ai_llm' : 'cv_parse',
              extraction_version: '3.0',
              raw_cv_text: rawText.substring(0, 50000),
              confidence_score: parsed.confidence_score,
              ai_headline: parsed.ai_headline,
              ai_summary: parsed.ai_summary,
              ai_portfolio_intro: parsed.ai_portfolio_intro,
              ai_strengths: parsed.ai_strengths,
              ai_development_areas: parsed.ai_development_areas,
              ai_suggested_roles: parsed.ai_suggested_roles,
              ai_suggested_categories: parsed.ai_suggested_categories,
              ai_missing_fields: parsed.ai_missing_fields || [],
              ai_profile_quality_notes: parsed.ai_profile_quality_notes || [],
              ai_normalized_skills: parsed.ai_normalized_skills || parsed.hard_skills,
              experience_level: dbExpLevel,
              ai_profile_approved: false,
              ai_generated_at: new Date().toISOString(),
              profile_completion_score: parsed._profile_completion_score || 0,
              updated_at: new Date().toISOString(),
            };

            const completion = calculateProfileCompletion(aiData);
            aiData.profile_completion_score = Math.max(aiData.profile_completion_score, completion.score);

            console.log('[CV Upload BG] Saving to ai_profiles for user:', user.id);
            const { data: aiProfile, error: aiErr } = await supabase.from('ai_profiles')
              .upsert(aiData, { onConflict: 'user_id' }).select().single();

            if (!aiErr && aiProfile) {
              console.log('[CV Upload BG] ✅ AI profile SAVED. Skills:', (aiProfile.hard_skills||[]).length, '| Headline:', aiProfile.ai_headline);
            }
            if (aiErr) {
              console.error('[CV Upload BG] ❌ AI profile save FAILED:', aiErr.message, aiErr.details, aiErr.hint);

              // Try a minimal insert/update as fallback
              try {
                const minimalData = {
                  user_id: user.id,
                  full_name: parsed.full_name,
                  email: parsed.email || user.email,
                  hard_skills: parsed.hard_skills,
                  soft_skills: parsed.soft_skills,
                  languages: parsed.languages,
                  education_level: parsed.education_level,
                  parse_status: parseStatus,
                  extraction_source: parsed._source === 'openai' ? 'ai_llm' : 'cv_parse',
                  raw_cv_text: rawText.substring(0, 50000),
                  confidence_score: parsed.confidence_score,
                  ai_headline: parsed.ai_headline,
                  ai_summary: parsed.ai_summary,
                  experience_level: dbExpLevel,
                  updated_at: new Date().toISOString(),
                };
                const { error: retryErr } = await supabase.from('ai_profiles')
                  .upsert(minimalData, { onConflict: 'user_id' }).select().single();
                if (!retryErr) {
                  console.log('[CV Upload BG] ✅ AI profile SAVED (minimal fallback)');
                } else {
                  console.error('[CV Upload BG] ❌ Minimal fallback also failed:', retryErr.message);
                }
              } catch (fbErr) {
                console.error('[CV Upload BG] Fallback save error:', fbErr.message);
              }
            }
          } catch (parseErr) {
            console.error('[CV Upload BG] AI parse error:', parseErr.message, parseErr.stack);
          }
        } else {
          console.warn('[CV Upload BG] Not enough text for AI analysis (' + rawText.length + ' chars)');
        }

        // Update profile flags
        try {
          const ready = parseStatus === 'ready' || parseStatus === 'needs_review';
          await supabase.from('profiles')
            .upsert({
              user_id: user.id,
              email: user.email,
              ai_profile_ready: ready,
              last_cv_parsed_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });
        } catch (flagErr) {
          console.warn('[CV Upload BG] Profile flag update non-fatal:', flagErr.message);
        }

        // Trigger match score recalculation against all active jobs
        try {
          const aiMatchingModule = require('./routes/ai-matching');
          if (aiMatchingModule.helpers && typeof aiMatchingModule.helpers.recalculateForStudent === 'function') {
            const matchCount = await aiMatchingModule.helpers.recalculateForStudent(user.id);
            console.log('[CV Upload BG] Match scores recalculated for', matchCount, 'jobs');
          }
        } catch (matchErr) {
          console.warn('[CV Upload BG] Match recalc non-fatal:', matchErr.message);
        }

        console.log('[CV Upload BG] ✅ Background processing complete for user:', user.id);
      } catch (bgErr) {
        console.error('[CV Upload BG] Background processing error:', bgErr.message, bgErr.stack);
      }
    })();
  } catch (err) {
    console.error('[CV Upload] Critical error:', err);
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
        .eq('id', employerId)
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
    const { job_id } = req.body;

    if (!job_id) return res.status(400).json({ error: 'job_id is required' });

    // 1. Get job info (for employer_id + title)
    const { data: job } = await supabase.from('jobs').select('employer_id, title, company').eq('id', job_id).maybeSingle();

    // 2. Get student profile from DB (authoritative source)
    const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
    const studentName = profile 
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() 
      : (user.user_metadata?.full_name || user.email);
    const studentProfile = profile ? {
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      education: profile.education || '',
      location: profile.location || '',
      skills: profile.skills || [],
      cv_id: profile.cv_id || null,
      original_filename: profile.original_filename || null,
      bio: profile.bio || '',
    } : {};

    // 3. Insert application with full data
    const insertData = {
      job_id,
      candidate_id: user.id,
      student_name: studentName || user.email,
      student_email: user.email,
      student_profile: studentProfile,
      status: 'Pending',
      ai_score: req.body.ai_score || 50,
      ai_reasoning: req.body.ai_reasoning || 'Submitted via Unemployed.sk',
    };

    // Add employer_id if available (enables employer-side RLS)
    if (job?.employer_id) insertData.employer_id = job.employer_id;

    let { data, error } = await supabase.from('applications').insert([insertData]).select().single();

    // If full insert fails (missing columns), try minimal insert
    if (error) {
      console.warn('[POST /api/applications] Full insert failed:', error.message, '— trying minimal insert');
      const minResult = await supabase.from('applications').insert([{
        job_id,
        candidate_id: user.id,
        student_name: studentName || user.email,
        student_email: user.email,
        status: 'Pending',
      }]).select().single();
      data = minResult.data;
      error = minResult.error;
    }

    if (error) {
      console.error('[POST /api/applications] Insert failed:', error);
      if (error.code === '23505') return res.status(409).json({ error: 'Already applied' });
      return res.status(400).json({ error: error.message, details: error.details, hint: error.hint });
    }

    console.log('[POST /api/applications] Success:', data?.id, 'for job', job_id, '| Student:', studentName);

    // ── Notify employer about new application (include AI match %) ──
    try {
      if (job?.employer_id) {
        // Look up AI match score for this candidate + job
        let matchPct = null;
        try {
          const { data: matchRow } = await supabase.from('match_scores')
            .select('overall_score')
            .eq('user_id', user.id)
            .eq('job_id', job_id)
            .maybeSingle();
          if (matchRow) matchPct = matchRow.overall_score;
        } catch {}

        const matchTag = matchPct != null ? ` (AI Match: ${matchPct}%)` : '';
        await supabase.from('notifications').insert([{
          user_id: job.employer_id,
          type: 'application_received',
          title: `Nová prihláška${matchTag}`,
          message: `${studentName} sa prihlásil/a na pozíciu ${job.title || 'ponuka'}.${matchTag ? ' ' + matchTag : ''}`,
          related_entity_id: data?.id || null,
        }]);
      }
    } catch (notifErr) {
      console.warn('Notification insert non-fatal:', notifErr.message);
    }

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
    
    // Fetch current application to verify candidate identity and get employer_id
    const { data: appData, error: appErr } = await supabase
      .from('applications')
      .select('id, job_id, student_name, student_email, employer_id, selected_date, interview_dates')
      .eq('id', req.params.id)
      .maybeSingle();

    if (appErr || !appData) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Verify ownership
    if (appData.student_email !== user.email) {
      return res.status(403).json({ error: 'Unauthorized: This is not your application.' });
    }

    const { status, selected_date } = req.body;
    const updatePayload = {};
    if (status) updatePayload.status = status;
    if (selected_date !== undefined) updatePayload.selected_date = selected_date;

    const { error } = await supabase
      .from('applications')
      .update(updatePayload)
      .eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });

    // Find the recipient (employer). Get the employer_id from job or application
    let recipientId = appData.employer_id;
    const { data: job } = await supabase.from('jobs').select('employer_id, title').eq('id', appData.job_id).maybeSingle();
    if (!recipientId && job) {
      recipientId = job.employer_id;
    }

    if (status && recipientId) {
      const studentName = appData.student_name || 'Uchádzač';
      const jobTitle = job?.title || 'Pracovná ponuka';
      
      const statusLabels = {
        'Interview-Confirmed': 'Potvrdený termín pohovoru',
        'Counter-Offer': 'Protinávrh termínu',
        'Declined': 'Odmietnuté pozvanie',
        'Withdrawn': 'Stiahnutá prihláška',
      };

      const label = statusLabels[status] || status;
      let msgText = `Uchádzač ${studentName} zmenil stav prihlášky pre "${jobTitle}" na: ${label}`;
      let notificationType = 'general';

      if (status === 'Interview-Confirmed') {
        const dateVal = selected_date || updatePayload.selected_date;
        const dateStr = dateVal ? new Date(dateVal).toLocaleString('sk-SK', { dateStyle: 'short', timeStyle: 'short' }) : '';
        msgText = `Uchádzač ${studentName} potvrdil termín pohovoru na pozíciu "${jobTitle}" dňa: ${dateStr}.`;
        notificationType = 'interview_confirmed';
      } else if (status === 'Counter-Offer') {
        const dateVal = selected_date || updatePayload.selected_date;
        const dateStr = dateVal ? new Date(dateVal).toLocaleString('sk-SK', { dateStyle: 'short', timeStyle: 'short' }) : '';
        msgText = `Uchádzač ${studentName} navrhol nový protinávrh termínu pre pohovor na pozíciu "${jobTitle}" dňa: ${dateStr}.`;
        notificationType = 'counter_offer';
      } else if (status === 'Declined') {
        msgText = `Uchádzač ${studentName} odmietol vaše pozvanie na pohovor pre pozíciu "${jobTitle}".`;
        notificationType = 'rejected';
      } else if (status === 'Withdrawn') {
        msgText = `Uchádzač ${studentName} stiahol svoju prihlášku na pozíciu "${jobTitle}".`;
        notificationType = 'rejected';
      }

      await createSystemMessageAndNotification({
        appId: req.params.id,
        recipientId: recipientId,
        type: notificationType,
        title: `Aktualizácia: ${label}`,
        message: msgText,
        statusChangeValue: status
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// ── Public Employers List (for student search) ─────────────────────────────
app.get('/api/employers', async (req, res) => {
  try {
    const { data, error } = await supabase.from('employers').select('id, name, description, logo_url');
    if (error) return res.status(500).json({ error: error.message });
    // Count jobs per employer
    const { data: jobs } = await supabase.from('jobs').select('employer_id');
    const jobCounts = {};
    (jobs || []).forEach(j => { if (j.employer_id) jobCounts[j.employer_id] = (jobCounts[j.employer_id] || 0) + 1; });
    const employers = (data || []).map(emp => ({
      name: emp.name,
      logo: emp.logo_url || emp.name.charAt(0).toUpperCase(),
      color: emp.color || '#FF5C00',
      jobCount: jobCounts[emp.id] || 0,
      description: emp.description || '',
    }));
    res.json({ employers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Notifications API ──────────────────────────────────────────────────────────

// GET /api/notifications — list user's notifications (newest first)
app.get('/api/notifications', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });


    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, title, message, read, related_entity_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);



    if (error) return res.status(500).json({ error: error.message });

    // Map 'message' column to 'body' for frontend compatibility
    const mapped = (data || []).map(n => ({
      ...n,
      body: n.message,
    }));

    res.json(mapped);
  } catch (err) {
    console.error('[Notifications] GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/:id/read — mark a single notification as read
app.patch('/api/notifications/:id/read', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', req.params.id)
      .eq('user_id', user.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    console.error('[Notifications] PATCH read error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/read-all — mark all user's notifications as read
app.post('/api/notifications/read-all', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    console.error('[Notifications] POST read-all error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications — create a notification (used by application flow)
app.post('/api/notifications', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { target_user_id, type, title, message, related_entity_id } = req.body;
    if (!target_user_id || !title) {
      return res.status(400).json({ error: 'target_user_id and title are required' });
    }

    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: target_user_id,
        type: type || 'general',
        title,
        message: message || '',
        read: false,
      });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    console.error('[Notifications] POST create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/application-received — auto-notify employer when student applies
app.post('/api/notifications/application-received', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { job_id, job_title, application_id } = req.body;
    if (!job_id) return res.status(400).json({ error: 'job_id is required' });

    // Look up the job's employer
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('employer_id, title')
      .eq('id', job_id)
      .maybeSingle();

    if (jobErr || !job) return res.status(404).json({ error: 'Job not found' });


    // Get student name
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('user_id', user.id)
      .maybeSingle();

    const studentName = profile
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
      : user.email?.split('@')[0] || 'Kandidát';

    const title = job_title || job.title || 'Ponuka';

    // Look up AI match score for this candidate + job
    let matchPct = null;
    try {
      const { data: matchRow } = await supabase.from('match_scores')
        .select('overall_score')
        .eq('user_id', user.id)
        .eq('job_id', job_id)
        .maybeSingle();
      if (matchRow) matchPct = matchRow.overall_score;
    } catch {}

    const matchTag = matchPct != null ? ` (AI Match: ${matchPct}%)` : '';

    // Create notification for employer with AI match %
    const { error: insertErr } = await supabase.from('notifications').insert({
      user_id: job.employer_id,
      type: 'application_received',
      title: `Nová prihláška: ${studentName}${matchTag}`,
      message: `${studentName} sa prihlásil/a na pozíciu "${title}"${matchTag ? ' ' + matchTag : ''}`,
      related_entity_id: application_id || null,
      read: false,
    });

    if (insertErr) {
      console.error('[Notifications] Insert error:', insertErr);
      return res.status(500).json({ error: insertErr.message });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Notifications] application-received error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/status-changed — notify student when employer changes status
app.post('/api/notifications/status-changed', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { application_id, new_status, candidate_id, job_title } = req.body;
    if (!candidate_id || !new_status) {
      return res.status(400).json({ error: 'candidate_id and new_status are required' });
    }

    const statusLabels = {
      'Viewed': 'Zobrazená',
      'Interview': 'Pohovor naplánovaný',
      'Interview-Confirmed': 'Pohovor potvrdený',
      'Counter-Offer': 'Protinávrh termínu',
      'Hired': 'Prijatý/á! 🎉',
      'Rejected': 'Zamietnutá',
    };

    const statusLabel = statusLabels[new_status] || new_status;
    const title = `Stav prihlášky: ${statusLabel}`;
    const message = job_title
      ? `Tvoja prihláška na "${job_title}" bola aktualizovaná na: ${statusLabel}`
      : `Stav tvojej prihlášky bol zmenený na: ${statusLabel}`;

    const type = new_status === 'Hired' ? 'hired'
      : new_status === 'Rejected' ? 'rejected'
      : new_status === 'Interview-Confirmed' ? 'interview_confirmed'
      : new_status === 'Counter-Offer' ? 'counter_offer'
      : new_status === 'Interview' ? 'interview_scheduled'
      : 'general';

    const { error: insertErr } = await supabase.from('notifications').insert({
      user_id: candidate_id,
      type,
      title,
      message,
      related_entity_id: application_id,
      read: false,
    });

    if (insertErr) {
      console.error('[Notifications] Insert error:', insertErr);
      return res.status(500).json({ error: insertErr.message });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Notifications] status-changed error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Virtual Conversations & Messaging API (using applications + notifications) ──
app.get('/api/conversations', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // Determine role (candidate or employer)
    const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
    const isCandidate = roleData ? roleData.role === 'candidate' : true;

    const hasDedicated = await checkUseDedicatedMessagesTable();
    const conversations = [];

    if (isCandidate) {
      // 1. Student / Candidate
      const { data: apps, error: appsErr } = await supabase
        .from('applications')
        .select('id, job_id, status, created_at, employer_id, selected_date, interview_dates')
        .eq('candidate_id', user.id);

      if (appsErr) throw appsErr;

      const appIds = (apps || []).map(a => a.id);
      let allMsgsMap = {};
      let allNotifsMap = {};

      if (appIds.length > 0) {
        if (hasDedicated) {
          const { data: dbMsgs } = await supabase
            .from('application_messages')
            .select('application_id, sender_id, read_at, message_type, body, created_at')
            .in('application_id', appIds)
            .order('created_at', { ascending: false });
          if (dbMsgs) {
            for (const m of dbMsgs) {
              if (!allMsgsMap[m.application_id]) allMsgsMap[m.application_id] = [];
              allMsgsMap[m.application_id].push(m);
            }
          }
        } else {
          const { data: notifs } = await supabase
            .from('notifications')
            .select('related_entity_id, user_id, read, type, message, title, created_at')
            .in('related_entity_id', appIds)
            .order('created_at', { ascending: false });
          if (notifs) {
            for (const n of notifs) {
              if (!allNotifsMap[n.related_entity_id]) allNotifsMap[n.related_entity_id] = [];
              allNotifsMap[n.related_entity_id].push(n);
            }
          }
        }
      }

      // Batch load jobs
      const jobIds = [...new Set((apps || []).map(a => a.job_id).filter(Boolean))];
      let jobsMap = {};
      if (jobIds.length > 0) {
        const { data: dbJobs } = await supabase
          .from('jobs')
          .select('id, title, company, employer_id')
          .in('id', jobIds);
        if (dbJobs) {
          for (const j of dbJobs) {
            jobsMap[j.id] = j;
          }
        }
      }

      // Batch load employers
      const empIds = [...new Set([
        ...(apps || []).map(a => a.employer_id),
        ...Object.values(jobsMap).map(j => j.employer_id)
      ].filter(Boolean))];
      let employersMap = {};
      if (empIds.length > 0) {
        const { data: dbEmps } = await supabase
          .from('employers')
          .select('id, name, logo_url')
          .in('id', empIds);
        if (dbEmps) {
          for (const e of dbEmps) {
            employersMap[e.id] = e;
          }
        }
      }

      for (const app of (apps || [])) {
        const job = jobsMap[app.job_id];
        const empId = app.employer_id || job?.employer_id;
        const employer = empId ? employersMap[empId] : null;

        let latestMsg = null;
        let unreadCount = 0;
        let updatedAt = app.created_at;

        if (hasDedicated) {
          const dbMsgs = allMsgsMap[app.id] || [];
          unreadCount = dbMsgs.filter(m => m.sender_id !== user.id && !m.read_at).length;
          if (dbMsgs.length > 0) {
            const m = dbMsgs[0];
            latestMsg = {
              id: m.id,
              body: m.body,
              message_type: m.message_type,
              created_at: m.created_at
            };
            updatedAt = m.created_at;
          } else {
            latestMsg = {
              id: 'initial-' + app.id,
              body: 'Prihláška odoslaná.',
              message_type: 'system',
              created_at: app.created_at
            };
          }
        } else {
          const notifs = allNotifsMap[app.id] || [];
          unreadCount = notifs.filter(n => n.user_id === user.id && !n.read).length;
          if (notifs.length > 0) {
            const n = notifs[0];
            latestMsg = {
              id: n.id,
              body: n.message,
              message_type: n.type === 'chat_message' ? 'text' : 'system',
              created_at: n.created_at
            };
            updatedAt = n.created_at;
          } else {
            latestMsg = {
              id: 'initial-' + app.id,
              body: 'Prihláška odoslaná.',
              message_type: 'system',
              created_at: app.created_at
            };
          }
        }

        conversations.push({
          id: app.id,
          applicationId: app.id,
          jobId: app.job_id,
          employerId: empId,
          employer: employer || { id: empId, name: job?.company || 'Zamestnávateľ', logo_url: null },
          job: job || { id: app.job_id, title: 'Pracovná ponuka' },
          status: app.status,
          application: app,
          lastMessage: latestMsg,
          unreadCount: unreadCount,
          updatedAt: updatedAt
        });
      }
    } else {
      // 2. Employer
      const { data: member } = await supabase.from('employer_members').select('employer_id').eq('user_id', user.id).maybeSingle();
      let employerId = member?.employer_id;
      if (!employerId) {
        // Fallback: check if the user.id is directly an employer_id in the employers table
        const { data: emp } = await supabase.from('employers').select('id').eq('id', user.id).maybeSingle();
        if (emp) {
          employerId = emp.id;
        }
      }
      if (!employerId) return res.json([]);

      // Fetch all jobs for this employer
      const { data: jobs } = await supabase.from('jobs').select('id, title, company').eq('employer_id', employerId);
      
      let jobsMap = {};
      if (jobs) {
        for (const j of jobs) {
          jobsMap[j.id] = j;
        }
      }
      const jobIds = Object.keys(jobsMap);

      let appsQuery = supabase.from('applications').select('id, job_id, candidate_id, status, created_at, student_name, student_email, selected_date, interview_dates');
      if (jobIds.length > 0) {
        appsQuery = appsQuery.or(`employer_id.eq.${employerId},job_id.in.(${jobIds.join(',')})`);
      } else {
        appsQuery = appsQuery.eq('employer_id', employerId);
      }
      
      const { data: apps, error: appsErr } = await appsQuery;
      if (appsErr) throw appsErr;

      const appIds = (apps || []).map(a => a.id);
      let allMsgsMap = {};
      let allNotifsMap = {};

      if (appIds.length > 0) {
        if (hasDedicated) {
          const { data: dbMsgs } = await supabase
            .from('application_messages')
            .select('application_id, sender_id, read_at, message_type, body, created_at')
            .in('application_id', appIds)
            .order('created_at', { ascending: false });
          if (dbMsgs) {
            for (const m of dbMsgs) {
              if (!allMsgsMap[m.application_id]) allMsgsMap[m.application_id] = [];
              allMsgsMap[m.application_id].push(m);
            }
          }
        } else {
          const { data: notifs } = await supabase
            .from('notifications')
            .select('related_entity_id, user_id, read, type, message, title, created_at')
            .in('related_entity_id', appIds)
            .order('created_at', { ascending: false });
          if (notifs) {
            for (const n of notifs) {
              if (!allNotifsMap[n.related_entity_id]) allNotifsMap[n.related_entity_id] = [];
              allNotifsMap[n.related_entity_id].push(n);
            }
          }
        }
      }

      // Batch load any missing jobs (just in case)
      const appJobIds = [...new Set((apps || []).map(a => a.job_id).filter(Boolean))];
      const missingJobIds = appJobIds.filter(id => !jobsMap[id]);
      if (missingJobIds.length > 0) {
        const { data: extraJobs } = await supabase
          .from('jobs')
          .select('id, title, company')
          .in('id', missingJobIds);
        if (extraJobs) {
          for (const j of extraJobs) {
            jobsMap[j.id] = j;
          }
        }
      }

      // Batch load profiles
      const candidateIds = [...new Set((apps || []).map(a => a.candidate_id).filter(Boolean))];
      let profilesMap = {};
      if (candidateIds.length > 0) {
        const { data: dbProfiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, avatar_url')
          .in('user_id', candidateIds);
        if (dbProfiles) {
          for (const p of dbProfiles) {
            profilesMap[p.user_id] = p;
          }
        }
      }

      for (const app of (apps || [])) {
        const job = jobsMap[app.job_id];
        const profile = profilesMap[app.candidate_id];

        let latestMsg = null;
        let unreadCount = 0;
        let updatedAt = app.created_at;

        if (hasDedicated) {
          const dbMsgs = allMsgsMap[app.id] || [];
          unreadCount = dbMsgs.filter(m => m.sender_id !== user.id && !m.read_at).length;
          if (dbMsgs.length > 0) {
            const m = dbMsgs[0];
            latestMsg = {
              id: m.id,
              body: m.body,
              message_type: m.message_type,
              created_at: m.created_at
            };
            updatedAt = m.created_at;
          } else {
            latestMsg = {
              id: 'initial-' + app.id,
              body: 'Prihláška odoslaná.',
              message_type: 'system',
              created_at: app.created_at
            };
          }
        } else {
          const notifs = allNotifsMap[app.id] || [];
          unreadCount = notifs.filter(n => n.user_id === user.id && !n.read).length;
          if (notifs.length > 0) {
            const n = notifs[0];
            latestMsg = {
              id: n.id,
              body: n.message,
              message_type: n.type === 'chat_message' ? 'text' : 'system',
              created_at: n.created_at
            };
            updatedAt = n.created_at;
          } else {
            latestMsg = {
              id: 'initial-' + app.id,
              body: 'Prihláška odoslaná.',
              message_type: 'system',
              created_at: app.created_at
            };
          }
        }

        const candName = profile
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
          : app.student_name || 'Kandidát';

        conversations.push({
          id: app.id,
          applicationId: app.id,
          jobId: app.job_id,
          studentId: app.candidate_id,
          student: {
            first_name: profile?.first_name || app.student_name?.split(' ')[0] || 'Kandidát',
            last_name: profile?.last_name || app.student_name?.split(' ')[1] || '',
            email: app.student_email,
            avatar_url: profile?.avatar_url
          },
          candidateName: candName || 'Kandidát',
          candidateEmail: app.student_email,
          candidateAvatar: profile?.avatar_url,
          application: app,
          job: job || { id: app.job_id, title: 'Pracovná ponuka' },
          status: app.status,
          lastMessage: latestMsg,
          unreadCount: unreadCount,
          updatedAt: updatedAt
        });
      }
    }

    // Sort by latest activity
    conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json(conversations);
  } catch (err) {
    console.error('[Conversations] GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/conversations/:id/messages', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const appId = req.params.id;

    // Fetch application to verify access
    const { data: app, error: appErr } = await supabase.from('applications').select('*').eq('id', appId).maybeSingle();
    if (appErr || !app) return res.status(404).json({ error: 'Application not found' });

    // Verify user is either student or employer member
    let hasAccess = app.candidate_id === user.id;
    if (!hasAccess) {
      const { data: member } = await supabase.from('employer_members').select('employer_id').eq('user_id', user.id).maybeSingle();
      let employerId = member?.employer_id;
      if (!employerId) {
        const { data: emp } = await supabase.from('employers').select('id').eq('id', user.id).maybeSingle();
        if (emp) employerId = emp.id;
      }

      if (employerId) {
        // Get job details to match employer_id
        const { data: job } = await supabase.from('jobs').select('employer_id').eq('id', app.job_id).maybeSingle();
        if ((job && job.employer_id === employerId) || app.employer_id === employerId) {
          hasAccess = true;
        }
      }
    }

    if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

    const messages = [];

    // Prepend the initial application submission message
    messages.push({
      id: 'initial-' + appId,
      conversation_id: appId,
      sender_id: null, // system message
      message_type: 'system',
      body: 'Prihláška odoslaná.',
      created_at: app.created_at
    });

    const hasDedicated = await checkUseDedicatedMessagesTable();

    if (hasDedicated) {
      // 1. Fetch from application_messages
      const { data: dbMsgs, error: dbMsgsErr } = await supabase
        .from('application_messages')
        .select('*')
        .eq('application_id', appId)
        .order('created_at', { ascending: true });

      if (dbMsgsErr) throw dbMsgsErr;

      for (const m of (dbMsgs || [])) {
        messages.push({
          id: m.id,
          conversation_id: appId,
          sender_id: m.sender_id === user.id ? user.id : (m.sender_id ? 'other' : null),
          message_type: m.message_type,
          body: m.body,
          created_at: m.created_at
        });
      }
    } else {
      // 2. Fetch from notifications (fallback virtual mode)
      const { data: notifs, error: notifsErr } = await supabase
        .from('notifications')
        .select('*')
        .eq('related_entity_id', appId)
        .order('created_at', { ascending: true });

      if (notifsErr) throw notifsErr;

      for (const n of (notifs || [])) {
        // Map sender based on user_id (recipient) of notification
        const senderId = n.user_id === user.id ? 'other' : user.id;

        messages.push({
          id: n.id,
          conversation_id: appId,
          sender_id: senderId,
          message_type: n.type === 'general' ? 'text' : 'system',
          body: n.message || n.title,
          created_at: n.created_at
        });
      }
    }

    res.json(messages);
  } catch (err) {
    console.error('[Messages] GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/conversations/:id/messages', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const appId = req.params.id;
    const { body } = req.body;
    if (!body || !body.trim()) return res.status(400).json({ error: 'Message body required' });

    // Fetch application
    const { data: app, error: appErr } = await supabase.from('applications').select('*').eq('id', appId).maybeSingle();
    if (appErr || !app) return res.status(404).json({ error: 'Application not found' });

    // Verify user has access to this conversation/application
    let hasAccess = app.candidate_id === user.id;
    if (!hasAccess) {
      const { data: member } = await supabase.from('employer_members').select('employer_id').eq('user_id', user.id).maybeSingle();
      let employerId = member?.employer_id;
      if (!employerId) {
        const { data: emp } = await supabase.from('employers').select('id').eq('id', user.id).maybeSingle();
        if (emp) employerId = emp.id;
      }

      if (employerId) {
        const { data: job } = await supabase.from('jobs').select('employer_id').eq('id', app.job_id).maybeSingle();
        if ((job && job.employer_id === employerId) || app.employer_id === employerId) {
          hasAccess = true;
        }
      }
    }

    if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

    // Determine recipient and sender name
    let recipientId = null;
    let senderName = '';

    if (app.candidate_id === user.id) {
      // Sender is Student, Recipient is Employer
      senderName = app.student_name || 'Kandidát';
      const empId = app.employer_id;
      if (empId) {
        const { data: member } = await supabase.from('employer_members').select('user_id').eq('employer_id', empId).limit(1).maybeSingle();
        recipientId = member?.user_id || empId;
      }
      if (!recipientId) {
        // Fallback: get employer member via job
        const { data: job } = await supabase.from('jobs').select('employer_id').eq('id', app.job_id).maybeSingle();
        if (job?.employer_id) {
          const { data: member } = await supabase.from('employer_members').select('user_id').eq('employer_id', job.employer_id).limit(1).maybeSingle();
          recipientId = member?.user_id || job.employer_id;
        }
      }
    } else {
      // Sender is Employer, Recipient is Student
      recipientId = app.candidate_id;
      const { data: job } = await supabase.from('jobs').select('company').eq('id', app.job_id).maybeSingle();
      senderName = job?.company || 'Zamestnávateľ';
    }

    if (!recipientId) return res.status(400).json({ error: 'Recipient not found' });

    const hasDedicated = await checkUseDedicatedMessagesTable();

    if (hasDedicated) {
      // 1. Insert into application_messages
      const { data: msg, error: insertErr } = await supabase
        .from('application_messages')
        .insert({
          application_id: appId,
          sender_id: user.id,
          body: body.trim(),
          message_type: 'text'
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      // 2. Insert notification (bell update)
      try {
        await supabase.from('notifications').insert({
          user_id: recipientId,
          type: 'general',
          title: senderName,
          message: body.trim(),
          related_entity_id: appId,
          read: false
        });
      } catch (e) {
        console.warn('Silent warning: Failed to insert message notification bell:', e.message);
      }

      res.json({
        id: msg.id,
        conversation_id: appId,
        sender_id: user.id,
        message_type: 'text',
        body: msg.body,
        created_at: msg.created_at
      });
    } else {
      // Fallback: Insert notification
      const { data: notif, error: insertErr } = await supabase
        .from('notifications')
        .insert({
          user_id: recipientId,
          type: 'general',
          title: senderName,
          message: body.trim(),
          related_entity_id: appId,
          read: false
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      // Return the formatted message
      res.json({
        id: notif.id,
        conversation_id: appId,
        sender_id: user.id,
        message_type: 'text',
        body: notif.message,
        created_at: notif.created_at
      });
    }
  } catch (err) {
    console.error('[Messages] POST error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/conversations/:id/read', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const appId = req.params.id;

    // Mark notifications for this application as read for current user
    const { error: notifErr } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('related_entity_id', appId)
      .eq('user_id', user.id);

    if (notifErr) console.warn('Warning marking notifications as read:', notifErr.message);

    // If using dedicated messages, mark messages as read
    const hasDedicated = await checkUseDedicatedMessagesTable();
    if (hasDedicated) {
      const { error: msgErr } = await supabase
        .from('application_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('application_id', appId)
        .not('sender_id', 'eq', user.id)
        .is('read_at', null);

      if (msgErr) console.warn('Warning marking messages as read:', msgErr.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Conversations] POST read error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Export for serverless OR start server ────────────────────────────────────
if (IS_SERVERLESS) {
  // In serverless mode, export the Express app (no listen, no SPA fallbacks)
  module.exports = { app, supabase };
} else {
  // ── SPA Fallbacks ──────────────────────────────────────────────────────────
  const distBase = __dirname;
  app.get('/login',               (req, res) => res.sendFile(path.join(distBase, 'apps', 'landing',      'login.html')));
  app.get('/app(/*)?',            (req, res) => res.sendFile(path.join(distBase, 'apps', 'student',      'dist', 'index.html')));
  app.get('/employer(/*)?',       (req, res) => res.sendFile(path.join(distBase, 'apps', 'employer',     'dist', 'index.html')));
  app.get('/student-demo(/*)?',   (req, res) => res.sendFile(path.join(distBase, 'apps', 'student-demo', 'dist', 'index.html')));
  app.get('/employer-demo(/*)?',  (req, res) => res.sendFile(path.join(distBase, 'apps', 'employer-demo','dist', 'index.html')));

  // ── Start ──────────────────────────────────────────────────────────────────
  const server = app.listen(PORT, () => {
    console.log(`unemployed.sk running on http://localhost:${PORT}`);

    // ── Startup: detect CVs uploaded while server was down ─────────────────
    setTimeout(async () => {
      try {
        const { data: profiles } = await supabase.from('profiles')
          .select('user_id, cv_id, original_filename')
          .not('cv_id', 'is', null);

        const { data: aiProfiles } = await supabase.from('ai_profiles')
          .select('user_id, updated_at');

        const aiMap = {};
        (aiProfiles || []).forEach(a => { aiMap[a.user_id] = a; });

        const stale = [];
        for (const p of (profiles || [])) {
          if (!p.cv_id) continue;
          const match = p.cv_id.match(/\/(\d{13})_/);
          if (!match) continue;
          const uploadTs = parseInt(match[1]);
          const ai = aiMap[p.user_id];
          const aiTs = ai ? new Date(ai.updated_at).getTime() : 0;
          if (uploadTs > aiTs + 60000) {
            stale.push({ user_id: p.user_id, filename: p.original_filename, uploadTs, aiTs });
          }
        }

        if (stale.length > 0) {
          console.log(`[Startup] Found ${stale.length} stale AI profile(s) — triggering reparse...`);
          const { PDFParse } = require('pdf-parse');
          const { parseWithAI } = require('./lib/ai-cv-parser');
          const { calculateProfileCompletion } = require('./lib/matching-engine');

          for (const s of stale) {
            try {
              console.log(`[Startup] Reparsing CV for ${s.user_id.slice(0,8)} (${s.filename})`);
              const profile = (profiles || []).find(p => p.user_id === s.user_id);
              const { data: fileData, error: dlErr } = await supabase.storage.from('cvs').download(profile.cv_id);
              if (dlErr || !fileData) { console.warn('[Startup] Download failed:', dlErr?.message); continue; }

              const buf = Buffer.from(await fileData.arrayBuffer());
              const parser = new PDFParse({ data: buf });
              const pdfResult = await parser.getText();
              await parser.destroy().catch(() => {});
              const rawText = (pdfResult.text || '').trim();
              if (rawText.length < 50) { console.warn('[Startup] Too little text'); continue; }

              const { data: prof } = await supabase.from('profiles')
                .select('first_name, last_name, location, skills, email')
                .eq('user_id', s.user_id).maybeSingle();

              const parsed = await parseWithAI(rawText, {
                full_name: `${prof?.first_name||''} ${prof?.last_name||''}`.trim() || null,
                email: prof?.email, location: prof?.location, skills: prof?.skills,
              }, s.user_id);

              const expLevelMap = { entry: 'beginner', junior: 'junior', mid: 'experienced', senior: 'experienced' };
              const aiData = {
                user_id: s.user_id, full_name: parsed.full_name, email: parsed.email || prof?.email,
                phone: parsed.phone, location: parsed.location,
                hard_skills: parsed.hard_skills, soft_skills: parsed.soft_skills,
                languages: parsed.languages, experience_years: parsed.experience_years,
                education_level: parsed.education_level, education_field: parsed.education_field,
                education_school: parsed.education_school, certifications: parsed.certifications || [],
                preferred_locations: parsed.preferred_work_locations || (parsed.location ? [parsed.location] : []),
                parse_status: parsed.confidence_score >= 0.5 ? 'ready' : 'needs_review',
                extraction_source: parsed._source === 'openai' ? 'ai_llm' : 'cv_parse',
                extraction_version: '3.0', raw_cv_text: rawText.substring(0, 50000),
                confidence_score: parsed.confidence_score,
                ai_headline: parsed.ai_headline, ai_summary: parsed.ai_summary,
                ai_portfolio_intro: parsed.ai_portfolio_intro,
                ai_strengths: parsed.ai_strengths, ai_development_areas: parsed.ai_development_areas,
                ai_suggested_roles: parsed.ai_suggested_roles, ai_suggested_categories: parsed.ai_suggested_categories,
                ai_missing_fields: parsed.ai_missing_fields || [], ai_profile_quality_notes: parsed.ai_profile_quality_notes || [],
                ai_normalized_skills: parsed.ai_normalized_skills || parsed.hard_skills,
                experience_level: expLevelMap[parsed.experience_level] || 'unknown',
                ai_profile_approved: false, ai_generated_at: new Date().toISOString(),
                profile_completion_score: 0, updated_at: new Date().toISOString(),
              };
              aiData.profile_completion_score = calculateProfileCompletion(aiData).score;

              const { error: saveErr } = await supabase.from('ai_profiles').upsert(aiData, { onConflict: 'user_id' });
              if (saveErr) { console.error('[Startup] Save failed:', saveErr.message); continue; }

              await supabase.from('profiles').upsert({
                user_id: s.user_id, ai_profile_ready: true,
                last_cv_parsed_at: new Date().toISOString(),
              }, { onConflict: 'user_id' });

              const aiMatchingModule = require('./routes/ai-matching');
              if (aiMatchingModule.helpers?.recalculateForStudent) {
                const count = await aiMatchingModule.helpers.recalculateForStudent(s.user_id);
                console.log(`[Startup] ✅ ${s.user_id.slice(0,8)} reparsed + ${count} scores recalculated`);
              }
            } catch (err) { console.warn('[Startup] Reparse error:', err.message); }
          }
        }
      } catch (err) { console.warn('[Startup] Stale check error:', err.message); }
    }, 5000);
  });
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
  process.on('SIGINT',  () => server.close(() => process.exit(0)));
}
