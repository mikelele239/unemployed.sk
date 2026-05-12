'use strict';
// Matching engine v3 — Multi-dimensional scoring with match bands,
// near-miss eligibility, trainable skills, and bilingual insights.
// Pure rule-based, deterministic, transparent.

const {
  MATCH_WEIGHTS, EXPERIENCE_RANK, EDUCATION_RANK,
  PROFILE_COMPLETION_FIELDS, JOB_TYPE_ALIASES,
  SKILL_FAMILIES, CATEGORY_MAP, DESCRIPTION_SKILL_PATTERNS,
  INSIGHT_TEMPLATES, SUCCESS_FACTOR_DIMENSION_MAP,
} = require('./matching-config');

// ── Match Band Labels ──────────────────────────────────────────────────────
const MATCH_BANDS = [
  { min: 80, band: 'A', sk: 'Silná zhoda',       en: 'Strong fit' },
  { min: 60, band: 'B', sk: 'Dobrá zhoda',        en: 'Good fit' },
  { min: 40, band: 'C', sk: 'Potenciálna zhoda',  en: 'Potential fit' },
  { min: 20, band: 'D', sk: 'Čiastočná zhoda',    en: 'Partial fit' },
  { min: 0,  band: 'E', sk: 'Nízka zhoda',         en: 'Low fit' },
];

function getMatchBand(score) {
  for (const b of MATCH_BANDS) {
    if (score >= b.min) return { band: b.band, label: { sk: b.sk, en: b.en } };
  }
  return { band: 'E', label: { sk: 'Nízka zhoda', en: 'Low fit' } };
}

// ── Bilingual gap/reason helper ────────────────────────────────────────────
const GAP_LABELS = {
  'Missing required skill':     { sk: 'Chýba povinná zručnosť', en: 'Missing required skill' },
  'Missing language':           { sk: 'Chýba jazyk', en: 'Missing language' },
  'Location mismatch':          { sk: 'Nesúlad lokality', en: 'Location mismatch' },
  'Location may not match':     { sk: 'Lokácia nemusí zodpovedať', en: 'Location may not match' },
  'Job type mismatch':          { sk: 'Nesúlad typu práce', en: 'Job type mismatch' },
  'Availability insufficient':  { sk: 'Nedostatočná dostupnosť', en: 'Availability insufficient' },
  'Education below preferred':  { sk: 'Vzdelanie pod požiadavkou', en: 'Education below preferred' },
  'Experience gap':             { sk: 'Medzera v skúsenostiach', en: 'Experience gap' },
  'Language':                   { sk: 'Jazyk', en: 'Language' },
  'Salary expectation':         { sk: 'Platové očakávanie', en: 'Salary expectation' },
  'Work mode mismatch':         { sk: 'Nesúlad pracovného modelu', en: 'Work mode mismatch' },
  'Field of study':             { sk: 'Odbor štúdia', en: 'Field of study' },
  'Job has no specific match criteria': { sk: 'Pozícia nemá nastavené kritériá', en: 'Job has no specific match criteria configured' },
};

const REASON_LABELS = {
  'Has required skill':       { sk: 'Má požadovanú zručnosť', en: 'Has required skill' },
  'Has preferred skill':      { sk: 'Má preferovanú zručnosť', en: 'Has preferred skill' },
  'Related skill':            { sk: 'Príbuzná zručnosť', en: 'Related skill' },
  'Location match':           { sk: 'Lokácia zodpovedá', en: 'Location match' },
  'Job is remote':            { sk: 'Vzdialená práca – kompatibilné', en: 'Remote job — location compatible' },
  'Job type match':           { sk: 'Typ práce zodpovedá', en: 'Job type match' },
  'Category match':           { sk: 'Kategória zodpovedá', en: 'Category match' },
  'Education level meets':    { sk: 'Vzdelanie spĺňa požiadavku', en: 'Education level meets requirement' },
  'Experience level matches': { sk: 'Skúsenosti zodpovedajú', en: 'Experience level matches' },
  'Student-friendly role':    { sk: 'Pozícia vhodná pre študentov', en: 'Student-friendly role' },
  'Availability OK':          { sk: 'Dostupnosť v poriadku', en: 'Availability OK' },
  'Salary expectation within':{ sk: 'Plat v rozpätí', en: 'Salary expectation within range' },
  'Work mode match':          { sk: 'Pracovný model zodpovedá', en: 'Work mode match' },
  'Field of study match':     { sk: 'Odbor štúdia zodpovedá', en: 'Field of study match' },
};

/**
 * Create a bilingual string. Falls back to raw text if no label found.
 */
function biGap(prefix, detail) {
  const label = GAP_LABELS[prefix];
  if (label && detail) return JSON.stringify({ sk: `${label.sk}: ${detail}`, en: `${prefix}: ${detail}` });
  if (label) return JSON.stringify({ sk: label.sk, en: label.en || prefix });
  return detail ? `${prefix}: ${detail}` : prefix;
}

function biReason(prefix, detail) {
  const label = REASON_LABELS[prefix];
  if (label && detail) return JSON.stringify({ sk: `${label.sk}: ${detail}`, en: `${prefix}: ${detail}` });
  if (label) return JSON.stringify({ sk: label.sk, en: label.en || prefix });
  return detail ? `${prefix}: ${detail}` : prefix;
}

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

  if (reqSkills.length === 0 && prefSkills.length === 0) return 0.5; // neutral — no criteria to evaluate

  // Score required skills (exact + family transfer)
  let reqScore = 0;
  const reqTotal = reqSkills.length;
  const matchedReq = [];
  const missingReq = [];

  // Trainable skills set (from job criteria V2)
  const trainableSet = new Set((jobCriteria.trainable_skills || []).map(normalizeSkill));

  for (const skill of reqSkills) {
    const norm = normalizeSkill(skill);
    if (cSkills.includes(norm)) {
      reqScore += 1.0;
      matchedReq.push(skill);
      reasons.push(biReason('Has required skill', skill));
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
          reasons.push(biReason('Related skill', `${relatedSkill} (${famName}) → ${skill}`));
          insights.push({ type: 'transfer', text: `Transferable: ${relatedSkill} → ${skill} (${Math.round(fam.transferCredit * 100)}% credit)` });
          transferred = true;
          break;
        }
      }
      if (!transferred) {
        // Check if employer marked this skill as trainable
        if (trainableSet.has(norm)) {
          reqScore += 0.3; // Reduced penalty — employer willing to train
          insights.push({ type: 'trainable', text: JSON.stringify({ sk: `Chýba ${skill} — zamestnávateľ ochotný trénovať`, en: `Missing ${skill} — employer willing to train` }) });
          gaps.push(biGap('Missing required skill', `${skill} (trénovateľné / trainable)`));
        } else {
          missingReq.push(skill);
          gaps.push(biGap('Missing required skill', skill));
        }
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
      reasons.push(biReason('Has preferred skill', skill));
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

  if (candidateCats.length === 0 && candidateSkills.length === 0) return 0.5; // neutral
  if (!jobCategory && jobTags.length === 0) return 0.5; // neutral

  let score = 0;
  let matched = false;

  // Direct category match
  if (jobCategory && candidateCats.some(c => c === jobCategory || jobCategory.includes(c) || c.includes(jobCategory))) {
    score = 1.0;
    matched = true;
    reasons.push(biReason('Category match', jobCategory));
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
    reasons.push(biReason('Job is remote', ''));
    insights.push({ type: 'strength', text: 'Remote position — work from anywhere' });
    return 1.0;
  }

  if (!jobLoc) return 0.5; // neutral — no location specified

  const directMatch = (cLoc && (cLoc.includes(jobLoc) || jobLoc.includes(cLoc)))
    || cPrefLocs.some(l => l.includes(jobLoc) || jobLoc.includes(l));

  if (directMatch) {
    reasons.push(biReason('Location match', job.location || jobLoc));
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
    gaps.push(biGap('Location mismatch', `${cLoc || '?'} vs ${jobLoc}`));
    insights.push({ type: 'gap', text: `Location gap — you're in ${cLoc || 'unknown'}, job requires ${jobLoc}` });
    return 0.1;
  }

  gaps.push(biGap('Location may not match', `${cLoc || '?'} vs ${jobLoc}`));
  return 0.3;
}

// ── Job Type Matching ──────────────────────────────────────────────────────
function scoreJobType(candidate, job, reasons, gaps) {
  const jobType = normalizeJobType(job.job_type || job.type || '');
  const cPrefTypes = (candidate.preferred_job_types || []).map(normalizeJobType);
  if (!jobType || cPrefTypes.length === 0) return 0.5; // neutral
  if (cPrefTypes.includes(jobType)) {
    reasons.push(biReason('Job type match', jobType));
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
  gaps.push(biGap('Job type mismatch', `${cPrefTypes.join(', ')} vs ${jobType}`));
  return 0.0;
}

// ── Availability Matching ──────────────────────────────────────────────────
function scoreAvailability(candidate, jobCriteria, reasons, gaps) {
  const cHours = candidate.availability_hours || 0;
  const jHours = jobCriteria.hours_per_week || 0;
  if (jHours === 0 || cHours === 0) return 0.5; // neutral
  if (cHours >= jHours) {
    reasons.push(biReason('Availability OK', `${cHours}h ≥ ${jHours}h`));
    return 1.0;
  }
  const ratio = cHours / jHours;
  if (ratio >= 0.8) {
    reasons.push(`Availability close: ${cHours}h vs ${jHours}h required`);
    return 0.7;
  }
  gaps.push(biGap('Availability insufficient', `${cHours}h vs ${jHours}h`));
  return ratio * 0.5;
}

// ── Education Matching ─────────────────────────────────────────────────────
function scoreEducation(candidate, jobCriteria, reasons, gaps, insights) {
  let score = 0;
  const cEdu = EDUCATION_RANK[candidate.education_level] || 0;
  const rEdu = EDUCATION_RANK[jobCriteria.min_education_level] || 0;

  if (rEdu === 0) { score += 0.25; } // neutral — no requirement
  else if (cEdu >= rEdu) {
    score += 0.5;
    reasons.push(biReason('Education level meets', ''));
  } else {
    score += (cEdu / rEdu) * 0.3;
    gaps.push(biGap('Education below preferred', candidate.education_level || '?'));
  }

  // Field of study match (improved: use CATEGORY_MAP for semantic matching)
  const prefFields = (jobCriteria.preferred_fields || []).map(normalizeText);
  const cField = normalizeText(candidate.education_field || '');

  if (prefFields.length === 0) {
    score += 0.25; // neutral — no preferred fields
  } else if (cField && prefFields.some(f => f.includes(cField) || cField.includes(f))) {
    score += 0.5;
    reasons.push(biReason('Field of study match', candidate.education_field));
    insights.push({ type: 'strength', text: `Your ${candidate.education_field} education is directly relevant` });
  } else {
    score += 0.1;
    if (cField) gaps.push(biGap('Field of study', `${cField}`));
  }

  return Math.min(score, 1);
}

// ── Experience Matching ────────────────────────────────────────────────────
function scoreExperience(candidate, job, jobCriteria, reasons, gaps, insights) {
  const cLevel = EXPERIENCE_RANK[candidate.experience_level] || EXPERIENCE_RANK.unknown;
  const rLevel = EXPERIENCE_RANK[jobCriteria.required_experience_level] || 0;

  if (jobCriteria.student_friendly || jobCriteria.no_experience_required) {
    if (cLevel <= 1) {
      reasons.push(biReason('Student-friendly role', ''));
      insights.push({ type: 'strength', text: JSON.stringify({ sk: 'Pozícia vhodná pre začiatočníkov', en: 'This role welcomes beginners — great entry point' }) });
      return 1.0;
    }
    reasons.push(biReason('Student-friendly role', ''));
    return 1.0;
  }

  if (rLevel === 0) return 0.5; // neutral — no experience requirement set

  if (cLevel >= rLevel) {
    reasons.push(biReason('Experience level matches', candidate.experience_level));
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

  gaps.push(biGap('Experience gap', `${candidate.experience_level} vs ${jobCriteria.required_experience_level}`));
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
  if (!Array.isArray(reqLangs) || reqLangs.length === 0) return 0.5; // neutral
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
        reasons.push(biReason('Language', `${req.lang} ≥ ${req.min_level}`));
      } else {
        total += (cLvl / Math.max(rLvl, 1)) * 0.6;
        gaps.push(biGap('Language', `${req.lang} ${found.level} vs ${req.min_level}`));
      }
    } else {
      gaps.push(biGap('Missing language', req.lang));
    }
  }
  return total / reqLangs.length;
}

// ── Salary Matching ────────────────────────────────────────────────────────
function scoreSalary(candidate, jobCriteria, reasons, gaps) {
  const cSalary = candidate.salary_expectation || candidate.min_salary || 0;
  const jMin = jobCriteria.salary_min || 0;
  const jMax = jobCriteria.salary_max || 0;
  if (cSalary === 0 || (jMin === 0 && jMax === 0)) return 0.5; // neutral
  if (jMax > 0 && cSalary <= jMax) { reasons.push(biReason('Salary expectation within', '')); return 1.0; }
  if (jMin > 0 && cSalary >= jMin && (jMax === 0 || cSalary <= jMax)) { reasons.push(biReason('Salary expectation within', '')); return 1.0; }
  if (jMax > 0 && cSalary > jMax) {
    const overBy = (cSalary - jMax) / jMax;
    if (overBy <= 0.15) { reasons.push('Salary slightly above range'); return 0.6; }
    gaps.push(biGap('Salary expectation', `${cSalary} > ${jMax}`));
    return 0.2;
  }
  return 0.5;
}

// ── Work Mode Matching ─────────────────────────────────────────────────────
function scoreWorkMode(candidate, job, jobCriteria, reasons, gaps) {
  const jMode = normalizeText(jobCriteria.work_model || job.work_model || '');
  const cMode = normalizeText(candidate.work_mode_preference || '');
  if (!jMode || !cMode || cMode === 'any') return 0.5; // neutral
  if (jMode === cMode) { reasons.push(biReason('Work mode match', jMode)); return 1.0; }
  if (jMode === 'hybrid') { reasons.push('Hybrid job — partially compatible'); return 0.7; }
  gaps.push(biGap('Work mode mismatch', `${cMode} vs ${jMode}`));
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

// ── V2: Derive dimension weights from success factors ──────────────────────
function deriveWeightsFromFactors(successFactors) {
  // Start with zero weights for all dimensions
  const weights = {
    skills: 0, location: 0, job_type: 2, category: 0,
    availability: 0, education: 0, experience_level: 0,
    language: 0, salary: 2, work_mode: 2,
  };

  // Distribute each factor's points across its mapped dimensions
  for (const { factor, points } of successFactors) {
    const dimMap = SUCCESS_FACTOR_DIMENSION_MAP[factor];
    if (!dimMap) continue;
    for (const [dim, influence] of Object.entries(dimMap)) {
      // Scale: 100 points total → map proportionally to weight space (total ~100)
      weights[dim] = (weights[dim] || 0) + (points * influence);
    }
  }

  // Normalize so total weight = 100 (matching engine expects this scale)
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (total > 0) {
    const scale = 100 / total;
    for (const key of Object.keys(weights)) {
      weights[key] = Math.round(weights[key] * scale * 10) / 10;
    }
  }

  return weights;
}

// ── V2: Evaluate a single hard gate ────────────────────────────────────────
function evaluateHardGate(gate, candidate, job) {
  switch (gate.type) {
    case 'language': {
      const LANG_LEVELS = { A1:1, A2:2, B1:3, B2:4, C1:5, C2:6 };
      // Cross-language synonym sets for SK↔EN matching
      const LANG_SYNONYMS = {
        'angličtina': ['english','angličtina','anglictina','eng'],
        'english': ['english','angličtina','anglictina','eng'],
        'nemčina': ['german','nemčina','nemcina','deutsch','ger'],
        'german': ['german','nemčina','nemcina','deutsch','ger'],
        'francúzština': ['french','francúzština','francuzstina','français','fre'],
        'french': ['french','francúzština','francuzstina','français','fre'],
        'španielčina': ['spanish','španielčina','spanielcina','español','spa'],
        'spanish': ['spanish','španielčina','spanielcina','español','spa'],
        'slovenčina': ['slovak','slovenčina','slovencina','slk'],
        'slovak': ['slovak','slovenčina','slovencina','slk'],
        'čeština': ['czech','čeština','cestina','ces'],
        'czech': ['czech','čeština','cestina','ces'],
        'maďarčina': ['hungarian','maďarčina','madarcina','magyar','hun'],
        'hungarian': ['hungarian','maďarčina','madarcina','magyar','hun'],
      };
      const reqLang = (gate.lang || '').toLowerCase();
      const reqLevel = LANG_LEVELS[gate.min_level] || 0;
      const cLangs = candidate.languages || [];
      const reqSyns = LANG_SYNONYMS[reqLang] || [reqLang];
      const found = cLangs.find(l => {
        const cName = (l.lang || '').toLowerCase();
        const cSyns = LANG_SYNONYMS[cName] || [cName];
        return reqSyns.some(rs => cSyns.includes(rs)) || cName.includes(reqLang) || reqLang.includes(cName);
      });
      if (found) {
        const cLevel = LANG_LEVELS[found.level] || 0;
        if (cLevel >= reqLevel) {
          return { passed: true, reasonKey: 'Language', detail: `${gate.lang} ≥ ${gate.min_level}` };
        }
        return { passed: false, gapKey: 'Language', detail: `${gate.lang} ${found.level} vs ${gate.min_level}`, margin: reqLevel - cLevel };
      }
      return { passed: false, gapKey: 'Missing language', detail: gate.lang };
    }
    case 'availability': {
      const cHours = candidate.availability_hours || 0;
      const minHours = gate.min_hours || 0;
      if (minHours <= 0 || cHours >= minHours) {
        return { passed: true, reasonKey: 'Availability OK', detail: `${cHours}h ≥ ${minHours}h` };
      }
      return { passed: false, gapKey: 'Availability insufficient', detail: `${cHours}h vs ${minHours}h`, margin: minHours - cHours };
    }
    case 'location': {
      if (!gate.strict) return { passed: true, reasonKey: 'Location match', detail: '' };
      const jobLoc = (job.location || '').toLowerCase();
      const cLoc = (candidate.location || '').toLowerCase();
      if (cLoc && jobLoc && (cLoc.includes(jobLoc) || jobLoc.includes(cLoc))) {
        return { passed: true, reasonKey: 'Location match', detail: job.location };
      }
      return { passed: false, gapKey: 'Location mismatch', detail: `${cLoc || '?'} vs ${jobLoc}` };
    }
    case 'education': {
      const cEdu = EDUCATION_RANK[candidate.education_level] || 0;
      const rEdu = EDUCATION_RANK[gate.min_level] || 0;
      if (rEdu <= 0 || cEdu >= rEdu) {
        return { passed: true, reasonKey: 'Education level meets', detail: '' };
      }
      return { passed: false, gapKey: 'Education below preferred', detail: candidate.education_level || '?' };
    }
    default:
      return { passed: true, reasonKey: 'Gate OK', detail: '' };
  }
}

// ── Main Matching Function ─────────────────────────────────────────────────
function calculateCandidateJobMatch(candidate, job, jobCriteria, customWeights) {
  const c = jobCriteria || {};

  // ── V2 criteria: derive weights from success_factors ──
  const isV2 = Array.isArray(c.success_factors) && c.success_factors.length > 0;
  let weights;
  if (isV2) {
    weights = deriveWeightsFromFactors(c.success_factors);
  } else {
    weights = { ...MATCH_WEIGHTS, ...(customWeights || {}) };
  }

  const reasons = [];
  const gaps = [];
  const insights = [];

  // ── V2: Evaluate hard gates first ──
  const hardGateResults = [];
  if (isV2 && Array.isArray(c.hard_gates)) {
    for (const gate of c.hard_gates) {
      const result = evaluateHardGate(gate, candidate, job);
      hardGateResults.push(result);
      if (result.passed) {
        reasons.push(biReason(result.reasonKey || 'Availability OK', result.detail || ''));
      } else {
        gaps.push(biGap(result.gapKey || 'Missing language', result.detail || ''));
      }
    }
  }

  // Check if the job actually has meaningful match criteria configured
  const hasCriteria = isV2 || (
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
    gaps.push(biGap('Job has no specific match criteria', ''));
  } else if (!hasCriteria && hasJobText) {
    // We mined the description — slightly lower confidence but still useful
    matchScore = Math.min(matchScore, 85);
    insights.push({ type: 'info', text: 'Score based on job description analysis — employer should add specific criteria for better accuracy' });
  }

  // Calculate confidence
  const confidence = calculateConfidence(candidate, c);

  // Generate executive summary
  const summary = generateExecutiveSummary(candidate, job, scores, reasons, gaps, insights, confidence);

  // ── Eligibility: three-tier (eligible / near_miss / not_eligible) ──
  const hardGaps = gaps.filter(g => {
    // Check both raw strings and bilingual JSON for "Missing required" prefix
    if (typeof g === 'string') {
      try {
        const parsed = JSON.parse(g);
        return (parsed.en || '').startsWith('Missing required') && !(parsed.en || '').includes('trainable');
      } catch {
        return g.startsWith('Missing required');
      }
    }
    return false;
  });
  const trainableGaps = gaps.filter(g => {
    if (typeof g === 'string') {
      try { const p = JSON.parse(g); return (p.en || '').includes('trainable'); } catch { return g.includes('trainable'); }
    }
    return false;
  });

  let eligibility_tier = 'eligible';

  // V2: hard gate failures are the primary eligibility driver
  if (isV2 && hardGateResults.length > 0) {
    const failedGates = hardGateResults.filter(r => !r.passed);
    const nearMissGates = failedGates.filter(r => r.margin && r.margin <= 1); // within 1 level
    if (failedGates.length >= 2) {
      eligibility_tier = 'not_eligible';
    } else if (failedGates.length === 1 && nearMissGates.length === 1) {
      eligibility_tier = 'near_miss';
    } else if (failedGates.length === 1) {
      eligibility_tier = 'not_eligible';
    }
  } else {
    // V1 fallback: check skill gaps
    if (hardGaps.length >= 2) {
      eligibility_tier = 'not_eligible';
    } else if (hardGaps.length === 1) {
      eligibility_tier = 'near_miss';
    }
  }
  // Trainable gaps don't affect eligibility
  if (eligibility_tier === 'eligible' && trainableGaps.length > 0) {
    eligibility_tier = 'eligible';
  }

  const finalScore = Math.min(matchScore, 100);
  const matchBand = getMatchBand(finalScore);

  return {
    candidate_id: candidate.user_id || null,
    job_id: job.id || null,
    match_score: finalScore,
    match_band: matchBand.band,
    match_band_label: matchBand.label,
    eligibility_tier: eligibility_tier,
    criteria_version: isV2 ? 2 : 1,
    score_breakdown: breakdown,
    dimension_scores: scores,
    match_reasons: [...new Set(reasons)],
    gaps: [...new Set(gaps)],
    insights: insights,
    executive_summary: summary,
    eligible: eligibility_tier !== 'not_eligible',
    has_criteria: hasCriteria,
    confidence: confidence,
  };
}

module.exports = {
  calculateCandidateJobMatch,
  calculateProfileCompletion,
  extractImplicitSkills,
  getMatchBand,
  MATCH_BANDS,
  deriveWeightsFromFactors,
  evaluateHardGate,
  scoreSkills, scoreLocation, scoreJobType, scoreCategory, scoreAvailability,
  scoreEducation, scoreExperience, scoreLanguage, scoreSalary, scoreWorkMode,
  normalizeJobType, calculateConfidence,
};
