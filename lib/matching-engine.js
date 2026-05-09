'use strict';
// Matching engine v2 — Intelligent, multi-dimensional scoring with real insights.
// Pure rule-based, deterministic, transparent.

const {
  MATCH_WEIGHTS, EXPERIENCE_RANK, EDUCATION_RANK,
  PROFILE_COMPLETION_FIELDS, JOB_TYPE_ALIASES,
  SKILL_FAMILIES, CATEGORY_MAP, DESCRIPTION_SKILL_PATTERNS,
  INSIGHT_TEMPLATES,
} = require('./matching-config');

function normalizeText(v) { return (v || '').toLowerCase().trim(); }

function normalizeJobType(v) {
  return JOB_TYPE_ALIASES[normalizeText(v)] || normalizeText(v);
}

function normalizeSkill(v) {
  try {
    const { normalizeSkill: ns } = require('./ai-extraction');
    return ns(v);
  } catch { return normalizeText(v); }
}

// ── Profile Completion Score ───────────────────────────────────────────────
function calculateProfileCompletion(profile) {
  let earned = 0, total = 0;
  const missing = [];
  for (const field of PROFILE_COMPLETION_FIELDS) {
    total += field.weight;
    const val = profile[field.key];
    if (field.check(val)) { earned += field.weight; }
    else { missing.push(field.key); }
  }
  return { score: total > 0 ? Math.round((earned / total) * 100) : 0, missing_fields: missing };
}

// ── Extract implicit skills from job description/requirements text ────────
function extractImplicitSkills(job) {
  const text = [job.description || '', job.requirements || '', (job.tags || []).join(' ')].join(' ');
  if (!text || text.length < 10) return [];
  const found = new Set();
  for (const { pattern, skill } of DESCRIPTION_SKILL_PATTERNS) {
    if (pattern.test(text)) found.add(skill);
  }
  return [...found];
}

// ── Find which skill family a skill belongs to ───────────────────────────
function getSkillFamilies(skillNorm) {
  const families = [];
  for (const [name, fam] of Object.entries(SKILL_FAMILIES)) {
    if (fam.skills.includes(skillNorm)) families.push(name);
  }
  return families;
}

// ── Skill Matching (v2: synonym-aware + transferable skill credit) ────────
function scoreSkills(candidate, jobCriteria, job, reasons, gaps, insights) {
  const cSkillsRaw = [
    ...(candidate.hard_skills || []),
    ...(candidate.soft_skills || []),
    ...(candidate.ai_normalized_skills || []),
  ];
  const cSkills = [...new Set(cSkillsRaw.map(normalizeSkill))];

  let reqSkills = (jobCriteria.required_skills || []);
  let prefSkills = (jobCriteria.preferred_skills || []);

  // If no explicit criteria skills, mine the job description
  if (reqSkills.length === 0 && prefSkills.length === 0 && job) {
    const implicit = extractImplicitSkills(job);
    if (implicit.length > 0) {
      prefSkills = implicit; // Treat mined skills as preferred, not required
      if (implicit.length > 0) {
        insights.push({ type: 'info', text: `Skills inferred from job description: ${implicit.slice(0, 5).join(', ')}` });
      }
    }
  }

  if (reqSkills.length === 0 && prefSkills.length === 0) return 1.0;

  // Score required skills (exact + family transfer)
  let reqScore = 0;
  const reqTotal = reqSkills.length;
  const matchedReq = [];
  const missingReq = [];

  for (const skill of reqSkills) {
    const norm = normalizeSkill(skill);
    if (cSkills.includes(norm)) {
      reqScore += 1.0;
      matchedReq.push(skill);
      reasons.push(`Has required skill: ${skill}`);
    } else {
      // Check for transferable skill in same family
      const reqFamilies = getSkillFamilies(norm);
      let transferred = false;
      for (const famName of reqFamilies) {
        const fam = SKILL_FAMILIES[famName];
        const hasRelated = cSkills.some(cs => fam.skills.includes(cs));
        if (hasRelated) {
          const relatedSkill = cSkills.find(cs => fam.skills.includes(cs));
          reqScore += fam.transferCredit;
          reasons.push(`Related skill: has ${relatedSkill} (${famName} family) — partial match for ${skill}`);
          insights.push({ type: 'transfer', text: `Transferable: ${relatedSkill} → ${skill} (${Math.round(fam.transferCredit * 100)}% credit)` });
          transferred = true;
          break;
        }
      }
      if (!transferred) {
        missingReq.push(skill);
        gaps.push(`Missing required skill: ${skill}`);
      }
    }
  }

  // Score preferred skills
  let prefScore = 0;
  const prefTotal = prefSkills.length;
  for (const skill of prefSkills) {
    const norm = normalizeSkill(skill);
    if (cSkills.includes(norm)) {
      prefScore += 1.0;
      reasons.push(`Has preferred skill: ${skill}`);
    } else {
      const reqFamilies = getSkillFamilies(norm);
      for (const famName of reqFamilies) {
        const fam = SKILL_FAMILIES[famName];
        if (cSkills.some(cs => fam.skills.includes(cs))) {
          prefScore += fam.transferCredit * 0.7; // Lower transfer credit for preferred
          break;
        }
      }
    }
  }

  // Weighted combination: required skills worth 70%, preferred 30%
  const reqWeight = reqTotal > 0 ? 0.7 : 0;
  const prefWeight = prefTotal > 0 ? (1 - reqWeight) : 1;

  let score = 0;
  if (reqTotal > 0) score += (reqScore / reqTotal) * reqWeight;
  if (prefTotal > 0) score += (prefScore / prefTotal) * prefWeight;
  if (reqTotal === 0) score = prefTotal > 0 ? prefScore / prefTotal : 1;

  // Generate insight
  const totalReqAndPref = reqTotal + prefTotal;
  const totalMatched = matchedReq.length + Math.round(prefScore);
  const matchPct = Math.round((totalMatched / Math.max(totalReqAndPref, 1)) * 100);
  if (matchPct >= 80) {
    insights.push({ type: 'strength', text: `Strong skill coverage (${matchPct}%) — covers most requirements` });
  } else if (matchPct >= 50) {
    insights.push({ type: 'moderate', text: `Partial skill match (${matchPct}%) — ${missingReq.length > 0 ? 'gaps in: ' + missingReq.slice(0, 3).join(', ') : 'solid foundation'}` });
  } else if (totalReqAndPref > 0) {
    const gapSkills = missingReq.length > 0 ? missingReq.slice(0, 3).join(', ') : prefSkills.slice(0, 3).join(', ');
    insights.push({ type: 'gap', text: `Low skill overlap (${matchPct}%) — would need training in ${gapSkills}` });
  }

  return Math.min(score, 1);
}

// ── Category/Tag Matching (NEW) ──────────────────────────────────────────
function scoreCategory(candidate, job, jobCriteria, reasons, gaps, insights) {
  const candidateCats = (candidate.preferred_categories || []).map(normalizeText);
  const candidateSkills = [...(candidate.hard_skills || []), ...(candidate.soft_skills || [])].map(normalizeText);
  const jobCategory = normalizeText(jobCriteria.category || '');
  const jobTags = (job.tags || []).map(normalizeText);
  const jobIndustry = normalizeText(jobCriteria.industry || '');

  if (candidateCats.length === 0 && candidateSkills.length === 0) return 1.0;
  if (!jobCategory && jobTags.length === 0) return 1.0;

  let score = 0;
  let matched = false;

  // Direct category match
  if (jobCategory && candidateCats.some(c => c === jobCategory || jobCategory.includes(c) || c.includes(jobCategory))) {
    score = 1.0;
    matched = true;
    reasons.push(`Category match: ${jobCategory}`);
    insights.push({ type: 'strength', text: `This role is in your preferred category` });
  }

  // Tag-based matching: check if job tags overlap with candidate categories or skills
  if (!matched && jobTags.length > 0) {
    let tagHits = 0;
    for (const tag of jobTags) {
      if (candidateCats.some(c => c.includes(tag) || tag.includes(c))) { tagHits++; }
      // Check if tag maps to a known category that matches candidate
      for (const [catName, catDef] of Object.entries(CATEGORY_MAP)) {
        if (catDef.keywords.some(kw => tag.includes(kw) || kw.includes(tag))) {
          if (candidateCats.some(c => normalizeText(catName).includes(c) || c.includes(normalizeText(catName)))) {
            tagHits++;
            break;
          }
          // Check if candidate skills match this category's skills
          if (catDef.skills.some(s => candidateSkills.includes(s))) {
            tagHits += 0.5;
            break;
          }
        }
      }
    }
    if (tagHits > 0) {
      score = Math.min(tagHits / jobTags.length, 1);
      if (score >= 0.5) reasons.push(`Job tags align with your profile`);
    }
  }

  // Skill-category cross-reference: if candidate's skills belong to the job's category
  if (!matched && jobCategory) {
    for (const [catName, catDef] of Object.entries(CATEGORY_MAP)) {
      if (normalizeText(catName) === jobCategory || jobCategory.includes(normalizeText(catName)) || normalizeText(catName).includes(jobCategory)) {
        const catSkillHits = catDef.skills.filter(s => candidateSkills.includes(s)).length;
        if (catSkillHits > 0) {
          score = Math.max(score, Math.min(catSkillHits / Math.max(catDef.skills.length, 1), 1) * 0.8);
          reasons.push(`Skills align with ${catName} category`);
        }
        break;
      }
    }
  }

  return Math.max(score, 0.3); // Minimum baseline — category is informational
}

// ── Location Matching ──────────────────────────────────────────────────────
function scoreLocation(candidate, job, jobCriteria, reasons, gaps, insights) {
  const jobLoc = normalizeText(job.location || '');
  const jobWorkMode = normalizeText(jobCriteria.work_model || job.work_model || '');
  const cLoc = normalizeText(candidate.location || '');
  const cPrefLocs = (candidate.preferred_locations || []).map(normalizeText);
  const cWorkMode = normalizeText(candidate.work_mode_preference || '');

  if (jobWorkMode === 'remote') {
    reasons.push('Job is remote — location compatible');
    insights.push({ type: 'strength', text: 'Remote position — work from anywhere' });
    return 1.0;
  }

  if (!jobLoc) return 1.0;

  const directMatch = (cLoc && (cLoc.includes(jobLoc) || jobLoc.includes(cLoc)))
    || cPrefLocs.some(l => l.includes(jobLoc) || jobLoc.includes(l));

  if (directMatch) {
    reasons.push(`Location match: ${jobLoc}`);
    insights.push({ type: 'strength', text: `Location match — ${job.location || jobLoc}` });
    return 1.0;
  }

  if (jobWorkMode === 'hybrid') {
    if (cWorkMode === 'remote' || cWorkMode === 'hybrid' || cWorkMode === 'any') {
      reasons.push('Hybrid job — candidate flexible on work mode');
      return 0.7;
    }
  }

  if (jobCriteria.location_strict) {
    gaps.push(`Location mismatch: candidate in ${cLoc || 'unknown'}, job in ${jobLoc}`);
    insights.push({ type: 'gap', text: `Location gap — you're in ${cLoc || 'unknown'}, job requires ${jobLoc}` });
    return 0.1;
  }

  gaps.push(`Location may not match: ${cLoc || 'unknown'} vs ${jobLoc}`);
  return 0.3;
}

// ── Job Type Matching ──────────────────────────────────────────────────────
function scoreJobType(candidate, job, reasons, gaps) {
  const jobType = normalizeJobType(job.job_type || job.type || '');
  const cPrefTypes = (candidate.preferred_job_types || []).map(normalizeJobType);
  if (!jobType || cPrefTypes.length === 0) return 1.0;
  if (cPrefTypes.includes(jobType)) {
    reasons.push(`Job type match: ${jobType}`);
    return 1.0;
  }
  const related = {
    part_time: ['internship', 'seasonal'],
    internship: ['part_time', 'junior_role'],
    full_time: ['graduate_role', 'junior_role'],
    junior_role: ['full_time', 'internship', 'graduate_role'],
    graduate_role: ['full_time', 'junior_role'],
    seasonal: ['part_time', 'internship'],
  };
  if (related[jobType]?.some(r => cPrefTypes.includes(r))) {
    reasons.push(`Related job type: ${jobType}`);
    return 0.5;
  }
  gaps.push(`Job type mismatch: prefers ${cPrefTypes.join(', ')}, job is ${jobType}`);
  return 0.0;
}

// ── Availability Matching ──────────────────────────────────────────────────
function scoreAvailability(candidate, jobCriteria, reasons, gaps) {
  const cHours = candidate.availability_hours || 0;
  const jHours = jobCriteria.hours_per_week || 0;
  if (jHours === 0 || cHours === 0) return 1.0;
  if (cHours >= jHours) {
    reasons.push(`Availability OK: ${cHours}h/week >= ${jHours}h required`);
    return 1.0;
  }
  const ratio = cHours / jHours;
  if (ratio >= 0.8) {
    reasons.push(`Availability close: ${cHours}h vs ${jHours}h required`);
    return 0.7;
  }
  gaps.push(`Availability insufficient: ${cHours}h/week, job needs ${jHours}h`);
  return ratio * 0.5;
}

// ── Education Matching ─────────────────────────────────────────────────────
function scoreEducation(candidate, jobCriteria, reasons, gaps, insights) {
  let score = 0;
  const cEdu = EDUCATION_RANK[candidate.education_level] || 0;
  const rEdu = EDUCATION_RANK[jobCriteria.min_education_level] || 0;

  if (rEdu === 0) { score += 0.5; }
  else if (cEdu >= rEdu) {
    score += 0.5;
    reasons.push(`Education level meets requirement`);
  } else {
    score += (cEdu / rEdu) * 0.3;
    gaps.push(`Education below preferred: has ${candidate.education_level || 'unknown'}`);
  }

  // Field of study match (improved: use CATEGORY_MAP for semantic matching)
  const prefFields = (jobCriteria.preferred_fields || []).map(normalizeText);
  const cField = normalizeText(candidate.education_field || '');

  if (prefFields.length === 0) {
    score += 0.5;
  } else if (cField && prefFields.some(f => f.includes(cField) || cField.includes(f))) {
    score += 0.5;
    reasons.push(`Field of study match: ${candidate.education_field}`);
    insights.push({ type: 'strength', text: `Your ${candidate.education_field} education is directly relevant` });
  } else {
    score += 0.1;
    if (cField) gaps.push(`Field of study: ${cField} not in preferred fields`);
  }

  return Math.min(score, 1);
}

// ── Experience Matching ────────────────────────────────────────────────────
function scoreExperience(candidate, job, jobCriteria, reasons, gaps, insights) {
  const cLevel = EXPERIENCE_RANK[candidate.experience_level] || EXPERIENCE_RANK.unknown;
  const rLevel = EXPERIENCE_RANK[jobCriteria.required_experience_level] || 0;

  if (jobCriteria.student_friendly || jobCriteria.no_experience_required) {
    if (cLevel <= 1) {
      reasons.push('Student-friendly role — beginner/no-experience OK');
      insights.push({ type: 'strength', text: 'This role welcomes beginners — great entry point' });
      return 1.0;
    }
    reasons.push('Student-friendly role — candidate qualifies');
    return 1.0;
  }

  if (rLevel === 0) return 1.0;

  if (cLevel >= rLevel) {
    reasons.push(`Experience level matches: ${candidate.experience_level}`);
    if (cLevel > rLevel + 1) {
      insights.push({ type: 'info', text: 'You exceed the experience requirements — may negotiate higher compensation' });
    }
    return 1.0;
  }

  if (cLevel === rLevel - 1) {
    reasons.push(`Experience close to requirement`);
    insights.push({ type: 'moderate', text: 'Slightly below experience requirement — highlight relevant projects' });
    return 0.6;
  }

  gaps.push(`Experience gap: has ${candidate.experience_level}, needs ${jobCriteria.required_experience_level}`);
  return 0.2;
}

// ── Language Matching ──────────────────────────────────────────────────────
// Language name normalization: employer UI uses Slovak names, AI parser uses English
const LANG_NAME_MAP = {
  // Slovak → canonical
  'angličtina': 'english', 'anglictina': 'english',
  'slovenčina': 'slovak', 'slovencina': 'slovak',
  'nemčina': 'german', 'nemcina': 'german',
  'francúzština': 'french', 'francuzstina': 'french',
  'španielčina': 'spanish', 'spanielcina': 'spanish',
  'taliančina': 'italian', 'taliansky': 'italian', 'taliancina': 'italian',
  'ruština': 'russian', 'rustina': 'russian',
  'čeština': 'czech', 'cestina': 'czech',
  'maďarčina': 'hungarian', 'madarcina': 'hungarian',
  'poľština': 'polish', 'polstina': 'polish',
  'ukrajinčina': 'ukrainian', 'ukrajincina': 'ukrainian',
  'portugalčina': 'portuguese', 'portugalcina': 'portuguese',
  'čínština': 'chinese', 'cinstina': 'chinese',
  'japončina': 'japanese', 'japoncina': 'japanese',
  'kórejčina': 'korean', 'korejcina': 'korean',
  // English → canonical (already canonical, but be explicit)
  'english': 'english', 'slovak': 'slovak', 'german': 'german',
  'french': 'french', 'spanish': 'spanish', 'italian': 'italian',
  'russian': 'russian', 'czech': 'czech', 'hungarian': 'hungarian',
  'polish': 'polish', 'ukrainian': 'ukrainian', 'portuguese': 'portuguese',
  'chinese': 'chinese', 'japanese': 'japanese', 'korean': 'korean',
};

function normalizeLangName(name) {
  const key = normalizeText(name).replace(/[áäčďéíĺľňóôŕšťúýž]/g, c => {
    return { á:'a',ä:'a',č:'c',ď:'d',é:'e',í:'i',ĺ:'l',ľ:'l',ň:'n',ó:'o',ô:'o',ŕ:'r',š:'s',ť:'t',ú:'u',ý:'y',ž:'z' }[c] || c;
  });
  return LANG_NAME_MAP[key] || key;
}

function scoreLanguage(candidate, jobCriteria, reasons, gaps) {
  const reqLangs = jobCriteria.required_languages || [];
  if (!Array.isArray(reqLangs) || reqLangs.length === 0) return 1.0;
  const LANG_LEVELS = { A1:1, A2:2, B1:3, B2:4, C1:5, C2:6 };
  const cLangs = candidate.languages || [];
  let total = 0;
  for (const req of reqLangs) {
    if (!req || !req.lang) continue;
    const reqNorm = normalizeLangName(req.lang);
    const found = cLangs.find(l => normalizeLangName(l.lang) === reqNorm);
    if (found) {
      const cLvl = LANG_LEVELS[found.level] || 0;
      const rLvl = LANG_LEVELS[req.min_level] || 0;
      if (cLvl >= rLvl) {
        total += 1;
        reasons.push(`Language: ${req.lang} ≥ ${req.min_level}`);
      } else {
        total += (cLvl / Math.max(rLvl, 1)) * 0.6;
        gaps.push(`Language: ${req.lang} at ${found.level}, needs ${req.min_level}`);
      }
    } else {
      gaps.push(`Missing language: ${req.lang}`);
    }
  }
  return total / reqLangs.length;
}

// ── Salary Matching ────────────────────────────────────────────────────────
function scoreSalary(candidate, jobCriteria, reasons, gaps) {
  const cSalary = candidate.salary_expectation || candidate.min_salary || 0;
  const jMin = jobCriteria.salary_min || 0;
  const jMax = jobCriteria.salary_max || 0;
  if (cSalary === 0 || (jMin === 0 && jMax === 0)) return 1.0;
  if (jMax > 0 && cSalary <= jMax) { reasons.push('Salary expectation within range'); return 1.0; }
  if (jMin > 0 && cSalary >= jMin && (jMax === 0 || cSalary <= jMax)) { reasons.push('Salary expectation within range'); return 1.0; }
  if (jMax > 0 && cSalary > jMax) {
    const overBy = (cSalary - jMax) / jMax;
    if (overBy <= 0.15) { reasons.push('Salary slightly above range'); return 0.6; }
    gaps.push(`Salary expectation ${cSalary} exceeds max ${jMax}`);
    return 0.2;
  }
  return 0.5;
}

// ── Work Mode Matching ─────────────────────────────────────────────────────
function scoreWorkMode(candidate, job, jobCriteria, reasons, gaps) {
  const jMode = normalizeText(jobCriteria.work_model || job.work_model || '');
  const cMode = normalizeText(candidate.work_mode_preference || '');
  if (!jMode || !cMode || cMode === 'any') return 1.0;
  if (jMode === cMode) { reasons.push(`Work mode match: ${jMode}`); return 1.0; }
  if (jMode === 'hybrid') { reasons.push('Hybrid job — partially compatible'); return 0.7; }
  gaps.push(`Work mode mismatch: prefers ${cMode}, job is ${jMode}`);
  return 0.0;
}

// ── Scoring Confidence ─────────────────────────────────────────────────────
function calculateConfidence(candidate, jobCriteria) {
  let signals = 0, total = 0;
  // Candidate data quality
  total++; if ((candidate.hard_skills || []).length > 0) signals++;
  total++; if (candidate.location) signals++;
  total++; if (candidate.education_level) signals++;
  total++; if (candidate.experience_level && candidate.experience_level !== 'unknown') signals++;
  total++; if ((candidate.languages || []).length > 0) signals++;
  // Job criteria quality
  const c = jobCriteria || {};
  total++; if ((c.required_skills || []).length > 0 || (c.preferred_skills || []).length > 0) signals++;
  total++; if (c.min_education_level) signals++;
  total++; if (c.required_experience_level) signals++;
  return { score: Math.round((signals / total) * 100), signals, total };
}

// ── Generate Executive Summary ─────────────────────────────────────────────
function generateExecutiveSummary(candidate, job, scores, reasons, gaps, insights, confidence) {
  const name = candidate.full_name || 'Candidate';
  const parts = [];

  // Lead with strongest dimension
  const sortedDims = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const strongest = sortedDims[0];
  const weakest = sortedDims[sortedDims.length - 1];

  const overallPct = Math.round(Object.values(scores).reduce((s, v) => s + v, 0) / Object.keys(scores).length * 100);

  if (overallPct >= 75) {
    parts.push(`Strong candidate — ${name} aligns well across ${sortedDims.filter(([,v]) => v >= 0.7).length} of ${sortedDims.length} evaluation dimensions.`);
  } else if (overallPct >= 50) {
    parts.push(`Moderate fit — ${name} shows strength in ${strongest[0]} but has gaps in ${weakest[0]}.`);
  } else {
    parts.push(`Limited match — ${name} may need significant development in key areas for this role.`);
  }

  // Skill summary
  const skillReasons = reasons.filter(r => r.includes('skill'));
  const skillGaps = gaps.filter(g => g.includes('skill'));
  if (skillReasons.length > 0 && skillGaps.length === 0) {
    parts.push(`Covers all required technical skills.`);
  } else if (skillGaps.length > 0) {
    parts.push(`Missing ${skillGaps.length} skill${skillGaps.length > 1 ? 's' : ''} — ${skillGaps.slice(0, 2).map(g => g.replace('Missing required skill: ', '')).join(', ')}.`);
  }

  // Confidence caveat
  if (confidence.score < 50) {
    parts.push(`Note: Score based on limited data (${confidence.signals}/${confidence.total} signals) — encourage profile completion for accuracy.`);
  }

  return parts.join(' ');
}

// ── Main Matching Function ─────────────────────────────────────────────────
function calculateCandidateJobMatch(candidate, job, jobCriteria, customWeights) {
  const weights = { ...MATCH_WEIGHTS, ...(customWeights || {}) };
  const reasons = [];
  const gaps = [];
  const insights = [];
  const c = jobCriteria || {};

  // Check if the job actually has meaningful match criteria configured
  const hasCriteria = (
    (c.required_skills && c.required_skills.length > 0) ||
    (c.preferred_skills && c.preferred_skills.length > 0) ||
    (c.required_languages && c.required_languages.length > 0) ||
    c.min_education_level ||
    c.required_experience_level ||
    c.hours_per_week > 0 ||
    c.salary_min > 0 || c.salary_max > 0
  );

  // Even without criteria, we can mine the job description
  const hasJobText = !!(job.description || job.requirements || (job.tags && job.tags.length > 0));

  // Calculate each dimension (0.0 - 1.0)
  const scores = {
    skills:           scoreSkills(candidate, c, job, reasons, gaps, insights),
    location:         scoreLocation(candidate, job, c, reasons, gaps, insights),
    job_type:         scoreJobType(candidate, job, reasons, gaps),
    category:         scoreCategory(candidate, job, c, reasons, gaps, insights),
    availability:     scoreAvailability(candidate, c, reasons, gaps),
    education:        scoreEducation(candidate, c, reasons, gaps, insights),
    experience_level: scoreExperience(candidate, job, c, reasons, gaps, insights),
    language:         scoreLanguage(candidate, c, reasons, gaps),
    salary:           scoreSalary(candidate, c, reasons, gaps),
    work_mode:        scoreWorkMode(candidate, job, c, reasons, gaps),
  };

  // Calculate weighted score (0-100)
  const breakdown = {};
  let totalWeighted = 0;
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  for (const [dim, rawScore] of Object.entries(scores)) {
    const w = weights[dim] || 0;
    const points = Math.round(rawScore * w * 10) / 10;
    breakdown[dim] = points;
    totalWeighted += points;
  }

  let matchScore = Math.round(totalWeighted);

  // If job has no real criteria AND no description to mine, cap score
  if (!hasCriteria && !hasJobText) {
    matchScore = Math.min(matchScore, 50);
    gaps.push('Job has no specific match criteria configured');
  } else if (!hasCriteria && hasJobText) {
    // We mined the description — slightly lower confidence but still useful
    matchScore = Math.min(matchScore, 85);
    insights.push({ type: 'info', text: 'Score based on job description analysis — employer should add specific criteria for better accuracy' });
  }

  // Calculate confidence
  const confidence = calculateConfidence(candidate, c);

  // Generate executive summary
  const summary = generateExecutiveSummary(candidate, job, scores, reasons, gaps, insights, confidence);

  return {
    candidate_id: candidate.user_id || null,
    job_id: job.id || null,
    match_score: Math.min(matchScore, 100),
    score_breakdown: breakdown,
    dimension_scores: scores, // raw 0-1 scores per dimension
    match_reasons: [...new Set(reasons)],
    gaps: [...new Set(gaps)],
    insights: insights,
    executive_summary: summary,
    eligible: gaps.filter(g => g.startsWith('Missing required')).length === 0,
    has_criteria: hasCriteria,
    confidence: confidence,
  };
}

module.exports = {
  calculateCandidateJobMatch,
  calculateProfileCompletion,
  extractImplicitSkills,
  scoreSkills, scoreLocation, scoreJobType, scoreCategory, scoreAvailability,
  scoreEducation, scoreExperience, scoreLanguage, scoreSalary, scoreWorkMode,
  normalizeJobType, calculateConfidence,
};
