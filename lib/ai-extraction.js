'use strict';
// Comprehensive CV extraction & scoring — no Express, no Supabase.

// ── Skill Dictionaries ─────────────────────────────────────────────────────

const SKILL_ALIASES = {
  'javascript':['js','javascript','ecmascript'],'typescript':['ts','typescript'],
  'node.js':['node','nodejs','node.js'],'sql':['sql','databases','databázy'],
  'excel':['excel','microsoft excel'],'google ads':['google ads','ppc','adwords'],
  'react':['react','react.js','reactjs'],'figma':['figma'],
  'python':['python'],'html':['html','html5'],'css':['css','css3'],'git':['git','github','gitlab'],
  'docker':['docker','containerization'],'aws':['aws','amazon web services'],
  'photoshop':['photoshop','adobe photoshop'],
  'java':['java'],'c++':['c++','cpp'],'c#':['c#','csharp','.net','dotnet'],
  'php':['php'],'angular':['angular','angularjs'],'vue':['vue','vue.js','vuejs'],
  'mongodb':['mongodb','mongo'],'postgresql':['postgresql','postgres'],
  'mysql':['mysql'],'redis':['redis'],'linux':['linux','ubuntu','debian'],
  'seo':['seo'],'ui/ux':['ui/ux','ux','ui design','ux design','user experience'],
  'canva':['canva'],'sap':['sap'],'jira':['jira','confluence'],
  'adobe illustrator':['adobe illustrator','illustrator'],
  'data analysis':['data analysis','analýza dát','data analytics'],
  'machine learning':['machine learning','strojové učenie','ml','deep learning'],
  'social media':['social media','správa sociálnych sietí','smm'],
  'copywriting':['copywriting'],'content marketing':['content marketing'],
  'facebook ads':['facebook ads','meta ads'],
  'email marketing':['email marketing'],'branding':['branding'],
  'accounting':['accounting','účtovníctvo'],
  'word':['word','microsoft word'],'powerpoint':['powerpoint','ppt'],
  'google analytics':['google analytics','ga4'],
  'programovanie':['programovanie'],'grafický dizajn':['grafický dizajn'],
  'marketing':['marketing'],'predaj':['predaj','sales'],
  'zákaznícky servis':['zákaznícky servis','customer service','customer support'],
  'administratíva':['administratíva','administration'],
  'projektový manažment':['projektový manažment','project management','pm'],
  'webový vývoj':['webový vývoj','web development','web dev'],
  'testovanie':['testovanie','testing','qa','quality assurance'],
  'devops':['devops','ci/cd','cicd'],
  'swift':['swift','ios development'],'kotlin':['kotlin','android development'],
  'flutter':['flutter'],'dart':['dart'],'rust':['rust'],'go':['golang'],
  'next.js':['next.js','nextjs','next'],'nuxt':['nuxt','nuxt.js'],
  'tailwind':['tailwind','tailwindcss'],'bootstrap':['bootstrap'],
  'sass':['sass','scss'],'webpack':['webpack','vite','rollup'],
  'rest api':['rest api','restful','api development'],
  'graphql':['graphql'],'firebase':['firebase'],
  'kubernetes':['kubernetes','k8s'],'terraform':['terraform'],
  'azure':['azure','microsoft azure'],
  'power bi':['power bi','powerbi'],'tableau':['tableau'],
  'scrum':['scrum','agile','kanban'],
  'wordpress':['wordpress','wp'],'shopify':['shopify'],
  'capcut':['capcut'],'g-suite':['g-suite','google workspace','google docs','google sheets'],
  'office 365':['office 365','microsoft 365','ms office'],
  'public speaking':['public speaking','verejné vystupovanie'],
  'icdl':['icdl','international certificate of digital literacy'],
  'video editing':['video editing','strih videa'],
};

const HARD_SKILLS = Object.keys(SKILL_ALIASES);

const SOFT_SKILLS = [
  'communication','teamwork','leadership','problem solving','time management',
  'adaptability','creativity','critical thinking','organizational','presentation',
  'komunikácia','tímová práca','vodcovstvo','riešenie problémov','manažment času',
  'adaptabilita','kreativita','organizácia','prezentačné schopnosti','spoľahlivosť',
  'zodpovednosť','analytické myslenie','samostatnosť','flexibilita','proaktivita',
  'attention to detail','negotiation','mentoring','customer orientation',
  'detailista','orientácia na zákazníka','vyjednávanie','multitasking',
];

const LANG_PATTERNS = [
  { re: /angli[cč]tin[aáy]|english/gi, lang: 'Angličtina' },
  { re: /nem[cč]in[aáy]|german|deutsch/gi, lang: 'Nemčina' },
  { re: /franc[uú]z[sš]tin[aáy]|french|fran[cç]ais/gi, lang: 'Francúzština' },
  { re: /[sš]paniel[cč]in[aáy]|spanish|espa[ñn]ol/gi, lang: 'Španielčina' },
  { re: /sloven[cč]in[aáy]|slovak/gi, lang: 'Slovenčina' },
  { re: /[cč]e[sš]tin[aáy]|czech/gi, lang: 'Čeština' },
  { re: /ma[dď]ar[cč]in[aáy]|hungarian/gi, lang: 'Maďarčina' },
  { re: /ru[sš]tin[aáy]|russian/gi, lang: 'Ruština' },
  { re: /talian[cč]in[aáy]|italian|italiano/gi, lang: 'Taliančina' },
  { re: /po[lľ][sš]tin[aáy]|polish/gi, lang: 'Poľština' },
  { re: /ukrajin[cč]in[aáy]|ukrain/gi, lang: 'Ukrajinčina' },
  { re: /č[ií]n[sš]tin[aáy]|chinese|mandarin/gi, lang: 'Čínština' },
];
const LEVEL_RE = /\b(A1|A2|B1|B2|C1|C2)\b/i;
const NATIVE_RE = /\b(native|rodný|materský|rodilý|materinský|mother\s*tongue|natívn)/i;
const LANG_LEVELS = { A1:1, A2:2, B1:3, B2:4, C1:5, C2:6 };

const EDU_LEVELS_RE = [
  { re: /\b(phd|ph\.d|doktor[aá]t|doktorand)/i, level: 'phd' },
  { re: /\b(master|magist|ing\.|mgr\.|m\.sc|mba|diplom)/i, level: 'masters' },
  { re: /\b(bachelor|bakal[aá]r|bc\.|b\.sc|b\.a\.)/i, level: 'bachelors' },
  { re: /\b(gymn[aá]zi|stredn[aá]\s+[sš]kol|stredo[sš]kol|sou\b|sp[sš]\b|high\s*school|maturit)/i, level: 'high_school' },
];
const EDU_RANK = { high_school:1, bachelors:2, masters:3, phd:4 };

const FIELD_KEYWORDS = {
  'Ekonómia': /ekon[oó]mi|economics|business|financ|podnik|manažment|management|účtovníc|international.*econom/i,
  'Marketing': /marketing|media|communic|komunik|reklam|žurnalist/i,
  'Informatika': /informatik|computer science|software|(?:^|\s)ict(?:\s|$)|kybernetik|programov/i,
  'Právo': /pr[aá]vo|law|legal|jurid/i,
  'Dizajn': /dizajn|design|art|umel|architekt/i,
  'Strojárstvo': /stroj[aá]r|mechanical|engineer(?!.*software)/i,
  'Elektrotechnika': /elektro|electric|energetik/i,
  'Medicína': /medic[ií]n|health|zdrav|farm[aá]ci|lekár/i,
  'Pedagogika': /pedagog|teach|educ(?!.*tion)|u[cč]ite|vychov/i,
  'Prírodné vedy': /biológ|chém|fyzik|matemat|biology|chemistry|physics|math/i,
  'Humanitné vedy': /filológ|filosof|histór|psychológ|sociol|philosophy|psychology/i,
};

const CITIES_SK = [
  'bratislava','košice','žilina','banská bystrica','nitra','prešov','trnava',
  'trenčín','martin','poprad','zvolen','považská bystrica','piešťany',
  'michalovce','komárno','levice','bardejov','humenné','lučenec',
  'ružomberok','topoľčany','partizánske','nové zámky','dunajská streda',
  'praha','brno','wien','vienna','budapest','london','berlin','munich',
  'amsterdam','zurich','paris','dublin','milan','rome','madrid','barcelona',
  'new york','san francisco','toronto','vancouver','sydney','warsaw',
];

// ── Section Detection ──────────────────────────────────────────────────────

const SECTION_HEADERS = {
  education: /\b(vzdelanie|education|štúdium|škola|akademick|academic|qualification)/i,
  experience: /\b(skúsenosti|experience|prax|práca|work|employment|zamestnanie|career|pracovn|pozície|positions|professional)/i,
  skills: /\b(zručnosti|skills|schopnosti|abilities|kompetenci|technologies|technológie|tech stack|znalosti|knowledge)/i,
  languages: /\b(jazyky|languages|jazykové)/i,
  projects: /\b(projekty|projects|portfólio|portfolio)/i,
  certificates: /\b(certifikáty|certificates|certification|kurzy|courses|training|školenia)/i,
  interests: /\b(záujmy|interests|hobbies|hobby|voľný čas)/i,
  about: /\b(o mne|about me|profil|profile|summary|zhrnutie|osobné)/i,
  contact: /\b(kontakt|contact|adresa|address)/i,
};

function detectSections(rawText) {
  const lines = rawText.split(/\n/);
  const sections = {};
  let currentSection = '_header';
  sections[currentSection] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if this line is a section header (short, possibly uppercase/bold)
    let matched = false;
    if (trimmed.length < 60) {
      for (const [name, re] of Object.entries(SECTION_HEADERS)) {
        if (re.test(trimmed)) {
          currentSection = name;
          if (!sections[currentSection]) sections[currentSection] = [];
          matched = true;
          break;
        }
      }
    }
    if (!matched) {
      if (!sections[currentSection]) sections[currentSection] = [];
      sections[currentSection].push(trimmed);
    }
  }
  return sections;
}

// ── Normalize helpers ──────────────────────────────────────────────────────

function normalizeText(v) { return (v || '').toLowerCase().trim(); }

function normalizeSkill(v) {
  const low = normalizeText(v);
  for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
    if (aliases.includes(low)) return canonical;
  }
  return low;
}

// ── Extractors ─────────────────────────────────────────────────────────────

function extractFullName(rawText) {
  // Try to find name in first 5 lines (typically at top of CV)
  const lines = rawText.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i];
    // Skip lines that look like headers, emails, phones, addresses
    if (/@/.test(line) || /^\+?\d/.test(line) || /^(curriculum|životopis|cv|resume|profil)/i.test(line)) continue;
    if (line.length > 50 || line.length < 3) continue;
    // Looks like a name: 2-4 words, mostly capitalized
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 4) {
      const allCapitalized = words.every(w => /^[A-ZÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ]/.test(w));
      if (allCapitalized) return line;
    }
  }
  return null;
}

function extractEmail(text) {
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : null;
}

function extractPhone(text) {
  const m = text.match(/(?:\+421|0)\s*\d[\d\s/-]{7,12}/);
  return m ? m[0].replace(/\s+/g, ' ').trim() : null;
}

function extractLocation(text) {
  const lower = normalizeText(text);
  // First check known cities
  for (const city of CITIES_SK) {
    if (lower.includes(city)) {
      // Try to get full "City, Country" from the text
      const re = new RegExp(city + '[,\\s]+([A-Za-zÁ-Žá-ž]+)', 'i');
      const m = text.match(re);
      if (m) return city.charAt(0).toUpperCase() + city.slice(1) + ', ' + m[1];
      return city.charAt(0).toUpperCase() + city.slice(1);
    }
  }
  // Fallback: look for "City, Country" pattern in header (first 5 lines)
  const headerLines = text.split('\n').slice(0, 8);
  for (const line of headerLines) {
    const m = line.match(/(?:\|\s*)?([A-ZÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ][a-záäčďéíĺľňóôŕšťúýž]+(?:\s+[A-Za-záäčďéíĺľňóôŕšťúýž]+)?)\s*,\s*([A-ZÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ][a-záäčďéíĺľňóôŕšťúýž]+)/);
    if (m && !m[1].match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i)) {
      return `${m[1]}, ${m[2]}`;
    }
  }
  return null;
}

function extractSkills(normalizedText, dictionary) {
  return dictionary.filter(skill => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (skill.includes(' ')) return normalizedText.includes(skill);
    // Stem matching for Slovak declensions
    if (skill.length >= 6 && /^[a-záäčďéíĺľňóôŕšťúýž]+$/i.test(skill)) {
      const stemLen = Math.max(4, Math.floor(skill.length * 0.7));
      const stem = skill.substring(0, stemLen).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`(?:^|[\\s,;.()/|–—-])${stem}`, 'i').test(normalizedText)) return true;
    }
    return new RegExp(`(?:^|[\\s,;.()\\[\\]/|–—-])${escaped}(?:$|[\\s,;.()\\[\\]/|–—-])`, 'i').test(normalizedText);
  });
}

// Context-aware: extract skills mentioned near skill-section headers
function extractContextualSkills(sections, existingSkills) {
  const extra = [];
  const skillText = (sections.skills || []).join(' ').toLowerCase();
  const expText = (sections.experience || []).join(' ').toLowerCase();
  const projText = (sections.projects || []).join(' ').toLowerCase();
  const certText = (sections.certificates || []).join(' ').toLowerCase();
  const combined = [skillText, expText, projText, certText].join(' ');

  // Extract any tech/tool mentioned in these sections
  for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
    if (existingSkills.includes(canonical)) continue;
    for (const alias of aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`(?:^|[\\s,;.()\\[\\]/|–—•·:])${escaped}(?:$|[\\s,;.()\\[\\]/|–—•·:])`, 'i').test(combined)) {
        extra.push(canonical);
        break;
      }
    }
  }
  return extra;
}

function extractLanguages(rawText) {
  const results = [];
  const seen = new Set();

  for (const { re, lang } of LANG_PATTERNS) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(rawText)) !== null) {
      if (seen.has(lang)) continue;
      seen.add(lang);
      const idx = match.index + match[0].length;
      // Look forward 40 chars for level
      // Look forward but stop at comma/semicolon (next language entry)
      let afterCtx = rawText.substring(idx, idx + 40);
      const sepIdx = afterCtx.search(/[,;]/);
      if (sepIdx !== -1) afterCtx = afterCtx.substring(0, sepIdx);
      const lm = afterCtx.match(LEVEL_RE);
      const nm = afterCtx.match(NATIVE_RE);
      // Check before context (40 chars) for level/fluency info
      const beforeCtx = rawText.substring(Math.max(0, match.index - 40), match.index);
      const hasSeparatorBefore = /[,;]/.test(beforeCtx);
      const bmLevel = !hasSeparatorBefore ? beforeCtx.match(LEVEL_RE) : null;
      const bmNative = !hasSeparatorBefore ? beforeCtx.match(NATIVE_RE) : null;

      let level = null;
      // Check for CEFR levels
      if (nm) level = 'C2';
      else if (lm) level = lm[1].toUpperCase();
      else if (bmNative) level = 'C2';
      else if (bmLevel) level = bmLevel[1].toUpperCase();
      
      // Fluency keywords (if no CEFR level found)
      if (!level) {
        const FLUENT_RE = /fluent|plynul[ýé]|výborn[ýé]|excellent|advanced|pokroč/i;
        const MODERATE_RE = /moderate|miern[ey]|stredne|intermediate|conversational|good/i;
        const BASIC_RE = /basic|základn[ýé]|beginner|elementary|zač[ií]ato/i;
        const fullCtx = beforeCtx + ' ' + afterCtx;
        if (FLUENT_RE.test(fullCtx)) level = 'C1';
        else if (MODERATE_RE.test(fullCtx)) level = 'B1';
        else if (BASIC_RE.test(fullCtx)) level = 'A2';
      }
      
      results.push({ lang, level: level || 'B1' });
    }
  }
  return results;
}

function detectEducationLevel(normalizedText) {
  let best = null;
  for (const { re, level } of EDU_LEVELS_RE) {
    if (re.test(normalizedText)) {
      if (!best || EDU_RANK[level] > EDU_RANK[best]) best = level;
    }
  }
  return best;
}

function detectEducationField(normalizedText) {
  for (const [field, re] of Object.entries(FIELD_KEYWORDS)) {
    if (re.test(normalizedText)) return field;
  }
  return null;
}

function detectSchool(rawText) {
  const patterns = [
    /(?:univerzit[aáy]|university|fakulta|faculty|vysok[aá]\s+[sš]kol[aáy])[^.;\n]{0,80}/i,
    /\b(STU|UK|TUKE|UNIBA|UCM|UMB|UPJŠ|SPU|UKF|TU|FIIT|FEI|FMFI|ŽU|PU|UJS)\b[^.;\n]{0,50}/i,
  ];
  for (const p of patterns) {
    const m = rawText.match(p);
    if (m) return m[0].trim().substring(0, 120);
  }
  return null;
}

function estimateExperienceYears(rawText, sections) {
  // Prefer experience section text to avoid counting education years
  let searchText = rawText;
  if (sections && sections.experience && sections.experience.length > 0) {
    // Filter out non-work entries: sports, student activities, awards, extracurricular
    const NON_WORK_RE = /\b(athlete|football|basketball|soccer|volleyball|hockey|sports?|club|student body|student council|headboy|headgirl|student.*council|extracurricular|award|prize|scholarship|certificate|captain|team\s+member)\b/i;
    const filteredLines = sections.experience.filter(line => !NON_WORK_RE.test(line));
    searchText = filteredLines.join('\n');
    // Also include projects section if available (those are work-relevant)
    if (sections.projects) searchText += '\n' + sections.projects.join('\n');
  }
  const ranges = [...searchText.matchAll(/(\d{4})\s*[-–—]\s*(\d{4}|present|súčasnosť|doteraz|dodnes|teraz)/gi)];
  if (ranges.length === 0) return 0;
  const now = new Date().getFullYear();
  const intervals = [];
  for (const m of ranges) {
    const start = parseInt(m[1]);
    const end = /\d{4}/.test(m[2]) ? parseInt(m[2]) : now;
    if (start >= 1990 && start <= now && end >= start && end <= now + 1) {
      intervals.push([start, end]);
    }
  }
  if (intervals.length === 0) return 0;
  intervals.sort((a, b) => a[0] - b[0]);
  const merged = [intervals[0]];
  for (let i = 1; i < intervals.length; i++) {
    const last = merged[merged.length - 1];
    if (intervals[i][0] <= last[1]) {
      last[1] = Math.max(last[1], intervals[i][1]);
    } else {
      merged.push(intervals[i]);
    }
  }
  // Cap at 15 for student platform
  return Math.min(merged.reduce((s, [a, b]) => s + (b - a), 0), 15);
}

// Generate a summary sentence from extracted data
function generateSummary(profile, rawText) {
  const parts = [];
  if (profile.education_level) {
    const eduLabel = { high_school:'stredoškolák', bachelors:'bakalár', masters:'inžinier/magister', phd:'doktorand' };
    parts.push(eduLabel[profile.education_level] || profile.education_level);
  }
  if (profile.education_field) parts.push(`v odbore ${profile.education_field}`);
  if (profile.experience_years > 0) parts.push(`${profile.experience_years} ${profile.experience_years === 1 ? 'rok' : profile.experience_years < 5 ? 'roky' : 'rokov'} praxe`);
  const topSkills = (profile.hard_skills || []).slice(0, 4);
  if (topSkills.length > 0) parts.push(`zručnosti: ${topSkills.join(', ')}`);

  // Also extract "about me" section text if available
  const aboutSection = rawText.match(/(?:o mne|about me|profil|profile|summary|zhrnutie)[:\s]*([^\n]{10,200})/i);
  if (aboutSection) return aboutSection[1].trim();
  
  return parts.length > 0 ? parts.join(' · ') : null;
}

function calculateExtractionConfidence(profile) {
  const signals = [
    (profile.hard_skills || []).length > 0,
    (profile.soft_skills || []).length > 0,
    (profile.languages || []).length > 0,
    !!profile.education_level,
    !!profile.education_field,
    !!profile.education_school,
    (profile.experience_years || 0) > 0,
    !!profile.email,
    !!profile.location,
    !!profile.full_name,
  ];
  return Math.round((signals.filter(Boolean).length / signals.length) * 100) / 100;
}

function extractProfileFromText(rawText) {
  const norm = normalizeText(rawText);
  const sections = detectSections(rawText);

  // Basic extractions
  const hard = extractSkills(norm, HARD_SKILLS);
  const contextExtra = extractContextualSkills(sections, hard);
  const allHard = [...new Set([...hard, ...contextExtra])];
  const soft = extractSkills(norm, SOFT_SKILLS);
  const langs = extractLanguages(rawText);
  const eduLevel = detectEducationLevel(norm);
  const field = detectEducationField(norm);
  const school = detectSchool(rawText);
  const expYears = estimateExperienceYears(rawText, sections);
  const email = extractEmail(rawText);
  const phone = extractPhone(rawText);
  const location = extractLocation(rawText);
  const fullName = extractFullName(rawText);

  const profile = {
    full_name: fullName,
    hard_skills: allHard, soft_skills: soft, languages: langs,
    education_level: eduLevel, education_field: field, education_school: school,
    experience_years: expYears, email, phone, location,
  };

  profile.summary = generateSummary(profile, rawText);
  profile.confidence_score = calculateExtractionConfidence(profile);
  return profile;
}

// ── Scoring ────────────────────────────────────────────────────────────────

function skillMatches(candidateSkills, targetSkill) {
  const normTarget = normalizeSkill(targetSkill);
  return candidateSkills.some(cs => normalizeSkill(cs) === normTarget);
}

function calculateMatchScore(aiProfile, job, jobCriteria) {
  const c = jobCriteria || {};
  const dims = {};
  const missing_required = [];

  // 1. Skills
  const cSkills = [...(aiProfile.hard_skills||[]), ...(aiProfile.soft_skills||[])];
  const req = c.required_skills || [];
  const pref = c.preferred_skills || [];
  const reqHit = req.filter(s => skillMatches(cSkills, s));
  const reqMiss = req.filter(s => !skillMatches(cSkills, s));
  reqMiss.forEach(s => missing_required.push(`skill:${s}`));
  if (req.length === 0 && pref.length === 0) { dims.skills = 100; }
  else {
    const totalSlots = req.length + pref.length;
    const prefHit = pref.filter(s => skillMatches(cSkills, s)).length;
    dims.skills = Math.round(((reqHit.length + prefHit) / Math.max(totalSlots, 1)) * 100);
  }

  // 2. Education
  const cEdu = EDU_RANK[aiProfile.education_level] || 0;
  const rEdu = EDU_RANK[c.min_education_level] || 0;
  let eduScore = rEdu === 0 ? 100 : cEdu >= rEdu ? 100 : (cEdu / rEdu) * 80;
  if ((c.preferred_fields||[]).length > 0 && aiProfile.education_field) {
    if (c.preferred_fields.some(f => normalizeText(f) === normalizeText(aiProfile.education_field))) {
      eduScore = Math.min(100, eduScore + 20);
    }
  }
  dims.education = Math.round(eduScore);

  // 3. Experience
  const cExp = aiProfile.experience_years || 0;
  const rExp = c.min_experience_years || 0;
  dims.experience = rExp === 0 ? 100 : cExp >= rExp ? 100 : Math.round((cExp / rExp) * 100);

  // 4. Location
  const jobWM = c.work_model || job.work_model;
  const jobLoc = normalizeText(job.location || '');
  if (jobWM === 'Remote') { dims.location = 100; }
  else {
    const cLoc = normalizeText(aiProfile.location || '');
    const prefLocs = (aiProfile.preferred_locations || []).map(normalizeText);
    const match = (cLoc && jobLoc && (cLoc.includes(jobLoc) || jobLoc.includes(cLoc)))
      || prefLocs.some(l => l.includes(jobLoc) || jobLoc.includes(l));
    dims.location = !jobLoc ? 100 : match ? 100 : c.location_strict ? 20 : 50;
  }

  // 5. Languages
  const reqLangs = c.required_languages || [];
  if (reqLangs.length === 0) { dims.languages = 100; }
  else {
    let lScore = 0;
    for (const r of reqLangs) {
      const found = (aiProfile.languages||[]).find(l => normalizeText(l.lang) === normalizeText(r.lang));
      if (found) {
        const cl = LANG_LEVELS[found.level] || 0;
        const rl = LANG_LEVELS[r.min_level] || 0;
        lScore += cl >= rl ? 100 : rl > 0 ? (cl / rl) * 70 : 100;
      } else { missing_required.push(`lang:${r.lang}`); }
    }
    dims.languages = Math.round(lScore / reqLangs.length);
  }

  const w = {
    skills: c.weight_skills || 3, education: c.weight_education || 2,
    experience: c.weight_experience || 2, location: c.weight_location || 3,
    languages: c.weight_languages || 2,
  };
  const totalW = Object.values(w).reduce((a, b) => a + b, 0);
  const wSum = dims.skills*w.skills + dims.education*w.education +
    dims.experience*w.experience + dims.location*w.location + dims.languages*w.languages;
  let overall = Math.round(wSum / totalW);
  const eligible = missing_required.length === 0;
  if (!eligible) overall = Math.min(overall, 49);
  return { eligible, overall_score: overall, breakdown: dims, missing_required };
}

module.exports = {
  normalizeText, normalizeSkill, SKILL_ALIASES, HARD_SKILLS, SOFT_SKILLS,
  extractEmail, extractPhone, extractLocation, extractSkills,
  extractLanguages, detectEducationLevel, detectEducationField, detectSchool,
  estimateExperienceYears, calculateExtractionConfidence, extractFullName,
  extractProfileFromText, calculateMatchScore, detectSections,
};
