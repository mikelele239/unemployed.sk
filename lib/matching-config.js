'use strict';
// Matching engine configuration — easy to edit weights without touching business logic.

const MATCH_WEIGHTS = {
  skills:           30,
  location:         15,
  job_type:         10,
  category:          8,
  availability:      7,
  education:        10,
  experience_level: 10,
  language:          5,
  salary:            3,
  work_mode:         2,
};

// Experience level hierarchy (higher = more experienced)
const EXPERIENCE_RANK = {
  no_experience: 0,
  beginner: 1,
  junior: 2,
  experienced: 3,
  unknown: 1, // treat unknown as beginner
};

// Education level hierarchy
const EDUCATION_RANK = {
  high_school: 1,
  bachelors: 2,
  masters: 3,
  phd: 4,
};

// Profile completion: fields and their weights for the completion score
const PROFILE_COMPLETION_FIELDS = [
  { key: 'full_name',       weight: 5,  check: v => !!v },
  { key: 'location',        weight: 10, check: v => !!v },
  { key: 'education_level', weight: 10, check: v => !!v },
  { key: 'education_field', weight: 5,  check: v => !!v },
  { key: 'education_school',weight: 5,  check: v => !!v },
  { key: 'hard_skills',     weight: 15, check: v => Array.isArray(v) && v.length > 0 },
  { key: 'languages',       weight: 10, check: v => Array.isArray(v) && v.length > 0 },
  { key: 'experience_level',weight: 5,  check: v => !!v && v !== 'unknown' },
  { key: 'availability_hours', weight: 5, check: v => v > 0 },
  { key: 'preferred_job_types', weight: 10, check: v => Array.isArray(v) && v.length > 0 },
  { key: 'preferred_categories', weight: 5, check: v => Array.isArray(v) && v.length > 0 },
  { key: 'work_mode_preference', weight: 5, check: v => !!v && v !== 'any' },
  { key: 'email',           weight: 5,  check: v => !!v },
  { key: 'phone',           weight: 5,  check: v => !!v },
];

// Job type normalization map
const JOB_TYPE_ALIASES = {
  'brigáda': 'part_time', 'part-time': 'part_time', 'part_time': 'part_time',
  'stáž': 'internship', 'internship': 'internship',
  'plný úväzok': 'full_time', 'full-time': 'full_time', 'full_time': 'full_time',
  'jednorázovky': 'seasonal', 'seasonal': 'seasonal', 'one-off': 'seasonal', 'gig': 'seasonal',
  'graduate': 'graduate_role', 'graduate_role': 'graduate_role',
  'junior': 'junior_role', 'junior_role': 'junior_role',
};

// ── Skill Families ────────────────────────────────────────────────────────
// Skills within the same family get PARTIAL credit (0.3–0.5) when the exact
// skill isn't matched.  This makes the algorithm understand that knowing
// "Vue" is partially relevant when a job asks for "React".

const SKILL_FAMILIES = {
  frontend: {
    skills: ['react', 'vue', 'angular', 'svelte', 'html', 'css', 'javascript', 'typescript', 'next.js', 'nuxt', 'tailwind', 'bootstrap', 'sass'],
    transferCredit: 0.35,
  },
  backend: {
    skills: ['node.js', 'python', 'java', 'php', 'c#', 'go', 'rust', 'ruby', 'django', 'flask', 'express', 'spring'],
    transferCredit: 0.30,
  },
  data: {
    skills: ['sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'data analysis', 'power bi', 'tableau', 'excel', 'google analytics'],
    transferCredit: 0.35,
  },
  devops: {
    skills: ['docker', 'kubernetes', 'aws', 'azure', 'terraform', 'linux', 'devops', 'ci/cd'],
    transferCredit: 0.30,
  },
  design: {
    skills: ['figma', 'photoshop', 'illustrator', 'canva', 'ui/ux', 'grafický dizajn', 'adobe illustrator'],
    transferCredit: 0.40,
  },
  marketing: {
    skills: ['marketing', 'seo', 'social media', 'google ads', 'facebook ads', 'content marketing', 'copywriting', 'email marketing', 'branding'],
    transferCredit: 0.35,
  },
  office: {
    skills: ['excel', 'word', 'powerpoint', 'g-suite', 'office 365', 'sap', 'administratíva'],
    transferCredit: 0.40,
  },
  ml: {
    skills: ['machine learning', 'python', 'data analysis', 'sql', 'tensorflow', 'pytorch'],
    transferCredit: 0.25,
  },
  mobile: {
    skills: ['swift', 'kotlin', 'flutter', 'dart', 'react native', 'react'],
    transferCredit: 0.30,
  },
  pm: {
    skills: ['projektový manažment', 'scrum', 'jira', 'project management'],
    transferCredit: 0.40,
  },
  customer: {
    skills: ['zákaznícky servis', 'predaj', 'customer service', 'communication', 'komunikácia'],
    transferCredit: 0.35,
  },
};

// ── Category Taxonomy ─────────────────────────────────────────────────────
// Maps category names (used in job_match_criteria.category and job.tags) to
// keywords that might appear in candidate profiles or job data.

const CATEGORY_MAP = {
  'IT & Development':  { keywords: ['javascript','python','react','node','java','developer','programov','software','html','css','typescript','sql','web','fullstack','frontend','backend'], skills: ['javascript','react','node.js','python','java','html','css','typescript','sql'] },
  'IT & Tech':         { keywords: ['javascript','python','react','node','java','developer','programov','software','html','css','typescript','sql','tech'], skills: ['javascript','react','node.js','python','java','html','css','typescript'] },
  'Design & Creative': { keywords: ['figma','photoshop','dizajn','design','creative','illustrator','canva','ui','ux','grafický'], skills: ['figma','photoshop','illustrator','canva','ui/ux','grafický dizajn'] },
  'Marketing':         { keywords: ['marketing','seo','social','media','ads','content','copywriting','pr','branding','digital','reklam'], skills: ['marketing','seo','social media','google ads','copywriting','content marketing'] },
  'Marketing & PR':    { keywords: ['marketing','seo','social','media','ads','content','copywriting','pr','branding','digital'], skills: ['marketing','seo','social media','google ads','copywriting'] },
  'Admin & Office':    { keywords: ['admin','office','excel','word','sap','administratív','kancelár','assistant','asistent','secretary'], skills: ['excel','word','administratíva','sap','office 365'] },
  'Gastro':            { keywords: ['gastro','restaurant','reštaurác','kitchen','kuchyň','waiter','čašník','cook','kuchár','barista','bar'], skills: [] },
  'Retail':            { keywords: ['retail','shop','obchod','predaj','sales','predajňa','pokladn','cashier'], skills: ['predaj','zákaznícky servis'] },
  'Warehouse':         { keywords: ['sklad','warehouse','logistics','logistik','balenie','expedícia','forklift','driver','skladník'], skills: [] },
  'Sklad':             { keywords: ['sklad','warehouse','logistics','logistik','balenie'], skills: [] },
  'Sales & Support':   { keywords: ['sales','predaj','support','zákaznícky','customer','call center','helpdesk'], skills: ['predaj','zákaznícky servis'] },
  'Data & Analytics':  { keywords: ['data','analytics','sql','power bi','tableau','analysis','analýza','statistik'], skills: ['data analysis','sql','power bi','tableau'] },
  'Legal':             { keywords: ['legal','law','právo','právn','jurist','legislat'], skills: [] },
  'Healthcare':        { keywords: ['health','medical','zdrav','medicín','farmac','lekár','nurse'], skills: [] },
  'Education':         { keywords: ['teach','pedagog','education','vzdelav','tutor','lektor','školenie','training'], skills: [] },
  'Administratíva':    { keywords: ['admin','administratív','kancelár','assistant','office','recepc'], skills: ['administratíva','excel','word'] },
};

// ── Description Keyword Patterns ──────────────────────────────────────────
// Used to extract implicit skill requirements from job description/requirements
// text when no explicit job_match_criteria skills are configured.

const DESCRIPTION_SKILL_PATTERNS = [
  // Technical
  { pattern: /\b(react|react\.js|reactjs)\b/i, skill: 'react' },
  { pattern: /\b(vue|vue\.js|vuejs)\b/i, skill: 'vue' },
  { pattern: /\b(angular|angularjs)\b/i, skill: 'angular' },
  { pattern: /\b(node|node\.js|nodejs)\b/i, skill: 'node.js' },
  { pattern: /\b(python)\b/i, skill: 'python' },
  { pattern: /\b(java)\b(?!script)/i, skill: 'java' },
  { pattern: /\b(javascript|js)\b/i, skill: 'javascript' },
  { pattern: /\b(typescript|ts)\b/i, skill: 'typescript' },
  { pattern: /\b(html5?)\b/i, skill: 'html' },
  { pattern: /\b(css3?)\b/i, skill: 'css' },
  { pattern: /\b(sql|databáz|database)\b/i, skill: 'sql' },
  { pattern: /\b(excel|tabuľk|spreadsheet)\b/i, skill: 'excel' },
  { pattern: /\b(word|textov[ýé]\s*editor)\b/i, skill: 'word' },
  { pattern: /\b(photoshop)\b/i, skill: 'photoshop' },
  { pattern: /\b(figma)\b/i, skill: 'figma' },
  { pattern: /\b(canva)\b/i, skill: 'canva' },
  { pattern: /\b(sap)\b/i, skill: 'sap' },
  { pattern: /\b(docker)\b/i, skill: 'docker' },
  { pattern: /\b(git|github|gitlab)\b/i, skill: 'git' },
  { pattern: /\b(linux)\b/i, skill: 'linux' },
  { pattern: /\b(aws|amazon web services)\b/i, skill: 'aws' },
  // Marketing
  { pattern: /\b(seo|search\s*engine\s*optim)\b/i, skill: 'seo' },
  { pattern: /\b(social\s*media|sociáln[ey]\s*siet|smm)\b/i, skill: 'social media' },
  { pattern: /\b(google\s*ads|adwords|ppc)\b/i, skill: 'google ads' },
  { pattern: /\b(facebook\s*ads|meta\s*ads)\b/i, skill: 'facebook ads' },
  { pattern: /\b(copywriting|kopi|copy)\b/i, skill: 'copywriting' },
  { pattern: /\b(content\s*marketing)\b/i, skill: 'content marketing' },
  { pattern: /\b(email\s*marketing)\b/i, skill: 'email marketing' },
  // Soft
  { pattern: /\b(customer\s*service|zákaznícky\s*servis|zákazníc)\b/i, skill: 'zákaznícky servis' },
  { pattern: /\b(project\s*management|projektov[ýé]\s*manažment)\b/i, skill: 'projektový manažment' },
  { pattern: /\b(komunikáci|communicat)\b/i, skill: 'komunikácia' },
  { pattern: /\b(team\s*work|tímov[áa]\s*prác)\b/i, skill: 'teamwork' },
  { pattern: /\b(leadership|vedenie|vodcov)\b/i, skill: 'leadership' },
  { pattern: /\b(predaj|sales)\b/i, skill: 'predaj' },
  { pattern: /\b(accounting|účtovníc)\b/i, skill: 'accounting' },
  { pattern: /\b(administratív|administrat)\b/i, skill: 'administratíva' },
];

// ── Insight Templates ─────────────────────────────────────────────────────
// Templates for generating human-readable insights.

const INSIGHT_TEMPLATES = {
  // For employers viewing candidates
  employer: {
    strongMatch:    (name, pct) => `${name} covers ${pct}% of your skill requirements and is a strong potential fit.`,
    partialMatch:   (name, pct, missing) => `${name} covers ${pct}% of required skills. Key gaps: ${missing}.`,
    transferable:   (name, family) => `${name} has transferable skills in ${family} that could accelerate onboarding.`,
    locationFit:    (name) => `${name}'s location aligns with this role — no relocation needed.`,
    overqualified:  (name) => `${name} exceeds the experience requirements — may expect growth opportunities.`,
    educationFit:   (name, field) => `${name}'s ${field} background is directly relevant to this role.`,
    noData:         () => `Limited profile data available — candidate should complete their profile for better matching.`,
  },
  // For students viewing jobs
  student: {
    strongMatch:    (pct) => `This job matches ${pct}% of your skills — a strong fit for your profile.`,
    growthOpp:      (skills) => `Great growth opportunity — you'd learn ${skills} on the job.`,
    locationFit:    (loc) => `Located in ${loc}, matching your preferred area.`,
    remote:         () => `This is a remote position — work from anywhere.`,
    salaryFit:      () => `The compensation matches your expectations.`,
    skillGap:       (skills) => `Consider brushing up on ${skills} to strengthen your application.`,
    categoryMatch:  (cat) => `This role is in ${cat}, one of your preferred categories.`,
  },
};

// ── Phase 2: Success factor → dimension mapping ──────────────────────────
// Each success factor maps to engine dimensions with relative influence.
const SUCCESS_FACTOR_DIMENSION_MAP = {
  technical_skills: { skills: 1.0 },
  communication:    { skills: 0.3, category: 0.7 },
  education:        { education: 1.0 },
  portfolio:        { experience_level: 0.6, skills: 0.4 },
  availability:     { availability: 0.7, job_type: 0.3 },
  location:         { location: 1.0 },
  language:         { language: 1.0 },
  industry_exp:     { category: 0.5, experience_level: 0.5 },
};

// ── Phase 2: Hard gate types ─────────────────────────────────────────────
const HARD_GATE_TYPES = ['language', 'availability', 'location', 'certification', 'education'];

// ── Phase 2: Role templates ──────────────────────────────────────────────
const ROLE_TEMPLATES = {
  frontend_dev: {
    label: { sk: 'Frontend Developer', en: 'Frontend Developer' },
    suggested_skills: ['javascript', 'html', 'css', 'react', 'typescript', 'git'],
    default_factors: [
      { factor: 'technical_skills', points: 40 },
      { factor: 'portfolio',        points: 25 },
      { factor: 'education',        points: 15 },
      { factor: 'communication',    points: 10 },
      { factor: 'language',         points: 10 },
    ],
    default_gates: [{ type: 'language', lang: 'Angličtina', min_level: 'B1' }],
  },
  marketing_intern: {
    label: { sk: 'Marketingový stážista', en: 'Marketing Intern' },
    suggested_skills: ['social media', 'content creation', 'copywriting', 'canva', 'google analytics', 'seo'],
    default_factors: [
      { factor: 'communication',    points: 35 },
      { factor: 'technical_skills', points: 25 },
      { factor: 'portfolio',        points: 20 },
      { factor: 'language',         points: 10 },
      { factor: 'education',        points: 10 },
    ],
    default_gates: [],
  },
  admin_assistant: {
    label: { sk: 'Administratívny asistent', en: 'Administrative Assistant' },
    suggested_skills: ['ms office', 'excel', 'communication', 'organization', 'data entry'],
    default_factors: [
      { factor: 'communication',    points: 30 },
      { factor: 'technical_skills', points: 20 },
      { factor: 'availability',     points: 20 },
      { factor: 'location',         points: 15 },
      { factor: 'language',         points: 15 },
    ],
    default_gates: [{ type: 'availability', min_hours: 20 }],
  },
  retail_sales: {
    label: { sk: 'Predavač / Retail', en: 'Retail / Sales' },
    suggested_skills: ['customer service', 'communication', 'pos systems', 'cash handling'],
    default_factors: [
      { factor: 'communication',    points: 30 },
      { factor: 'availability',     points: 30 },
      { factor: 'location',         points: 20 },
      { factor: 'language',         points: 10 },
      { factor: 'industry_exp',     points: 10 },
    ],
    default_gates: [{ type: 'location', strict: true }],
  },
  gastro_hospitality: {
    label: { sk: 'Gastro / Hotelierstvo', en: 'Gastro / Hospitality' },
    suggested_skills: ['customer service', 'teamwork', 'food handling', 'hygiene', 'pos systems'],
    default_factors: [
      { factor: 'availability',     points: 35 },
      { factor: 'location',         points: 25 },
      { factor: 'communication',    points: 20 },
      { factor: 'language',         points: 10 },
      { factor: 'industry_exp',     points: 10 },
    ],
    default_gates: [{ type: 'availability', min_hours: 15 }],
  },
};

module.exports = {
  MATCH_WEIGHTS,
  EXPERIENCE_RANK,
  EDUCATION_RANK,
  PROFILE_COMPLETION_FIELDS,
  JOB_TYPE_ALIASES,
  SKILL_FAMILIES,
  CATEGORY_MAP,
  DESCRIPTION_SKILL_PATTERNS,
  INSIGHT_TEMPLATES,
  SUCCESS_FACTOR_DIMENSION_MAP,
  HARD_GATE_TYPES,
  ROLE_TEMPLATES,
};
