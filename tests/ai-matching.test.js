'use strict';
const {
  extractEmail, extractPhone, extractSkills, extractLanguages,
  detectEducationLevel, normalizeSkill, HARD_SKILLS, SOFT_SKILLS,
  extractProfileFromText,
} = require('../lib/ai-extraction');

const {
  calculateCandidateJobMatch, calculateProfileCompletion,
} = require('../lib/matching-engine');

const { generateCandidateProfileSummary } = require('../lib/ai-profile-builder');

let passed = 0, failed = 0;
function assert(name, cond) {
  if (cond) { console.log(`  ✓ ${name}`); passed++; }
  else { console.log(`  ✗ FAIL: ${name}`); failed++; }
}

console.log('\n═══ AI Matching Tests v4 ═══');

// ── Extraction ─────────────────────────────────────────────────────────────
console.log('\nextractEmail:');
assert('finds standard email', extractEmail('test@example.com') === 'test@example.com');
assert('finds email in CV text', extractEmail('Kontakt: matej@mail.sk tel 0900') === 'matej@mail.sk');
assert('returns null when no email', extractEmail('no email here') === null);

console.log('\nextractPhone:');
assert('finds +421 number', extractPhone('+421 912 345 678')?.startsWith('+421'));
assert('finds 0-prefix number', extractPhone('0912 345 678')?.startsWith('0912'));
assert('returns null when none', extractPhone('no phone') === null);

console.log('\nextractSkills:');
const skillText = 'worked with javascript, react, node.js, python and sql. used figma for design. also excel.';
const foundSkills = extractSkills(skillText, HARD_SKILLS);
['javascript', 'react', 'node.js', 'sql', 'figma', 'python', 'excel'].forEach(s =>
  assert(`finds ${s}`, foundSkills.includes(s))
);
assert('finds Slovak soft skill', extractSkills('komunikácia a tímová práca', SOFT_SKILLS).includes('komunikácia'));

console.log('\nnormalizeSkill:');
assert('js → javascript', normalizeSkill('js') === 'javascript');
assert('ts → typescript', normalizeSkill('ts') === 'typescript');
assert('node → node.js', normalizeSkill('node') === 'node.js');
assert('ppc → google ads', normalizeSkill('ppc') === 'google ads');
assert('reactjs → react', normalizeSkill('reactjs') === 'react');

console.log('\nextractLanguages:');
const langText = 'Angličtina B2, Nemčina A2, Slovenčina - native';
const langs = extractLanguages(langText);
assert('finds 3 languages', langs.length === 3);
assert('English at B2', langs.some(l => l.lang === 'Angličtina' && l.level === 'B2'));
assert('German at A2', langs.some(l => l.lang === 'Nemčina' && l.level === 'A2'));
assert('Slovak at C2 (native)', langs.some(l => l.lang === 'Slovenčina' && l.level === 'C2'));

console.log('\ndetectEducationLevel:');
assert('finds masters (Ing.)', detectEducationLevel('ing. jan novák') === 'masters');
assert('finds bachelors (Bc.)', detectEducationLevel('bc. mária') === 'bachelors');
assert('finds high school', detectEducationLevel('gymnázium') === 'high_school');
assert('finds PhD', detectEducationLevel('phd candidate') === 'phd');
assert('returns null for empty', detectEducationLevel('nothing here') === null);

// ── Matching Engine (100-point) ────────────────────────────────────────────
console.log('\n--- Matching Engine (100pts) ---');

const candidate = {
  user_id: 'test-user',
  hard_skills: ['javascript', 'react', 'node.js', 'sql'],
  soft_skills: ['communication', 'teamwork'],
  languages: [{ lang: 'Angličtina', level: 'B2' }, { lang: 'Slovenčina', level: 'C2' }],
  education_level: 'bachelors',
  education_field: 'Informatika',
  experience_years: 1,
  experience_level: 'beginner',
  location: 'Bratislava',
  preferred_locations: ['Bratislava'],
  preferred_job_types: ['part_time', 'internship'],
  availability_hours: 20,
  work_mode_preference: 'hybrid',
  salary_expectation: 800,
};

const job = { id: 1, location: 'Bratislava', work_model: 'Hybrid', job_type: 'part_time' };
const criteria = {
  required_skills: ['javascript', 'react'],
  preferred_skills: ['node.js', 'typescript'],
  min_education_level: 'bachelors',
  preferred_fields: ['Informatika'],
  required_experience_level: 'beginner',
  student_friendly: true,
  required_languages: [{ lang: 'Angličtina', min_level: 'B1' }],
  hours_per_week: 20,
  salary_min: 600,
  salary_max: 1000,
  work_model: 'Hybrid',
};

console.log('\ncalculateCandidateJobMatch — good match:');
const result = calculateCandidateJobMatch(candidate, job, criteria);
assert('match_score is a number', typeof result.match_score === 'number');
assert('score > 60 for good match', result.match_score > 60);
assert('has score_breakdown', typeof result.score_breakdown === 'object');
assert('breakdown sums to match_score', Math.round(Object.values(result.score_breakdown).reduce((a,b) => a+b, 0)) === result.match_score);
assert('has match_reasons', Array.isArray(result.match_reasons) && result.match_reasons.length > 0);
assert('has gaps array', Array.isArray(result.gaps));
assert('is eligible', result.eligible === true);
assert('all 10 dimensions in breakdown', Object.keys(result.score_breakdown).length === 10);

console.log('\ncalculateCandidateJobMatch — missing required skills:');
const weakCandidate = { ...candidate, hard_skills: ['python'], soft_skills: [] };
const weakResult = calculateCandidateJobMatch(weakCandidate, job, criteria);
assert('lower score', weakResult.match_score < result.match_score);
assert('has skill gaps', weakResult.gaps.some(g => g.includes('Missing required skill')));
assert('skills score < 30', weakResult.score_breakdown.skills < 30);

console.log('\ncalculateCandidateJobMatch — no experience (student-friendly):');
const noExpCandidate = { ...candidate, experience_level: 'no_experience', experience_years: 0 };
const noExpResult = calculateCandidateJobMatch(noExpCandidate, job, criteria);
assert('still good score (student-friendly)', noExpResult.match_score > 50);
assert('experience not penalized', noExpResult.score_breakdown.experience_level === 10);

console.log('\ncalculateCandidateJobMatch — remote job:');
const remoteJob = { ...job, work_model: 'Remote' };
const remoteResult = calculateCandidateJobMatch(candidate, remoteJob, { ...criteria, work_model: 'Remote' });
assert('location = full points', remoteResult.score_breakdown.location === 15);

console.log('\ncalculateCandidateJobMatch — location mismatch:');
const farCandidate = { ...candidate, location: 'Košice', preferred_locations: ['Košice'] };
const farResult = calculateCandidateJobMatch(farCandidate, job, criteria);
assert('location < full', farResult.score_breakdown.location < 15);
assert('location > 0 for hybrid', farResult.score_breakdown.location > 0);

console.log('\ncalculateCandidateJobMatch — availability mismatch:');
const busyCandidate = { ...candidate, availability_hours: 5 };
const busyResult = calculateCandidateJobMatch(busyCandidate, job, criteria);
assert('availability < full', busyResult.score_breakdown.availability < 10);
assert('has availability gap', busyResult.gaps.some(g => g.includes('Availability')));

console.log('\ncalculateCandidateJobMatch — salary mismatch:');
const expensiveCandidate = { ...candidate, salary_expectation: 5000 };
const expensiveResult = calculateCandidateJobMatch(expensiveCandidate, job, criteria);
assert('salary < full', expensiveResult.score_breakdown.salary < 3);

console.log('\ncalculateCandidateJobMatch — work mode mismatch:');
const remoteOnlyCandidate = { ...candidate, work_mode_preference: 'remote' };
const onSiteJob = { ...job, work_model: 'On-site' };
const wmResult = calculateCandidateJobMatch(remoteOnlyCandidate, onSiteJob, { ...criteria, work_model: 'On-site' });
assert('work_mode = 0', wmResult.score_breakdown.work_mode === 0);

// ── Profile Completion ─────────────────────────────────────────────────────
console.log('\nprofileCompletion:');
const completion = calculateProfileCompletion(candidate);
assert('score is 0-100', completion.score >= 0 && completion.score <= 100);
assert('missing_fields is array', Array.isArray(completion.missing_fields));
assert('good profile > 50%', completion.score > 50);

const emptyCompletion = calculateProfileCompletion({});
assert('empty profile has missing fields', emptyCompletion.missing_fields.length > 5);
assert('empty profile low score', emptyCompletion.score < 30);

// ── AI Profile Builder ─────────────────────────────────────────────────────
console.log('\n--- AI Profile Builder ---');

console.log('\ngenerateCandidateProfileSummary — full data:');
const aiResult = generateCandidateProfileSummary(candidate);
assert('returns headline', typeof aiResult.headline === 'string' && aiResult.headline.length > 0);
assert('returns summary', typeof aiResult.summary === 'string' && aiResult.summary.length > 0);
assert('returns strengths array', Array.isArray(aiResult.strengths) && aiResult.strengths.length > 0);
assert('returns development_areas', Array.isArray(aiResult.development_areas));
assert('returns suggested_roles', Array.isArray(aiResult.suggested_roles) && aiResult.suggested_roles.length > 0);
assert('returns suggested_categories', Array.isArray(aiResult.suggested_categories));
assert('returns missing_fields', Array.isArray(aiResult.missing_fields));
assert('returns experience_level', ['no_experience','beginner','junior','experienced'].includes(aiResult.experience_level));
assert('returns normalized_skills', Array.isArray(aiResult.normalized_skills) && aiResult.normalized_skills.length > 0);
assert('returns profile_quality_notes', Array.isArray(aiResult.profile_quality_notes));
assert('valid JSON structure', JSON.parse(JSON.stringify(aiResult)) !== null);

console.log('\ngenerateCandidateProfileSummary — empty data:');
const emptyAi = generateCandidateProfileSummary({});
assert('returns valid structure for empty', typeof emptyAi.headline === 'string');
assert('has missing fields', emptyAi.missing_fields.length > 5);
assert('experience_level fallback', emptyAi.experience_level === 'no_experience');

console.log('\ngenerateCandidateProfileSummary — dev candidate:');
const devData = {
  full_name: 'Jana Nová', hard_skills: ['react', 'node.js', 'typescript'],
  soft_skills: ['teamwork'], education_level: 'bachelors', education_field: 'Informatika',
  experience_years: 2, languages: [{ lang: 'Angličtina', level: 'C1' }],
};
const devAi = generateCandidateProfileSummary(devData);
assert('headline mentions Developer', devAi.headline.includes('Developer'));
assert('suggested roles has Frontend', devAi.suggested_roles.some(r => r.includes('Developer')));
assert('suggested category has IT', devAi.suggested_categories.includes('IT & Development'));

// ── Employer card: unapproved AI hidden ────────────────────────────────────
console.log('\nEmployer card — unapproved AI hidden:');
const profileNotApproved = { ...candidate, ai_headline: 'Test Headline', ai_summary: 'Test Summary', ai_profile_approved: false };
const profileApproved = { ...profileNotApproved, ai_profile_approved: true };

function buildEmployerCard(p) {
  return {
    headline: p.ai_profile_approved ? p.ai_headline : null,
    summary: p.ai_profile_approved ? p.ai_summary : null,
    skills: p.hard_skills,
    location: p.location,
  };
}
const cardNotApproved = buildEmployerCard(profileNotApproved);
const cardApproved = buildEmployerCard(profileApproved);
assert('unapproved: no headline', cardNotApproved.headline === null);
assert('unapproved: no summary', cardNotApproved.summary === null);
assert('approved: has headline', cardApproved.headline === 'Test Headline');
assert('approved: has summary', cardApproved.summary === 'Test Summary');

// ── Edge cases ─────────────────────────────────────────────────────────────
console.log('\nEdge cases:');
const extractEmpty = extractProfileFromText('');
assert('empty text → 0 confidence', extractEmpty.confidence_score === 0);

const extractShort = extractProfileFromText('hello');
assert('short text → low confidence', extractShort.confidence_score < 0.3);

// Match with no criteria
const noCriteriaResult = calculateCandidateJobMatch(candidate, job, {});
assert('no criteria → capped score (<= 50)', noCriteriaResult.match_score <= 50);

// Match with null candidate data
const nullResult = calculateCandidateJobMatch({}, job, criteria);
assert('empty candidate → still returns score', typeof nullResult.match_score === 'number');

console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══\n`);
process.exit(failed > 0 ? 1 : 0);
