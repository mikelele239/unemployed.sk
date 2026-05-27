import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Send, ShieldCheck, ChevronRight, Sparkles, Volume2 } from 'lucide-react';
import { startVerification, submitTurn, getVerificationStatus } from '../services/verificationService';
import { useTranslation } from '../I18nContext';

// ── Attribute config ──────────────────────────────────────────────────────────
const ATTRIBUTES = ['language', 'skills', 'experience', 'soft_skills'];

const ATTR_CONFIG = {
  language:    { icon: '🌍', color: '#3b82f6', sk: 'Jazykové znalosti', en: 'Language Skills' },
  skills:      { icon: '💻', color: '#8b5cf6', sk: 'Technické zručnosti', en: 'Technical Skills' },
  experience:  { icon: '💼', color: '#f59e0b', sk: 'Pracovné skúsenosti', en: 'Work Experience' },
  soft_skills: { icon: '🤝', color: '#22c55e', sk: 'Mäkké zručnosti', en: 'Soft Skills' },
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function ConsentModal({ lang, onAccept, onDecline }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        style={{
          background: 'var(--bg-card)', borderRadius: 28, padding: 32, maxWidth: 460, width: '100%',
          border: '1px solid var(--border)', boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 16,
            background: 'linear-gradient(135deg, var(--accent), #FF8C32)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldCheck size={24} color="#fff" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
              {lang === 'sk' ? 'Súhlas so spracovaním hlasu' : 'Voice Processing Consent'}
            </h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>GDPR · unemployed.sk</p>
          </div>
        </div>

        <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text-muted)', marginBottom: 24 }}>
          {lang === 'sk'
            ? 'Táto sekcia pohovoru umožňuje hlasové odpovede. Tvoje hlasové nahrávky budú prepísané a spracované AI systémom výhradne za účelom overenia tvojho profilu. Žiadne nahrávky nie sú ukladané po prepise.'
            : 'This interview section allows voice responses. Your voice recordings will be transcribed and processed by AI solely for the purpose of verifying your profile. No recordings are stored after transcription.'}
        </p>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onDecline}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 14,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-muted)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            {lang === 'sk' ? 'Len text' : 'Text only'}
          </button>
          <button
            onClick={onAccept}
            style={{
              flex: 2, padding: '12px 0', borderRadius: 14,
              border: 'none', background: 'linear-gradient(135deg, var(--accent), #FF8C32)',
              color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'var(--font-body)', boxShadow: '0 4px 16px rgba(255,92,0,0.3)',
            }}
          >
            {lang === 'sk' ? 'Súhlasím, pokračovať s hlasom' : 'I agree, continue with voice'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ProgressBar({ attributeIndex, questionIndex, totalAttributes, totalQuestions }) {
  const totalSteps = totalAttributes * totalQuestions;
  const currentStep = attributeIndex * totalQuestions + questionIndex;
  const pct = Math.round((currentStep / totalSteps) * 100);

  return (
    <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {ATTRIBUTES.map((attr, i) => {
            const cfg = ATTR_CONFIG[attr];
            const done = i < attributeIndex;
            const active = i === attributeIndex;
            return (
              <div
                key={attr}
                title={cfg.sk}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700,
                  background: done ? `${cfg.color}22` : active ? `${cfg.color}18` : 'var(--bg-card)',
                  border: `1px solid ${done || active ? cfg.color + '44' : 'var(--border)'}`,
                  color: done ? cfg.color : active ? cfg.color : 'var(--text-muted)',
                  transition: 'all 0.3s',
                }}
              >
                <span style={{ fontSize: 13 }}>{done ? '✓' : cfg.icon}</span>
                <span style={{ display: 'none' }}>{cfg.sk}</span>
              </div>
            );
          })}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{pct}%</span>
      </div>
      <div style={{ height: 4, background: 'var(--bg-card)', borderRadius: 2, overflow: 'hidden' }}>
        <motion.div
          style={{ height: '100%', background: 'linear-gradient(90deg, var(--accent), #FF8C32)', borderRadius: 2 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function AttributeTransition({ attribute, lang }) {
  const cfg = ATTR_CONFIG[attribute] || {};
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px', margin: '8px 0',
      }}
    >
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '10px 18px', borderRadius: 100,
        background: `${cfg.color}15`, border: `1px solid ${cfg.color}33`,
        fontSize: 13, fontWeight: 700, color: cfg.color,
      }}>
        <span style={{ fontSize: 16 }}>{cfg.icon}</span>
        {lang === 'sk' ? cfg.sk : cfg.en}
        <ChevronRight size={14} />
      </div>
    </motion.div>
  );
}

function CompletionScreen({ results, overallScore, lang }) {
  const pct = Math.round((overallScore || 0) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: 32, textAlign: 'center',
      }}
    >
      {/* Animated checkmark */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
        style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'linear-gradient(135deg, #22c55e, #16a34a)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20, boxShadow: '0 8px 32px rgba(34,197,94,0.4)',
        }}
      >
        <span style={{ fontSize: 36 }}>✓</span>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.5px' }}
      >
        {lang === 'sk' ? 'Overenie dokončené!' : 'Verification Complete!'}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 28 }}
      >
        {lang === 'sk'
          ? 'Tvoj profil je teraz overený. Zamestnávatelia uvidia overené odznaky.'
          : 'Your profile is now verified. Employers will see verified badges.'}
      </motion.p>

      {/* Overall score */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 20, padding: '20px 28px', marginBottom: 24, width: '100%', maxWidth: 320,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
          {lang === 'sk' ? 'Celkové skóre' : 'Overall Score'}
        </div>
        <div style={{ fontSize: 48, fontWeight: 800, color: pct >= 70 ? '#22c55e' : pct >= 45 ? '#f59e0b' : '#ef4444', lineHeight: 1 }}>
          {pct}%
        </div>
      </motion.div>

      {/* Per-attribute results */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        {ATTRIBUTES.map(attr => {
          const r = results?.[attr];
          if (!r) return null;
          const cfg = ATTR_CONFIG[attr];
          const scorePct = Math.round((r.score || 0) * 100);
          return (
            <div
              key={attr}
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 14, padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}
            >
              <span style={{ fontSize: 20 }}>{cfg.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                  {lang === 'sk' ? cfg.sk : cfg.en}
                </div>
                {r.level && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.level}</div>
                )}
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '3px 10px', borderRadius: 100,
                background: r.verified ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${r.verified ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.25)'}`,
                fontSize: 11, fontWeight: 800,
                color: r.verified ? '#22c55e' : '#ef4444',
              }}>
                {r.verified ? '✅' : '⚠️'}
                <span>{scorePct}%</span>
              </div>
            </div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function VerificationChat() {
  const { lang } = useTranslation();

  // Phase management
  const [phase, setPhase] = useState('loading'); // loading | consent | interview | complete | already_done | error
  const [errorMsg, setErrorMsg] = useState('');

  // Consent
  const [voiceAllowed, setVoiceAllowed] = useState(false);

  // Session state
  const [sessionId, setSessionId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentAttribute, setCurrentAttribute] = useState('language');
  const [attributeIndex, setAttributeIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions] = useState(3);
  const [messages, setMessages] = useState([]); // [{role:'ai'|'student', text, attribute}]

  // Results (accumulate as sections complete)
  const [results, setResults] = useState({});
  const [overallScore, setOverallScore] = useState(null);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  // Text input
  const [textInput, setTextInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Scroll
  const messagesEndRef = useRef(null);
  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  // ── Init: check existing verification status ───────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const { verification } = await getVerificationStatus();
        if (verification?.status === 'completed') {
          setResults(verification.results || {});
          setOverallScore(verification.overall_score || 0);
          setPhase('already_done');
        } else {
          setPhase('consent');
        }
      } catch (err) {
        console.error('[VerificationChat] Init error:', err);
        setPhase('consent'); // allow them to try anyway
      }
    };
    init();
  }, []);

  // ── Start interview after consent ──────────────────────────────────────────
  const handleStart = useCallback(async (withVoice) => {
    setVoiceAllowed(withVoice);
    setPhase('starting');
    try {
      const data = await startVerification(lang);
      setSessionId(data.sessionId);
      setCurrentQuestion(data.question);
      setCurrentAttribute(data.attribute || 'language');
      setAttributeIndex(data.attributeIndex || 0);
      setQuestionIndex(data.questionIndex || 0);
      setMessages([{ role: 'ai', text: data.question, attribute: data.attribute }]);
      setPhase('interview');
    } catch (err) {
      if (err.status === 409 && err.data?.verification) {
        // Already completed
        setResults(err.data.verification.results || {});
        setOverallScore(err.data.verification.overall_score || 0);
        setPhase('already_done');
      } else {
        setErrorMsg(err.message);
        setPhase('error');
      }
    }
  }, [lang]);

  // ── Submit answer (text or audio) ──────────────────────────────────────────
  const submitAnswer = useCallback(async ({ answer, audioBase64, audioMimeType }) => {
    if (isSending || !sessionId) return;
    setIsSending(true);

    // Optimistically add student bubble
    const displayText = answer || (lang === 'sk' ? '🎤 Hlasová odpoveď...' : '🎤 Voice response...');
    const studentMsg = { role: 'student', text: displayText, attribute: currentAttribute };
    setMessages(prev => [...prev, studentMsg]);
    setTextInput('');
    scrollToBottom();

    try {
      const resp = await submitTurn({ sessionId, answer, audioBase64, audioMimeType });

      // Update transcribed answer if it came from audio
      if (resp.transcribedAnswer && !answer) {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...studentMsg, text: resp.transcribedAnswer };
          return updated;
        });
      }

      // Accumulate evaluation result when an attribute section ends
      if (resp.attributeComplete && resp.evaluation) {
        setResults(prev => ({
          ...prev,
          [currentAttribute]: { ...resp.evaluation, transcript: [] },
        }));
      }

      if (resp.sessionComplete) {
        setOverallScore(
          Object.values({ ...results, [currentAttribute]: resp.evaluation }).reduce((acc, r) => acc + (r?.score || 0), 0) /
          ATTRIBUTES.length
        );
        setPhase('complete');
        return;
      }

      // Add AI's next question
      if (resp.nextQuestion) {
        // Show attribute transition if switching sections
        const sameAttribute = resp.attribute === currentAttribute;
        if (!sameAttribute) {
          setMessages(prev => [...prev, { role: 'transition', attribute: resp.attribute }]);
        }
        setMessages(prev => [...prev, { role: 'ai', text: resp.nextQuestion, attribute: resp.attribute }]);
        setCurrentQuestion(resp.nextQuestion);
        setCurrentAttribute(resp.attribute);
        setAttributeIndex(resp.attributeIndex);
        setQuestionIndex(resp.questionIndex);
      }
    } catch (err) {
      console.error('[VerificationChat] submitTurn error:', err);
      // Remove optimistic message
      setMessages(prev => prev.slice(0, -1));
      setErrorMsg(err.message);
    } finally {
      setIsSending(false);
      scrollToBottom();
    }
  }, [isSending, sessionId, currentAttribute, results, lang]);

  // ── Voice recording ────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (!voiceAllowed || isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result.split(',')[1];
          await submitAnswer({ audioBase64: base64, audioMimeType: 'audio/webm' });
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      // Timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(s => {
          if (s >= 59) { stopRecording(); return s; } // auto-stop at 60s
          return s + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Mic error:', err);
      setVoiceAllowed(false); // fall back to text
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (phase === 'loading' || phase === 'starting') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, color: 'var(--text-muted)' }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          border: '3px solid rgba(255,92,0,0.15)',
          borderTopColor: 'var(--accent)',
          animation: 'spin 1s linear infinite',
        }} />
        <p style={{ fontSize: 14, fontWeight: 600 }}>
          {phase === 'starting'
            ? (lang === 'sk' ? 'Pripravujem pohovor...' : 'Preparing interview...')
            : (lang === 'sk' ? 'Načítavam...' : 'Loading...')}
        </p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 32, textAlign: 'center' }}>
        <span style={{ fontSize: 48 }}>⚠️</span>
        <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
          {lang === 'sk' ? 'Nastala chyba' : 'Something went wrong'}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{errorMsg}</p>
        <button
          onClick={() => setPhase('consent')}
          style={{
            padding: '12px 24px', borderRadius: 14, border: 'none',
            background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {lang === 'sk' ? 'Skúsiť znova' : 'Try again'}
        </button>
      </div>
    );
  }

  if (phase === 'complete') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <CompletionScreen results={results} overallScore={overallScore} lang={lang} />
      </div>
    );
  }

  if (phase === 'already_done') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#22c55e' }}>
            <span>✅</span>
            {lang === 'sk' ? 'Overenie dokončené' : 'Verification complete'}
          </div>
        </div>
        <CompletionScreen results={results} overallScore={overallScore} lang={lang} />
      </div>
    );
  }

  // Consent screen
  if (phase === 'consent') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: 32 }}
        >
          <div style={{
            width: 72, height: 72, borderRadius: 24, margin: '0 auto 20px',
            background: 'linear-gradient(135deg, var(--accent), #FF8C32)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 12px 40px rgba(255,92,0,0.35)',
          }}>
            <Sparkles size={36} color="#fff" />
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 10px', letterSpacing: '-0.5px' }}>
            {lang === 'sk' ? 'Overte si profil' : 'Verify Your Profile'}
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 380, margin: '0 auto' }}>
            {lang === 'sk'
              ? 'Absolvujte krátky 2-3 minútový AI pohovor. Overené odznaky zvýšia dôveryhodnosť vášho profilu u zamestnávateľov.'
              : 'Complete a short 2-3 minute AI interview. Verified badges boost your profile credibility with employers.'}
          </p>
        </motion.div>

        {/* Attribute cards */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 32 }}
        >
          {ATTRIBUTES.map(attr => {
            const cfg = ATTR_CONFIG[attr];
            return (
              <div
                key={attr}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 100,
                  background: `${cfg.color}12`, border: `1px solid ${cfg.color}30`,
                  fontSize: 12, fontWeight: 700, color: cfg.color,
                }}
              >
                {cfg.icon} {lang === 'sk' ? cfg.sk : cfg.en}
              </div>
            );
          })}
        </motion.div>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 340 }}
        >
          <button
            onClick={() => handleStart(true)}
            style={{
              padding: '16px', borderRadius: 16, border: 'none',
              background: 'linear-gradient(135deg, var(--accent), #FF8C32)',
              color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 8px 24px rgba(255,92,0,0.3)',
              fontFamily: 'var(--font-body)',
            }}
          >
            <Mic size={18} />
            {lang === 'sk' ? 'Začať s hlasom' : 'Start with Voice'}
          </button>
          <button
            onClick={() => handleStart(false)}
            style={{
              padding: '14px', borderRadius: 16,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            {lang === 'sk' ? 'Pokračovať len s textom' : 'Continue with text only'}
          </button>
        </motion.div>

        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 20, maxWidth: 320 }}>
          {lang === 'sk'
            ? 'Jedno pokus. Pohovor nie je možné opakovať. Odpovedaj úprimne.'
            : 'One attempt only. The interview cannot be repeated. Answer honestly.'}
        </p>
      </div>
    );
  }

  // ── Interview phase ──────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
      {/* Progress Bar */}
      <ProgressBar
        attributeIndex={attributeIndex}
        questionIndex={questionIndex}
        totalAttributes={ATTRIBUTES.length}
        totalQuestions={totalQuestions}
      />

      {/* Current section label */}
      {(() => {
        const cfg = ATTR_CONFIG[currentAttribute];
        return (
          <div style={{
            padding: '8px 20px',
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: 700, color: cfg?.color,
            textTransform: 'uppercase', letterSpacing: '0.5px',
            borderBottom: '1px solid var(--border)',
            background: `${cfg?.color}08`,
          }}>
            <span>{cfg?.icon}</span>
            {lang === 'sk' ? cfg?.sk : cfg?.en}
            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
              — {lang === 'sk' ? `Otázka ${questionIndex + 1} z ${totalQuestions}` : `Question ${questionIndex + 1} of ${totalQuestions}`}
            </span>
          </div>
        );
      })()}

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '20px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <AnimatePresence>
          {messages.map((msg, i) => {
            if (msg.role === 'transition') {
              return (
                <motion.div key={`trans-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <AttributeTransition attribute={msg.attribute} lang={lang} />
                </motion.div>
              );
            }

            const isAI = msg.role === 'ai';
            const cfg = ATTR_CONFIG[msg.attribute];

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', justifyContent: isAI ? 'flex-start' : 'flex-end' }}
              >
                <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', alignItems: isAI ? 'flex-start' : 'flex-end' }}>
                  {isAI && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: cfg?.color || 'var(--accent)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Sparkles size={10} />
                      unemployed.sk AI
                    </div>
                  )}
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: isAI ? '4px 20px 20px 20px' : '20px 20px 4px 20px',
                    background: isAI
                      ? 'var(--bg-card)'
                      : 'linear-gradient(135deg, var(--accent) 0%, #FF8C32 100%)',
                    color: isAI ? 'var(--text)' : '#fff',
                    border: isAI ? '1px solid var(--border)' : 'none',
                    fontSize: 14, lineHeight: 1.55, fontWeight: 500,
                    boxShadow: isAI ? '0 2px 8px rgba(0,0,0,0.04)' : '0 4px 16px rgba(255,92,0,0.2)',
                  }}>
                    {msg.text}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Typing indicator while waiting */}
        {isSending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{
              padding: '12px 18px', borderRadius: '4px 20px 20px 20px',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              display: 'flex', gap: 4, alignItems: 'center',
            }}>
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }}
                />
              ))}
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{
        padding: '14px 16px',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg)',
        display: 'flex', gap: 8, alignItems: 'flex-end',
      }}>
        {/* Text input */}
        <textarea
          value={textInput}
          onChange={e => setTextInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (textInput.trim() && !isSending && !isRecording) {
                submitAnswer({ answer: textInput.trim() });
              }
            }
          }}
          placeholder={lang === 'sk' ? 'Napíš svoju odpoveď...' : 'Type your answer...'}
          disabled={isSending || isRecording}
          rows={2}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 14,
            border: '1px solid var(--border)', background: 'var(--bg-card)',
            color: 'var(--text)', fontSize: 14, fontWeight: 500,
            outline: 'none', resize: 'none', lineHeight: 1.45,
            fontFamily: 'var(--font-body)',
            opacity: isRecording ? 0.5 : 1,
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--accent)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
        />

        {/* Voice button (push-to-talk) */}
        {voiceAllowed && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            disabled={isSending}
            title={lang === 'sk' ? 'Drž pre nahrávanie' : 'Hold to record'}
            style={{
              width: 48, height: 48, borderRadius: 14, border: 'none',
              background: isRecording
                ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                : 'linear-gradient(135deg, var(--accent), #FF8C32)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
              boxShadow: isRecording
                ? '0 0 0 4px rgba(239,68,68,0.25)'
                : '0 4px 12px rgba(255,92,0,0.25)',
              transition: 'all 0.2s',
            }}
          >
            {isRecording
              ? <><MicOff size={18} />{recordingSeconds > 0 && <span style={{ fontSize: 9, position: 'absolute', bottom: 4 }}>{recordingSeconds}s</span>}</>
              : <Mic size={18} />
            }
          </motion.button>
        )}

        {/* Send text button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            if (textInput.trim() && !isSending && !isRecording) {
              submitAnswer({ answer: textInput.trim() });
            }
          }}
          disabled={!textInput.trim() || isSending || isRecording}
          style={{
            width: 48, height: 48, borderRadius: 14, border: 'none',
            background: textInput.trim() && !isSending
              ? 'linear-gradient(135deg, var(--accent), #FF8C32)'
              : 'var(--bg-card)',
            color: textInput.trim() && !isSending ? '#fff' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: textInput.trim() && !isSending ? 'pointer' : 'default',
            flexShrink: 0,
            border: textInput.trim() && !isSending ? 'none' : '1px solid var(--border)',
            transition: 'all 0.2s',
          }}
        >
          <Send size={18} />
        </motion.button>
      </div>

      {/* Recording status banner */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{
              background: 'rgba(239,68,68,0.08)', borderTop: '1px solid rgba(239,68,68,0.2)',
              padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }}
            />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>
              {lang === 'sk' ? `Nahrávam... ${recordingSeconds}s (max 60s)` : `Recording... ${recordingSeconds}s (max 60s)`}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {lang === 'sk' ? 'Uvoľni pre odoslanie' : 'Release to send'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
