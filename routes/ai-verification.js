'use strict';

/**
 * AI Verification Interview Route
 * 
 * Endpoints:
 *   POST /api/verify/start          — start a new verification session
 *   POST /api/verify/turn           — submit an answer (text or audio), get next question
 *   POST /api/verify/complete       — finalise session, compute overall score
 *   GET  /api/verify/status         — get current verification status for student
 *   GET  /api/employer/candidate/:id/verification — employer reads a candidate's verification
 */

const OpenAI = require('openai');

let _openai = null;
function getOpenAI() {
  if (_openai) return _openai;
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');
  _openai = new OpenAI({ apiKey: key });
  return _openai;
}

// ── Attribute definitions ──────────────────────────────────────────────────────
const ATTRIBUTES = ['language', 'skills', 'experience', 'soft_skills'];

const ATTRIBUTE_LABELS = {
  language:   { sk: 'Jazykové znalosti', en: 'Language Skills' },
  skills:     { sk: 'Technické zručnosti', en: 'Technical Skills' },
  experience: { sk: 'Pracovné skúsenosti', en: 'Work Experience' },
  soft_skills:{ sk: 'Mäkké zručnosti', en: 'Soft Skills' },
};

// Questions per attribute (3 each = 12 total, ~2-3 min)
const QUESTIONS_PER_ATTRIBUTE = 3;

/**
 * Build a contextual system prompt for the interviewer role.
 */
function buildSystemPrompt(aiProfile, attribute, lang = 'sk') {
  const name = aiProfile?.full_name || 'kandidát';
  const languages = (aiProfile?.languages || []).map(l => l.lang || l).join(', ') || 'neuvedené';
  const hardSkills = (aiProfile?.hard_skills || []).slice(0, 8).join(', ') || 'neuvedené';
  const softSkills = (aiProfile?.soft_skills || []).slice(0, 5).join(', ') || 'neuvedené';
  const expYears = aiProfile?.experience_years || 0;
  const education = aiProfile?.education_level || 'unknown';

  const langInstruction = lang === 'en'
    ? 'Conduct the interview in ENGLISH. Ask natural, conversational questions.'
    : 'Veď pohovor v SLOVENČINE. Pýtaj sa prirodzene a konverzačne.';

  const attributeContext = {
    language: lang === 'en'
      ? `Verify the candidate's language proficiency. They claim to speak: ${languages}. Focus on their non-native languages (e.g. English, German). Ask them to speak/write naturally — describe their day, explain a concept, or react to a scenario. Assess grammar, vocabulary, fluency.`
      : `Over si jazykové znalosti kandidáta. Tvrdí, že hovorí: ${languages}. Zameraj sa na cudzí jazyk (napr. angličtinu, nemčinu). Požiadaj ich, aby hovorili/písali prirodzene — opíšte deň, vysvetlite koncept, reagujte na situáciu.`,
    skills: lang === 'en'
      ? `Verify the candidate's technical skills. They listed: ${hardSkills}. Ask them to explain a concept, describe how they used a skill in practice, or walk through a real example. Focus on depth, not just name-dropping.`
      : `Over technické zručnosti kandidáta. Uviedli: ${hardSkills}. Požiadaj ich, aby vysvetlili koncept, opísali, ako zručnosť použili v praxi, alebo prešli reálnym príkladom.`,
    experience: lang === 'en'
      ? `Verify the candidate's work experience. They have ~${expYears} years of experience. Ask about specific roles, responsibilities, challenges they faced, and what they learned. Probe for authenticity.`
      : `Over pracovné skúsenosti kandidáta. Majú ~${expYears} rokov skúseností. Pýtaj sa na konkrétne pozície, zodpovednosti, výzvy a čo sa naučili.`,
    soft_skills: lang === 'en'
      ? `Verify the candidate's soft skills. They claim: ${softSkills}. Use situational/behavioral questions (STAR method). Ask about teamwork, conflict resolution, leadership, or adaptability with a real example.`
      : `Over mäkké zručnosti kandidáta. Tvrdia: ${softSkills}. Použi situačné/behaviorálne otázky (STAR metóda). Pýtaj sa na tímovú prácu, riešenie konfliktov, vedenie alebo adaptabilitu s reálnym príkladom.`,
  };

  return `You are a professional but warm AI interviewer for unemployed.sk, a Slovak student job platform.
${langInstruction}

Candidate profile:
- Name: ${name}
- Education: ${education}
- Languages: ${languages}
- Technical skills: ${hardSkills}
- Soft skills: ${softSkills}
- Experience: ${expYears} year(s)

Current section: ${ATTRIBUTE_LABELS[attribute]?.[lang] || attribute}
${attributeContext[attribute] || ''}

Rules:
- Ask ONE short, clear question at a time. Maximum 2 sentences.
- Be encouraging but professional.
- Do NOT reveal scores or give feedback during the interview.
- Do NOT ask yes/no questions — ask open-ended ones.
- After receiving an answer, ask a natural follow-up or the next question in the section.`;
}

/**
 * Generate the first question for a given attribute.
 */
async function generateFirstQuestion(aiProfile, attribute, lang) {
  const openai = getOpenAI();
  const system = buildSystemPrompt(aiProfile, attribute, lang);
  
  const openers = {
    language: {
      sk: 'Začni tým, že poprosíš kandidáta, aby sa stručne predstavil v cudzom jazyku, ktorý uviedol (napr. angličtine). Použi iba 1-2 vety.',
      en: 'Start by asking the candidate to briefly introduce themselves in a foreign language they listed. Keep it to 1-2 sentences.',
    },
    skills: {
      sk: 'Začni tým, že požiadaš kandidáta, aby ti opísal jednu zo svojich technických zručností a ako ju používal v praxi.',
      en: 'Start by asking the candidate to describe one of their technical skills and how they used it in practice.',
    },
    experience: {
      sk: 'Začni tým, že požiadaš kandidáta, aby ti povedal o svojej najvýznamnejšej pracovnej skúsenosti alebo brigáde.',
      en: 'Start by asking the candidate to tell you about their most significant work experience or part-time job.',
    },
    soft_skills: {
      sk: 'Začni situačnou otázkou: Popros kandidáta, aby ti opísal situáciu, keď musel spolupracovať s niekým, s kým nesúhlasil.',
      en: 'Start with a situational question: Ask the candidate to describe a situation where they had to work with someone they disagreed with.',
    },
  };

  const userMsg = openers[attribute]?.[lang] || openers[attribute]?.sk || 'Ask the opening question for this section.';

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userMsg },
    ],
    max_tokens: 150,
    temperature: 0.7,
  });

  return resp.choices[0]?.message?.content?.trim() || 'Could you tell me a bit about yourself?';
}

/**
 * Generate the next question given conversation history.
 */
async function generateNextQuestion(aiProfile, attribute, history, lang, questionIndex) {
  const openai = getOpenAI();
  const system = buildSystemPrompt(aiProfile, attribute, lang);

  const messages = [{ role: 'system', content: system }];
  for (const turn of history) {
    messages.push({ role: 'assistant', content: turn.question });
    messages.push({ role: 'user', content: turn.answer });
  }

  const isLast = questionIndex >= QUESTIONS_PER_ATTRIBUTE - 1;
  if (isLast) {
    messages.push({
      role: 'user',
      content: lang === 'sk'
        ? 'Toto je posledná otázka v tejto sekcii. Polož záverečnú otázku pre túto sekciu.'
        : 'This is the last question in this section. Ask the final question for this section.',
    });
  }

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    max_tokens: 150,
    temperature: 0.7,
  });

  return resp.choices[0]?.message?.content?.trim() || '';
}

/**
 * Evaluate a complete attribute section and produce a score + summary.
 */
async function evaluateAttribute(aiProfile, attribute, history, lang) {
  const openai = getOpenAI();

  const transcriptText = history
    .map((t, i) => `Q${i + 1}: ${t.question}\nA${i + 1}: ${t.answer}`)
    .join('\n\n');

  const claimedValue = {
    language: (aiProfile?.languages || []).map(l => l.lang || l).join(', '),
    skills: (aiProfile?.hard_skills || []).slice(0, 6).join(', '),
    experience: `${aiProfile?.experience_years || 0} years`,
    soft_skills: (aiProfile?.soft_skills || []).slice(0, 4).join(', '),
  }[attribute] || 'not specified';

  const prompt = lang === 'en'
    ? `You are evaluating a job candidate's ${attribute.replace('_', ' ')} based on their interview responses.
    
Claimed: "${claimedValue}"

Interview transcript:
${transcriptText}

Evaluate and respond with ONLY valid JSON (no markdown, no explanation):
{
  "verified": true/false,
  "score": 0.0-1.0,
  "level": "brief level description e.g. B1, intermediate, 2 years hands-on",
  "summary": "2-3 sentence professional summary of what was demonstrated",
  "strengths": ["strength 1", "strength 2"],
  "gaps": ["gap 1"]
}`
    : `Si hodnotiteľ pracovného pohovoru. Hodnotíš sekciu: ${attribute.replace('_', ' ')}.

Tvrdenia kandidáta: "${claimedValue}"

Prepis pohovoru:
${transcriptText}

Zhodnoť a odpovedaj IBA platným JSON (bez markdown, bez vysvetlení):
{
  "verified": true/false,
  "score": 0.0-1.0,
  "level": "stručný popis úrovne napr. B1, mierne pokročilý, 2 roky praxe",
  "summary": "2-3 vetné profesionálne zhrnutie preukázaných schopností",
  "strengths": ["silná stránka 1", "silná stránka 2"],
  "gaps": ["slabé miesto 1"]
}`;

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 400,
    temperature: 0.3,
  });

  const raw = resp.choices[0]?.message?.content?.trim() || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    // Attempt to extract JSON from response
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    return { verified: false, score: 0, level: 'unknown', summary: 'Evaluation failed.', strengths: [], gaps: [] };
  }
}

/**
 * Transcribe audio using OpenAI Whisper.
 */
async function transcribeAudio(audioBase64, mimeType = 'audio/webm') {
  const openai = getOpenAI();
  const buffer = Buffer.from(audioBase64, 'base64');
  
  // Determine file extension from mimeType
  let ext = 'webm';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) ext = 'mp4';
  else if (mimeType.includes('wav')) ext = 'wav';
  else if (mimeType.includes('ogg')) ext = 'ogg';
  else if (mimeType.includes('mp3')) ext = 'mp3';

  const file = new File([buffer], `audio.${ext}`, { type: mimeType });

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: undefined, // auto-detect
  });

  return transcription.text?.trim() || '';
}

// ── Route Module ───────────────────────────────────────────────────────────────
module.exports = function aiVerificationRouter(app, supabase, { getUserFromToken }) {

  // ── POST /api/verify/start ─────────────────────────────────────────────────
  app.post('/api/verify/start', async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      // Check if already has a completed verification (one attempt only)
      const { data: existing } = await supabase
        .from('cv_verifications')
        .select('id, status, results, overall_score, completed_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing?.status === 'completed') {
        return res.status(409).json({
          error: 'Verification already completed',
          verification: existing,
        });
      }

      // Get their AI profile for context
      const { data: aiProfile } = await supabase
        .from('ai_profiles')
        .select('full_name, languages, hard_skills, soft_skills, experience_years, education_level, soft_skills')
        .eq('user_id', user.id)
        .maybeSingle();

      const lang = req.body.lang || 'sk';
      const firstAttribute = ATTRIBUTES[0]; // 'language'

      // Generate first question
      let firstQuestion;
      try {
        firstQuestion = await generateFirstQuestion(aiProfile || {}, firstAttribute, lang);
      } catch (aiErr) {
        console.error('[verify/start] AI error:', aiErr.message);
        firstQuestion = lang === 'sk'
          ? 'Môžeš sa mi stručne predstaviť v anglickom jazyku?'
          : 'Could you briefly introduce yourself in English?';
      }

      // Create or update verification session
      const sessionData = {
        user_id: user.id,
        status: 'in_progress',
        results: {},
        full_transcript: [],
        session_state: {
          lang,
          current_attribute: firstAttribute,
          attribute_index: 0,
          question_index: 0,
          attribute_history: {}, // { language: [{question, answer}], ... }
        },
      };

      let sessionId;
      if (existing?.status === 'in_progress') {
        // Resume existing in-progress session
        sessionId = existing.id;
        await supabase
          .from('cv_verifications')
          .update({ status: 'in_progress', updated_at: new Date().toISOString() })
          .eq('id', sessionId);
      } else {
        const { data: newSession, error: insertErr } = await supabase
          .from('cv_verifications')
          .insert(sessionData)
          .select('id')
          .single();
        if (insertErr) {
          console.error('[verify/start] DB insert error:', insertErr);
          return res.status(500).json({ error: insertErr.message });
        }
        sessionId = newSession.id;
      }

      res.json({
        sessionId,
        attribute: firstAttribute,
        attributeLabel: ATTRIBUTE_LABELS[firstAttribute],
        attributeIndex: 0,
        totalAttributes: ATTRIBUTES.length,
        questionIndex: 0,
        totalQuestions: QUESTIONS_PER_ATTRIBUTE,
        question: firstQuestion,
      });
    } catch (err) {
      console.error('[verify/start] Error:', err);
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

      // Fetch current session
      const { data: session, error: sessionErr } = await supabase
        .from('cv_verifications')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

      if (sessionErr || !session) return res.status(404).json({ error: 'Session not found' });
      if (session.status === 'completed') return res.status(409).json({ error: 'Session already completed' });

      // Get AI profile for context
      const { data: aiProfile } = await supabase
        .from('ai_profiles')
        .select('full_name, languages, hard_skills, soft_skills, experience_years, education_level')
        .eq('user_id', user.id)
        .maybeSingle();

      const state = session.session_state || {};
      const lang = state.lang || 'sk';
      const currentAttribute = state.current_attribute || ATTRIBUTES[0];
      const attributeIndex = state.attribute_index || 0;
      let questionIndex = state.question_index || 0;
      const attributeHistory = state.attribute_history || {};

      if (!attributeHistory[currentAttribute]) {
        attributeHistory[currentAttribute] = [];
      }

      // Transcribe audio if provided
      let finalAnswer = textAnswer || '';
      if (audioBase64 && !finalAnswer) {
        try {
          finalAnswer = await transcribeAudio(audioBase64, audioMimeType || 'audio/webm');
          console.log(`[verify/turn] Transcribed audio: "${finalAnswer.substring(0, 60)}..."`);
        } catch (sttErr) {
          console.error('[verify/turn] Whisper transcription failed:', sttErr.message);
          return res.status(500).json({ error: 'Audio transcription failed. Please try text input.' });
        }
      }

      if (!finalAnswer.trim()) {
        return res.status(400).json({ error: 'No answer provided' });
      }

      // Get the current question from the last turn (stored in full_transcript)
      const fullTranscript = session.full_transcript || [];
      const lastAITurn = [...fullTranscript].reverse().find(t => t.role === 'ai' && t.attribute === currentAttribute);
      const currentQuestion = lastAITurn?.text || '?';

      // Record this Q&A pair
      attributeHistory[currentAttribute].push({
        question: currentQuestion,
        answer: finalAnswer,
      });

      // Add to full transcript
      fullTranscript.push({
        role: 'student',
        text: finalAnswer,
        attribute: currentAttribute,
        timestamp: new Date().toISOString(),
        wasAudio: !!audioBase64,
      });

      questionIndex++;

      // Determine what comes next
      let nextQuestion = null;
      let nextAttribute = currentAttribute;
      let nextAttributeIndex = attributeIndex;
      let nextQuestionIndex = questionIndex;
      let attributeComplete = false;
      let sessionComplete = false;
      let evaluation = null;

      if (questionIndex >= QUESTIONS_PER_ATTRIBUTE) {
        // This attribute section is done — evaluate it
        attributeComplete = true;
        try {
          evaluation = await evaluateAttribute(aiProfile || {}, currentAttribute, attributeHistory[currentAttribute], lang);
        } catch (evalErr) {
          console.error('[verify/turn] Evaluation error:', evalErr.message);
          evaluation = { verified: false, score: 0.5, level: 'N/A', summary: 'Evaluation unavailable.', strengths: [], gaps: [] };
        }

        // Save evaluation to results
        const results = session.results || {};
        results[currentAttribute] = {
          ...evaluation,
          transcript: attributeHistory[currentAttribute],
          completed_at: new Date().toISOString(),
        };

        // Move to next attribute or complete
        nextAttributeIndex = attributeIndex + 1;
        if (nextAttributeIndex < ATTRIBUTES.length) {
          nextAttribute = ATTRIBUTES[nextAttributeIndex];
          nextQuestionIndex = 0;

          // Generate first question for next attribute
          try {
            nextQuestion = await generateFirstQuestion(aiProfile || {}, nextAttribute, lang);
          } catch (aiErr) {
            nextQuestion = lang === 'sk'
              ? `Prejdeme na ďalšiu sekciu: ${ATTRIBUTE_LABELS[nextAttribute]?.[lang]}. Môžeš mi povedať viac?`
              : `Moving to the next section: ${ATTRIBUTE_LABELS[nextAttribute]?.en}. Can you tell me more?`;
          }

          // Add to transcript
          fullTranscript.push({
            role: 'ai',
            text: nextQuestion,
            attribute: nextAttribute,
            timestamp: new Date().toISOString(),
          });

          // Update session state
          await supabase.from('cv_verifications').update({
            results,
            full_transcript: fullTranscript,
            session_state: {
              lang,
              current_attribute: nextAttribute,
              attribute_index: nextAttributeIndex,
              question_index: 0,
              attribute_history: attributeHistory,
            },
            updated_at: new Date().toISOString(),
          }).eq('id', sessionId);
        } else {
          // All attributes done
          sessionComplete = true;

          // Compute overall score
          const allScores = Object.values(results).map(r => r.score || 0);
          const overallScore = allScores.length > 0
            ? allScores.reduce((a, b) => a + b, 0) / allScores.length
            : 0;

          await supabase.from('cv_verifications').update({
            results,
            full_transcript: fullTranscript,
            status: 'completed',
            overall_score: overallScore,
            completed_at: new Date().toISOString(),
            session_state: {
              lang,
              current_attribute: null,
              attribute_index: nextAttributeIndex,
              question_index: 0,
              attribute_history: attributeHistory,
            },
            updated_at: new Date().toISOString(),
          }).eq('id', sessionId);

          // Post a system message to any active application conversations
          try {
            const completionMsg = lang === 'sk'
              ? '✅ Overenie profilu dokončené! Tvoj profil teraz obsahuje overené odznaky, ktoré uvidia zamestnávatelia.'
              : '✅ Profile verification complete! Your profile now has verified badges visible to employers.';

            const { data: apps } = await supabase
              .from('applications')
              .select('id')
              .eq('candidate_id', user.id)
              .in('status', ['Pending', 'Viewed', 'Interview']);

            for (const app of (apps || []).slice(0, 5)) {
              await supabase.from('application_messages').insert({
                application_id: app.id,
                sender_id: null,
                body: completionMsg,
                message_type: 'system',
                metadata: { type: 'verification_complete' },
              }).catch(() => {});
            }
          } catch (msgErr) {
            console.warn('[verify/complete] System message non-fatal:', msgErr.message);
          }
        }
      } else {
        // More questions in this attribute
        try {
          nextQuestion = await generateNextQuestion(
            aiProfile || {},
            currentAttribute,
            attributeHistory[currentAttribute],
            lang,
            questionIndex
          );
        } catch (aiErr) {
          console.error('[verify/turn] Next question AI error:', aiErr.message);
          nextQuestion = lang === 'sk'
            ? 'Môžeš mi povedať viac o tom?'
            : 'Can you tell me more about that?';
        }

        // Add to transcript
        fullTranscript.push({
          role: 'ai',
          text: nextQuestion,
          attribute: currentAttribute,
          timestamp: new Date().toISOString(),
        });

        // Update session state
        await supabase.from('cv_verifications').update({
          full_transcript: fullTranscript,
          session_state: {
            lang,
            current_attribute: currentAttribute,
            attribute_index: attributeIndex,
            question_index: questionIndex,
            attribute_history: attributeHistory,
          },
          updated_at: new Date().toISOString(),
        }).eq('id', sessionId);
      }

      res.json({
        transcribedAnswer: finalAnswer,
        nextQuestion,
        attribute: nextAttribute,
        attributeLabel: ATTRIBUTE_LABELS[nextAttribute],
        attributeIndex: nextAttributeIndex,
        totalAttributes: ATTRIBUTES.length,
        questionIndex: nextQuestionIndex,
        totalQuestions: QUESTIONS_PER_ATTRIBUTE,
        attributeComplete,
        sessionComplete,
        evaluation: attributeComplete ? evaluation : null,
      });
    } catch (err) {
      console.error('[verify/turn] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/verify/status ─────────────────────────────────────────────────
  app.get('/api/verify/status', async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const { data, error } = await supabase
        .from('cv_verifications')
        .select('id, status, results, overall_score, completed_at, created_at, session_state')
        .eq('user_id', user.id)
        .maybeSingle();

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

      // Verify employer has a job that this candidate applied to
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id')
        .eq('employer_id', user.id);

      const jobIds = (jobs || []).map(j => j.id);
      let isAuthorized = false;

      if (jobIds.length > 0) {
        const { data: app } = await supabase
          .from('applications')
          .select('id')
          .eq('candidate_id', candidateId)
          .in('job_id', jobIds)
          .limit(1)
          .maybeSingle();
        if (app) isAuthorized = true;
      }

      if (!isAuthorized) {
        const { data: directApp } = await supabase
          .from('applications')
          .select('id')
          .eq('candidate_id', candidateId)
          .eq('employer_id', user.id)
          .limit(1)
          .maybeSingle();
        if (directApp) isAuthorized = true;
      }

      if (!isAuthorized) {
        return res.status(403).json({ error: 'Unauthorized: candidate has not applied to your jobs' });
      }

      const { data, error } = await supabase
        .from('cv_verifications')
        .select('id, status, results, full_transcript, overall_score, completed_at, created_at')
        .eq('user_id', candidateId)
        .eq('status', 'completed')
        .maybeSingle();

      if (error) return res.status(500).json({ error: error.message });
      res.json({ verification: data || null });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
};
