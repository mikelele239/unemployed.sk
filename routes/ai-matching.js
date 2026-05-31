'use strict';
// Lazy-load pdf-parse to avoid DOMMatrix crash in serverless environments
let _PDFParse = null;
function getPDFParse() {
  if (!_PDFParse) _PDFParse = require('pdf-parse').PDFParse;
  return _PDFParse;
}
const {
  extractProfileFromText, normalizeText,
} = require('../lib/ai-extraction');
const { calculateCandidateJobMatch, calculateProfileCompletion } = require('../lib/matching-engine');
const { generateCandidateProfileSummary } = require('../lib/ai-profile-builder');
const { parseWithAI, usageTracker, CONFIG: AI_CONFIG } = require('../lib/ai-cv-parser');

const MAX_CV_SIZE = 10 * 1024 * 1024; // 10 MB
const MIN_TEXT_LEN = 50;
const VALID_EDU = ['high_school','bachelors','masters','phd'];
const VALID_AVAIL = ['immediate','2_weeks','1_month','flexible'];
const VALID_WORK = ['On-site','Hybrid','Remote'];

let _recalcHelpers = {};

function aiMatchingRouter(app, supabase, { getUserFromToken }) {

  // ── Helpers ──────────────────────────────────────────────────────────────

  async function parseCvBuffer(buffer) {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy().catch(() => {});
    return (result.text || '').trim();
  }

  async function parseCvFromStorage(storagePath) {
    const { data, error } = await supabase.storage.from('cvs').download(storagePath);
    if (error || !data) throw new Error('CV download failed: ' + (error?.message || 'no data'));
    const buf = Buffer.from(await data.arrayBuffer());
    return parseCvBuffer(buf);
  }

  function determineParseStatus(rawText, confidence) {
    if (!rawText || rawText.length < MIN_TEXT_LEN) return 'failed';
    if (confidence < 0.25) return 'needs_review';
    return 'ready';
  }

  async function recalculateForStudent(userId) {
    try {
      const { data: profile } = await supabase.from('ai_profiles')
        .select('*').eq('user_id', userId).maybeSingle();
      if (!profile || profile.parse_status === 'failed') return 0;

      // Fetch full job data (including description, requirements, tags) for description mining
      const { data: jobs } = await supabase.from('jobs').select('*')
        .or('status.eq.Active,status.is.null')
        .limit(500);
      if (!jobs?.length) return 0;

      const { data: criteriaRows } = await supabase.from('job_match_criteria')
        .select('*').in('job_id', jobs.map(j => j.id));
      const cMap = {};
      (criteriaRows || []).forEach(c => { cMap[c.job_id] = c; });

      const v3Batch = [];
      const baseBatch = [];
      for (const job of jobs) {
        const result = calculateCandidateJobMatch(profile, job, cMap[job.id] || {});
        const basePayload = {
          user_id: userId, job_id: job.id,
          eligible: result.eligible,
          overall_score: result.match_score,
          breakdown: result.score_breakdown,
          match_reasons: result.match_reasons,
          gaps: result.gaps,
          missing_required: result.gaps.filter(g => {
            try { const p = JSON.parse(g); return (p.en || '').startsWith('Missing required') && !(p.en || '').includes('trainable'); } catch { return typeof g === 'string' && g.startsWith('Missing required'); }
          }),
          calculated_at: new Date().toISOString(),
        };
        const v3Payload = {
          ...basePayload,
          match_band: result.match_band,
          eligibility_tier: result.eligibility_tier,
          criteria_version: result.criteria_version || 1,
          insights: result.insights || [],
          executive_summary: result.executive_summary || null,
        };
        v3Batch.push(v3Payload);
        baseBatch.push(basePayload);
      }
      // Batch upsert — single DB round trip instead of N
      const { error: v3Err } = await supabase.from('match_scores').upsert(v3Batch, { onConflict: 'user_id,job_id' });
      if (v3Err) {
        await supabase.from('match_scores').upsert(baseBatch, { onConflict: 'user_id,job_id' });
      }
      const count = v3Batch.length;
      return count;
    } catch (err) {
      console.warn('[recalculateForStudent] Non-fatal:', err.message);
      return 0;
    }
  }

  async function recalculateForJob(jobId) {
    try {
      // Fetch full job data for description/requirements mining
      const { data: job } = await supabase.from('jobs')
        .select('*').eq('id', jobId).single();
      if (!job) return 0;

      const { data: criteria } = await supabase.from('job_match_criteria')
        .select('*').eq('job_id', jobId).maybeSingle();

      const { data: profiles } = await supabase.from('ai_profiles')
        .select('*').neq('parse_status', 'failed')
        .limit(1000);
      if (!profiles?.length) return 0;

      const v3Batch = [];
      const baseBatch = [];
      for (const p of profiles) {
        const result = calculateCandidateJobMatch(p, job, criteria || {});
        const basePayload = {
          user_id: p.user_id, job_id: jobId,
          eligible: result.eligible,
          overall_score: result.match_score,
          breakdown: result.score_breakdown,
          match_reasons: result.match_reasons,
          gaps: result.gaps,
          missing_required: result.gaps.filter(g => {
            try { const p2 = JSON.parse(g); return (p2.en || '').startsWith('Missing required') && !(p2.en || '').includes('trainable'); } catch { return typeof g === 'string' && g.startsWith('Missing required'); }
          }),
          calculated_at: new Date().toISOString(),
        };
        const v3Payload = {
          ...basePayload,
          match_band: result.match_band,
          eligibility_tier: result.eligibility_tier,
          criteria_version: result.criteria_version || 1,
          insights: result.insights || [],
          executive_summary: result.executive_summary || null,
        };
        v3Batch.push(v3Payload);
        baseBatch.push(basePayload);
      }
      // Batch upsert — single DB round trip instead of N
      const { error: v3Err } = await supabase.from('match_scores').upsert(v3Batch, { onConflict: 'user_id,job_id' });
      if (v3Err) {
        await supabase.from('match_scores').upsert(baseBatch, { onConflict: 'user_id,job_id' });
      }
      const count = v3Batch.length;
      return count;
    } catch (err) {
      console.warn('[recalculateForJob] Non-fatal:', err.message);
      return 0;
    }
  }
  // ── GET /api/ai-budget — Admin-only: view API usage & cost ────────────────

  app.get('/api/ai-budget', (req, res) => {
    // Only allow with service role key (admin access)
    const authHeader = req.headers.authorization || '';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey || !authHeader.includes(serviceKey.substring(0, 20))) {
      // Also allow authenticated users to see their own limits
      const token = authHeader.replace('Bearer ', '');
      if (!token) return res.status(401).json({ error: 'Unauthorized' });
      
      // For regular users, return limited info
      return res.json({
        per_user_limit: AI_CONFIG.perUserDailyLimit,
        model: AI_CONFIG.model,
        api_available: !!process.env.OPENAI_API_KEY,
      });
    }
    
    // Full admin view
    res.json({
      ...usageTracker.getStatus(),
      config: {
        model: AI_CONFIG.model,
        daily_budget_usd: AI_CONFIG.dailyBudgetUSD,
        per_user_limit: AI_CONFIG.perUserDailyLimit,
        global_daily_limit: AI_CONFIG.globalDailyLimit,
        max_input_chars: AI_CONFIG.maxInputChars,
        max_tokens_response: AI_CONFIG.maxTokensResponse,
      },
    });
  });

  // ── POST /api/ai-profile/parse ───────────────────────────────────────────
  // NOTE: Primary AI analysis happens automatically on CV upload (server.js).
  // This endpoint is ONLY for re-parsing an already-uploaded CV.
  // Rate limited: 10 per user per day.

  app.post('/api/ai-profile/parse', async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      // Check remaining quota before doing anything
      const remaining = usageTracker.getUserCallsRemaining(user.id);
      if (remaining <= 0) {
        return res.status(429).json({
          error: 'Daily AI analysis limit reached. Try again tomorrow.',
          limit: AI_CONFIG.perUserDailyLimit,
          remaining: 0,
        });
      }

      const { data: profile } = await supabase.from('profiles')
        .select('cv_id, first_name, last_name, location, skills')
        .eq('user_id', user.id).maybeSingle();

      if (!profile?.cv_id) {
        return res.status(400).json({ error: 'No CV uploaded. Upload a CV first to trigger AI analysis.' });
      }

      let rawText = '';
      let warnings = [];
      try {
        rawText = await parseCvFromStorage(profile.cv_id);
      } catch (e) {
        warnings.push('PDF parse failed: ' + e.message);
      }

      if (rawText.length < MIN_TEXT_LEN) {
        return res.status(400).json({ error: 'Could not extract text from CV', warnings });
      }

      const existingData = {
        full_name: `${profile.first_name||''} ${profile.last_name||''}`.trim() || null,
        email: user.email,
        location: profile.location,
        skills: profile.skills,
      };

      const parsed = await parseWithAI(rawText, existingData, user.id);

      if (parsed.hard_skills.length === 0 && (profile.skills||[]).length > 0) {
        parsed.hard_skills = profile.skills;
      }

      const parseStatus = parsed.confidence_score >= 0.5 ? 'ready' : 'needs_review';

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
        preferred_locations: parsed.location ? [parsed.location] : [],
        parse_status: parseStatus,
        extraction_source: parsed._source === 'openai' ? 'openai_gpt4o_mini' : 'rule_based',
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
        experience_level: parsed.experience_level || 'entry',
        ai_profile_approved: true,
        ai_generated_at: new Date().toISOString(),
        profile_completion_score: 0,
        updated_at: new Date().toISOString(),
      };

      const completion = calculateProfileCompletion(aiData);
      aiData.profile_completion_score = completion.score;

      const { data: aiProfile, error } = await supabase.from('ai_profiles')
        .upsert(aiData, { onConflict: 'user_id' }).select().single();
      if (error) return res.status(500).json({ error: error.message });

      const ready = parseStatus === 'ready' || parseStatus === 'needs_review';
      await supabase.from('profiles')
        .update({ ai_profile_ready: ready, last_cv_parsed_at: new Date().toISOString() })
        .eq('user_id', user.id);

      let matchCount = 0;
      if (ready) {
        matchCount = await recalculateForStudent(user.id).catch(() => 0);
      }

      const { raw_cv_text, ...safeProfile } = aiProfile;
      res.json({
        ai_profile: safeProfile,
        parse_status: parseStatus,
        confidence_score: parsed.confidence_score,
        extraction_source: aiData.extraction_source,
        remaining_analyses_today: usageTracker.getUserCallsRemaining(user.id),
        warnings,
        matches_recalculated: matchCount,
      });
    } catch (err) {
      console.error('[AI] Parse error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/ai-profile ──────────────────────────────────────────────────

  app.get('/api/ai-profile', async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      try {
        const { data, error } = await supabase.from('ai_profiles')
          .select('user_id,full_name,email,phone,location,hard_skills,soft_skills,languages,experience_years,experience_level,education_level,education_field,education_school,certifications,preferred_job_types,preferred_work_models,preferred_locations,preferred_categories,min_salary,availability,availability_hours,work_mode_preference,salary_expectation,portfolio_links,ai_headline,ai_summary,ai_portfolio_intro,ai_strengths,ai_development_areas,ai_suggested_roles,ai_suggested_categories,ai_missing_fields,ai_profile_quality_notes,ai_normalized_skills,ai_profile_approved,ai_generated_at,profile_completion_score,parse_status,confidence_score,profile_version,created_at,updated_at')
          .eq('user_id', user.id).maybeSingle();
        if (error) throw error;
        res.json({ profile: data });
      } catch (dbErr) {
        console.warn('[ai-profile] DB query failed (table may not exist):', dbErr.message);
        res.json({ profile: null });
      }
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── PATCH /api/ai-profile ────────────────────────────────────────────────

  app.patch('/api/ai-profile', async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const b = req.body;
      const updates = {};
      const errs = [];

      // Validate arrays
      for (const k of ['hard_skills','soft_skills','preferred_job_types','preferred_locations']) {
        if (b[k] !== undefined) {
          if (!Array.isArray(b[k])) errs.push(`${k} must be array`);
          else updates[k] = b[k];
        }
      }
      // Validate work models
      if (b.preferred_work_models !== undefined) {
        if (!Array.isArray(b.preferred_work_models)) errs.push('preferred_work_models must be array');
        else if (b.preferred_work_models.some(w => !VALID_WORK.includes(w))) errs.push('Invalid work model');
        else updates.preferred_work_models = b.preferred_work_models;
      }
      // Validate languages
      if (b.languages !== undefined) {
        if (!Array.isArray(b.languages)) errs.push('languages must be array');
        else if (b.languages.some(l => !l.lang || !l.level)) errs.push('Each language needs lang and level');
        else updates.languages = b.languages;
      }
      // Validate education
      if (b.education_level !== undefined) {
        if (b.education_level && !VALID_EDU.includes(b.education_level)) errs.push('Invalid education level');
        else updates.education_level = b.education_level;
      }
      if (b.education_field !== undefined) updates.education_field = b.education_field;
      if (b.education_school !== undefined) updates.education_school = b.education_school;
      if (b.experience_years !== undefined) {
        const n = parseInt(b.experience_years);
        if (isNaN(n) || n < 0 || n > 50) errs.push('Invalid experience years');
        else updates.experience_years = n;
      }
      if (b.location !== undefined) updates.location = b.location;
      if (b.min_salary !== undefined) {
        if (b.min_salary !== null && (isNaN(b.min_salary) || b.min_salary < 0)) errs.push('Invalid salary');
        else updates.min_salary = b.min_salary;
      }
      if (b.availability !== undefined) {
        if (b.availability && !VALID_AVAIL.includes(b.availability)) errs.push('Invalid availability');
        else updates.availability = b.availability;
      }

      // Validate extra fields
      if (b.full_name !== undefined) updates.full_name = b.full_name;
      if (b.phone !== undefined) updates.phone = b.phone;
      if (b.ai_headline !== undefined) updates.ai_headline = b.ai_headline;
      if (b.ai_strengths !== undefined) {
        if (!Array.isArray(b.ai_strengths)) errs.push('ai_strengths must be array');
        else updates.ai_strengths = b.ai_strengths;
      }
      if (b.ai_suggested_roles !== undefined) {
        if (!Array.isArray(b.ai_suggested_roles)) errs.push('ai_suggested_roles must be array');
        else updates.ai_suggested_roles = b.ai_suggested_roles;
      }
      if (b.ai_missing_fields !== undefined) {
        if (!Array.isArray(b.ai_missing_fields)) errs.push('ai_missing_fields must be array');
        else updates.ai_missing_fields = b.ai_missing_fields;
      }
      if (b.work_mode_preference !== undefined) {
        if (b.work_mode_preference && !['remote','hybrid','on-site','any'].includes(b.work_mode_preference)) {
          errs.push('Invalid work mode preference');
        } else {
          updates.work_mode_preference = b.work_mode_preference;
        }
      }
      if (b.salary_expectation !== undefined) {
        const n = parseInt(b.salary_expectation);
        if (b.salary_expectation !== null && (isNaN(n) || n < 0)) errs.push('Invalid salary expectation');
        else updates.salary_expectation = n;
      }
      if (b.availability_hours !== undefined) {
        const n = parseInt(b.availability_hours);
        if (b.availability_hours !== null && (isNaN(n) || n < 0 || n > 168)) errs.push('Invalid availability hours');
        else updates.availability_hours = n;
      }

      if (errs.length) return res.status(400).json({ error: errs.join('; ') });

      // Increment version
      const { data: current } = await supabase.from('ai_profiles')
        .select('profile_version').eq('user_id', user.id).maybeSingle();
      
      updates.user_id = user.id;
      updates.profile_version = (current?.profile_version || 0) + 1;
      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase.from('ai_profiles')
        .upsert(updates, { onConflict: 'user_id' }).select().single();
      if (error) return res.status(500).json({ error: error.message });

      recalculateForStudent(user.id).catch(e => console.warn('[AI] Recalc:', e.message));

      const { raw_cv_text, ...safe } = data;
      res.json({ ai_profile: safe });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── POST /api/ai-profile/reparse ─────────────────────────────────────────

  app.post('/api/ai-profile/reparse', async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      // Delegate to the parse endpoint
      req.url = '/api/ai-profile/parse';
      app.handle(req, res);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── GET /api/match-scores ────────────────────────────────────────────────

  app.get('/api/match-scores', async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      // 1. Fetch existing scores
      const v3Result = await supabase.from('match_scores')
        .select('job_id, eligible, overall_score, match_band, eligibility_tier, criteria_version, breakdown, match_reasons, gaps, insights, executive_summary, missing_required, calculated_at')
        .eq('user_id', user.id).order('overall_score', { ascending: false });

      let existingScores = [];
      if (!v3Result.error) {
        existingScores = v3Result.data || [];
      } else {
        // V3 columns may not exist — fallback to basic columns
        const basicResult = await supabase.from('match_scores')
          .select('job_id, eligible, overall_score, breakdown, match_reasons, gaps, missing_required, calculated_at')
          .eq('user_id', user.id).order('overall_score', { ascending: false });
        if (!basicResult.error) existingScores = basicResult.data || [];
      }

      // 2. Check which active jobs are missing scores
      const { data: activeJobs } = await supabase.from('jobs').select('id')
        .or('status.eq.Active,status.is.null');
      const activeJobIds = (activeJobs || []).map(j => j.id);
      const scoredJobIds = new Set(existingScores.map(s => s.job_id));
      const missingJobIds = activeJobIds.filter(id => !scoredJobIds.has(id));

      // 3. If there are missing scores, calculate them now
      if (missingJobIds.length > 0) {
        try {
          const { data: profile } = await supabase.from('ai_profiles')
            .select('*').eq('user_id', user.id).maybeSingle();

          if (profile && profile.parse_status !== 'failed') {
            const { data: missingJobs } = await supabase.from('jobs')
              .select('*').in('id', missingJobIds);
            const { data: criteriaRows } = await supabase.from('job_match_criteria')
              .select('*').in('job_id', missingJobIds);
            const cMap = {};
            (criteriaRows || []).forEach(c => { cMap[c.job_id] = c; });

            const newScores = [];
            for (const job of (missingJobs || [])) {
              const result = calculateCandidateJobMatch(profile, job, cMap[job.id] || {});
              const payload = {
                user_id: user.id, job_id: job.id,
                eligible: result.eligible,
                overall_score: result.match_score,
                breakdown: result.score_breakdown,
                match_reasons: result.match_reasons,
                gaps: result.gaps,
                missing_required: result.gaps.filter(g => {
                  try { const p = JSON.parse(g); return (p.en || '').startsWith('Missing required') && !(p.en || '').includes('trainable'); } catch { return typeof g === 'string' && g.startsWith('Missing required'); }
                }),
                match_band: result.match_band,
                eligibility_tier: result.eligibility_tier,
                criteria_version: result.criteria_version || 1,
                insights: result.insights || [],
                executive_summary: result.executive_summary || null,
                calculated_at: new Date().toISOString(),
              };

              // Upsert (fire-and-forget batch — don't block response for DB writes)
              supabase.from('match_scores').upsert(payload, { onConflict: 'user_id,job_id' })
                .then(({ error }) => { if (error) console.warn('[match-scores] upsert err:', error.message); });

              // Add to response immediately
              newScores.push({
                job_id: job.id,
                eligible: payload.eligible,
                overall_score: payload.overall_score,
                match_band: payload.match_band,
                eligibility_tier: payload.eligibility_tier,
                criteria_version: payload.criteria_version,
                breakdown: payload.breakdown,
                match_reasons: payload.match_reasons,
                gaps: payload.gaps,
                insights: payload.insights,
                executive_summary: payload.executive_summary,
                missing_required: payload.missing_required,
                calculated_at: payload.calculated_at,
              });
            }

            console.log(`[match-scores] Auto-filled ${newScores.length} missing scores for user ${user.id}`);
            existingScores = [...existingScores, ...newScores];
          }
        } catch (calcErr) {
          console.warn('[match-scores] Auto-fill non-fatal:', calcErr.message);
        }
      }

      res.json({ scores: existingScores });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── GET /api/jobs/for-you ────────────────────────────────────────────────

  app.get('/api/jobs/for-you', async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const { data: jobs } = await supabase.from('jobs').select('*')
        .or('status.eq.Active,status.is.null')
        .order('created_at', { ascending: false })
        .limit(500);

      let scores = null;
      // Try V3 columns first, fallback to basic if columns don't exist
      const v3Result = await supabase.from('match_scores')
        .select('job_id, eligible, overall_score, match_band, eligibility_tier, criteria_version, breakdown, match_reasons, gaps, insights, executive_summary, missing_required')
        .eq('user_id', user.id);
      if (!v3Result.error) {
        scores = v3Result.data;
      } else {
        // V3 columns may not exist — fallback to basic columns
        const basicResult = await supabase.from('match_scores')
          .select('job_id, eligible, overall_score, breakdown, match_reasons, gaps, missing_required')
          .eq('user_id', user.id);
        scores = basicResult.data;
      }

      const scoreMap = {};
      (scores || []).forEach(s => { scoreMap[s.job_id] = s; });

      const enriched = (jobs || []).map(j => ({
        ...j,
        rateUnit: j.rate_unit, startDate: j.start_date, workModel: j.work_model,
        match: scoreMap[j.id] || null,
      }));

      // Sort: eligible first, then by score desc, then by date
      enriched.sort((a, b) => {
        const aE = a.match?.eligible !== false ? 1 : 0;
        const bE = b.match?.eligible !== false ? 1 : 0;
        if (aE !== bE) return bE - aE;
        const aS = a.match?.overall_score || 0;
        const bS = b.match?.overall_score || 0;
        if (aS !== bS) return bS - aS;
        return new Date(b.created_at) - new Date(a.created_at);
      });

      res.json(enriched);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── GET /api/employer/match-scores/:jobId ─────────────────────────────────

  app.get('/api/employer/match-scores/:jobId', async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const jobId = req.params.jobId;

      // Verify ownership
      const { data: job } = await supabase.from('jobs')
        .select('*').eq('id', jobId).single();
      if (!job || job.employer_id !== user.id)
        return res.status(403).json({ error: 'Not your job' });

      try {
        const { data, error } = await supabase.from('match_scores')
          .select('user_id, eligible, overall_score, match_band, eligibility_tier, breakdown, match_reasons, gaps, missing_required, calculated_at')
          .eq('job_id', jobId)
          .order('overall_score', { ascending: false });
        if (error) throw error;

        let scores = data || [];

        // Auto-fill: find applicants who don't have match scores yet
        const { data: apps } = await supabase.from('applications')
          .select('candidate_id').eq('job_id', jobId);
        const applicantIds = [...new Set((apps || []).map(a => a.candidate_id).filter(Boolean))];
        const scoredIds = new Set(scores.map(s => s.user_id));
        const missingIds = applicantIds.filter(id => !scoredIds.has(id));

        if (missingIds.length > 0) {
          const { data: profiles } = await supabase.from('ai_profiles')
            .select('*').in('user_id', missingIds);
          const { data: criteria } = await supabase.from('job_match_criteria')
            .select('*').eq('job_id', jobId).maybeSingle();

          for (const profile of (profiles || [])) {
            if (profile.parse_status === 'failed') continue;
            const result = calculateCandidateJobMatch(profile, job, criteria || {});
            const scoreObj = {
              user_id: profile.user_id,
              eligible: result.eligible,
              overall_score: result.match_score,
              match_band: result.match_band,
              eligibility_tier: result.eligibility_tier,
              breakdown: result.score_breakdown,
              match_reasons: result.match_reasons,
              gaps: result.gaps,
              missing_required: [],
              calculated_at: new Date().toISOString(),
            };
            scores.push(scoreObj);

            // Fire-and-forget DB write
            supabase.from('match_scores').upsert({
              ...scoreObj,
              job_id: jobId,
              criteria_version: result.criteria_version || 1,
              insights: result.insights || [],
              executive_summary: result.executive_summary || null,
            }, { onConflict: 'user_id,job_id' }).then(({ error: e }) => {
              if (e) console.warn('[employer/match-scores] upsert err:', e.message);
            });
          }
          if (profiles?.length) console.log(`[employer/match-scores] Auto-filled ${profiles.length} scores for job ${jobId}`);
        }

        res.json({ scores });
      } catch (dbErr) {
        console.warn('[employer/match-scores] DB query failed:', dbErr.message);
        res.json({ scores: [] });
      }
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── POST /api/job-criteria ───────────────────────────────────────────────

  app.post('/api/job-criteria', async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const { job_id, ...criteria } = req.body;
      if (!job_id) return res.status(400).json({ error: 'job_id required' });

      const { data: job } = await supabase.from('jobs')
        .select('employer_id').eq('id', job_id).single();
      if (!job || job.employer_id !== user.id)
        return res.status(403).json({ error: 'Not your job' });

      const payload = { job_id };
      const arrFields = ['required_skills','preferred_skills','preferred_fields','trainable_skills','nice_to_haves'];
      const intFields = ['min_experience_years','weight_skills','weight_education','weight_experience','weight_location','weight_language','criteria_version'];
      const strFields = ['min_education_level','work_model','team_size','pace','industry','role_family','role_level'];
      const boolFields = ['location_strict'];
      const jsonFields = ['required_languages','hard_gates','success_factors','calibration_snapshot'];

      for (const f of arrFields) if (criteria[f] !== undefined) payload[f] = Array.isArray(criteria[f]) ? criteria[f] : [];
      for (const f of intFields) if (criteria[f] !== undefined) payload[f] = parseInt(criteria[f]) || 0;
      for (const f of strFields) if (criteria[f] !== undefined) payload[f] = criteria[f];
      for (const f of boolFields) if (criteria[f] !== undefined) payload[f] = !!criteria[f];
      for (const f of jsonFields) if (criteria[f] !== undefined) payload[f] = criteria[f];

      // Auto-detect criteria version
      if (Array.isArray(criteria.success_factors) && criteria.success_factors.length > 0) {
        payload.criteria_version = 2;
      } else if (!payload.criteria_version) {
        payload.criteria_version = 1;
      }

      const { data, error } = await supabase.from('job_match_criteria')
        .upsert(payload, { onConflict: 'job_id' }).select().single();
      if (error) return res.status(500).json({ error: error.message });

      // Audit log
      try {
        await supabase.from('criteria_audit_log').insert({
          job_id, employer_id: user.id,
          action: 'updated',
          criteria_snapshot: payload,
        });
      } catch (auditErr) { console.warn('[AI] Audit log non-fatal:', auditErr.message); }

      recalculateForJob(job_id).catch(e => console.warn('[AI] Recalc:', e.message));
      res.json({ criteria: data });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── GET /api/job-criteria/:jobId ─────────────────────────────────────────

  app.get('/api/job-criteria/:jobId', async (req, res) => {
    try {
      // H-12: Add authentication — job criteria should not be publicly accessible
      const user = await getUserFromToken(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const { data, error } = await supabase.from('job_match_criteria')
        .select('*').eq('job_id', req.params.jobId).maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      res.json({ criteria: data });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── GET /api/role-templates — Return available role templates ─────────────

  app.get('/api/role-templates', (req, res) => {
    const { ROLE_TEMPLATES } = require('../lib/matching-config');
    res.json({ templates: ROLE_TEMPLATES });
  });

  // ── POST /api/match/recalculate ──────────────────────────────────────────

  app.post('/api/match/recalculate', async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const { user_id, job_id } = req.body;
      let count = 0;

      // H-11: Restrict recalculation to own user or own jobs only
      if (user_id) {
        if (user_id !== user.id) {
          return res.status(403).json({ error: 'Cannot recalculate for other users' });
        }
        count = await recalculateForStudent(user_id);
      } else if (job_id) {
        // Verify employer owns this job
        const { data: job } = await supabase.from('jobs')
          .select('employer_id').eq('id', job_id).maybeSingle();
        if (!job || job.employer_id !== user.id) {
          return res.status(403).json({ error: 'Not your job' });
        }
        count = await recalculateForJob(job_id);
      } else {
        count = await recalculateForStudent(user.id);
      }
      res.json({ success: true, scores_updated: count });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── POST /api/ai-profile/generate — Generate AI-assisted profile summary ──

  app.post('/api/ai-profile/generate', async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      // Get current AI profile data
      let profileData = {};
      try {
        const { data } = await supabase.from('ai_profiles')
          .select('*').eq('user_id', user.id).maybeSingle();
        if (data) {
          const { raw_cv_text, ...safe } = data;
          profileData = safe;
        }
      } catch (e) { /* table may not exist */ }

      // Merge with any body data the candidate sent
      const merged = { ...profileData, ...(req.body.candidateData || {}) };

      // Generate AI-assisted profile
      const aiResult = generateCandidateProfileSummary(merged);

      // Calculate profile completion
      const completion = calculateProfileCompletion(merged);

      // Save AI-generated content (unapproved by default)
      try {
        await supabase.from('ai_profiles').upsert({
          user_id: user.id,
          ai_headline: aiResult.headline,
          ai_summary: aiResult.summary,
          ai_portfolio_intro: aiResult.portfolio_intro,
          ai_strengths: aiResult.strengths,
          ai_development_areas: aiResult.development_areas,
          ai_suggested_roles: aiResult.suggested_roles,
          ai_suggested_categories: aiResult.suggested_categories,
          ai_missing_fields: aiResult.missing_fields,
          ai_profile_quality_notes: aiResult.profile_quality_notes,
          ai_normalized_skills: aiResult.normalized_skills,
          experience_level: aiResult.experience_level,
          ai_profile_approved: true, // Auto approved
          ai_generated_at: new Date().toISOString(),
          profile_completion_score: completion.score,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      } catch (e) {
        console.warn('[ai-profile/generate] DB save non-fatal:', e.message);
      }

      res.json({
        ai_profile: aiResult,
        profile_completion: completion,
        approved: false,
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── POST /api/ai-profile/approve — Candidate approves AI content ──────────

  app.post('/api/ai-profile/approve', async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      // Candidate can also send edited versions of AI text
      const edits = req.body || {};
      const updateData = {
        ai_profile_approved: true,
        updated_at: new Date().toISOString(),
      };

      // Allow candidate to edit AI content before approving
      if (edits.headline) updateData.ai_headline = edits.headline;
      if (edits.summary) updateData.ai_summary = edits.summary;
      if (edits.portfolio_intro) updateData.ai_portfolio_intro = edits.portfolio_intro;
      if (edits.strengths) updateData.ai_strengths = edits.strengths;

      try {
        const { error } = await supabase.from('ai_profiles')
          .update(updateData).eq('user_id', user.id);
        if (error) throw error;
        res.json({ success: true, approved: true });
      } catch (e) {
        console.warn('[ai-profile/approve] DB error:', e.message);
        res.status(500).json({ error: e.message });
      }
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── DELETE /api/ai-profile/ai-content — Delete AI-generated content ───────

  app.delete('/api/ai-profile/ai-content', async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      try {
        await supabase.from('ai_profiles').update({
          ai_headline: null, ai_summary: null, ai_portfolio_intro: null,
          ai_strengths: '{}', ai_development_areas: '{}',
          ai_suggested_roles: '{}', ai_suggested_categories: '{}',
          ai_missing_fields: '{}', ai_profile_quality_notes: '{}',
          ai_normalized_skills: '{}', ai_profile_approved: false,
          ai_generated_at: null, updated_at: new Date().toISOString(),
        }).eq('user_id', user.id);
        res.json({ success: true });
      } catch (e) { res.json({ success: true }); }
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── GET /api/ai-profile/completion — Profile completion score ─────────────

  app.get('/api/ai-profile/completion', async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      let profileData = {};
      try {
        const { data } = await supabase.from('ai_profiles')
          .select('*').eq('user_id', user.id).maybeSingle();
        if (data) profileData = data;
      } catch (e) { /* table may not exist */ }

      const completion = calculateProfileCompletion(profileData);
      res.json(completion);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── GET /api/employer/candidate-card/:userId/:jobId — Employer candidate card

  app.get('/api/employer/candidate-card/:userId/:jobId', async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const { userId, jobId } = req.params;

      // Verify employer owns this job
      const { data: job } = await supabase.from('jobs')
        .select('employer_id, title, location, work_model').eq('id', jobId).single();
      if (!job || job.employer_id !== user.id) {
        return res.status(403).json({ error: 'Not your job' });
      }

      // Get candidate AI profile
      let profile = {};
      try {
        const { data } = await supabase.from('ai_profiles')
          .select('full_name,location,hard_skills,soft_skills,languages,experience_level,experience_years,education_level,education_field,availability_hours,preferred_job_types,ai_headline,ai_summary,ai_strengths,ai_suggested_roles,ai_suggested_categories,ai_profile_approved')
          .eq('user_id', userId).maybeSingle();
        if (data) profile = data;
      } catch (e) { /* table may not exist */ }

      // Get match score
      let matchData = null;
      try {
        const { data } = await supabase.from('match_scores')
          .select('overall_score,breakdown,match_reasons,gaps')
          .eq('user_id', userId).eq('job_id', jobId).maybeSingle();
        if (data) matchData = data;
      } catch (e) { /* table may not exist */ }

      // Build card — only show AI content if approved
      const card = {
        candidate_id: userId,
        job_id: jobId,
        name: profile.full_name,
        headline: profile.ai_profile_approved ? profile.ai_headline : null,
        summary: profile.ai_profile_approved ? profile.ai_summary : null,
        match_score: matchData?.overall_score || null,
        score_breakdown: matchData?.breakdown || null,
        match_reasons: matchData?.match_reasons || [],
        gaps: matchData?.gaps || [],
        skills: [...(profile.hard_skills || []), ...(profile.soft_skills || [])],
        languages: profile.languages,
        availability_hours: profile.availability_hours,
        location: profile.location,
        experience_level: profile.experience_level,
        education: profile.education_level ? `${profile.education_level}${profile.education_field ? ' - ' + profile.education_field : ''}` : null,
        suggested_roles: profile.ai_profile_approved ? profile.ai_suggested_roles : [],
        suggested_categories: profile.ai_profile_approved ? profile.ai_suggested_categories : [],
        strengths: profile.ai_profile_approved ? profile.ai_strengths : [],
        ai_approved: profile.ai_profile_approved || false,
      };

      res.json({ card });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── POST /api/employer/match-scores-bulk — Fetch match scores (bypasses RLS) ──

  app.post('/api/employer/match-scores-bulk', async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const { candidate_ids, job_ids } = req.body;
      if (!Array.isArray(candidate_ids) || !Array.isArray(job_ids)) {
        return res.json({ scores: {} });
      }

      const cIds = candidate_ids.slice(0, 50);
      const jIds = job_ids.slice(0, 50);

      // Verify that the logged-in user is the employer who owns these jobs
      const { data: ownJobs, error: jobsErr } = await supabase
        .from('jobs')
        .select('id')
        .eq('employer_id', user.id)
        .in('id', jIds);

      const authorizedJobIds = (ownJobs || []).map(j => j.id);

      if (jobsErr || authorizedJobIds.length === 0) {
        return res.json({ scores: {} });
      }

      const { data: matchScores, error } = await supabase.from('match_scores')
        .select('user_id, job_id, overall_score, match_band, eligibility_tier, breakdown, match_reasons, gaps')
        .in('user_id', cIds)
        .in('job_id', authorizedJobIds);

      if (error) {
        console.warn('[match-scores-bulk] Error:', error.message);
        return res.json({ scores: {} });
      }

      const scoresMap = {};
      (matchScores || []).forEach(ms => {
        scoresMap[`${ms.user_id}_${ms.job_id}`] = ms;
      });

      // Auto-fill missing pairs
      const missingPairs = [];
      for (const cid of cIds) {
        for (const jid of jIds) {
          if (!scoresMap[`${cid}_${jid}`]) {
            missingPairs.push({ candidate_id: cid, job_id: jid });
          }
        }
      }

      if (missingPairs.length > 0 && missingPairs.length <= 200) {
        try {
          // Fetch all needed profiles and jobs
          const uniqueCids = [...new Set(missingPairs.map(p => p.candidate_id))];
          const uniqueJids = [...new Set(missingPairs.map(p => p.job_id))];

          const { data: profiles } = await supabase.from('ai_profiles')
            .select('*').in('user_id', uniqueCids);
          const profileMap = {};
          (profiles || []).forEach(p => { profileMap[p.user_id] = p; });

          const { data: jobs } = await supabase.from('jobs')
            .select('*').in('id', uniqueJids);
          const jobMap = {};
          (jobs || []).forEach(j => { jobMap[j.id] = j; });

          const { data: criteriaRows } = await supabase.from('job_match_criteria')
            .select('*').in('job_id', uniqueJids);
          const cMap = {};
          (criteriaRows || []).forEach(c => { cMap[c.job_id] = c; });

          let filled = 0;
          for (const { candidate_id, job_id } of missingPairs) {
            const profile = profileMap[candidate_id];
            const job = jobMap[job_id];
            if (!profile || profile.parse_status === 'failed' || !job) continue;

            const result = calculateCandidateJobMatch(profile, job, cMap[job_id] || {});
            const key = `${candidate_id}_${job_id}`;
            scoresMap[key] = {
              user_id: candidate_id,
              job_id: job_id,
              overall_score: result.match_score,
              match_band: result.match_band,
              eligibility_tier: result.eligibility_tier,
              breakdown: result.score_breakdown,
              match_reasons: result.match_reasons,
              gaps: result.gaps,
            };

            // Fire-and-forget DB write
            supabase.from('match_scores').upsert({
              user_id: candidate_id, job_id: job_id,
              eligible: result.eligible,
              overall_score: result.match_score,
              breakdown: result.score_breakdown,
              match_reasons: result.match_reasons,
              gaps: result.gaps,
              match_band: result.match_band,
              eligibility_tier: result.eligibility_tier,
              criteria_version: result.criteria_version || 1,
              insights: result.insights || [],
              executive_summary: result.executive_summary || null,
              missing_required: [],
              calculated_at: new Date().toISOString(),
            }, { onConflict: 'user_id,job_id' }).then(({ error: e }) => {
              if (e) console.warn('[match-scores-bulk] upsert err:', e.message);
            });
            filled++;
          }
          if (filled > 0) console.log(`[match-scores-bulk] Auto-filled ${filled} missing scores`);
        } catch (calcErr) {
          console.warn('[match-scores-bulk] Auto-fill non-fatal:', calcErr.message);
        }
      }

      res.json({ scores: scoresMap });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/employer/ai-profiles — Fetch AI profiles for candidates ──────
  // Server-side only (bypasses RLS) — employer must own the jobs the candidates applied to

  app.post('/api/employer/ai-profiles', async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const { candidate_ids } = req.body;
      if (!Array.isArray(candidate_ids) || candidate_ids.length === 0) {
        return res.json({ profiles: {} });
      }

      // Limit to 50 at a time
      const ids = candidate_ids.slice(0, 50);

      // Verify that the candidate has applied to a job owned by this employer, or is requesting their own profile
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id')
        .eq('employer_id', user.id);
      const jobIds = (jobs || []).map(j => j.id);

      const selfRequested = ids.filter(id => id === user.id);
      let authorizedCandidateIds = [...selfRequested];

      if (jobIds.length > 0) {
        const { data: apps } = await supabase
          .from('applications')
          .select('candidate_id')
          .in('candidate_id', ids)
          .or(`employer_id.eq.${user.id},job_id.in.(${jobIds.join(',')})`);
        if (apps) {
          authorizedCandidateIds.push(...apps.map(a => a.candidate_id));
        }
      } else {
        const { data: apps } = await supabase
          .from('applications')
          .select('candidate_id')
          .in('candidate_id', ids)
          .eq('employer_id', user.id);
        if (apps) {
          authorizedCandidateIds.push(...apps.map(a => a.candidate_id));
        }
      }

      authorizedCandidateIds = [...new Set(authorizedCandidateIds)];

      if (authorizedCandidateIds.length === 0) {
        return res.json({ profiles: {} });
      }

      const { data: aiProfiles, error } = await supabase.from('ai_profiles')
        .select('user_id, ai_headline, ai_summary, ai_strengths, ai_suggested_roles, hard_skills, soft_skills, languages, experience_years, experience_level, education_level, education_field, education_school, confidence_score')
        .in('user_id', authorizedCandidateIds);

      if (error) {
        console.warn('[employer/ai-profiles] Query error:', error.message);
        return res.json({ profiles: {} });
      }

      const profilesMap = {};
      (aiProfiles || []).forEach(p => {
        profilesMap[p.user_id] = p;
      });

      res.json({ profiles: profilesMap });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Export helpers for server.js to call after CV upload
  _recalcHelpers = { recalculateForStudent, recalculateForJob };
}

aiMatchingRouter.helpers = _recalcHelpers;

// Wrap so helpers become available after first call
const wrappedRouter = function(...args) {
  aiMatchingRouter(...args);
  wrappedRouter.helpers = _recalcHelpers;
};
wrappedRouter.helpers = _recalcHelpers;

module.exports = wrappedRouter;
