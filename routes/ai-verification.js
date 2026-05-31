'use strict';

/**
 * AI Verification Interview Route — v2
 *
 * Endpoints:
 *   POST /api/verify/start          — start a new session (handles no-CV flow)
 *   POST /api/verify/turn           — submit answer (text or audio)
 *   GET  /api/verify/status         — get current verification status for student
 *   GET  /api/employer/candidate/:id/verification — employer reads a candidate's verification
 *
 * Modes:
 *   "collect"  — candidate has no CV; AI gathers name/contact/education/experience/skills/languages
 *                then generates a PDF CV, uploads it, builds their ai_profile, then transitions to…
 *   "interview" — standard 4-attribute verification interview
 *
 * Cost controls:
 *   All OpenAI calls are tracked via the shared usageTracker from ai-cv-parser.
 *   GPT-4o pricing: $2.50/M input · $10.00/M output
 *   Whisper:        $0.006/min
 *   Per interview:  ~$0.03 (text) | ~$0.05 (voice)
 */

const OpenAI  = require('openai');
const { usageTracker } = require('../lib/ai-cv-parser');
const { generateCvPdf } = require('../lib/cv-generator');

// ── GPT-4o pricing for the tracker (it uses gpt-4o-mini rates internally, so we
//    override recordCall with the real gpt-4o rates for verification calls) ────
const GPT4O_INPUT_PER_1M  = 2.50;
const GPT4O_OUTPUT_PER_1M = 10.00;

function recordVerificationCall(userId, inputTokens, outputTokens) {
  // Manually credit cost at gpt-4o rates while reusing the shared counter
  usageTracker.reset();
  usageTracker.totalCallsToday++;
  usageTracker.totalTokensToday.input  += inputTokens;
  usageTracker.totalTokensToday.output += outputTokens;
  const cost = (inputTokens * GPT4O_INPUT_PER_1M / 1_000_000)
             + (outputTokens * GPT4O_OUTPUT_PER_1M / 1_000_000);
  usageTracker.totalCostToday += cost;
  if (userId) {
    const existing = usageTracker.perUser.get(userId) || { calls: 0 };
    usageTracker.perUser.set(userId, { calls: existing.calls + 1, lastCall: new Date() });
  }
  console.log(
    `[Verify Budget] Call | ${inputTokens}+${outputTokens} tokens | $${cost.toFixed(5)}`
    + ` | Day total: $${usageTracker.totalCostToday.toFixed(4)}/$${usageTracker.getStatus().budget_usd}`
  );
}

// ── OpenAI singleton ──────────────────────────────────────────────────────────
let _openai = null;
function getOpenAI() {
  if (_openai) return _openai;
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');
  _openai = new OpenAI({ apiKey: key });
  return _openai;
}

// ── Attribute definitions ─────────────────────────────────────────────────────
const ATTRIBUTES = ['language', 'skills', 'experience', 'soft_skills'];
const ATTRIBUTE_LABELS = {
  language:    { sk: 'Jazykové znalosti',   en: 'Language Skills' },
  skills:      { sk: 'Technické zručnosti', en: 'Technical Skills' },
  experience:  { sk: 'Pracovné skúsenosti', en: 'Work Experience' },
  soft_skills: { sk: 'Mäkké zručnosti',     en: 'Soft Skills' },
};
const QUESTIONS_PER_ATTRIBUTE = 3;

// ── CV Collection flow ────────────────────────────────────────────────────────
// The AI collects these fields in order. Each step = one Q&A turn.
const COLLECT_STEPS = [
  {
    key: 'full_name',
    ask_sk: 'Vitaj! Som AI asistent unemployed.sk. Nemáš ešte nahraté CV, tak ti ho pomôžem vytvoriť. Začnime — aké je tvoje celé meno?',
    ask_en: 'Welcome! I\'m the unemployed.sk AI assistant. You don\'t have a CV uploaded yet, so let me help you create one. Let\'s start — what is your full name?',
  },
  {
    key: 'phone',
    ask_sk: 'Skvelé! Aké je tvoje telefónne číslo (vrátane medzinárodnej predvoľby, napr. +421...)?',
    ask_en: 'Great! What is your phone number (including country code, e.g. +421...)?',
  },
  {
    key: 'location',
    ask_sk: 'Kde sa nachádzaš / kde žiješ? (Napr. Bratislava, Slovensko)',
    ask_en: 'Where are you located / where do you live? (e.g. Bratislava, Slovakia)',
  },
  {
    key: 'nationality',
    ask_sk: 'Aká je tvoja štátna príslušnosť?',
    ask_en: 'What is your nationality?',
  },
  {
    key: 'education',
    ask_sk: 'Povedz mi o svojom vzdelaní. Napríklad: škola, odbor, rok začiatku a konca. Môžeš uviesť viac škôl — oddeľ ich čiarkou alebo novým riadkom.',
    ask_en: 'Tell me about your education. For example: school name, degree/field, start and end year. You can list multiple — separate with a comma or new line.',
  },
  {
    key: 'work_experience',
    ask_sk: 'Aké máš pracovné skúsenosti? Uveď pozíciu, firmu, dátumy a čo si tam robil/a. Ak nemáš skúsenosti, napíš "žiadne".',
    ask_en: 'What work experience do you have? Include job title, company, dates, and what you did. If none, just say "none".',
  },
  {
    key: 'extracurricular',
    ask_sk: 'Máš nejaké mimoškolské aktivity, vedenie, ocenenia alebo dobrovoľníctvo, ktoré by si chcel/a uviesť? (Nepovinné — napíš "nie" ak nie)',
    ask_en: 'Do you have any extracurricular activities, leadership roles, awards or volunteering to include? (Optional — type "none" to skip)',
  },
  {
    key: 'skills_primary',
    ask_sk: 'Aké sú tvoje hlavné mäkké/osobnostné zručnosti? Napr. komunikácia, tímová práca, riešenie problémov...',
    ask_en: 'What are your main soft/personal skills? e.g. communication, teamwork, problem-solving...',
  },
  {
    key: 'skills_technical',
    ask_sk: 'Aké technické alebo digitálne nástroje/programy ovládaš? Napr. Excel, Python, Figma, Adobe...',
    ask_en: 'What technical tools or software do you know? e.g. Excel, Python, Figma, Adobe...',
  },
  {
    key: 'skills_linguistic',
    ask_sk: 'Aké jazyky ovládaš a na akej úrovni? Napr. slovenčina (rodný jazyk), angličtina (B2), nemčina (A2)',
    ask_en: 'What languages do you speak and at what level? e.g. Slovak (native), English (B2), German (A2)',
  },
];

// ── GPT-4o call wrapper with budget check ────────────────────────────────────

async function gptCall(userId, messages, { maxTokens = 150, temperature = 0.7 } = {}) {
  // Budget gate
  const check = usageTracker.canMakeCall(userId);
  if (!check.allowed) {
    console.warn('[verify] Budget blocked:', check.reason);
    return null; // caller handles null
  }

  const openai = getOpenAI();
  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    max_tokens: maxTokens,
    temperature,
  });

  const usage = resp.usage || {};
  recordVerificationCall(userId, usage.prompt_tokens || 0, usage.completion_tokens || 0);

  return resp.choices[0]?.message?.content?.trim() || '';
}

// ── Transcript to audio ───────────────────────────────────────────────────────

async function transcribeAudio(userId, audioBase64, mimeType = 'audio/webm') {
  const check = usageTracker.canMakeCall(userId);
  if (!check.allowed) return null;

  const openai = getOpenAI();
  const buffer = Buffer.from(audioBase64, 'base64');

  let ext = 'webm';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) ext = 'mp4';
  else if (mimeType.includes('wav')) ext = 'wav';
  else if (mimeType.includes('ogg')) ext = 'ogg';
  else if (mimeType.includes('mp3')) ext = 'mp3';

  const file = new File([buffer], `audio.${ext}`, { type: mimeType });
  const t = await openai.audio.transcriptions.create({ file, model: 'whisper-1' });

  // Estimate cost: $0.006/min → per second: 0.0001; assume 20s avg
  const estimatedCost = 0.002; // ~20s
  usageTracker.totalCostToday += estimatedCost;
  console.log(`[Verify Budget] Whisper | est $${estimatedCost.toFixed(4)} | Day total: $${usageTracker.totalCostToday.toFixed(4)}`);

  return t.text?.trim() || '';
}

// ── Interview helpers ─────────────────────────────────────────────────────────

function buildInterviewSystemPrompt(aiProfile, attribute, lang, responseTimings = []) {
  const name       = aiProfile?.full_name || 'kandidát';
  const languages  = (aiProfile?.languages || []).map(l => `${l.lang || l} (${l.level || '?'})`).join(', ') || 'N/A';
  const topSkill   = (aiProfile?.hard_skills || [])[0] || 'N/A';
  const hardSkills = (aiProfile?.hard_skills || []).slice(0, 5).join(', ') || 'N/A';
  const softSkills = (aiProfile?.soft_skills || []).slice(0, 3).join(', ') || 'N/A';
  const expYears   = aiProfile?.experience_years || 0;
  const school     = aiProfile?.education_school || '';
  const field      = aiProfile?.education_field  || '';

  const il = lang === 'en' ? 'EN' : 'SK';

  const avgT = responseTimings.length > 0
    ? Math.round(responseTimings.reduce((a, b) => a + b, 0) / responseTimings.length) : null;
  const fast = avgT !== null && avgT < 5 ? ' [FAST RESPONSES—probe personal details]' : '';

  const sectionCtx = {
    language: `Verify: ${languages}. Ask them to EXPLAIN something specific in their claimed language—a problem, debate, or opinion. NOT "introduce yourself". Push for idioms, nuances, complex sentences.`,
    skills: `Verify: ${hardSkills}. Ask scenario/debugging questions about ${topSkill}. "What happens when X breaks?" "How would you build Y?" Push past textbook answers.`,
    experience: `Verify: ${expYears}yr experience.${school ? ` Studies ${field} at ${school}.` : ''} Ask about specific roles, team sizes, daily tasks, failures. Details only real experience provides.`,
    soft_skills: `Verify: ${softSkills}. Use STAR method—demand a SPECIFIC situation with names, exact words, emotions, outcome. No hypotheticals.`,
  };

  return `Interviewer for unemployed.sk (student jobs). Lang: ${il}.${fast}
Candidate: ${name} | Skills: ${hardSkills} | Langs: ${languages} | Exp: ${expYears}yr
${sectionCtx[attribute] || ''}
Rules: 1 question, 2 sentences max. Demand specifics. Reference previous answers. Reject generic/AI-sounding answers. No yes/no questions.
Be CRITICAL: analyze answer quality ruthlessly. For voice answers (transcribed from speech), note grammar errors, filler words (um, uh, like), vocabulary range, and sentence coherence — these reveal true fluency vs rehearsed answers.`;
}

async function generateFirstQuestion(userId, aiProfile, attribute, lang) {
  const openers = {
    language: {
      sk: 'Začni overovanie cudzieho jazyka. NEPÝTAJ SA na "predstavenie sa". Namiesto toho požiadaj kandidáta, aby v cudzom jazyku podrobne opísal konkrétny problém, ktorý nedávno riešil v škole alebo práci, vrátane toho, čo bolo ťažké a ako sa cítil.',
      en: 'Start the foreign language verification. DO NOT ask them to "introduce yourself". Instead, ask the candidate to describe in detail — in their claimed foreign language — a specific problem they recently solved at school or work, including what was difficult and how they felt about it.',
    },
    skills: {
      sk: 'Začni overovanie technických zručností. Vyber jednu konkrétnu zručnosť z ich profilu a polož im scenárovú otázku, kde musia vysvetliť, ako by riešili reálny technický problém s touto zručnosťou. Pýtaj sa na detaily implementácie.',
      en: 'Start the technical skills verification. Pick one specific skill from their profile and ask them a scenario question where they must explain how they would solve a real technical problem with that skill. Ask about implementation details.',
    },
    experience: {
      sk: 'Začni overovanie pracovných skúseností. Požiadaj kandidáta, aby podrobne opísal svoju POSLEDNÚ pracovnú pozíciu — čo bola ich prvá úloha prvý deň? S kým spolupracovali? Čo bol ich najväčší úspech a najväčšia frustrácia?',
      en: 'Start the work experience verification. Ask the candidate to describe in detail their MOST RECENT role — what was their first task on day one? Who did they work with? What was their biggest achievement and biggest frustration?',
    },
    soft_skills: {
      sk: 'Začni overovanie mäkkých zručností. Polož hlbokú STAR otázku: požiadaj kandidáta, aby opísal KONKRÉTNU situáciu z posledných 12 mesiacov, kde musel riešiť konflikt alebo nezhodu s niekým. Chcem mená, kontext, presné slová a výsledok.',
      en: 'Start the soft skills verification. Ask a deep STAR question: ask the candidate to describe a SPECIFIC situation from the last 12 months where they had to resolve a conflict or disagreement with someone. I want names, context, exact words, and outcome.',
    },
  };
  const prompt = openers[attribute]?.[lang] || openers[attribute]?.sk || 'Ask the opening question.';
  const system = buildInterviewSystemPrompt(aiProfile, attribute, lang);
  const result = await gptCall(userId, [
    { role: 'system', content: system },
    { role: 'user',   content: prompt },
  ], { maxTokens: 200, temperature: 0.75 });
  return result || (lang === 'sk' ? 'Opíš mi konkrétnu situáciu, v ktorej si využil svoje zručnosti.' : 'Describe a specific situation where you used your skills.');
}

async function generateNextQuestion(userId, aiProfile, attribute, history, lang, qIdx, responseTimings = []) {
  const system = buildInterviewSystemPrompt(aiProfile, attribute, lang, responseTimings);
  const messages = [{ role: 'system', content: system }];
  for (const t of history) {
    messages.push({ role: 'assistant', content: t.question });
    messages.push({ role: 'user',      content: t.answer });
  }

  // Build a follow-up instruction that forces the AI to probe deeper
  const lastAnswer = history[history.length - 1]?.answer || '';
  const avgTime = responseTimings.length > 0 ? Math.round(responseTimings.reduce((a, b) => a + b, 0) / responseTimings.length) : null;

  let followUpInstruction;
  if (qIdx >= QUESTIONS_PER_ATTRIBUTE - 1) {
    followUpInstruction = lang === 'sk'
      ? `Toto je POSLEDNÁ otázka v tejto sekcii. Polož najťažšiu otázku — odkazuj na niečo konkrétne, čo kandidát povedal, a požiadaj ho, aby vysvetlil detaily, ktoré by vedel len niekto so skutočnou skúsenosťou.`
      : `This is the LAST question in this section. Ask the toughest question — reference something specific the candidate said and ask them to explain details that only someone with real experience would know.`;
  } else {
    followUpInstruction = lang === 'sk'
      ? `Pokračuj v overovaní. Vyber niečo KONKRÉTNE z poslednej odpovede kandidáta a pýtaj sa hlbšie. Ak odpoveď znela genericky alebo príliš vybrúsene, jemne to adresuj a požiadaj o surovejšie, osobnejšie detaily.${avgTime && avgTime < 8 ? ' Kandidát odpovedá veľmi rýchlo — to môže naznačovať kopírovanie. Polož osobnejšiu otázku.' : ''}`
      : `Continue verification. Pick something SPECIFIC from the candidate's last answer and probe deeper. If the answer sounded generic or overly polished, subtly address it and ask for rawer, more personal details.${avgTime && avgTime < 8 ? ' Candidate is responding very quickly — this may indicate copy-pasting. Ask a more personal question.' : ''}`;
  }
  messages.push({ role: 'user', content: followUpInstruction });

  return await gptCall(userId, messages, { maxTokens: 200, temperature: 0.75 })
    || (lang === 'sk' ? 'Môžeš byť konkrétnejší? Potrebujem detaily z tvojej osobnej skúsenosti.' : 'Can you be more specific? I need details from your personal experience.');
}

async function evaluateAttribute(userId, aiProfile, attribute, history, lang, responseTimings = []) {
  const hasVoice = history.some(t => t.wasAudio);
  const transcript = history.map((t, i) => {
    const mode = t.wasAudio ? '[VOICE]' : '[TEXT]';
    return `Q${i+1}: ${t.question}\nA${i+1} ${mode}: ${t.answer}`;
  }).join('\n\n');
  const claimed = {
    language:    (aiProfile?.languages || []).map(l => `${l.lang || l} (${l.level || '?'})`).join(', '),
    skills:      (aiProfile?.hard_skills || []).slice(0, 6).join(', '),
    experience:  `${aiProfile?.experience_years || 0} years`,
    soft_skills: (aiProfile?.soft_skills || []).slice(0, 4).join(', '),
  }[attribute] || 'not specified';

  const avgTime = responseTimings.length > 0 ? Math.round(responseTimings.reduce((a, b) => a + b, 0) / responseTimings.length) : null;
  const timingNote = avgTime !== null
    ? `\nResponse timing: avg ${avgTime}s. ${avgTime < 8 ? 'WARNING: Suspiciously fast.' : avgTime > 120 ? 'NOTE: Very slow — may be researching.' : 'Normal.'}`
    : '';

  const speechNote = hasVoice
    ? `\nSpeech quality analysis (for [VOICE] answers): Assess grammar accuracy, filler words (um/uh/like), vocabulary range, sentence structure, and coherence. These are transcribed from real speech — errors reflect actual fluency. Factor this into the score.`
    : '';

  const prompt = lang === 'en'
    ? `Evaluate ${attribute.replace('_',' ')} section. Be STRICT and CRITICAL.\nClaimed: "${claimed}"${timingNote}${speechNote}\n\nTranscript:\n${transcript}\n\nCriteria: specific vs generic answers, real experience vs theory, consistency across follow-ups, AI-generated patterns (overly structured, transition phrases, comprehensive lists).${hasVoice ? ' For [VOICE] answers: grammar quality, vocabulary sophistication, filler words, coherence.' : ''}\n\nJSON only:\n{"verified":true/false,"score":0.0-1.0,"level":"brief","summary":"2-3 sentences","strengths":[],"gaps":[],"ai_suspected":true/false${hasVoice ? ',"speech_quality":{"grammar":"good/fair/poor","vocabulary":"rich/adequate/limited","coherence":"clear/moderate/disjointed","filler_words":"none/some/many"}' : ''}}`
    : `Hodnoť sekciu: ${attribute.replace('_',' ')}. Buď PRÍSNY. Tvoj cieľ je overiť skutočné znalosti, nie odmeniť vyleštené odpovede.\nTvrdenia: "${claimed}"${timingNote}${speechNote}\n\nPrepis:\n${transcript}\n\nKritériá hodnotenia:\n- Boli odpovede KONKRÉTNE a OSOBNÉ (skutočné mená, projekty, detaily) alebo GENERICKÉ a UČEBNICOVÉ?\n- Preukázali odpovede skutočnú hands-on skúsenosť alebo len teoretické znalosti?\n- Boli follow-up odpovede konzistentné s predchádzajúcimi tvrdeniami?\n- Mal kandidát problémy s detailmi, ktoré by mali byť ľahké ak má túto skúsenosť?\n- Znaky AI-generovaných odpovedí: prílišná štruktúra, prechodové frázy, podozrivo vyčerpávajúce zoznamy, chýba osobná emócia.${hasVoice ? '\n- [VOICE] odpovede: kvalita gramatiky, slovná zásoba, výplňové slová, koherencia.' : ''}\n\nOdpovedaj IBA platným JSON:\n{"verified":true/false,"score":0.0-1.0,"level":"stručný popis","summary":"2-3 vetné profesionálne zhrnutie","strengths":["s1"],"gaps":["g1"],"ai_suspected":true/false${hasVoice ? ',"speech_quality":{"grammar":"dobrá/stredná/zlá","vocabulary":"bohatá/primeraná/obmedzená","coherence":"jasná/stredná/nesúrodá","filler_words":"žiadne/niektoré/veľa"}' : ''}}`;

  const raw = await gptCall(userId, [{ role: 'user', content: prompt }], { maxTokens: 500, temperature: 0.2 });
  try { return JSON.parse(raw || '{}'); } catch {
    const m = (raw || '').match(/\{[\s\S]*\}/);
    if (m) try { return JSON.parse(m[0]); } catch {}
    return { verified: false, score: 0.5, level: 'N/A', summary: 'Evaluation unavailable.', strengths: [], gaps: [], ai_suspected: false };
  }
}

// ── CV Collection: parse collected answers into a structured CV object ────────

async function buildCvFromCollected(userId, collected, lang) {
  const prompt = `You are a CV data extractor. Given the user's raw answers below, return a JSON object with this EXACT structure (no markdown, no explanation):
{
  "name": "Full Name",
  "phone": "phone number or null",
  "email": "email or null",
  "location": "City, Country or null",
  "nationality": "nationality or null",
  "education": [
    { "school": "name", "degree": "Degree / Program", "location": "City, Country", "start": "Sep. 2022", "end": "May 2025", "note": "optional gpa or note or null" }
  ],
  "work_experience": [
    { "title": "Job Title", "company": "Company", "location": "City / Remote", "start": "Jan. 2023", "end": "Mar. 2023 or null if current", "bullets": ["achievement 1", "achievement 2"] }
  ],
  "extracurricular": [
    { "title": "Role | Organisation", "date": "Nov. 2023 - May 2024", "bullets": ["achievement"] }
  ],
  "skills": {
    "primary": ["Public Speaking", "Teamwork"],
    "technical": ["Excel", "Python"],
    "linguistic": ["Fluent Slovak", "English B2", "German A2"]
  },
  "ai_profile": {
    "full_name": "name",
    "languages": [{"lang":"English","level":"B2"}],
    "hard_skills": ["excel","python"],
    "soft_skills": ["teamwork","communication"],
    "experience_years": 0,
    "education_level": "bachelors",
    "education_field": "economics",
    "education_school": "University Name",
    "location": "city, country",
    "experience_level": "beginner",
    "preferred_categories": ["finance","administration"],
    "ai_headline": {"sk":"Študent ekonómie | Bratislava","en":"Economics Student | Bratislava"},
    "ai_summary": {"sk":"3-5 viet po slovensky","en":"3-5 sentences in English"}
  }
}

Raw answers:
${Object.entries(collected).map(([k, v]) => `${k}: ${v}`).join('\n')}

Return ONLY valid JSON.`;

  const raw = await gptCall(userId, [{ role: 'user', content: prompt }], { maxTokens: 1800, temperature: 0.2 });
  try {
    return JSON.parse(raw || '{}');
  } catch {
    const m = (raw || '').match(/\{[\s\S]*\}/);
    if (m) try { return JSON.parse(m[0]); } catch {}
    return null;
  }
}

function formatCvFallback(aiProfile) {
  if (!aiProfile) return '';
  const lines = [];
  if (aiProfile.full_name) lines.push(`Name: ${aiProfile.full_name}`);
  if (aiProfile.education_level) lines.push(`Education: ${aiProfile.education_level}`);
  if (aiProfile.experience_years !== undefined) lines.push(`Experience: ${aiProfile.experience_years} years`);
  if (aiProfile.hard_skills && aiProfile.hard_skills.length > 0) {
    lines.push(`Skills: ${aiProfile.hard_skills.join(', ')}`);
  }
  if (aiProfile.soft_skills && aiProfile.soft_skills.length > 0) {
    lines.push(`Soft Skills: ${aiProfile.soft_skills.join(', ')}`);
  }
  if (aiProfile.languages && Array.isArray(aiProfile.languages)) {
    const langs = aiProfile.languages.map(l => typeof l === 'string' ? l : `${l.language || l.name || ''} (${l.level || ''})`).filter(Boolean);
    if (langs.length > 0) lines.push(`Languages: ${langs.join(', ')}`);
  }
  return lines.join('\n');
}

async function generateAndUploadCvFromDb(userId, supabase, lang) {
  try {
    console.log('[CV Generate Post-Interview] Starting CV generation for user:', userId);
    
    // Fetch basic profile info
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (profErr) {
      console.error('[CV Generate Post-Interview] Profile fetch error:', profErr.message);
      return;
    }

    // Fetch AI profile info
    const { data: aiProfile, error: aiErr } = await supabase
      .from('ai_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (aiErr) {
      console.error('[CV Generate Post-Interview] AI Profile fetch error:', aiErr.message);
      return;
    }

    const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || aiProfile?.full_name || '';
    const phone = profile?.phone || aiProfile?.phone || '';
    const location = profile?.location || aiProfile?.location || '';
    
    // Process education
    const education = [];
    const school = aiProfile?.education_school || profile?.university || profile?.education || '';
    if (school) {
      const degreeParts = [];
      if (aiProfile?.education_level) degreeParts.push(aiProfile.education_level);
      if (aiProfile?.education_field || profile?.field_of_study) degreeParts.push(aiProfile?.education_field || profile?.field_of_study);
      
      education.push({
        school: school,
        degree: degreeParts.join(' - ') || 'Štúdium / Education',
        location: location || '',
        start: '',
        end: aiProfile?.graduation_year ? String(aiProfile.graduation_year) : 'Present'
      });
    }

    // Process work experience
    const workExperience = [];
    if (aiProfile?.work_experience && Array.isArray(aiProfile.work_experience)) {
      for (const job of aiProfile.work_experience) {
        const bullets = [];
        if (job.description) {
          const lines = job.description.split(/\n+/).map(l => l.trim().replace(/^[-•*]\s*/, '')).filter(Boolean);
          bullets.push(...lines);
        }
        workExperience.push({
          title: job.title || '',
          company: job.company || '',
          location: job.location || '',
          start: job.start_date || '',
          end: job.is_current ? 'Present' : (job.end_date || ''),
          bullets: bullets
        });
      }
    }

    // Process skills
    const primarySkills = Array.from(new Set([
      ...(profile?.skills || []),
      ...(aiProfile?.hard_skills || [])
    ]));

    const softSkills = aiProfile?.soft_skills || [];
    
    const linguisticSkills = [];
    if (aiProfile?.languages && Array.isArray(aiProfile.languages)) {
      for (const langObj of aiProfile.languages) {
        if (typeof langObj === 'string') {
          linguisticSkills.push(langObj);
        } else if (langObj && typeof langObj === 'object') {
          const lName = langObj.lang || langObj.language || langObj.name || '';
          if (lName) {
            linguisticSkills.push(`${lName} (${langObj.level || 'B1'})`);
          }
        }
      }
    }

    const cvData = {
      name: fullName || 'Candidate',
      phone: phone || null,
      email: profile?.email || '',
      location: location || null,
      nationality: null,
      education: education,
      work_experience: workExperience,
      extracurricular: [],
      skills: {
        primary: primarySkills,
        technical: softSkills,
        linguistic: linguisticSkills
      }
    };

    const pdfBuffer = await generateCvPdf(cvData);
    const fileName = `cv_generated_${Date.now()}.pdf`;
    const filePath = `${userId}/${fileName}`;

    // Clean up previous generated CV if it exists
    if (profile?.cv_id && (profile.cv_id.includes('cv_generated_') || profile.cv_id.includes('cv_ai_generated_'))) {
      await supabase.storage.from('cvs').remove([profile.cv_id]).catch(err => {
        console.warn('[CV Generate Post-Interview] Old file delete error:', err.message);
      });
    }

    // Upload generated PDF to Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from('cvs')
      .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

    if (uploadErr) {
      console.error('[CV Generate Post-Interview] Upload failed:', uploadErr.message);
      return;
    }

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        cv_id: filePath,
        original_filename: 'Životopis.pdf',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateErr) {
      console.error('[CV Generate Post-Interview] DB update error:', updateErr.message);
    } else {
      console.log('[CV Generate Post-Interview] CV PDF generated and linked successfully for user:', userId);
    }
  } catch (err) {
    console.error('[CV Generate Post-Interview] Failed:', err);
  }
}

// ── Route Module ──────────────────────────────────────────────────────────────

module.exports = function aiVerificationRouter(app, supabase, { getUserFromToken }) {

  // ── POST /api/verify/start ─────────────────────────────────────────────────
  app.post('/api/verify/start', async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      // Budget check
      const budgetCheck = usageTracker.canMakeCall(user.id);
      if (!budgetCheck.allowed) {
        return res.status(429).json({ error: `Service temporarily unavailable: ${budgetCheck.reason}` });
      }

      // GDPR Art. 9 — Explicit consent required for AI profiling and voice data processing
      const { data_processing_consent } = req.body || {};
      if (!data_processing_consent) {
        return res.status(400).json({
          error: 'Consent required',
          error_sk: 'Pre spustenie AI overenia je potrebný súhlas so spracovaním údajov.',
          error_en: 'Consent for data processing is required to start AI verification.',
          requires_consent: true,
          consent_details: {
            purpose: 'AI-powered skills and experience verification',
            data_types: ['text responses', 'voice recordings (if using voice mode)', 'AI-generated profile'],
            retention: 'Stored until account deletion or explicit withdrawal of consent',
            legal_basis: 'GDPR Art. 6(1)(a) — explicit consent',
            withdrawal: 'You can delete your account at any time to remove all data',
          }
        });
      }

      // Already completed?
      const { data: existing } = await supabase
        .from('cv_verifications')
        .select('id, status, results, overall_score, completed_at, session_state, full_transcript')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing?.status === 'completed') {
        return res.status(409).json({ error: 'Verification already completed', verification: existing });
      }

      const collectMode = !!req.body.collectMode;

      // ── Resume existing in-progress session ──────────────────────────────────
      if (existing?.status === 'in_progress') {
        const state = existing.session_state || {};
        const existingIsCollect = state.mode === 'collect';
        
        if (existingIsCollect !== collectMode) {
          // Mismatched mode: delete the old in-progress session and start fresh
          await supabase.from('cv_verifications').delete().eq('id', existing.id);
        } else {
          const transcript = existing.full_transcript || [];
          const lastAI = [...transcript].reverse().find(t => t.role === 'ai');
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('cv_id, original_filename')
            .eq('user_id', user.id)
            .maybeSingle();

          const isCollect = state.mode === 'collect';
          const isCvGen = !!state.cv_generated;

          return res.json({
            sessionId: existing.id,
            mode: state.mode || 'interview',
            noCv: false,
            resumed: true,
            attribute: isCollect ? 'collect' : (state.current_attribute || ATTRIBUTES[0]),
            attributeLabel: isCollect
              ? (isCvGen ? { sk: 'Životopis vytvorený', en: 'CV Generated' } : { sk: 'Zber informácií', en: 'Profile Collection' })
              : (ATTRIBUTE_LABELS[state.current_attribute || ATTRIBUTES[0]]),
            attributeIndex: isCollect ? (state.collect_step || 0) : (state.attribute_index || 0),
            totalAttributes: isCollect ? COLLECT_STEPS.length : ATTRIBUTES.length,
            questionIndex: 0,
            totalQuestions: isCollect ? 1 : QUESTIONS_PER_ATTRIBUTE,
            question: lastAI?.text || '',
            transcript,
            results: existing.results || {},
            cvPath: profile?.cv_id || null,
            originalFilename: profile?.original_filename || null,
          });
        }
      }

      const lang = req.body.lang || 'sk';
      const collectMode = !!req.body.collectMode;

      // ── Does the user have a CV? Check profiles.cv_id AND ai_profiles ──────
      const [{ data: profile }, { data: aiProfileRow }] = await Promise.all([
        supabase.from('profiles').select('cv_id, original_filename').eq('user_id', user.id).maybeSingle(),
        supabase.from('ai_profiles').select('user_id, raw_cv_text, full_name, hard_skills, languages').eq('user_id', user.id).maybeSingle(),
      ]);

      // Has a CV if profiles.cv_id is set OR if ai_profiles has raw text from a previous parse
      const hasCv = !!(profile?.cv_id) || !!(aiProfileRow?.raw_cv_text);
      console.log(`[verify/start] user=${user.id.substring(0,8)} hasCv=${hasCv} cv_id=${profile?.cv_id} collectMode=${collectMode}`);

      if (!hasCv && !collectMode) {
        return res.json({
          noCv: true
        });
      }

      let firstQuestion, mode, sessionData, resolvedCvText = '';

      if (!hasCv) {
        // ── No CV (but collectMode = true): enter collect mode ────────────────
        mode = 'collect';
        const step = COLLECT_STEPS[0];
        firstQuestion = lang === 'sk' ? step.ask_sk : step.ask_en;

        sessionData = {
          user_id: user.id,
          status: 'in_progress',
          results: {},
          full_transcript: [{
            role: 'ai',
            text: firstQuestion,
            attribute: 'collect',
            timestamp: new Date().toISOString(),
          }],
          session_state: {
            lang,
            mode: 'collect',
            collect_step: 0,
            collected: {},
            // interview state (filled after collect phase)
            current_attribute: null,
            attribute_index: 0,
            question_index: 0,
            attribute_history: {},
          },
        };
      } else {
        // ── Has CV: straight to interview ────────────────────────────────────
        mode = 'interview';
        const { data: aiProfile } = await supabase
          .from('ai_profiles')
          .select('full_name, languages, hard_skills, soft_skills, experience_years, education_level, raw_cv_text')
          .eq('user_id', user.id)
          .maybeSingle();

        resolvedCvText = aiProfile?.raw_cv_text || formatCvFallback(aiProfile);

        const firstAttr = ATTRIBUTES[0];
        firstQuestion = await generateFirstQuestion(user.id, aiProfile || {}, firstAttr, lang);

        sessionData = {
          user_id: user.id,
          status: 'in_progress',
          results: {},
          full_transcript: [{
            role: 'ai',
            text: firstQuestion,
            attribute: firstAttr,
            timestamp: new Date().toISOString(),
          }],
          session_state: {
            lang,
            mode: 'interview',
            collect_step: null,
            collected: null,
            current_attribute: firstAttr,
            attribute_index: 0,
            question_index: 0,
            attribute_history: {},
          },
        };
      }

      // Always insert fresh (stale in_progress was deleted above)
      let sessionId;
      const { data: newSess, error: ie } = await supabase.from('cv_verifications')
         .insert(sessionData).select('id').single();
      if (ie) return res.status(500).json({ error: ie.message });
      sessionId = newSess.id;

      return res.json({
        sessionId,
        mode,
        noCv: !hasCv && !collectMode,
        attribute: mode === 'interview' ? ATTRIBUTES[0] : 'collect',
        attributeLabel: mode === 'interview' ? ATTRIBUTE_LABELS[ATTRIBUTES[0]] : { sk: 'Zber informácií', en: 'Profile Collection' },
        attributeIndex: 0,
        totalAttributes: mode === 'interview' ? ATTRIBUTES.length : COLLECT_STEPS.length,
        questionIndex: 0,
        totalQuestions: mode === 'interview' ? QUESTIONS_PER_ATTRIBUTE : 1,
        question: firstQuestion,
        cvText: resolvedCvText,
        cvPath: profile?.cv_id || null,
        originalFilename: profile?.original_filename || null,
      });
    } catch (err) {
      console.error('[verify/start]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/verify/turn ──────────────────────────────────────────────────
  app.post('/api/verify/turn', async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const { sessionId, answer: textAnswer, audioBase64, audioMimeType } = req.body;
      if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

      // Fetch session
      const { data: session, error: se } = await supabase
        .from('cv_verifications')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

      if (se || !session) return res.status(404).json({ error: 'Session not found' });
      if (session.status === 'completed') return res.status(409).json({ error: 'Session already completed' });

      // Budget check
      const budgetCheck = usageTracker.canMakeCall(user.id);
      if (!budgetCheck.allowed) {
        return res.status(429).json({ error: `Budget limit reached: ${budgetCheck.reason}` });
      }

      // Transcribe audio if needed
      let finalAnswer = textAnswer || '';
      if (audioBase64 && !finalAnswer) {
        try {
          finalAnswer = await transcribeAudio(user.id, audioBase64, audioMimeType || 'audio/webm') || '';
        } catch (e) {
          return res.status(500).json({ error: 'Audio transcription failed. Please use text.' });
        }
      }
      if (!finalAnswer.trim()) return res.status(400).json({ error: 'No answer provided' });

      const state = session.session_state || {};
      const lang  = state.lang || 'sk';
      const mode  = state.mode || 'interview';
      const fullTranscript = session.full_transcript || [];

      // Add student answer to transcript
      fullTranscript.push({
        role: 'student',
        text: finalAnswer,
        attribute: mode === 'collect' ? 'collect' : state.current_attribute,
        timestamp: new Date().toISOString(),
        wasAudio: !!audioBase64,
      });

      // ── COLLECT MODE ──────────────────────────────────────────────────────
      if (mode === 'collect') {
        const collectStep = state.collect_step || 0;
        const collected   = state.collected || {};
        const currentStep = COLLECT_STEPS[collectStep];

        // Store this answer
        collected[currentStep.key] = finalAnswer;

        const nextStepIdx = collectStep + 1;

        if (nextStepIdx < COLLECT_STEPS.length) {
          // More collect questions
          const nextStep = COLLECT_STEPS[nextStepIdx];
          const nextQ = lang === 'sk' ? nextStep.ask_sk : nextStep.ask_en;

          fullTranscript.push({
            role: 'ai', text: nextQ, attribute: 'collect', timestamp: new Date().toISOString(),
          });

          await supabase.from('cv_verifications').update({
            full_transcript: fullTranscript,
            session_state: { ...state, collect_step: nextStepIdx, collected },
            updated_at: new Date().toISOString(),
          }).eq('id', sessionId);

          return res.json({
            transcribedAnswer: finalAnswer,
            nextQuestion: nextQ,
            attribute: 'collect',
            attributeLabel: { sk: 'Zber informácií', en: 'Profile Collection' },
            attributeIndex: nextStepIdx,
            totalAttributes: COLLECT_STEPS.length,
            questionIndex: 0,
            totalQuestions: 1,
            attributeComplete: false,
            sessionComplete: false,
            collectProgress: { step: nextStepIdx, total: COLLECT_STEPS.length },
          });
        }

        // ── All collect steps done — build CV + ai_profile ──────────────────
        const processing_msg = lang === 'sk'
          ? '✨ Perfektné! Spracovávam tvoje údaje a vytváram CV...'
          : '✨ Perfect! Processing your information and generating your CV...';

        fullTranscript.push({
          role: 'ai', text: processing_msg, attribute: 'collect', timestamp: new Date().toISOString(),
        });

        // Save intermediate state
        await supabase.from('cv_verifications').update({
          full_transcript: fullTranscript,
          session_state: { ...state, collect_step: nextStepIdx, collected },
          updated_at: new Date().toISOString(),
        }).eq('id', sessionId);

        // Build structured CV from collected answers
        let cvData = null;
        let filePath = null;
        try {
          cvData = await buildCvFromCollected(user.id, collected, lang);
        } catch (e) {
          console.error('[verify/collect] buildCv error:', e);
        }

        if (cvData) {
          // Build ai_profile from cvData.ai_profile
          if (cvData.ai_profile) {
            const ap = cvData.ai_profile;
            const stringify = v => v && typeof v === 'object' ? JSON.stringify(v) : v;
            try {
              await supabase.from('ai_profiles').upsert({
                user_id:             user.id,
                full_name:           ap.full_name || collected.full_name,
                languages:           ap.languages || [],
                hard_skills:         ap.hard_skills || [],
                soft_skills:         ap.soft_skills || [],
                experience_years:    ap.experience_years || 0,
                education_level:     ap.education_level || null,
                education_field:     ap.education_field || null,
                education_school:    ap.education_school || null,
                location:            ap.location || collected.location,
                experience_level:    ap.experience_level || 'beginner',
                preferred_categories: ap.preferred_categories || [],
                ai_headline:         stringify(ap.ai_headline),
                ai_summary:          stringify(ap.ai_summary),
                updated_at:          new Date().toISOString(),
              }, { onConflict: 'user_id' });
              console.log('[verify/collect] ai_profile saved');
            } catch (apErr) {
              console.error('[verify/collect] ai_profile upsert error:', apErr.message);
            }
          }

          // Generate CV PDF immediately and save to Supabase Storage + link to profile
          try {
            const pdfBuffer = await generateCvPdf(cvData);
            const fileName = `cv_generated_${Date.now()}.pdf`;
            filePath = `${user.id}/${fileName}`;

            // Clean up previous generated CV if it exists
            const { data: profile } = await supabase
              .from('profiles')
              .select('cv_id')
              .eq('user_id', user.id)
              .maybeSingle();

            if (profile?.cv_id && (profile.cv_id.includes('cv_generated_') || profile.cv_id.includes('cv_ai_generated_'))) {
              await supabase.storage.from('cvs').remove([profile.cv_id]).catch(err => {
                console.warn('[verify/collect] Old file delete error:', err.message);
              });
            }

            // Upload generated PDF to Supabase Storage
            const { error: uploadErr } = await supabase.storage
              .from('cvs')
              .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

            if (uploadErr) {
              console.error('[verify/collect] PDF upload failed:', uploadErr.message);
            } else {
              // Parse name parts for first/last name
              const nameParts = (cvData.name || '').trim().split(' ');
              const firstName = nameParts[0] || '';
              const lastName = nameParts.slice(1).join(' ') || '';

              // Process education description for profiles
              const educationStr = cvData.education && cvData.education.length > 0
                ? cvData.education.map(edu => `${edu.school || ''}${edu.degree ? ', ' + edu.degree : ''}`).join('; ')
                : '';

              // Map languages for profiles format
              const languagesArr = [];
              if (cvData.skills?.linguistic && Array.isArray(cvData.skills.linguistic)) {
                for (const langItem of cvData.skills.linguistic) {
                  const match = langItem.match(/^([^(]+)/);
                  if (match) {
                    languagesArr.push(match[1].trim());
                  } else {
                    languagesArr.push(langItem);
                  }
                }
              }

              // Update profiles table (removed invalid 'updated_at' column)
              const { error: updateErr } = await supabase
                .from('profiles')
                .update({
                  cv_id: filePath,
                  original_filename: 'Životopis.pdf',
                  first_name: firstName,
                  last_name: lastName,
                  education: educationStr,
                  location: cvData.location || '',
                  skills: [
                    ...(cvData.skills?.primary || []),
                    ...(cvData.skills?.technical || [])
                  ],
                  languages_spoken: languagesArr
                })
                .eq('user_id', user.id);

              if (updateErr) {
                console.error('[verify/collect] profiles update error:', updateErr.message);
              } else {
                console.log('[verify/collect] CV PDF generated and profiles row updated successfully');
              }
            }
          } catch (pdfErr) {
            console.error('[verify/collect] PDF generation error:', pdfErr);
          }
        }

        // Generate signed URL to display in chat
        let signedUrl = null;
        if (cvData && filePath) {
          try {
            const { data: signedData } = await supabase.storage
              .from('cvs')
              .createSignedUrl(filePath, 3600);
            signedUrl = signedData?.signedUrl || null;
          } catch (e) {
            console.warn('[verify/collect] error creating signed URL:', e.message);
          }
        }

        const completionMsg = lang === 'sk'
          ? '✨ Skvelé! Tvoj životopis bol úspešne vygenerovaný a uložený do tvojho profilu. Môžeš si ho stiahnuť nižšie.'
          : '✨ Great! Your CV has been successfully generated and saved to your profile. You can download it below.';

        fullTranscript.push({
          role: 'ai',
          text: completionMsg,
          attribute: 'collect',
          timestamp: new Date().toISOString(),
          isCvGenerated: true,
          cvUrl: signedUrl,
          cvPath: filePath
        });

        // Save session state indicating data collection is finished and CV is generated
        await supabase.from('cv_verifications').update({
          full_transcript: fullTranscript,
          session_state: {
            ...state,
            collect_step: nextStepIdx,
            collected,
            cv_generated: true,
            cv_path: filePath
          },
          updated_at: new Date().toISOString(),
        }).eq('id', sessionId);

        return res.json({
          transcribedAnswer: finalAnswer,
          nextQuestion: null,
          attribute: 'collect',
          attributeLabel: { sk: 'Životopis vytvorený', en: 'CV Generated' },
          attributeIndex: nextStepIdx,
          totalAttributes: COLLECT_STEPS.length,
          questionIndex: 0,
          totalQuestions: 1,
          cvGenerated: true,
          cvPath: filePath,
          cvUrl: signedUrl
        });
      }

      // ── INTERVIEW MODE ────────────────────────────────────────────────────
      const { data: aiProfile } = await supabase
        .from('ai_profiles')
        .select('full_name, languages, hard_skills, soft_skills, experience_years, education_level, education_school, education_field')
        .eq('user_id', user.id)
        .maybeSingle();

      // ── Compute response timings from transcript ──────────────────────────
      const responseTimings = [];
      for (let i = 1; i < fullTranscript.length; i++) {
        const prev = fullTranscript[i - 1];
        const curr = fullTranscript[i];
        if (prev.role === 'ai' && curr.role === 'student' && prev.timestamp && curr.timestamp) {
          const delta = (new Date(curr.timestamp) - new Date(prev.timestamp)) / 1000;
          if (delta > 0 && delta < 600) responseTimings.push(delta); // cap at 10min
        }
      }

      const currentAttribute = state.current_attribute || ATTRIBUTES[0];
      const attributeIndex   = state.attribute_index   || 0;
      let   questionIndex    = state.question_index    || 0;
      const attributeHistory = state.attribute_history || {};
      if (!attributeHistory[currentAttribute]) attributeHistory[currentAttribute] = [];

      // Get current question from transcript
      const lastAI = [...fullTranscript].reverse()
        .find(t => t.role === 'ai' && t.attribute === currentAttribute);
      const currentQuestion = lastAI?.text || '?';

      // Record Q&A
      attributeHistory[currentAttribute].push({ question: currentQuestion, answer: finalAnswer, wasAudio: !!audioBase64 });
      questionIndex++;

      let nextQuestion = null, nextAttribute = currentAttribute;
      let nextAttrIdx  = attributeIndex, nextQIdx = questionIndex;
      let attributeComplete = false, sessionComplete = false, evaluation = null;

      if (questionIndex >= QUESTIONS_PER_ATTRIBUTE) {
        // Attribute section done — evaluate
        attributeComplete = true;
        evaluation = await evaluateAttribute(
          user.id, aiProfile || {}, currentAttribute,
          attributeHistory[currentAttribute], lang, responseTimings
        );

        const results = session.results || {};
        results[currentAttribute] = {
          ...evaluation,
          transcript: attributeHistory[currentAttribute],
          completed_at: new Date().toISOString(),
        };

        nextAttrIdx = attributeIndex + 1;
        if (nextAttrIdx < ATTRIBUTES.length) {
          nextAttribute  = ATTRIBUTES[nextAttrIdx];
          nextQIdx       = 0;
          nextQuestion   = await generateFirstQuestion(user.id, aiProfile || {}, nextAttribute, lang);

          fullTranscript.push({ role: 'ai', text: nextQuestion, attribute: nextAttribute, timestamp: new Date().toISOString() });

          await supabase.from('cv_verifications').update({
            results, full_transcript: fullTranscript,
            session_state: { lang, mode: 'interview', current_attribute: nextAttribute, attribute_index: nextAttrIdx, question_index: 0, attribute_history: attributeHistory },
            updated_at: new Date().toISOString(),
          }).eq('id', sessionId);
        } else {
          // All done
          sessionComplete = true;
          const allScores   = Object.values(results).map(r => r.score || 0);
          const overallScore = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;

          await supabase.from('cv_verifications').update({
            results, full_transcript: fullTranscript,
            status: 'completed', overall_score: overallScore,
            completed_at: new Date().toISOString(),
            session_state: { lang, mode: 'interview', current_attribute: null, attribute_index: nextAttrIdx, question_index: 0, attribute_history: attributeHistory },
            updated_at: new Date().toISOString(),
          }).eq('id', sessionId);

          // Generate CV PDF here
          await generateAndUploadCvFromDb(user.id, supabase, lang);

          // System message to open applications
          try {
            const msg = lang === 'sk'
              ? '✅ Overenie profilu dokončené! Tvoj profil teraz obsahuje overené odznaky.'
              : '✅ Profile verification complete! Your profile now has verified badges.';
            const { data: apps } = await supabase.from('applications').select('id')
              .eq('candidate_id', user.id).in('status', ['Pending', 'Viewed', 'Interview']);
            for (const app of (apps || []).slice(0, 5)) {
              await supabase.from('application_messages').insert({
                application_id: app.id, sender_id: null, body: msg,
                message_type: 'system', metadata: { type: 'verification_complete' },
              }).catch(() => {});
            }
          } catch {}
        }
      } else {
        // More questions in this attribute
        nextQuestion = await generateNextQuestion(
          user.id, aiProfile || {}, currentAttribute, attributeHistory[currentAttribute], lang, questionIndex, responseTimings
        );
        fullTranscript.push({ role: 'ai', text: nextQuestion, attribute: currentAttribute, timestamp: new Date().toISOString() });

        await supabase.from('cv_verifications').update({
          full_transcript: fullTranscript,
          session_state: { lang, mode: 'interview', current_attribute: currentAttribute, attribute_index: attributeIndex, question_index: questionIndex, attribute_history: attributeHistory },
          updated_at: new Date().toISOString(),
        }).eq('id', sessionId);
      }

      return res.json({
        transcribedAnswer: finalAnswer,
        nextQuestion,
        attribute: nextAttribute,
        attributeLabel: ATTRIBUTE_LABELS[nextAttribute],
        attributeIndex: nextAttrIdx,
        totalAttributes: ATTRIBUTES.length,
        questionIndex: nextQIdx,
        totalQuestions: QUESTIONS_PER_ATTRIBUTE,
        attributeComplete,
        sessionComplete,
        evaluation: attributeComplete ? evaluation : null,
      });

    } catch (err) {
      console.error('[verify/turn]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/verify/status ─────────────────────────────────────────────────
  app.get('/api/verify/status', async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const { data, error } = await supabase.from('cv_verifications')
        .select('id, status, results, overall_score, completed_at, created_at, session_state')
        .eq('user_id', user.id).maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      res.json({ verification: data || null });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/employer/candidate/:candidateId/verification ──────────────────
  app.get('/api/employer/candidate/:candidateId/verification', async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const { candidateId } = req.params;

      const { data: jobs } = await supabase.from('jobs').select('id').eq('employer_id', user.id);
      const jobIds = (jobs || []).map(j => j.id);
      let authorized = false;

      if (jobIds.length > 0) {
        const { data: app } = await supabase.from('applications').select('id')
          .eq('candidate_id', candidateId).in('job_id', jobIds).limit(1).maybeSingle();
        if (app) authorized = true;
      }
      if (!authorized) {
        const { data: d } = await supabase.from('applications').select('id')
          .eq('candidate_id', candidateId).eq('employer_id', user.id).limit(1).maybeSingle();
        if (d) authorized = true;
      }
      if (!authorized) return res.status(403).json({ error: 'Unauthorized' });

      const { data, error } = await supabase.from('cv_verifications')
        .select('id, status, results, full_transcript, overall_score, completed_at, created_at')
        .eq('user_id', candidateId).eq('status', 'completed').maybeSingle();

      if (error) return res.status(500).json({ error: error.message });
      res.json({ verification: data || null });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/verify/continue ──────────────────────────────────────────────
  app.post('/api/verify/continue', async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      // Fetch the user's verification session
      const { data: session, error: sessErr } = await supabase
        .from('cv_verifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'in_progress')
        .maybeSingle();

      if (sessErr || !session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const state = session.session_state || {};
      const lang = state.lang || 'sk';

      // Transition to interview mode
      const { data: aiProfile } = await supabase
        .from('ai_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      const firstAttr = ATTRIBUTES[0];
      let interviewQ;
      try {
        interviewQ = await generateFirstQuestion(user.id, aiProfile || {}, firstAttr, lang);
      } catch (e) {
        interviewQ = lang === 'sk' ? 'Môžeš sa mi predstaviť v anglickom jazyku?' : 'Could you briefly introduce yourself in English?';
      }

      const transitionMsg = lang === 'sk'
        ? `🎉 Začnime krátky overovací pohovor v ${ATTRIBUTES.length} sekciách.`
        : `🎉 Let's start a short verification interview in ${ATTRIBUTES.length} sections.`;

      const fullTranscript = session.full_transcript || [];
      fullTranscript.push({
        role: 'ai', text: transitionMsg, attribute: 'transition', timestamp: new Date().toISOString(),
      });
      fullTranscript.push({
        role: 'ai', text: interviewQ, attribute: firstAttr, timestamp: new Date().toISOString(),
      });

      const updatedState = {
        ...state,
        mode: 'interview',
        collect_step: null,
        collected: null,
        current_attribute: firstAttr,
        attribute_index: 0,
        question_index: 0,
        attribute_history: {},
      };

      await supabase.from('cv_verifications').update({
        full_transcript: fullTranscript,
        session_state: updatedState,
        updated_at: new Date().toISOString(),
      }).eq('id', session.id);

      res.json({
        nextQuestion: interviewQ,
        transitionMessage: transitionMsg,
        attribute: firstAttr,
        attributeLabel: ATTRIBUTE_LABELS[firstAttr],
        attributeIndex: 0,
        totalAttributes: ATTRIBUTES.length,
        questionIndex: 0,
        totalQuestions: QUESTIONS_PER_ATTRIBUTE,
        modeTransition: 'interview'
      });
    } catch (err) {
      console.error('[verify/continue] error:', err);
      res.status(500).json({ error: err.message });
    }
  });
};
