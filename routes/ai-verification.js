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
    model: 'gpt-4o',
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

function buildInterviewSystemPrompt(aiProfile, attribute, lang) {
  const name       = aiProfile?.full_name || 'kandidát';
  const languages  = (aiProfile?.languages || []).map(l => l.lang || l).join(', ') || 'neuvedené';
  const hardSkills = (aiProfile?.hard_skills || []).slice(0, 8).join(', ')  || 'neuvedené';
  const softSkills = (aiProfile?.soft_skills || []).slice(0, 5).join(', ')  || 'neuvedené';
  const expYears   = aiProfile?.experience_years || 0;
  const education  = aiProfile?.education_level  || 'unknown';

  const langInstruction = lang === 'en'
    ? 'Conduct the interview in ENGLISH. Ask natural, conversational questions.'
    : 'Veď pohovor v SLOVENČINE. Pýtaj sa prirodzene a konverzačne.';

  const ctx = {
    language: lang === 'en'
      ? `Verify language proficiency. Claimed languages: ${languages}. Ask them to write naturally in their non-native language. Assess grammar, vocabulary, fluency.`
      : `Over jazykové znalosti. Tvrdené jazyky: ${languages}. Požiadaj ich, aby písali/hovorili prirodzene v cudzom jazyku. Hodnoť gramatiku, slovnú zásobu, plynulosť.`,
    skills: lang === 'en'
      ? `Verify technical skills. Listed: ${hardSkills}. Ask for practical examples — how they used a skill, a project they worked on, or a tool they mastered.`
      : `Over technické zručnosti. Uviedli: ${hardSkills}. Pýtaj sa na praktické príklady — ako zručnosť použili, projekt na ktorom pracovali, alebo nástroj ktorý ovládajú.`,
    experience: lang === 'en'
      ? `Verify work experience. ~${expYears} years claimed. Ask about specific roles, responsibilities, and outcomes. Probe for authenticity.`
      : `Over pracovné skúsenosti. Tvrdí ~${expYears} rokov. Pýtaj sa na konkrétne pozície, zodpovednosti a výsledky.`,
    soft_skills: lang === 'en'
      ? `Verify soft skills: ${softSkills}. Use STAR-method behavioral questions — ask for real examples of teamwork, leadership, conflict resolution.`
      : `Over mäkké zručnosti: ${softSkills}. Použi STAR behaviorálne otázky — pýtaj sa na reálne príklady tímovej práce, vedenia, riešenia konfliktov.`,
  };

  return `You are a professional but warm AI interviewer for unemployed.sk, a Slovak student job platform.
${langInstruction}

Candidate: ${name} | Education: ${education} | Languages: ${languages}
Technical: ${hardSkills} | Soft: ${softSkills} | Experience: ${expYears}yr

Section: ${ATTRIBUTE_LABELS[attribute]?.[lang] || attribute}
${ctx[attribute] || ''}

Rules:
- ONE short question at a time. Max 2 sentences.
- Encouraging but professional.
- Do NOT reveal scores during the interview.
- Open-ended questions only — no yes/no.`;
}

async function generateFirstQuestion(userId, aiProfile, attribute, lang) {
  const openers = {
    language:    { sk: 'Popros kandidáta, aby sa stručne predstavil v cudzom jazyku (napr. angličtine).', en: 'Ask the candidate to briefly introduce themselves in a foreign language they listed.' },
    skills:      { sk: 'Požiadaj kandidáta, aby opísal jednu technickú zručnosť a ako ju použil v praxi.', en: 'Ask the candidate to describe one technical skill and how they used it in practice.' },
    experience:  { sk: 'Požiadaj kandidáta, aby povedal o svojej najvýznamnejšej pracovnej skúsenosti.', en: 'Ask the candidate about their most significant work or internship experience.' },
    soft_skills: { sk: 'Polož situačnú otázku: kandidát má opísať situáciu, keď musel spolupracovať s niekým s kým nesúhlasil.', en: 'Ask a situational question: describe a time they had to work with someone they disagreed with.' },
  };
  const prompt = openers[attribute]?.[lang] || openers[attribute]?.sk || 'Ask the opening question.';
  const system = buildInterviewSystemPrompt(aiProfile, attribute, lang);
  const result = await gptCall(userId, [
    { role: 'system', content: system },
    { role: 'user',   content: prompt },
  ], { maxTokens: 150, temperature: 0.7 });
  return result || (lang === 'sk' ? 'Môžeš sa mi predstaviť?' : 'Can you introduce yourself?');
}

async function generateNextQuestion(userId, aiProfile, attribute, history, lang, qIdx) {
  const system = buildInterviewSystemPrompt(aiProfile, attribute, lang);
  const messages = [{ role: 'system', content: system }];
  for (const t of history) {
    messages.push({ role: 'assistant', content: t.question });
    messages.push({ role: 'user',      content: t.answer });
  }
  if (qIdx >= QUESTIONS_PER_ATTRIBUTE - 1) {
    messages.push({ role: 'user', content: lang === 'sk'
      ? 'Toto je posledná otázka v tejto sekcii.'
      : 'This is the last question in this section.' });
  }
  return await gptCall(userId, messages, { maxTokens: 150, temperature: 0.7 })
    || (lang === 'sk' ? 'Môžeš mi povedať viac?' : 'Can you tell me more?');
}

async function evaluateAttribute(userId, aiProfile, attribute, history, lang) {
  const transcript = history.map((t, i) => `Q${i+1}: ${t.question}\nA${i+1}: ${t.answer}`).join('\n\n');
  const claimed = {
    language:    (aiProfile?.languages || []).map(l => l.lang || l).join(', '),
    skills:      (aiProfile?.hard_skills || []).slice(0, 6).join(', '),
    experience:  `${aiProfile?.experience_years || 0} years`,
    soft_skills: (aiProfile?.soft_skills || []).slice(0, 4).join(', '),
  }[attribute] || 'not specified';

  const prompt = lang === 'en'
    ? `Evaluate this candidate's ${attribute.replace('_',' ')} section.\nClaimed: "${claimed}"\n\nTranscript:\n${transcript}\n\nRespond ONLY with valid JSON:\n{"verified":true/false,"score":0.0-1.0,"level":"brief descriptor","summary":"2-3 sentence professional summary","strengths":["s1"],"gaps":["g1"]}`
    : `Hodnoť sekciu: ${attribute.replace('_',' ')}.\nTvrdenia: "${claimed}"\n\nPrepis:\n${transcript}\n\nOdpovedaj IBA platným JSON:\n{"verified":true/false,"score":0.0-1.0,"level":"stručný popis","summary":"2-3 vetné profesionálne zhrnutie","strengths":["s1"],"gaps":["g1"]}`;

  const raw = await gptCall(userId, [{ role: 'user', content: prompt }], { maxTokens: 400, temperature: 0.3 });
  try { return JSON.parse(raw || '{}'); } catch {
    const m = (raw || '').match(/\{[\s\S]*\}/);
    if (m) try { return JSON.parse(m[0]); } catch {}
    return { verified: false, score: 0.5, level: 'N/A', summary: 'Evaluation unavailable.', strengths: [], gaps: [] };
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

      // Already completed?
      const { data: existing } = await supabase
        .from('cv_verifications')
        .select('id, status, results, overall_score, completed_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing?.status === 'completed') {
        return res.status(409).json({ error: 'Verification already completed', verification: existing });
      }

      const lang = req.body.lang || 'sk';

      // ── Does the user have a CV uploaded? ──────────────────────────────────
      const { data: profile } = await supabase
        .from('profiles')
        .select('cv_id')
        .eq('user_id', user.id)
        .maybeSingle();

      const hasCv = !!(profile?.cv_id);

      let firstQuestion, mode, sessionData;

      if (!hasCv) {
        // ── No CV: enter collect mode ────────────────────────────────────────
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
          .select('full_name, languages, hard_skills, soft_skills, experience_years, education_level')
          .eq('user_id', user.id)
          .maybeSingle();

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

      // Upsert session
      let sessionId;
      if (existing?.status === 'in_progress') {
        sessionId = existing.id;
        await supabase.from('cv_verifications')
          .update({ ...sessionData, updated_at: new Date().toISOString() })
          .eq('id', sessionId);
      } else {
        const { data: newSess, error: ie } = await supabase.from('cv_verifications')
          .insert(sessionData).select('id').single();
        if (ie) return res.status(500).json({ error: ie.message });
        sessionId = newSess.id;
      }

      return res.json({
        sessionId,
        mode,
        noCv: !hasCv,
        attribute: mode === 'interview' ? ATTRIBUTES[0] : 'collect',
        attributeLabel: mode === 'interview' ? ATTRIBUTE_LABELS[ATTRIBUTES[0]] : { sk: 'Zber informácií', en: 'Profile Collection' },
        attributeIndex: 0,
        totalAttributes: mode === 'interview' ? ATTRIBUTES.length : COLLECT_STEPS.length,
        questionIndex: 0,
        totalQuestions: mode === 'interview' ? QUESTIONS_PER_ATTRIBUTE : 1,
        question: firstQuestion,
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
        try {
          cvData = await buildCvFromCollected(user.id, collected, lang);
        } catch (e) {
          console.error('[verify/collect] buildCv error:', e);
        }

        if (cvData) {
          // Generate PDF
          try {
            const pdfBuffer = await generateCvPdf(cvData);
            const fileName  = `cv_ai_generated_${user.id}_${Date.now()}.pdf`;
            const filePath  = `${user.id}/${fileName}`;

            // Upload to Supabase storage
            const { error: uploadErr } = await supabase.storage
              .from('cvs')
              .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

            if (!uploadErr) {
              // Update profile with cv_id
              await supabase.from('profiles')
                .upsert({ user_id: user.id, cv_id: filePath }, { onConflict: 'user_id' });
              console.log('[verify/collect] Generated CV uploaded:', filePath);
            } else {
              console.warn('[verify/collect] CV upload failed:', uploadErr.message);
            }
          } catch (pdfErr) {
            console.error('[verify/collect] PDF generation error:', pdfErr.message);
          }

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
        }

        // Now transition to interview mode
        const aiProfile = cvData?.ai_profile || {};
        const firstAttr = ATTRIBUTES[0];
        let interviewQ;
        try {
          interviewQ = await generateFirstQuestion(user.id, aiProfile, firstAttr, lang);
        } catch (e) {
          interviewQ = lang === 'sk' ? 'Môžeš sa mi predstaviť v anglickom jazyku?' : 'Could you briefly introduce yourself in English?';
        }

        const transitionMsg = lang === 'sk'
          ? `🎉 Tvoje CV bolo vytvorené! Teraz začneme krátky overovací pohovor v ${ATTRIBUTES.length} sekciách.`
          : `🎉 Your CV has been created! Now let's start a short verification interview in ${ATTRIBUTES.length} sections.`;

        fullTranscript.push({
          role: 'ai', text: transitionMsg, attribute: 'transition', timestamp: new Date().toISOString(),
        });
        fullTranscript.push({
          role: 'ai', text: interviewQ, attribute: firstAttr, timestamp: new Date().toISOString(),
        });

        await supabase.from('cv_verifications').update({
          full_transcript: fullTranscript,
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
          updated_at: new Date().toISOString(),
        }).eq('id', sessionId);

        return res.json({
          transcribedAnswer: finalAnswer,
          nextQuestion: interviewQ,
          attribute: firstAttr,
          attributeLabel: ATTRIBUTE_LABELS[firstAttr],
          attributeIndex: 0,
          totalAttributes: ATTRIBUTES.length,
          questionIndex: 0,
          totalQuestions: QUESTIONS_PER_ATTRIBUTE,
          attributeComplete: false,
          sessionComplete: false,
          cvGenerated: !!cvData,
          modeTransition: 'interview',
          transitionMessage: transitionMsg,
        });
      }

      // ── INTERVIEW MODE ────────────────────────────────────────────────────
      const { data: aiProfile } = await supabase
        .from('ai_profiles')
        .select('full_name, languages, hard_skills, soft_skills, experience_years, education_level')
        .eq('user_id', user.id)
        .maybeSingle();

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
      attributeHistory[currentAttribute].push({ question: currentQuestion, answer: finalAnswer });
      questionIndex++;

      let nextQuestion = null, nextAttribute = currentAttribute;
      let nextAttrIdx  = attributeIndex, nextQIdx = questionIndex;
      let attributeComplete = false, sessionComplete = false, evaluation = null;

      if (questionIndex >= QUESTIONS_PER_ATTRIBUTE) {
        // Attribute section done — evaluate
        attributeComplete = true;
        evaluation = await evaluateAttribute(
          user.id, aiProfile || {}, currentAttribute,
          attributeHistory[currentAttribute], lang
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
          user.id, aiProfile || {}, currentAttribute, attributeHistory[currentAttribute], lang, questionIndex
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
};
