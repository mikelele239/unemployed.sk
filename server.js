'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const { createHash } = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Supabase (service role key — bypasses RLS for server-side operations) ────
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ── Helpers ──────────────────────────────────────────────────────────────────
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
// JSON body parser — skip for multipart file upload routes
app.use((req, res, next) => {
  if (req.path === '/api/cvs/upload') return next();
  express.json({ limit: '16kb' })(req, res, next);
});
app.use((req, res, next) => {
  if (req.path === '/api/cvs/upload') return next();
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
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co; " +
    // TODO: Replace unsafe-inline with nonces once the landing page is migrated to a build step
    "script-src 'self' 'unsafe-inline' https://unpkg.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: blob: https: https://*.supabase.co;"
  );
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  const origin = req.headers.origin;
  const allowedOrigins = [
    `http://localhost:${PORT}`,
    'https://unemployed.sk',
    'https://www.unemployed.sk',
  ];
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// ── Static File Serving (order matters — demos before landing page) ──────────
app.use('/app',          express.static(path.join(__dirname, 'apps', 'student',      'dist')));
app.use('/employer',     express.static(path.join(__dirname, 'apps', 'employer',     'dist')));
app.use('/student-demo', express.static(path.join(__dirname, 'apps', 'student-demo', 'dist')));
app.use('/employer-demo',express.static(path.join(__dirname, 'apps', 'employer-demo','dist')));
app.use(express.static(path.join(__dirname, 'apps', 'landing')));

// ── Route Modules ──────────────────────────────────────────────────────────────
require('./routes/jobs')(app, supabase, { getUserFromToken });
require('./routes/auth')(app, supabase, { hashIp, getUserFromToken, rateLimit, VALID_TYPES, EMAIL_RE });

// ── Employer Profile API ──────────────────────────────────────────────────────
app.post('/api/employer/ensure-profile', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { name, description, website, location } = req.body;
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

app.get('/api/employer/profile', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await supabase.from('employers').select('*').eq('id', user.id).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ profile: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Student Profile API ──────────────────────────────────────────────────────
app.post('/api/student/profile', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { first_name, last_name, education, location, skills, job_preferences, cv_id, original_filename, avatar_url } = req.body;
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
    const { data, error } = await supabase.from('profiles').upsert(upsertData, { onConflict: 'user_id' }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ profile: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/student/profile', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

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

// ── Employer Update Application Status ──────────────────────────────────────
app.patch('/api/employer/candidates/:id', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // Verify this application belongs to one of the employer's jobs
    const { data: application } = await supabase
      .from('applications')
      .select('job_id')
      .eq('id', req.params.id)
      .single();
    if (!application) return res.status(404).json({ error: 'Application not found' });

    const { data: job } = await supabase
      .from('jobs')
      .select('id')
      .eq('id', application.job_id)
      .eq('employer_id', user.id)
      .single();
    if (!job) return res.status(403).json({ error: 'Forbidden' });

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

// ── Employer Job Update ─────────────────────────────────────────────────────
const JOB_UPDATABLE_FIELDS = ['title', 'description', 'requirements', 'rate', 'rate_unit', 'work_model', 'location', 'hours', 'type', 'duration', 'start_date', 'tags'];

app.patch('/api/employer/jobs/:id', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const updateData = {};
    for (const field of JOB_UPDATABLE_FIELDS) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }
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

    // TODO: Replace manual multipart parsing with multer (already in package.json)
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

app.post('/api/applications', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
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

    if (job?.employer_id) insertData.employer_id = job.employer_id;

    let { data, error } = await supabase.from('applications').insert([insertData]).select().single();

    if (error) {
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
    res.json({ application: data });
  } catch (err) {
    console.error('[POST /api/applications] Exception:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/applications', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
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
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
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

// ── Public Employers List (for student search) ─────────────────────────────
app.get('/api/employers', async (req, res) => {
  try {
    const { data, error } = await supabase.from('employers').select('id, name, description, color, logo_url');
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
