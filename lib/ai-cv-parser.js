'use strict';

/**
 * AI CV Parser — GPT-4o-mini powered structured extraction
 * 
 * FLOW: CV stored in Supabase → raw text extracted → sent to GPT → structured profile saved
 * TRIGGER: ONLY on CV upload (server.js upload handler)
 * 
 * SECURITY & COST CONTROLS:
 * 1. Daily budget cap: $1.00/day (OPENAI_DAILY_BUDGET_USD)
 * 2. Per-user rate limit: 10 analyses/user/24h (OPENAI_PER_USER_LIMIT)
 * 3. Global rate limit: 200 total API calls/24h (OPENAI_GLOBAL_DAILY_LIMIT)
 * 4. Input sanitization: strips injection attempts, caps input at 8000 chars
 * 5. max_tokens hard-capped at 2500
 * 6. Token usage tracking with live cost calculation
 * 7. API key never exposed to client (server-side only)
 * 8. Auto-fallback to free rule-based parsing when any limit is hit
 */

const OpenAI = require('openai');
const { extractProfileFromText } = require('./ai-extraction');
const { generateCandidateProfileSummary } = require('./ai-profile-builder');

// ── Configuration ───────────────────────────────────────────────────────────

const CONFIG = {
  model: 'gpt-4o-mini',
  maxInputChars: 8000,
  maxTokensResponse: 2500,       // Increased for executive_summary
  temperature: 0.1,
  dailyBudgetUSD: parseFloat(process.env.OPENAI_DAILY_BUDGET_USD) || 1.00,
  perUserDailyLimit: parseInt(process.env.OPENAI_PER_USER_LIMIT) || 10,
  globalDailyLimit: parseInt(process.env.OPENAI_GLOBAL_DAILY_LIMIT) || 200,
  inputPricePer1M: 0.15,
  outputPricePer1M: 0.60,
};

// ── Rate Limiting & Cost Tracking ───────────────────────────────────────────

const usageTracker = {
  dailyReset: new Date().toDateString(),
  totalCallsToday: 0,
  totalCostToday: 0,
  totalTokensToday: { input: 0, output: 0 },
  perUser: new Map(),
  
  reset() {
    const today = new Date().toDateString();
    if (this.dailyReset !== today) {
      console.log('[AI Budget] Daily reset — yesterday: ' + this.totalCallsToday + ' calls, $' + this.totalCostToday.toFixed(4));
      this.dailyReset = today;
      this.totalCallsToday = 0;
      this.totalCostToday = 0;
      this.totalTokensToday = { input: 0, output: 0 };
      this.perUser.clear();
    }
  },
  
  canMakeCall(userId) {
    this.reset();
    if (this.totalCallsToday >= CONFIG.globalDailyLimit) {
      return { allowed: false, reason: 'Global daily limit reached (' + CONFIG.globalDailyLimit + ')' };
    }
    if (this.totalCostToday >= CONFIG.dailyBudgetUSD) {
      return { allowed: false, reason: 'Daily budget exhausted ($' + this.totalCostToday.toFixed(4) + '/$' + CONFIG.dailyBudgetUSD + ')' };
    }
    if (userId) {
      const userUsage = this.perUser.get(userId) || { calls: 0 };
      if (userUsage.calls >= CONFIG.perUserDailyLimit) {
        return { allowed: false, reason: 'Per-user limit reached (' + CONFIG.perUserDailyLimit + '/day)' };
      }
    }
    return { allowed: true };
  },
  
  recordCall(userId, inputTokens, outputTokens) {
    this.reset();
    this.totalCallsToday++;
    this.totalTokensToday.input += inputTokens;
    this.totalTokensToday.output += outputTokens;
    const cost = (inputTokens * CONFIG.inputPricePer1M / 1000000) + (outputTokens * CONFIG.outputPricePer1M / 1000000);
    this.totalCostToday += cost;
    if (userId) {
      const existing = this.perUser.get(userId) || { calls: 0 };
      this.perUser.set(userId, { calls: existing.calls + 1, lastCall: new Date() });
    }
    console.log('[AI Budget] Call #' + this.totalCallsToday + ' | ' + inputTokens + '+' + outputTokens + ' tokens | $' + cost.toFixed(5) + ' | Day total: $' + this.totalCostToday.toFixed(4) + '/$' + CONFIG.dailyBudgetUSD);
    return cost;
  },
  
  getUserCallsRemaining(userId) {
    this.reset();
    const userUsage = this.perUser.get(userId) || { calls: 0 };
    return Math.max(0, CONFIG.perUserDailyLimit - userUsage.calls);
  },
  
  getStatus() {
    this.reset();
    return {
      calls_today: this.totalCallsToday,
      cost_today_usd: parseFloat(this.totalCostToday.toFixed(4)),
      budget_usd: CONFIG.dailyBudgetUSD,
      budget_remaining_usd: parseFloat((CONFIG.dailyBudgetUSD - this.totalCostToday).toFixed(4)),
      tokens_today: Object.assign({}, this.totalTokensToday),
      global_limit: CONFIG.globalDailyLimit,
      per_user_limit: CONFIG.perUserDailyLimit,
      active_users: this.perUser.size,
    };
  },
};

// ── Input Sanitization ──────────────────────────────────────────────────────

function sanitizeCvText(rawText) {
  if (typeof rawText !== 'string') return '';
  var clean = rawText.substring(0, CONFIG.maxInputChars);
  var INJECTION_PATTERNS = [
    /ignore\s+(previous|above|all)\s+instructions/gi,
    /you\s+are\s+now\s+/gi,
    /system\s*:\s*/gi,
    /\bact\s+as\b/gi,
    /\bpretend\s+to\s+be\b/gi,
    /\bforget\s+(everything|all|previous)\b/gi,
    /\bdo\s+not\s+follow\b.*\binstructions\b/gi,
    /\bnew\s+instructions?\b/gi,
    /```[\s\S]*?```/g,
    /<script[\s\S]*?>/gi,
  ];
  for (var i = 0; i < INJECTION_PATTERNS.length; i++) {
    clean = clean.replace(INJECTION_PATTERNS[i], '[removed]');
  }
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  clean = clean.replace(/\n{4,}/g, '\n\n\n');
  clean = clean.replace(/ {4,}/g, '   ');
  return clean.trim();
}

// ── GPT Prompts (v3 — structured, employer-aligned) ─────────────────────────

var SYSTEM_PROMPT = [
  'You are an expert CV analysis assistant for unemployed.sk, a jobs platform focused on students, graduates, internships, part-time jobs, junior roles, and early-career opportunities.',
  '',
  'Your task is to transform candidate CV/profile information into a structured, truthful, employer-friendly candidate profile.',
  '',
  'You must analyze the candidate\'s education, experience, skills, languages, availability signals, and career direction. You must also generate a professional AI summary and portfolio-style profile text.',
  '',
  'Important rules:',
  '- Do not invent facts.',
  '- Do not exaggerate experience.',
  '- Do not claim the candidate has skills, degrees, jobs, certifications, or language levels unless supported by the input.',
  '- Do not make final hiring decisions.',
  '- Do not rank the candidate.',
  '- Do not assign a candidate-job match score.',
  '- Do not compare the candidate against other candidates.',
  '- Do not infer sensitive personal attributes.',
  '- Do not include protected characteristics such as race, religion, health, politics, sexual orientation, or family status.',
  '- Do not include age unless explicitly relevant and provided.',
  '- If information is missing or unclear, add it to missing_fields or uncertainty_notes.',
  '- Treat student projects, volunteering, school activities, part-time jobs, and internships as valid experience, but label them accurately.',
  '- For students and graduates, emphasize transferable skills, motivation, field of study, tools used, languages, availability, and junior-friendly role fit.',
  '- The headline must describe who the candidate IS right now (e.g. "Economics Student", "Recent Marketing Graduate", "Junior Frontend Developer"), NOT a job title they are applying for or seeking. Never label someone as an intern or role they have not yet held.',
  '- Keep employer-facing language professional, concise, and factual.',
  '- Output valid JSON only.',
  '- Do not include markdown.',
  '- Do not include commentary outside the JSON.',
  '',
  'Language rules:',
  '- CVs may be in Slovak, Czech, English, or mixed language.',
  '- Normalize skills and categories into English snake_case values.',
  '- Generate human-readable summaries in English.',
  '',
  'Experience level definitions:',
  '- "no_experience": no work, internship, volunteering, project, or practical experience found.',
  '- "beginner": some school projects, volunteering, student club work, informal work, or very limited work experience.',
  '- "junior": relevant internship, part-time work, freelance work, or 6-24 months of relevant experience.',
  '- "experienced": more than 24 months of relevant professional experience.',
  '- "unknown": not enough information.',
  '',
  'Job category guidance (use these exact values):',
  'marketing, sales, customer_support, administration, finance, accounting, software_development, data_analytics, design, hospitality, retail, logistics, hr, legal, education, events, social_media, operations, engineering, healthcare, other.',
].join('\n');

var USER_PROMPT_TEMPLATE = [
  'Analyze the following CV text and return a structured candidate profile as JSON.',
  '',
  'Your output must follow this exact JSON structure:',
  '{',
  '  "candidate_identity": {',
  '    "full_name": "string or null",',
  '    "email": "string or null",',
  '    "phone_number": "string with country code or null",',
  '    "location": "City, Country or null",',
  '    "linkedin_url": "string or null",',
  '    "portfolio_url": "string or null",',
  '    "github_url": "string or null",',
  '    "other_links": []',
  '  },',
  '  "education": [',
  '    {',
  '      "school": "institution name",',
  '      "degree": "degree title",',
  '      "field_of_study": "exact program name",',
  '      "education_level": "high_school|bachelors|masters|phd",',
  '      "start_year": "YYYY",',
  '      "end_year": "YYYY or null if current",',
  '      "is_current": false,',
  '      "confidence": 0.0',
  '    }',
  '  ],',
  '  "work_experience": [',
  '    {',
  '      "title": "job title",',
  '      "company": "company name",',
  '      "employment_type": "internship|part-time|full-time|freelance|volunteer|student_project",',
  '      "start_date": "YYYY-MM or YYYY",',
  '      "end_date": "YYYY-MM or null if current",',
  '      "is_current": false,',
  '      "description": "2-3 sentence summary of responsibilities and skills used",',
  '      "detected_skills": ["skills demonstrated in this role"],',
  '      "confidence": 0.0',
  '    }',
  '  ],',
  '  "projects": [',
  '    {',
  '      "name": "project name",',
  '      "description": "what was built/done",',
  '      "detected_skills": [],',
  '      "confidence": 0.0',
  '    }',
  '  ],',
  '  "skills": {',
  '    "raw_skills": ["every skill mentioned verbatim"],',
  '    "normalized_skills": ["deduplicated lowercase skill names"],',
  '    "technical_skills": ["tools, frameworks, platforms, domain skills"],',
  '    "soft_skills": ["interpersonal and transferable skills"],',
  '    "tools": ["specific software/tools: excel, canva, figma, etc."],',
  '    "skill_confidence_notes": ["notes about uncertain skill claims"]',
  '  },',
  '  "languages": [',
  '    {',
  '      "language": "language name",',
  '      "level": "A1|A2|B1|B2|C1|C2",',
  '      "confidence": 0.0',
  '    }',
  '  ],',
  '  "certifications": [',
  '    {',
  '      "name": "certification name",',
  '      "issuer": "issuing organization or null",',
  '      "year": "YYYY or null",',
  '      "confidence": 0.0',
  '    }',
  '  ],',
  '  "candidate_classification": {',
  '    "experience_level": "no_experience|beginner|junior|experienced|unknown",',
  '    "candidate_type": "high_school_student|university_student|graduate|career_starter|junior_professional|unknown",',
  '    "likely_job_categories": ["from: marketing, sales, customer_support, administration, finance, accounting, software_development, data_analytics, design, hospitality, retail, logistics, hr, legal, education, events, social_media, operations, engineering, healthcare, other"],',
  '    "suggested_roles": ["3-5 specific job titles this candidate fits"],',
  '    "preferred_job_types_detected": ["internship|part-time|full-time|contract"],',
  '    "availability_detected": "immediate|2_weeks|1_month|flexible|null",',
  '    "work_mode_preference_detected": "remote|hybrid|on-site|any|null",',
  '    "salary_expectation_detected": "string or null"',
  '  },',
  '  "ai_profile": {',
  '    "headline": { "sk": "profesionálny nadpis max 60 znakov — popisuje kým kandidát JE (napr. Študent ekonómie | Bratislava), NIE pozíciu ktorú hľadá", "en": "professional headline max 60 chars — describes who they ARE now (e.g. Economics Student | City), NOT a job title they are seeking" },',
  '    "short_summary": { "sk": "1 vetný pitch kandidáta po slovensky", "en": "1 sentence candidate pitch in English" },',
  '    "portfolio_intro": { "sk": "profesionálne portfólio intro po slovensky alebo null", "en": "professional portfolio intro paragraph in English or null" },',
  '    "employer_summary": { "sk": "3-5 vetný executive summary v tretej osobe po slovensky. Pokryte: kto je kandidát, vzdelanie, zručnosti, skúsenosti a typ pozície pre ktorú sa hodí.", "en": "3-5 sentence executive summary in third person in English. Cover: who they are, education, key skills, experience, and role fit." },',
  '    "strengths": [{ "sk": "silná stránka po slovensky", "en": "strength in English" }],',
  '    "development_areas": [{ "sk": "oblasť rozvoja po slovensky", "en": "development area in English" }],',
  '    "career_direction": { "sk": "1 veta o kariérnom smerovaní po slovensky", "en": "1 sentence about career trajectory in English" },',
  '    "profile_quality_notes": ["any notes about profile completeness or quality"]',
  '  },',
  '  "profile_completion": {',
  '    "estimated_completion_score": 0,',
  '    "missing_fields": ["fields that are missing or incomplete"],',
  '    "recommended_candidate_actions": ["suggested next steps to improve their profile"]',
  '  },',
  '  "matching_features": {',
  '    "normalized_location": "lowercase city, country",',
  '    "normalized_preferred_locations": ["lowercase cities"],',
  '    "normalized_job_types": ["internship|part-time|full-time|contract"],',
  '    "normalized_categories": ["from the job category list above"],',
  '    "normalized_skills": ["all skills deduplicated, lowercase"],',
  '    "normalized_languages": [{"lang": "name", "level": "A1-C2"}],',
  '    "field_of_study_normalized": "lowercase field name",',
  '    "experience_level": "no_experience|beginner|junior|experienced|unknown",',
  '    "availability_hours_per_week": null,',
  '    "salary_expectation_min": null,',
  '    "salary_expectation_max": null,',
  '    "work_mode_preferences": ["remote|hybrid|on-site"]',
  '  },',
  '  "risk_and_uncertainty": {',
  '    "uncertainty_notes": ["things that are ambiguous in the CV"],',
  '    "possible_parsing_issues": ["potential extraction problems"],',
  '    "low_confidence_fields": ["field names with low confidence"]',
  '  }',
  '}',
  '',
  'CV TEXT:',
  '"""',
].join('\n');

var USER_PROMPT_SUFFIX = '\n"""\n\nReturn ONLY valid JSON. No markdown. No commentary.';

function buildUserPrompt(cvText) {
  return USER_PROMPT_TEMPLATE + '\n' + cvText + USER_PROMPT_SUFFIX;
}

// ── OpenAI Client ───────────────────────────────────────────────────────────

var openaiClient = null;

function getClient() {
  if (openaiClient) return openaiClient;
  var key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  if (!key.startsWith('sk-')) {
    console.error('[AI CV Parser] Invalid API key format');
    return null;
  }
  openaiClient = new OpenAI({ apiKey: key });
  return openaiClient;
}

// ── Main Parser ─────────────────────────────────────────────────────────────

async function parseWithAI(rawText, existingProfile, userId) {
  existingProfile = existingProfile || {};
  var client = getClient();
  if (!client) {
    console.warn('[AI CV Parser] No OPENAI_API_KEY — using rule-based fallback');
    return fallbackParse(rawText, existingProfile);
  }

  var rateCheck = usageTracker.canMakeCall(userId);
  if (!rateCheck.allowed) {
    console.warn('[AI CV Parser] BLOCKED: ' + rateCheck.reason);
    var result = fallbackParse(rawText, existingProfile);
    result._blocked_reason = rateCheck.reason;
    return result;
  }

  var sanitized = sanitizeCvText(rawText);
  if (sanitized.length < 50) {
    console.warn('[AI CV Parser] Text too short after sanitization');
    return fallbackParse(rawText, existingProfile);
  }

  var userPrompt = buildUserPrompt(sanitized);

  try {
    var response = await client.chat.completions.create({
      model: CONFIG.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: CONFIG.temperature,
      max_tokens: CONFIG.maxTokensResponse,
      response_format: { type: 'json_object' },
    });

    var usage = response.usage || {};
    usageTracker.recordCall(userId, usage.prompt_tokens || 0, usage.completion_tokens || 0);

    var content = response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content;
    if (!content) {
      console.warn('[AI CV Parser] Empty API response');
      return fallbackParse(rawText, existingProfile);
    }

    var parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.warn('[AI CV Parser] Invalid JSON from API');
      return fallbackParse(rawText, existingProfile);
    }

    var result = normalizeApiResult(parsed, existingProfile);
    result._source = 'openai';
    result._model = CONFIG.model;
    result.confidence_score = calculateAiConfidence(result);

    console.log('[AI CV Parser] Done via ' + CONFIG.model + ': ' + (result.hard_skills || []).length + ' skills, ' + (result.languages || []).length + ' langs, ' + result.experience_years + 'yr, cat=' + (result.preferred_categories || []).join(','));
    return result;

  } catch (err) {
    console.error('[AI CV Parser] API error:', err.message);
    if (err.status === 401) console.error('[AI CV Parser] Invalid API key');
    else if (err.status === 429) console.error('[AI CV Parser] OpenAI rate limited');
    else if (err.status === 402) console.error('[AI CV Parser] OpenAI billing issue');
    return fallbackParse(rawText, existingProfile);
  }
}

// ── Normalize API Result (v3 — nested → flat DB mapping) ────────────────────

function normalizeApiResult(parsed, existing) {
  existing = existing || {};
  var safeArray = function(v) { return Array.isArray(v) ? v : []; };
  var safeString = function(v) { return (typeof v === 'string' && v.trim()) ? v.trim() : null; };
  var safeNumber = function(v) { var n = parseFloat(v); return isNaN(n) ? 0 : Math.max(0, n); };
  var safeObj = function(v) { return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}; };

  // Extract nested sections
  var identity = safeObj(parsed.candidate_identity);
  var skills = safeObj(parsed.skills);
  var classification = safeObj(parsed.candidate_classification);
  var aiProfile = safeObj(parsed.ai_profile);
  var profileCompletion = safeObj(parsed.profile_completion);
  var matchingFeatures = safeObj(parsed.matching_features);
  var riskUncertainty = safeObj(parsed.risk_and_uncertainty);

  // ── Skills: merge all skill arrays, deduplicate, lowercase ──
  var allSkillSources = [
    ...safeArray(skills.normalized_skills),
    ...safeArray(skills.technical_skills),
    ...safeArray(skills.tools),
    ...safeArray(matchingFeatures.normalized_skills),
  ];
  var hardSkills = Array.from(new Set(allSkillSources.map(function(s) { return (s || '').toLowerCase().trim(); }).filter(Boolean)));
  var softSkills = Array.from(new Set(safeArray(skills.soft_skills).map(function(s) { return (s || '').toLowerCase().trim(); }).filter(Boolean)));

  // ── Languages: normalize from new {language, level} format ──
  var languages = safeArray(parsed.languages).map(function(l) {
    return {
      lang: l.language || l.lang || 'Unknown',
      level: /^[A-C][1-2]$/i.test(l.level) ? l.level.toUpperCase() : 'B1',
    };
  }).filter(function(l) { return l.lang !== 'Unknown'; });

  // ── Education: take first/most relevant entry ──
  var eduEntries = safeArray(parsed.education);
  var primaryEdu = eduEntries.length > 0 ? eduEntries[0] : {};
  // Find current or last education
  for (var i = 0; i < eduEntries.length; i++) {
    if (eduEntries[i].is_current) { primaryEdu = eduEntries[i]; break; }
  }

  var validEduLevels = ['high_school', 'bachelors', 'masters', 'phd'];
  var eduLevel = safeString(primaryEdu.education_level);
  if (eduLevel && !validEduLevels.includes(eduLevel.toLowerCase())) {
    var eduMap = { 'bachelor': 'bachelors', 'master': 'masters', 'doctorate': 'phd', 'high school': 'high_school' };
    eduLevel = eduMap[eduLevel.toLowerCase()] || null;
  } else if (eduLevel) {
    eduLevel = eduLevel.toLowerCase();
  }

  // ── Experience: compute years from work_experience entries ──
  var workEntries = safeArray(parsed.work_experience);
  var totalMonths = 0;
  workEntries.forEach(function(w) {
    if (w.start_date && w.end_date) {
      var start = new Date(w.start_date);
      var end = new Date(w.end_date);
      if (!isNaN(start) && !isNaN(end)) {
        totalMonths += Math.max(0, (end - start) / (1000 * 60 * 60 * 24 * 30));
      }
    }
  });
  var computedYears = Math.round(totalMonths / 12);

  // ── Experience level mapping ──
  var validExpLevels = ['no_experience', 'beginner', 'junior', 'experienced', 'unknown'];
  var expLevel = safeString(classification.experience_level) || safeString(matchingFeatures.experience_level);
  if (expLevel && !validExpLevels.includes(expLevel.toLowerCase())) expLevel = 'beginner';
  else if (expLevel) expLevel = expLevel.toLowerCase();

  // ── Job types / work model ──
  var jobTypes = safeArray(classification.preferred_job_types_detected).concat(safeArray(matchingFeatures.normalized_job_types));
  var workModes = safeArray(matchingFeatures.work_mode_preferences);
  var workModeDetected = safeString(classification.work_mode_preference_detected);
  if (workModeDetected && !workModes.includes(workModeDetected)) workModes.push(workModeDetected);

  // ── Categories ──
  var categories = safeArray(classification.likely_job_categories).concat(safeArray(matchingFeatures.normalized_categories));
  categories = Array.from(new Set(categories.map(function(c) { return (c || '').toLowerCase().trim(); }).filter(Boolean)));

  // ── Certifications ──
  var certs = safeArray(parsed.certifications).map(function(c) {
    return typeof c === 'string' ? c : (c.name || '');
  }).filter(Boolean);

  // ── Work experience for DB storage (as JSONB) ──
  var workExpForDb = workEntries.map(function(w) {
    return {
      title: w.title || '',
      company: w.company || '',
      employment_type: w.employment_type || '',
      start_date: w.start_date || '',
      end_date: w.end_date || null,
      is_current: !!w.is_current,
      description: w.description || '',
      detected_skills: safeArray(w.detected_skills),
    };
  });

  // ── Preferred locations ──
  var prefLocations = safeArray(matchingFeatures.normalized_preferred_locations);
  if (prefLocations.length === 0) {
    var loc = safeString(identity.location) || safeString(matchingFeatures.normalized_location);
    if (loc) prefLocations = [loc.toLowerCase()];
  }

  // ── Portfolio links ──
  var portfolioLinks = safeArray(identity.other_links);
  if (identity.linkedin_url) portfolioLinks.push(identity.linkedin_url);
  if (identity.portfolio_url) portfolioLinks.push(identity.portfolio_url);
  if (identity.github_url) portfolioLinks.push(identity.github_url);

  // Helper: extract bilingual text — stores as JSON string {sk, en}
  function bilingualText(val) {
    if (!val) return null;
    if (typeof val === 'object' && (val.sk || val.en)) {
      return JSON.stringify({ sk: val.sk || val.en || '', en: val.en || val.sk || '' });
    }
    if (typeof val === 'string') return JSON.stringify({ sk: val, en: val });
    return null;
  }
  function bilingualArray(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.filter(Boolean).map(function(item) {
      if (typeof item === 'object' && (item.sk || item.en)) {
        return JSON.stringify({ sk: item.sk || item.en || '', en: item.en || item.sk || '' });
      }
      if (typeof item === 'string') return JSON.stringify({ sk: item, en: item });
      return null;
    }).filter(Boolean);
  }

  return {
    full_name: safeString(identity.full_name) || existing.full_name || null,
    email: safeString(identity.email) || existing.email || null,
    phone: safeString(identity.phone_number) || existing.phone || null,
    location: safeString(identity.location) || safeString(matchingFeatures.normalized_location) || existing.location || null,
    preferred_work_locations: prefLocations,

    hard_skills: hardSkills,
    soft_skills: softSkills,
    languages: languages,
    experience_years: computedYears || Math.min(safeNumber(parsed.experience_years), 15),
    experience_level: expLevel || 'beginner',
    work_experience: workExpForDb,
    education_level: eduLevel,
    education_field: safeString(primaryEdu.field_of_study),
    education_school: safeString(primaryEdu.school),

    preferred_job_types: Array.from(new Set(jobTypes.map(function(t) { return (t || '').toLowerCase().trim(); }).filter(Boolean))),
    preferred_work_models: Array.from(new Set(workModes.map(function(m) { return (m || '').toLowerCase().trim(); }).filter(Boolean))),
    preferred_categories: categories,
    availability_hours_per_week: safeNumber(matchingFeatures.availability_hours_per_week) || null,
    salary_expectation: safeNumber(matchingFeatures.salary_expectation_min) || null,
    work_mode_preference: workModeDetected ? workModeDetected.toLowerCase() : null,

    certifications: certs,
    portfolio_links: portfolioLinks.filter(Boolean),

    // AI-generated content (bilingual)
    ai_headline: bilingualText(aiProfile.headline),
    ai_summary: bilingualText(aiProfile.employer_summary),
    ai_portfolio_intro: bilingualText(aiProfile.portfolio_intro),
    ai_strengths: bilingualArray(aiProfile.strengths),
    ai_development_areas: bilingualArray(aiProfile.development_areas),
    ai_suggested_roles: safeArray(classification.suggested_roles).filter(Boolean),
    ai_suggested_categories: categories.slice(0, 3),
    ai_missing_fields: safeArray(profileCompletion.missing_fields),
    ai_profile_quality_notes: safeArray(aiProfile.profile_quality_notes),
    ai_normalized_skills: hardSkills,

    // Extra structured data (stored but not directly used in matching yet)
    _projects: safeArray(parsed.projects),
    _uncertainty: riskUncertainty,
    _candidate_type: safeString(classification.candidate_type),
    _career_direction: bilingualText(aiProfile.career_direction),
    _short_summary: bilingualText(aiProfile.short_summary),
    _profile_completion_score: safeNumber(profileCompletion.estimated_completion_score),
  };
}

function calculateAiConfidence(result) {
  var score = 0.5;
  if (result.full_name) score += 0.06;
  if ((result.hard_skills || []).length > 0) score += 0.1;
  if ((result.hard_skills || []).length > 5) score += 0.05;
  if ((result.languages || []).length > 0) score += 0.06;
  if (result.education_level) score += 0.06;
  if (result.education_field) score += 0.04;
  if (result.email || result.phone) score += 0.03;
  if (result.location) score += 0.04;
  if (result.experience_level && result.experience_level !== 'unknown') score += 0.03;
  if (result.ai_summary) score += 0.05;
  if (result.ai_headline) score += 0.03;
  if ((result.ai_suggested_roles || []).length > 0) score += 0.03;
  return Math.min(score, 1.0);
}

// ── Fallback (free, no API) ─────────────────────────────────────────────────

function fallbackParse(rawText, existingProfile) {
  existingProfile = existingProfile || {};
  console.log('[AI CV Parser] Using free rule-based fallback');
  var extracted = extractProfileFromText(rawText);
  var merged = Object.assign({}, extracted, existingProfile);
  var aiSummary = generateCandidateProfileSummary(merged);

  return {
    full_name: extracted.full_name || existingProfile.full_name || null,
    email: extracted.email || existingProfile.email || null,
    phone: extracted.phone || existingProfile.phone || null,
    location: extracted.location || existingProfile.location || null,
    preferred_work_locations: [],
    hard_skills: extracted.hard_skills || [],
    soft_skills: extracted.soft_skills || [],
    languages: extracted.languages || [],
    experience_years: extracted.experience_years || 0,
    experience_level: aiSummary.experience_level || 'beginner',
    experience_entries: [],
    education_level: extracted.education_level,
    education_field: extracted.education_field,
    education_school: extracted.education_school,
    job_type_preference: null,
    work_model_preference: null,
    availability_hours_per_week: null,
    salary_expectation: null,
    category: (aiSummary.suggested_categories && aiSummary.suggested_categories[0]) || null,
    industry_fit: [],
    certifications: [],
    interests: [],
    ai_headline: aiSummary.headline,
    ai_summary: aiSummary.summary,
    ai_portfolio_intro: aiSummary.portfolio_intro,
    ai_strengths: aiSummary.strengths,
    ai_development_areas: aiSummary.development_areas,
    ai_suggested_roles: aiSummary.suggested_roles,
    ai_suggested_categories: aiSummary.suggested_categories,
    ai_missing_fields: aiSummary.missing_fields,
    ai_profile_quality_notes: aiSummary.profile_quality_notes,
    ai_normalized_skills: aiSummary.normalized_skills,
    confidence_score: extracted.confidence_score || 0.5,
    _source: 'rule-based',
    _model: null,
  };
}

module.exports = { parseWithAI, fallbackParse, usageTracker, CONFIG };
