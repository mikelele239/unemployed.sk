'use strict';
// AI Profile Builder — generates structured candidate profile summaries.
// Rule-based in v1 (no external AI API). Can be swapped to LLM later.

const { PROFILE_COMPLETION_FIELDS } = require('./matching-config');

// ── Experience Level Detection ─────────────────────────────────────────────

function detectExperienceLevel(data) {
  const years = data.experience_years || 0;
  const hasWork = Array.isArray(data.work_experience) && data.work_experience.length > 0;
  
  if (years === 0 && !hasWork) return 'no_experience';
  if (years <= 1) return 'beginner';
  if (years <= 3) return 'junior';
  return 'experienced';
}

// ── Headline Generator ─────────────────────────────────────────────────────

function generateHeadline(data) {
  const parts = [];
  
  const level = data.experience_level || detectExperienceLevel(data);
  const levelLabels = {
    no_experience: 'Ambitious',
    beginner: 'Aspiring',
    junior: 'Junior',
    experienced: 'Experienced',
    unknown: '',
  };
  
  const prefix = levelLabels[level] || '';
  
  // Detect role from skills/education
  const skills = [...(data.hard_skills || []), ...(data.soft_skills || [])];
  const skillsLower = skills.map(s => s.toLowerCase());
  
  let role = '';
  if (skillsLower.some(s => ['react', 'vue', 'angular', 'html', 'css', 'javascript', 'typescript'].includes(s))) {
    role = 'Web Developer';
  } else if (skillsLower.some(s => ['python', 'java', 'c++', 'c#', 'golang', 'rust'].includes(s))) {
    role = 'Software Developer';
  } else if (skillsLower.some(s => ['figma', 'ui/ux', 'photoshop', 'illustrator', 'canva', 'grafický dizajn'].includes(s))) {
    role = 'Designer';
  } else if (skillsLower.some(s => ['marketing', 'seo', 'social media', 'content marketing', 'google ads', 'copywriting'].includes(s))) {
    role = 'Marketing Specialist';
  } else if (skillsLower.some(s => ['excel', 'accounting', 'sap', 'financial analysis', 'administratíva'].includes(s))) {
    role = 'Business & Admin Professional';
  } else if (skillsLower.some(s => ['data analysis', 'machine learning', 'sql', 'power bi', 'tableau'].includes(s))) {
    role = 'Data Analyst';
  } else if (data.education_field) {
    role = `${data.education_field} Graduate`;
  } else {
    role = 'Professional';
  }
  
  if (prefix) parts.push(prefix);
  parts.push(role);
  if (data.location) parts.push(`| ${data.location}`);
  
  return parts.join(' ');
}

// ── Summary Generator ──────────────────────────────────────────────────────

function generateSummary(data) {
  const parts = [];
  const name = data.full_name || 'Candidate';
  
  // Education
  if (data.education_level || data.education_school) {
    const eduLabels = {
      high_school: 'high school student',
      bachelors: 'bachelor\'s student/graduate',
      masters: 'master\'s graduate',
      phd: 'PhD candidate',
    };
    const eduLabel = eduLabels[data.education_level] || 'student';
    const school = data.education_school ? ` at ${data.education_school}` : '';
    const field = data.education_field ? ` in ${data.education_field}` : '';
    parts.push(`${name} is a ${eduLabel}${field}${school}.`);
  } else {
    parts.push(`${name} is looking for new opportunities.`);
  }
  
  // Skills
  const allSkills = [...(data.hard_skills || [])];
  if (allSkills.length > 0) {
    const top = allSkills.slice(0, 5).join(', ');
    parts.push(`Key skills include ${top}.`);
  }
  
  // Experience
  const years = data.experience_years || 0;
  if (years > 0) {
    parts.push(`Has ${years} year${years !== 1 ? 's' : ''} of relevant experience.`);
  }
  
  // Languages
  const langs = data.languages || [];
  if (langs.length > 0) {
    const langStr = langs.map(l => `${l.lang} (${l.level})`).join(', ');
    parts.push(`Languages: ${langStr}.`);
  }
  
  return parts.join(' ');
}

// ── Portfolio Intro ────────────────────────────────────────────────────────

function generatePortfolioIntro(data) {
  const skills = [...(data.hard_skills || [])];
  if (skills.length === 0 && !data.education_field) return '';
  
  const focus = data.education_field || skills.slice(0, 3).join(', ');
  const level = data.experience_level || detectExperienceLevel(data);
  
  if (level === 'no_experience' || level === 'beginner') {
    return `Eager to apply knowledge in ${focus} to real-world projects. Open to learning and growing in a professional environment.`;
  }
  
  return `Bringing practical experience in ${focus} with a proven ability to deliver results. Ready for the next challenge.`;
}

// ── Strengths Detection ────────────────────────────────────────────────────

function detectStrengths(data) {
  const strengths = [];
  const skills = [...(data.hard_skills || []), ...(data.soft_skills || [])];
  
  if (skills.length >= 5) strengths.push('Diverse skill set');
  if (skills.length >= 10) strengths.push('Broad technical expertise');
  
  const softSkills = data.soft_skills || [];
  if (softSkills.length >= 3) strengths.push('Strong interpersonal skills');
  
  const langs = data.languages || [];
  if (langs.length >= 3) strengths.push('Multilingual');
  if (langs.some(l => ['C1', 'C2'].includes(l.level) && l.lang !== 'Slovenčina')) {
    strengths.push('Advanced language proficiency');
  }
  
  if (data.experience_years >= 2) strengths.push('Practical work experience');
  if (data.certifications?.length > 0) strengths.push('Certified professional');
  if (data.portfolio_links?.length > 0) strengths.push('Portfolio-backed skills');
  if (data.education_level === 'masters' || data.education_level === 'phd') strengths.push('Advanced education');
  
  return strengths.length > 0 ? strengths : ['Motivated learner', 'Open to growth'];
}

// ── Development Areas ──────────────────────────────────────────────────────

function detectDevelopmentAreas(data) {
  const areas = [];
  
  if (!data.experience_years || data.experience_years === 0) {
    areas.push('Building practical work experience');
  }
  
  const skills = data.hard_skills || [];
  if (skills.length < 3) areas.push('Expanding technical skill set');
  
  const softSkills = data.soft_skills || [];
  if (softSkills.length === 0) areas.push('Developing soft skills');
  
  const langs = data.languages || [];
  if (langs.length <= 1) areas.push('Learning additional languages');
  
  if (!data.certifications?.length) areas.push('Obtaining professional certifications');
  if (!data.portfolio_links?.length) areas.push('Building a project portfolio');
  
  return areas.slice(0, 4);
}

// ── Role Suggestions ───────────────────────────────────────────────────────

function suggestRoles(data) {
  const roles = new Set();
  const skills = [...(data.hard_skills || [])].map(s => s.toLowerCase());
  
  // Tech roles
  if (skills.some(s => ['react', 'vue', 'angular', 'html', 'css'].includes(s))) roles.add('Frontend Developer');
  if (skills.some(s => ['node.js', 'python', 'java', 'php', 'c#'].includes(s))) roles.add('Backend Developer');
  if (roles.has('Frontend Developer') && roles.has('Backend Developer')) roles.add('Full-Stack Developer');
  if (skills.includes('sql') || skills.includes('data analysis') || skills.includes('power bi')) roles.add('Data Analyst');
  if (skills.includes('testovanie') || skills.includes('qa')) roles.add('QA Tester');
  if (skills.includes('devops') || skills.includes('docker') || skills.includes('kubernetes')) roles.add('DevOps Engineer');
  
  // Creative roles
  if (skills.some(s => ['figma', 'photoshop', 'illustrator', 'canva', 'ui/ux', 'grafický dizajn'].includes(s))) roles.add('Graphic Designer');
  if (skills.includes('ui/ux')) roles.add('UX Designer');
  
  // Marketing roles
  if (skills.some(s => ['marketing', 'seo', 'social media', 'google ads'].includes(s))) roles.add('Marketing Assistant');
  if (skills.includes('copywriting') || skills.includes('content marketing')) roles.add('Content Writer');
  
  // Business roles
  if (skills.some(s => ['excel', 'accounting', 'sap'].includes(s))) roles.add('Administrative Assistant');
  if (skills.includes('projektový manažment') || skills.includes('project management')) roles.add('Project Coordinator');
  if (skills.includes('zákaznícky servis') || skills.includes('customer service')) roles.add('Customer Support');
  
  // Education-based
  if (data.education_field) {
    const f = data.education_field.toLowerCase();
    if (f.includes('informatik') || f.includes('computer')) roles.add('IT Intern');
    if (f.includes('ekonóm') || f.includes('business')) roles.add('Business Intern');
    if (f.includes('právo') || f.includes('law')) roles.add('Legal Assistant');
    if (f.includes('medicín') || f.includes('health')) roles.add('Healthcare Support');
  }
  
  return [...roles].slice(0, 6);
}

// ── Category Suggestions ───────────────────────────────────────────────────

function suggestCategories(data) {
  const cats = new Set();
  const skills = [...(data.hard_skills || [])].map(s => s.toLowerCase());
  
  if (skills.some(s => ['javascript', 'python', 'react', 'node.js', 'html', 'java', 'c++'].includes(s))) cats.add('IT & Development');
  if (skills.some(s => ['figma', 'photoshop', 'canva', 'ui/ux', 'grafický dizajn'].includes(s))) cats.add('Design & Creative');
  if (skills.some(s => ['marketing', 'seo', 'social media', 'google ads', 'copywriting'].includes(s))) cats.add('Marketing & PR');
  if (skills.some(s => ['excel', 'accounting', 'sap', 'administratíva'].includes(s))) cats.add('Admin & Office');
  if (skills.some(s => ['zákaznícky servis', 'customer service', 'predaj'].includes(s))) cats.add('Sales & Support');
  if (skills.some(s => ['data analysis', 'sql', 'power bi', 'tableau', 'machine learning'].includes(s))) cats.add('Data & Analytics');
  
  if (data.education_field) {
    const f = data.education_field.toLowerCase();
    if (f.includes('právo')) cats.add('Legal');
    if (f.includes('medicín') || f.includes('zdrav')) cats.add('Healthcare');
    if (f.includes('pedagog') || f.includes('teach')) cats.add('Education');
  }
  
  return [...cats].slice(0, 5);
}

// ── Missing Fields ─────────────────────────────────────────────────────────

function detectMissingFields(data) {
  const missing = [];
  
  if (!data.full_name) missing.push('full_name');
  if (!data.location) missing.push('location');
  if (!data.education_level) missing.push('education_level');
  if (!data.education_field) missing.push('field_of_study');
  if (!(data.hard_skills?.length > 0)) missing.push('skills');
  if (!(data.languages?.length > 0)) missing.push('languages');
  if (!data.experience_level || data.experience_level === 'unknown') missing.push('experience_level');
  if (!data.availability_hours) missing.push('availability_hours_per_week');
  if (!(data.preferred_job_types?.length > 0)) missing.push('preferred_job_types');
  if (!data.email) missing.push('email');
  if (!data.phone) missing.push('phone_number');
  if (!(data.portfolio_links?.length > 0)) missing.push('portfolio_links');
  if (!data.work_mode_preference) missing.push('work_mode_preference');
  
  return missing;
}

// ── Profile Quality Notes ──────────────────────────────────────────────────

function generateQualityNotes(data, missing) {
  const notes = [];
  
  if (missing.length === 0) {
    notes.push('Profile is complete — great job!');
  } else if (missing.length <= 3) {
    notes.push(`Almost complete — fill in ${missing.join(', ')} to improve visibility.`);
  } else {
    notes.push(`${missing.length} fields missing — more detail helps employers find you.`);
  }
  
  if ((data.hard_skills?.length || 0) < 3) {
    notes.push('Add more skills to increase match opportunities.');
  }
  
  if (!(data.languages?.length > 0)) {
    notes.push('Adding language proficiency helps with international roles.');
  }
  
  return notes;
}

// ── Normalize Skills ───────────────────────────────────────────────────────

function normalizeSkillList(data) {
  try {
    const { normalizeSkill } = require('./ai-extraction');
    const all = [...(data.hard_skills || []), ...(data.soft_skills || [])];
    return [...new Set(all.map(normalizeSkill))];
  } catch {
    return [...new Set([...(data.hard_skills || []), ...(data.soft_skills || [])])];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Main entry point
// ══════════════════════════════════════════════════════════════════════════════

function generateCandidateProfileSummary(candidateData) {
  const data = candidateData || {};
  
  try {
    const expLevel = data.experience_level || detectExperienceLevel(data);
    const missing = detectMissingFields(data);
    const normalizedSkills = normalizeSkillList(data);
    
    return {
      headline: generateHeadline({ ...data, experience_level: expLevel }),
      summary: generateSummary(data),
      portfolio_intro: generatePortfolioIntro({ ...data, experience_level: expLevel }),
      strengths: detectStrengths(data),
      development_areas: detectDevelopmentAreas(data),
      suggested_roles: suggestRoles(data),
      suggested_categories: suggestCategories(data),
      missing_fields: missing,
      experience_level: expLevel,
      normalized_skills: normalizedSkills,
      languages: data.languages || [],
      profile_quality_notes: generateQualityNotes(data, missing),
    };
  } catch (err) {
    // Graceful fallback — return safe empty structure
    return {
      headline: '',
      summary: '',
      portfolio_intro: '',
      strengths: [],
      development_areas: [],
      suggested_roles: [],
      suggested_categories: [],
      missing_fields: detectMissingFields(data),
      experience_level: 'unknown',
      normalized_skills: [],
      languages: [],
      profile_quality_notes: ['Profile generation encountered an error — please fill in fields manually.'],
    };
  }
}

module.exports = {
  generateCandidateProfileSummary,
  generateHeadline, generateSummary, generatePortfolioIntro,
  detectStrengths, detectDevelopmentAreas, suggestRoles, suggestCategories,
  detectMissingFields, detectExperienceLevel, calculateProfileCompletion: require('./matching-engine').calculateProfileCompletion,
};
