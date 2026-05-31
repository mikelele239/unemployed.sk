import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Send, ShieldCheck, ChevronRight, Sparkles, Volume2, Upload, CheckCircle2, Bot } from 'lucide-react';
import { startVerification, submitTurn, getVerificationStatus, continueVerification } from '../services/verificationService';
import { useTranslation } from '../I18nContext';
import { supabase } from '../supabase';

// ── Attribute config ──────────────────────────────────────────────────────────
const ATTRIBUTES = ['language', 'skills', 'experience', 'soft_skills'];

const ATTR_CONFIG = {
  language:    { icon: '🌍', color: 'var(--color-info)', sk: 'Jazykové znalosti', en: 'Language Skills' },
  skills:      { icon: '💻', color: 'var(--color-premium)', sk: 'Technické zručnosti', en: 'Technical Skills' },
  experience:  { icon: '💼', color: 'var(--color-warning)', sk: 'Pracovné skúsenosti', en: 'Work Experience' },
  soft_skills: { icon: '🤝', color: 'var(--color-success)', sk: 'Mäkké zručnosti',    en: 'Soft Skills' },
  collect:     { icon: '📋', color: '#a78bfa', sk: 'Zber informácií',     en: 'Profile Collection' },
};

const COLLECT_STEP_LABELS = [
  { sk: 'Celé meno',        en: 'Full name' },
  { sk: 'Telefón',          en: 'Phone' },
  { sk: 'Lokalita',         en: 'Location' },
  { sk: 'Štátna príslušnosť', en: 'Nationality' },
  { sk: 'Vzdelanie',        en: 'Education' },
  { sk: 'Pracovné skúsenosti', en: 'Work experience' },
  { sk: 'Mimoškolské aktivity', en: 'Extracurricular' },
  { sk: 'Osobnostné zručnosti', en: 'Soft skills' },
  { sk: 'Technické zručnosti', en: 'Technical skills' },
  { sk: 'Jazyky',           en: 'Languages' },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function CollectProgressBar({ step, total, lang }) {
  const pct = Math.round((step / total) * 100);
  const label = COLLECT_STEP_LABELS[step] || COLLECT_STEP_LABELS[total - 1];
  return (
    <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: 5 }}>
          📋 {lang === 'sk' ? 'Vytvárame tvoj profil' : 'Building your profile'}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
          {lang === 'sk' ? label?.sk : label?.en} · {pct}%
        </span>
      </div>
      <div style={{ height: 4, background: 'var(--bg-card)', borderRadius: 2, overflow: 'hidden' }}>
        <motion.div
          style={{ height: '100%', background: 'linear-gradient(90deg, #a78bfa, #7c3aed)', borderRadius: 2 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function ConsentModal({ lang, onAccept, onDecline }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'var(--overlay-modal)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        style={{
          background: 'var(--bg-card)', borderRadius: 28, padding: 32, maxWidth: 460, width: '100%',
          border: '1px solid var(--border)', boxShadow: '0 32px 80px var(--overlay-dark)',
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
              fontFamily: 'var(--font-body)', boxShadow: '0 4px 16px var(--shadow-accent)',
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
  const { lang } = useTranslation();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const totalSteps = totalAttributes * totalQuestions;
  const currentStep = attributeIndex * totalQuestions + questionIndex;

  const stepWeight = 100 / (totalAttributes - 1);
  const progressInStep = (questionIndex / totalQuestions) * stepWeight;
  const fillPct = Math.min(100, Math.round(attributeIndex * stepWeight + progressInStep));

  const STEP_LABELS = [
    {
      sk: { title: 'Jazyky', desc: 'Úroveň komunikácie' },
      en: { title: 'Languages', desc: 'Communication' }
    },
    {
      sk: { title: 'Zručnosti', desc: 'Odborné vedomosti' },
      en: { title: 'Skills', desc: 'Technical knowledge' }
    },
    {
      sk: { title: 'Prax', desc: 'História práce' },
      en: { title: 'Experience', desc: 'Work history' }
    },
    {
      sk: { title: 'Osobnosť', desc: 'Tímový prístup' },
      en: { title: 'Personality', desc: 'Team attitude' }
    }
  ];

  return (
    <div style={{ 
      padding: isMobile ? '8px 12px' : '20px 16px 18px', 
      borderBottom: '1px solid var(--border)', 
      background: 'var(--bg)', 
      display: 'flex', 
      flexDirection: 'column', 
      gap: isMobile ? 6 : 12 
    }}>
      <div style={{ position: 'relative', width: '100%', padding: '0 8px' }}>
        {/* Background Track Line */}
        <div style={{
          position: 'absolute',
          top: '15px',
          left: '44px',
          right: '44px',
          height: '3px',
          background: 'var(--border)',
          borderRadius: 2,
          zIndex: 0
        }}>
          {/* Active Fill Line */}
          <motion.div
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, var(--accent), #FF8C32)',
              borderRadius: 2,
            }}
            animate={{ width: `${fillPct}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        {/* Stepper Nodes */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1
        }}>
          {ATTRIBUTES.map((attr, i) => {
            const done = i < attributeIndex;
            const active = i === attributeIndex;
            const labelCfg = STEP_LABELS[i] || { sk: { title: '', desc: '' }, en: { title: '', desc: '' } };
            
            return (
              <div 
                key={attr} 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  width: 72
                }}
              >
                {/* Node Circle */}
                <motion.div
                  animate={{
                    scale: active ? 1.1 : 1,
                    borderColor: done ? 'var(--color-success)' : active ? 'var(--accent)' : 'var(--border)',
                    backgroundColor: done ? 'var(--color-success)' : 'var(--bg-card)'
                  }}
                  transition={{ duration: 0.3 }}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    border: '2px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2,
                    position: 'relative'
                  }}
                >
                  {active ? (
                    <div style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      border: '2px solid var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent)',
                      fontSize: 11,
                      fontWeight: 900,
                      background: 'var(--accent-light)'
                    }}>
                      {i + 1}
                    </div>
                  ) : done ? (
                    <CheckCircle2 size={12} color="#fff" style={{ strokeWidth: 3 }} />
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                      {i + 1}
                    </span>
                  )}
                </motion.div>

                {/* Step Label & Description */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  marginTop: isMobile ? 4 : 8,
                  textAlign: 'center',
                  width: '100%'
                }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: done ? 'var(--color-success)' : active ? 'var(--accent)' : 'var(--text-muted)',
                    transition: 'all 0.3s',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4
                  }}>
                    <span style={{ fontSize: 12 }}>{ATTR_CONFIG[attr].icon}</span>
                    <span>{lang === 'sk' ? labelCfg.sk.title : labelCfg.en.title}</span>
                  </span>
                  {!isMobile && (
                    <span style={{
                      fontSize: 8.5,
                      fontWeight: 500,
                      color: 'var(--text-muted)',
                      marginTop: 2,
                      whiteSpace: 'nowrap',
                      opacity: 0.8
                    }}>
                      {lang === 'sk' ? labelCfg.sk.desc : labelCfg.en.desc}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
      {/* Animated checkmark — matches Onboarding.jsx platform style */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
        style={{
          width: 72, height: 72, borderRadius: 24,
          background: 'linear-gradient(135deg, var(--color-success), var(--color-success))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20, boxShadow: '0 12px 40px var(--color-success-bg)',
        }}
      >
        <CheckCircle2 size={36} color="#fff" />
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

      {/* Per-attribute results */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        {ATTRIBUTES.map(attr => {
          const r = results?.[attr];
          if (!r) return null;
          const cfg = ATTR_CONFIG[attr];
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
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 100,
                background: r.verified ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
                border: `1px solid ${r.verified ? 'var(--color-success-bg)' : 'var(--color-error-bg)'}`,
                fontSize: 11, fontWeight: 800,
                color: r.verified ? 'var(--color-success)' : 'var(--color-error)',
              }}>
                {r.verified ? (
                  <>
                    <CheckCircle2 size={13} style={{ color: 'var(--color-success)' }} />
                    <span>{lang === 'sk' ? 'Overené' : 'Verified'}</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 12 }}>⚠️</span>
                    <span>{lang === 'sk' ? 'Neoverené' : 'Unverified'}</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function VerificationChat({ onComplete, startCvInterview }) {
  const { lang } = useTranslation();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Phase management
  const [phase, setPhase] = useState('loading'); // loading | consent | no_cv | interview | complete | already_done | error | session_expired
  const [errorMsg, setErrorMsg] = useState('');

  // Consent
  const [voiceAllowed, setVoiceAllowed] = useState(false);
  const [voiceOnlyMode, setVoiceOnlyMode] = useState(false);

  // Session state
  const [sessionId, setSessionId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentAttribute, setCurrentAttribute] = useState('language');
  const [attributeIndex, setAttributeIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions] = useState(3);
  const [messages, setMessages] = useState([]);
  const [sessionMode, setSessionMode] = useState('interview'); // 'collect' | 'interview'
  const [collectStep, setCollectStep] = useState(0);
  const [collectTotal] = useState(10); // [{role:'ai'|'student', text, attribute}]

  // Results (accumulate as sections complete)
  const [results, setResults] = useState({});
  const [overallScore, setOverallScore] = useState(null);

  // Upload/CV
  const [uploadState, setUploadState] = useState('idle');
  const [uploadError, setUploadError] = useState('');
  const [cvConfirmed, setCvConfirmed] = useState(false);
  const [pendingFirstQuestion, setPendingFirstQuestion] = useState('');
  const [cvText, setCvText] = useState('');
  const [cvPath, setCvPath] = useState(null);
  const [cvOriginalFilename, setCvOriginalFilename] = useState('');
  const [cvUrl, setCvUrl] = useState(null);
  const [showNewCvUploader, setShowNewCvUploader] = useState(false);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  // Text input
  const [textInput, setTextInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [pasteWarning, setPasteWarning] = useState(false);

  // CV upload dropzone refs
  const [isDragOver, setIsDragOver] = useState(false);
  const cvFileInputRef = useRef(null);

  // Scroll
  const messagesEndRef = useRef(null);
  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const [isResuming, setIsResuming] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        if (startCvInterview) {
          setPhase('interview');
          setMessages([{
            role: 'ai',
            isCvInterviewStartPrompt: true,
            text: lang === 'sk'
              ? 'Chceš začať krátky rozhovor pre vytvorenie tvojho životopisu?'
              : 'Would you like to start a short interview to generate your CV?'
          }]);
        } else {
          const { verification } = await getVerificationStatus();
          if (verification?.status === 'completed') {
            setResults(verification.results || {});
            setOverallScore(verification.overall_score || 0);
            setPhase('already_done');
          } else if (verification?.status === 'in_progress') {
            setIsResuming(true);
            setPhase('consent');
          } else {
            setPhase('consent');
          }
        }

        // Also fetch active CV from profile so we can show PDF preview
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('cv_id, original_filename')
            .eq('user_id', session.user.id)
            .maybeSingle();
          if (profile?.cv_id) {
            setCvPath(profile.cv_id);
            setCvOriginalFilename(profile.original_filename || profile.cv_id.split('/').pop().replace(/^\d+_/,''));
            const { data, error } = await supabase.storage
              .from('cvs')
              .createSignedUrl(profile.cv_id, 3600);
            if (!error && data?.signedUrl) {
              setCvUrl(data.signedUrl);
            }
          }
        }
      } catch (err) {
        console.error('[VerificationChat] Init error:', err);
        if (!startCvInterview) {
          setPhase('consent');
        }
      }
    };
    init();
  }, [startCvInterview, lang]);

  const handleFileUpload = async (file) => {
      if (!file) return;

      // Quick check if the file name matches exactly
      if (cvOriginalFilename && file.name === cvOriginalFilename) {
        alert(lang === 'sk' ? 'Tento životopis už máš nahraný.' : 'You already have this CV uploaded.');
        setUploadState('done');
        // Continue with the existing CV interview flow
        setTimeout(() => handleStart(voiceAllowed, false), 1200);
        return;
      }

      const ok = file.type === 'application/pdf'
        || file.name.endsWith('.pdf')
        || file.name.endsWith('.docx')
        || file.name.endsWith('.doc');
      if (!ok) {
        setUploadError(lang === 'sk' ? 'Iba PDF alebo DOCX súbory sú povolené.' : 'Only PDF or DOCX files are allowed.');
        return;
      }
      setUploadState('uploading');
      setUploadError('');
      try {
        // Get session — try refresh if expired
        let { data: { session: authSession } } = await supabase.auth.getSession();
        if (!authSession?.access_token) {
          const { data: refreshData } = await supabase.auth.refreshSession();
          authSession = refreshData?.session;
        }
        if (!authSession?.access_token) {
          setUploadState('error');
          setUploadError(lang === 'sk' ? 'Relácia vypršala. Obnov stránku a prihlás sa znova.' : 'Session expired. Please reload and log in again.');
          return;
        }
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/cvs/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${authSession.access_token}` },
          body: fd,
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.error || `Upload failed (${res.status})`);
        }
        
        // Refresh CV URL and path after upload
        const result = await res.json();
        if (result.cv?.id) {
          setCvPath(result.cv.id);
          const { data, error } = await supabase.storage
            .from('cvs')
            .createSignedUrl(result.cv.id, 3600);
          if (!error && data?.signedUrl) {
            setCvUrl(data.signedUrl);
          }
        }
        
        setUploadState('done');
        // Small delay so user sees success, then auto-start interview
        setTimeout(() => handleStart(voiceAllowed, false), 1200);
      } catch (e) {
        setUploadError(e.message);
        setUploadState('error');
      }
    };

  // ── Start interview after consent ──────────────────────────────────────────
  const handleStart = useCallback(async (withVoice, collectMode = false, isVoiceOnly = false) => {
    console.log('[VerificationChat] handleStart called', { withVoice, collectMode, isVoiceOnly, lang });
    setVoiceAllowed(withVoice);
    setVoiceOnlyMode(isVoiceOnly);
    setPhase('starting');
    try {
      // ── Ensure we have a valid session before hitting any API ────────────────
      const { data: { session: currentSession }, error: sessionErr } = await supabase.auth.getSession();
      console.log('[VerificationChat] session check', { hasToken: !!currentSession?.access_token, sessionErr });
      if (sessionErr || !currentSession?.access_token) {
        // Try a refresh once before giving up
        const { error: refreshErr } = await supabase.auth.refreshSession();
        if (refreshErr) {
          console.error('[VerificationChat] session refresh failed', refreshErr);
          setPhase('session_expired');
          return;
        }
      }

      const data = await startVerification(lang, collectMode);
      console.log('[VerificationChat] startVerification response:', JSON.stringify(data, null, 2));

      // ── Server says no CV found — show inline chat upload prompt ─────────────────────────────
      if (data.noCv) {
        console.log('[VerificationChat] No CV detected → showing in-chat upload prompt');
        setMessages([{
          role: 'ai',
          isNoCvIntro: true,
          text: lang === 'sk'
            ? 'Nenašiel sa žiadny životopis. Môžeš ho nahrať pre overenie, alebo ak žiadny nemáš, poďme spraviť rýchly rozhovor a ja ti ho vytvorím.'
            : 'No CV found. Can you upload it for the interview to be carried out? If you don\'t have one, let\'s do a quick interview and I will make one for you based on the format stated before.'
        }]);
        setPhase('interview');
        return;
      }

      setSessionId(data.sessionId);
      if (data.cvPath) {
        setCvPath(data.cvPath);
        setCvOriginalFilename(data.originalFilename || data.cvPath.split('/').pop().replace(/^\d+_/,''));
        try {
          const { data: signedData, error } = await supabase.storage
            .from('cvs')
            .createSignedUrl(data.cvPath, 3600);
          if (!error && signedData?.signedUrl) {
            setCvUrl(signedData.signedUrl);
          }
        } catch (e) {
          console.warn('[VerificationChat] error generating signed URL in handleStart:', e);
        }
      }
      setCurrentQuestion(data.question);
      setCurrentAttribute(data.attribute || 'language');
      setAttributeIndex(data.attributeIndex || 0);
      setQuestionIndex(data.questionIndex || 0);
      setSessionMode(data.mode || 'interview');
      if (data.mode === 'collect') setCollectStep(0);

      // ── Resume: rebuild messages from saved transcript ───────────────────
      if (data.resumed && data.transcript?.length > 0) {
        const restored = data.transcript.map(t => ({
          role: t.role === 'ai' ? 'ai' : 'student',
          text: t.text,
          attribute: t.attribute,
          isCvGenerated: t.isCvGenerated,
          cvUrl: t.cvUrl,
          cvPath: t.cvPath,
          showContinueButton: t.isCvGenerated && (data.mode === 'collect'),
        }));
        setMessages(restored);
        if (data.results) setResults(data.results);
        console.log('[VerificationChat] Resumed session, restored', restored.length, 'messages');
      } else {
        // If collectMode is true, go straight to questions. Otherwise, show CV exists intro.
        if (data.mode === 'collect') {
          setMessages([{ role: 'ai', text: data.question, attribute: data.attribute }]);
        } else {
          setPendingFirstQuestion(data.question);
          setCvText(data.cvText || '');
          setMessages([{
            role: 'ai',
            isCvIntro: true,
            cvText: data.cvText || '',
            text: lang === 'sk'
              ? 'Budem s tebou viesť rozhovor na základe tvojho životopisu. Ak je toto tvoj aktuálny životopis, poďme pokračovať!'
              : 'I will conduct an interview with you based on your CV. If this is your current up-to-date CV, let\'s continue!'
          }]);
          setCvConfirmed(false);
          setShowNewCvUploader(false);
        }
      }

      console.log('[VerificationChat] → interview phase, mode:', data.mode);
      setPhase('interview');
    } catch (err) {
      console.error('[VerificationChat] handleStart error:', err);
      if (err.status === 409 && err.data?.verification) {
        setResults(err.data.verification.results || {});
        setOverallScore(err.data.verification.overall_score || 0);
        setPhase('already_done');
      } else if (err.message?.includes('401') || err.message?.includes('Unauthorized') || err.message?.includes('Not authenticated')) {
        setPhase('session_expired');
      } else {
        setErrorMsg(err.message);
        setPhase('error');
      }
    }
  }, [lang]);

  const handleContinueToVerification = useCallback(async () => {
    setIsSending(true);
    try {
      const resp = await continueVerification();
      
      // Hide the continue button on the previous CV generated message
      setMessages(prev => prev.map(m => m.isCvGenerated ? { ...m, showContinueButton: false } : m));

      // Update session mode
      if (resp.modeTransition === 'interview') {
        setSessionMode('interview');
      }

      // Add transition message
      if (resp.transitionMessage) {
        setMessages(prev => [...prev, { role: 'ai', text: resp.transitionMessage, attribute: 'transition' }]);
      }

      // Add AI's first verification question
      if (resp.nextQuestion) {
        setMessages(prev => [...prev, { role: 'ai', text: resp.nextQuestion, attribute: resp.attribute }]);
        setCurrentQuestion(resp.nextQuestion);
        setCurrentAttribute(resp.attribute);
        setAttributeIndex(resp.attributeIndex);
        setQuestionIndex(resp.questionIndex);
      }
    } catch (err) {
      console.error('[VerificationChat] continueVerification error:', err);
      alert(err.message);
    } finally {
      setIsSending(false);
      setTimeout(scrollToBottom, 50);
    }
  }, [lang]);

  const handleConfirmCv = useCallback(() => {
    setCvConfirmed(true);
    const confirmMsg = {
      role: 'student',
      text: lang === 'sk' ? 'Pokračovať' : 'Continue',
      attribute: currentAttribute
    };
    setMessages(prev => [...prev, confirmMsg]);
    
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'ai',
        text: pendingFirstQuestion,
        attribute: currentAttribute
      }]);
      scrollToBottom();
    }, 400);
  }, [lang, currentAttribute, pendingFirstQuestion]);

  // ── Submit answer (text or audio) ──────────────────────────────────────────
  const submitAnswer = useCallback(async ({ answer, audioBase64, audioMimeType }) => {
    if (isSending || !sessionId) return;
    setIsSending(true);

    // Optimistically add student bubble
    const isVoice = !!audioBase64 && !answer;
    const displayText = answer || '';
    const studentMsg = { role: 'student', text: displayText, attribute: currentAttribute, isAudioPending: isVoice };
    setMessages(prev => [...prev, studentMsg]);
    setTextInput('');
    scrollToBottom();

    try {
      const resp = await submitTurn({ sessionId, answer, audioBase64, audioMimeType });

      // Update transcribed answer if it came from audio
      if (resp.transcribedAnswer && isVoice) {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...studentMsg, text: resp.transcribedAnswer, isAudioPending: false };
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

      // CV generated → show custom CV download card and continue button
      if (resp.cvGenerated) {
        setMessages(prev => [...prev, {
          role: 'ai',
          isCvGenerated: true,
          cvUrl: resp.cvUrl,
          cvPath: resp.cvPath,
          text: lang === 'sk'
            ? '✨ Skvelé! Tvoj životopis bol úspešne vygenerovaný a uložený do tvojho profilu. Môžeš si ho stiahnuť nižšie.'
            : '✨ Great! Your CV has been successfully generated and saved to your profile. You can download it below.',
          showContinueButton: true
        }]);
        setIsSending(false);
        setTimeout(scrollToBottom, 50);
        return;
      }

      // CV generated → show transition banner
      if (resp.modeTransition === 'interview') {
        setSessionMode('interview');
        if (resp.transitionMessage) {
          setMessages(prev => [...prev, { role: 'ai', text: resp.transitionMessage, attribute: 'transition' }]);
        }
      }

      // Update collect progress
      if (resp.collectProgress) {
        setCollectStep(resp.collectProgress.step);
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

  // ── Voice recording (toggle: tap to start, tap to stop) ─────────────────────
  const streamRef = useRef(null);

  const stopRecording = useCallback(() => {
    clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    // Stop mic tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
  }, []);

  const startRecording = useCallback(async () => {
    if (!voiceAllowed) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      // Pick the first supported audio format
      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4',
      ].find(t => MediaRecorder.isTypeSupported(t)) || '';

      const mrOptions = mimeType ? { mimeType } : {};
      const mr = new MediaRecorder(stream, mrOptions);
      const actualMime = mr.mimeType || mimeType || 'audio/webm';
      console.log('[Voice] MediaRecorder created, mime:', actualMime);

      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        console.log('[Voice] Recording stopped, chunks:', audioChunksRef.current.length);
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;

        if (audioChunksRef.current.length === 0) {
          console.warn('[Voice] No audio chunks recorded');
          return;
        }

        const blob = new Blob(audioChunksRef.current, { type: actualMime });
        console.log('[Voice] Blob size:', blob.size, 'bytes');

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1];
          if (base64) {
            console.log('[Voice] Submitting audio, base64 length:', base64.length);
            submitAnswer({ audioBase64: base64, audioMimeType: actualMime });
          }
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorderRef.current = mr;
      mr.start(250); // collect data every 250ms
      setIsRecording(true);
      setRecordingSeconds(0);

      // Timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(s => {
          if (s >= 59) {
            stopRecording();
            return s;
          }
          return s + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('[Voice] Mic error:', err);
      alert(err.name === 'NotAllowedError'
        ? (lang === 'sk' ? 'Prístup k mikrofónu bol zamietnutý. Skontroluj nastavenia prehliadača.' : 'Microphone access was denied. Please check your browser settings.')
        : (lang === 'sk' ? 'Mikrofón nie je dostupný.' : 'Microphone not available.')
      );
      setVoiceAllowed(false);
    }
  }, [voiceAllowed, lang, submitAnswer, stopRecording]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

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

  const isIntroPending = (messages.length > 0 && (
    (messages[messages.length - 1].isCvIntro && !cvConfirmed) ||
    (messages[messages.length - 1].isNoCvIntro && uploadState !== 'done') ||
    messages[messages.length - 1].isCvInterviewStartPrompt
  ));

  if (phase === 'session_expired') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center', gap: 16 }}>
        <span style={{ fontSize: 48 }}>🔒</span>
        <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
          {lang === 'sk' ? 'Relácia vypršala' : 'Session expired'}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 300, margin: 0 }}>
          {lang === 'sk'
            ? 'Tvoja relaciá vypršala. Obnov stránku a prihlás sa znova.'
            : 'Your session has expired. Please reload the page and log in again.'}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '12px 28px', borderRadius: 14, border: 'none',
            background: 'linear-gradient(135deg, var(--accent), #FF8C32)',
            color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >
          {lang === 'sk' ? 'Obnoviť stránku' : 'Reload page'}
        </button>
      </div>
    );
  }

  if (phase === 'loading' || phase === 'starting') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, color: 'var(--text-muted)' }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          border: '3px solid var(--accent-light)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--color-success)' }}>
            <span>✅</span>
            {lang === 'sk' ? 'Overenie dokončené' : 'Verification complete'}
          </div>
        </div>
        <CompletionScreen results={results} overallScore={overallScore} lang={lang} />
      </div>
    );
  }

  // ── No CV Upload/Create screen ─────────────────────────────────────────────
  if (phase === 'no_cv') {
    const isUploading = uploadState === 'uploading';
    const isDone = uploadState === 'done';

    const onDragOver = (e) => {
      e.preventDefault();
      setIsDragOver(true);
    };

    const onDragLeave = () => {
      setIsDragOver(false);
    };

    const onDrop = (e) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        handleFileUpload(file);
      }
    };

    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: 32, textAlign: 'center',
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: 24, maxWidth: 420 }}
        >
          <div style={{
            width: 64, height: 64, borderRadius: 20, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, var(--accent), #FF8C32)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px var(--shadow-accent)',
          }}>
            <Upload size={28} color="#fff" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.5px' }}>
            {lang === 'sk' ? 'Potrebujeme tvoj životopis' : 'We need your CV'}
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {lang === 'sk'
              ? 'Na začatie AI overenia potrebuješ mať nahratý životopis. Nahraj ho nižšie alebo si vytvor nový profil pomocou konverzácie.'
              : 'To start the AI verification, you need to have a CV uploaded. Upload it below or create a new profile through conversation.'}
          </p>
        </motion.div>

        {/* Dropzone */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          style={{
            width: '100%', maxWidth: 400,
            border: `2px dashed ${isDragOver ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 20,
            padding: '40px 24px',
            background: isDragOver ? 'var(--accent-lighter)' : 'var(--bg-card)',
            cursor: 'pointer',
            position: 'relative',
            transition: 'all 0.25s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}
          onClick={() => cvFileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={cvFileInputRef}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
            accept=".pdf,.docx,.doc"
            style={{ display: 'none' }}
          />

          {isUploading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                border: '3px solid var(--accent-light)',
                borderTopColor: 'var(--accent)',
                animation: 'spin 1s linear infinite',
              }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                {lang === 'sk' ? 'Nahrávam životopis...' : 'Uploading CV...'}
              </span>
            </div>
          ) : isDone ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--color-success)' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 16,
                background: 'linear-gradient(135deg, var(--color-success), var(--color-success))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 24px var(--color-success-bg)',
              }}>
                <CheckCircle2 size={24} color="#fff" />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                {lang === 'sk' ? 'Úspešne nahraté!' : 'Upload successful!'}
              </span>
            </div>
          ) : (
            <>
              <Upload size={32} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
              <span style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                {lang === 'sk' ? 'Presuň súbor sem' : 'Drag & drop file here'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                {lang === 'sk' ? 'alebo klikni pre výber (PDF, DOCX)' : 'or click to browse (PDF, DOCX)'}
              </span>
            </>
          )}

          {uploadError && (
            <div style={{ color: 'var(--color-error)', fontSize: 12, marginTop: 12, fontWeight: 600 }}>
              ⚠️ {uploadError}
            </div>
          )}
        </motion.div>

        {/* Collect Mode CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0', color: 'var(--text-muted)' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {lang === 'sk' ? 'alebo' : 'or'}
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <button
            onClick={() => handleStart(voiceAllowed, true)}
            style={{
              padding: '16px', borderRadius: 16, border: 'none',
              background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
              color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 8px 24px rgba(124,58,237,0.25)',
              fontFamily: 'var(--font-body)',
              transition: 'all 0.2s',
            }}
          >
            📋 {lang === 'sk' ? 'Vytvoriť profil rozhovorom' : 'Create profile via conversation'}
          </button>
        </motion.div>
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
            width: 80, height: 80, borderRadius: '50%', margin: '0 auto 20px',
            background: 'linear-gradient(135deg, #1A1A24 0%, #0D0D12 100%)',
            border: '3px solid var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(255, 92, 0, 0.35)',
            position: 'relative'
          }}>
            <Bot size={40} style={{ color: 'var(--accent)' }} />
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 10px', letterSpacing: '-0.5px' }}>
            {isResuming
              ? (lang === 'sk' ? 'Pokračovať v overovaní' : 'Continue Verification')
              : (lang === 'sk' ? 'Overte si profil' : 'Verify Your Profile')}
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 380, margin: '0 auto' }}>
            {isResuming
              ? (lang === 'sk'
                ? 'Máte rozrobené overovanie. Pokračujte tam, kde ste prestali.'
                : 'You have an interview in progress. Pick up where you left off.')
              : (lang === 'sk'
                ? 'Absolvujte krátky 2-3 minútový AI pohovor. Overené odznaky zvýšia dôveryhodnosť vášho profilu u zamestnávateľov.'
                : 'Complete a short 2-3 minute AI interview. Verified badges boost your profile credibility with employers.')}
          </p>

          {!isResuming && (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              style={{
                marginTop: 18,
                padding: '8px 18px',
                borderRadius: '100px',
                background: 'var(--color-success-bg)',
                border: '1px solid var(--color-success-border)',
                color: 'var(--color-success)',
                fontSize: 12,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 4px 12px rgba(31, 173, 84, 0.06)'
              }}
            >
              🚀 <span>{lang === 'sk' ? 'Až o 70% vyššia šanca na získanie pohovoru!' : 'Up to 70% higher chance of getting interviews!'}</span>
            </motion.div>
          )}
        </motion.div>

        {/* Attribute cards */}
        {/* Stepper Progress Bar Preview */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          style={{
            width: '100%',
            maxWidth: 580,
            padding: '28px 24px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 24,
            marginBottom: 32,
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.06)',
            position: 'relative'
          }}
        >
          <div style={{ position: 'relative', width: '100%', padding: '0 8px' }}>
            {/* Background Track Line */}
            <div style={{
              position: 'absolute',
              top: '15px',
              left: '44px',
              right: '44px',
              height: '3px',
              background: 'var(--border)',
              borderRadius: 2,
              zIndex: 0
            }}>
              {/* Active Fill Line - 0% fill for starting status */}
              <div
                style={{
                  height: '100%',
                  width: '0%',
                  background: 'linear-gradient(90deg, var(--accent), #FF8C32)',
                  borderRadius: 2,
                }}
              />
            </div>

            {/* Stepper Nodes */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'relative',
              zIndex: 1
            }}>
              {ATTRIBUTES.map((attr, i) => {
                const active = i === 0; // First step is active when previewing before start
                const done = false;
                const cfg = ATTR_CONFIG[attr];
                
                const STEP_LABELS = [
                  {
                    sk: { title: 'Jazyky', desc: 'Úroveň komunikácie' },
                    en: { title: 'Languages', desc: 'Communication' }
                  },
                  {
                    sk: { title: 'Zručnosti', desc: 'Odborné vedomosti' },
                    en: { title: 'Skills', desc: 'Technical knowledge' }
                  },
                  {
                    sk: { title: 'Prax', desc: 'História práce' },
                    en: { title: 'Experience', desc: 'Work history' }
                  },
                  {
                    sk: { title: 'Osobnosť', desc: 'Tímový prístup' },
                    en: { title: 'Personality', desc: 'Team attitude' }
                  }
                ];
                const labelCfg = STEP_LABELS[i];

                return (
                  <div 
                    key={attr} 
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center',
                      width: 72
                    }}
                  >
                    {/* Node Circle */}
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                        backgroundColor: 'var(--bg-card)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2,
                        position: 'relative'
                      }}
                    >
                      {active ? (
                        <div style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          border: '2px solid var(--accent)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--accent)',
                          fontSize: 11,
                          fontWeight: 900,
                          background: 'var(--accent-light)'
                        }}>
                          {i + 1}
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                          {i + 1}
                        </span>
                      )}
                    </div>

                    {/* Step Label & Description */}
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      marginTop: 8,
                      textAlign: 'center',
                      width: '100%'
                    }}>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: active ? 'var(--accent)' : 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4
                      }}>
                        <span style={{ fontSize: 12 }}>{cfg.icon}</span>
                        <span>{lang === 'sk' ? labelCfg.sk.title : labelCfg.en.title}</span>
                      </span>
                      <span style={{
                        fontSize: 8.5,
                        fontWeight: 500,
                        color: 'var(--text-muted)',
                        marginTop: 2,
                        whiteSpace: 'nowrap',
                        opacity: 0.8
                      }}>
                        {lang === 'sk' ? labelCfg.sk.desc : labelCfg.en.desc}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 340 }}
        >
          <button
            onClick={() => handleStart(true, false, true)}
            style={{
              padding: '16px', borderRadius: 16, border: 'none',
              background: 'linear-gradient(135deg, var(--accent), #FF8C32)',
              color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 8px 24px var(--shadow-accent)',
              fontFamily: 'var(--font-body)',
            }}
          >
            <Mic size={18} />
            {isResuming
              ? (lang === 'sk' ? 'Pokračovať s hlasom (odporúčané)' : 'Continue with Voice (recommended)')
              : (lang === 'sk' ? 'Začať s hlasom (odporúčané)' : 'Start with Voice (recommended)')}
          </button>
          <button
            onClick={() => handleStart(true, false, false)}
            style={{
              padding: '14px', borderRadius: 16,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            {isResuming
              ? (lang === 'sk' ? 'Pokračovať s textom' : 'Continue with Text')
              : (lang === 'sk' ? 'Pokračovať s textom' : 'Continue with Text')}
          </button>
        </motion.div>

        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 20, maxWidth: 360, lineHeight: 1.5 }}>
          {lang === 'sk'
            ? 'Iba jeden pokus. Pohovor nie je možné opakovať. Odpovedajte úprimne a nepoužívajte cudziu pomoc ani AI.'
            : 'Only one attempt. The interview cannot be repeated. Answer honestly and do not use external help or AI.'}
        </p>
      </div>
    );
  }

  // ── Interview phase ──────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%', position: 'relative' }}>
      {/* Progress Bar — collect or interview */}
      {sessionMode === 'collect' ? (
        <CollectProgressBar step={collectStep} total={collectTotal} lang={lang} />
      ) : (
        <ProgressBar
          attributeIndex={attributeIndex}
          questionIndex={questionIndex}
          totalAttributes={ATTRIBUTES.length}
          totalQuestions={totalQuestions}
        />
      )}

      {/* Current section label */}
      {(() => {
        const cfg = ATTR_CONFIG[sessionMode === 'collect' ? 'collect' : currentAttribute];
        const label = sessionMode === 'collect'
          ? (lang === 'sk' ? 'Zber informácií pre CV' : 'Collecting CV information')
          : (lang === 'sk' ? cfg?.sk : cfg?.en);
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
            {label}
            {sessionMode === 'interview' && (
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                — {lang === 'sk' ? `Otázka ${questionIndex + 1} z ${totalQuestions}` : `Question ${questionIndex + 1} of ${totalQuestions}`}
              </span>
            )}
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
                      <Bot size={10} />
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
                    boxShadow: isAI ? '0 2px 8px rgba(0,0,0,0.04)' : '0 4px 16px var(--shadow-accent)',
                  }}>
                    {msg.isAudioPending ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
                        <Mic size={14} style={{ opacity: 0.8, flexShrink: 0 }} />
                        {/* Audio waveform transcription animation */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                          {[...Array(8)].map((_, j) => (
                            <motion.div
                              key={j}
                              animate={{ height: [4, 12 + Math.random() * 8, 4, 10 + Math.random() * 6, 4] }}
                              transition={{ duration: 0.7 + Math.random() * 0.3, repeat: Infinity, repeatType: 'reverse', delay: j * 0.06 }}
                              style={{ width: 3, borderRadius: 2, background: 'rgba(255,255,255,0.7)' }}
                            />
                          ))}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.8, whiteSpace: 'nowrap' }}>
                          {lang === 'sk' ? 'Prepisujem...' : 'Transcribing...'}
                        </span>
                      </div>
                    ) : msg.isCvIntro ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>{msg.text}</div>
                        {cvUrl ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                            <div style={{ 
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '10px 14px', background: 'var(--bg-card-hover)', borderRadius: 12,
                              border: '1px solid var(--border)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                <span style={{ fontSize: 20 }}>📄</span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {cvPath ? cvPath.split('/').pop().replace(/^\d+_/,'') : (lang === 'sk' ? 'Môj životopis' : 'My CV')}
                                </span>
                              </div>
                              <button
                                onClick={() => window.open(cvUrl, '_blank')}
                                style={{
                                  padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
                                  background: 'transparent', color: 'var(--accent)', fontSize: 11,
                                  fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                                  transition: 'all 0.2s'
                                }}
                              >
                                {lang === 'sk' ? 'Otvoriť' : 'Open'} ↗
                              </button>
                            </div>
                            
                            <div style={{ 
                              width: '100%', height: isMobile ? '160px' : '300px', borderRadius: 12, overflow: 'hidden', 
                              border: '1px solid var(--border)', background: '#fff', position: 'relative'
                            }}>
                              <iframe 
                                src={`${cvUrl}#toolbar=0&navpanes=0`} 
                                style={{ width: '100%', height: '100%', border: 'none' }}
                                title="CV Preview"
                              />
                            </div>
                          </div>
                        ) : (
                          msg.cvText && (
                            <div style={{
                              maxHeight: 160,
                              overflowY: 'auto',
                              padding: '10px 14px',
                              background: 'var(--bg)',
                              borderRadius: 12,
                              border: '1px solid var(--border)',
                              fontFamily: 'var(--font-body)',
                              fontSize: 12,
                              whiteSpace: 'pre-wrap',
                              textAlign: 'left',
                              color: 'var(--text-muted)',
                              lineHeight: 1.5
                            }}>
                              {msg.cvText}
                            </div>
                          )
                        )}
                        {i === messages.length - 1 && !cvConfirmed && (
                          showNewCvUploader ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {/* Compact Upload Box */}
                              <div 
                                onClick={() => uploadState !== 'uploading' && uploadState !== 'done' && cvFileInputRef.current?.click()}
                                style={{
                                  border: '1px dashed var(--border)',
                                  borderRadius: 12,
                                  padding: '18px 14px',
                                  background: 'var(--bg)',
                                  textAlign: 'center',
                                  cursor: uploadState === 'uploading' || uploadState === 'done' ? 'default' : 'pointer',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: 6,
                                  transition: 'all 0.2s',
                                }}
                              >
                                <input
                                  type="file"
                                  ref={cvFileInputRef}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileUpload(file);
                                  }}
                                  accept=".pdf,.docx,.doc"
                                  style={{ display: 'none' }}
                                />
                                {uploadState === 'uploading' ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{
                                      width: 16, height: 16, borderRadius: '50%',
                                      border: '2px solid var(--accent-light)',
                                      borderTopColor: 'var(--accent)',
                                      animation: 'spin 1s linear infinite',
                                    }} />
                                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                      {lang === 'sk' ? 'Nahrávam...' : 'Uploading...'}
                                    </span>
                                  </div>
                                ) : uploadState === 'done' ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-success)', fontSize: 12, fontWeight: 700 }}>
                                    <CheckCircle2 size={14} />
                                    <span>{lang === 'sk' ? 'Úspešne nahraté!' : 'Upload successful!'}</span>
                                  </div>
                                ) : (
                                  <>
                                    <Upload size={18} style={{ color: 'var(--text-muted)' }} />
                                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                                      {lang === 'sk' ? 'Klikni pre výber životopisu (PDF, DOCX)' : 'Click to select CV file (PDF, DOCX)'}
                                    </span>
                                  </>
                                )}
                                {uploadError && (
                                  <div style={{ color: 'var(--color-error)', fontSize: 11, fontWeight: 600 }}>
                                    ⚠️ {uploadError}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => setShowNewCvUploader(false)}
                                style={{
                                  padding: '8px 12px',
                                  borderRadius: 10,
                                  border: '1px solid var(--border)',
                                  background: 'transparent',
                                  color: 'var(--text-muted)',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  fontFamily: 'var(--font-body)',
                                }}
                              >
                                {lang === 'sk' ? 'Zrušiť' : 'Cancel'}
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 6 : 8 }}>
                              <button
                                onClick={handleConfirmCv}
                                style={{
                                  alignSelf: 'stretch',
                                  padding: isMobile ? '10px 12px' : '12px 18px',
                                  borderRadius: 14,
                                  border: 'none',
                                  background: 'linear-gradient(135deg, var(--accent), #FF8C32)',
                                  color: '#fff',
                                  fontSize: 13,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  marginTop: 4,
                                  boxShadow: '0 4px 12px var(--shadow-accent)',
                                  fontFamily: 'var(--font-body)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6
                                }}
                              >
                                {lang === 'sk' ? 'Pokračovať s týmto životopisom →' : 'Continue with this CV →'}
                              </button>
                              <button
                                onClick={() => setShowNewCvUploader(true)}
                                style={{
                                  alignSelf: 'stretch',
                                  padding: isMobile ? '8px 12px' : '10px 18px',
                                  borderRadius: 14,
                                  border: '1px solid var(--border)',
                                  background: 'transparent',
                                  color: 'var(--text)',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  fontFamily: 'var(--font-body)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6
                                }}
                              >
                                📤 {lang === 'sk' ? 'Nahrať novší životopis' : 'Upload newer CV'}
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    ) : msg.isCvGenerated ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', minWidth: 260, alignItems: 'center' }}>
                        <div style={{ alignSelf: 'flex-start' }}>{msg.text}</div>
                        
                        {/* CV Preview & Download Card */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '14px 16px',
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          borderRadius: 16,
                          width: '100%',
                          justifyContent: 'space-between'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 24 }}>📄</span>
                            <div style={{ textAlign: 'left' }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                                {lang === 'sk' ? 'Tvoj životopis.pdf' : 'Your CV.pdf'}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {lang === 'sk' ? 'PDF formát' : 'PDF format'}
                              </div>
                            </div>
                          </div>
                          <a 
                            href={msg.cvUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{
                              padding: '8px 14px',
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border)',
                              borderRadius: 10,
                              color: 'var(--text)',
                              fontSize: 12,
                              fontWeight: 700,
                              textDecoration: 'none',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                            onMouseOut={e => e.currentTarget.style.background = 'var(--bg-card)'}
                          >
                            {lang === 'sk' ? 'Stiahnuť' : 'Download'}
                          </a>
                        </div>

                        {/* Continue Button */}
                        {msg.showContinueButton && (
                          <button
                            onClick={handleContinueToVerification}
                            disabled={isSending}
                            style={{
                              marginTop: 8,
                              width: '100%',
                              padding: '14px 20px',
                              borderRadius: 14,
                              border: 'none',
                              background: 'linear-gradient(135deg, var(--accent), #FF8C32)',
                              color: '#fff',
                              fontSize: 13,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              boxShadow: '0 4px 12px var(--shadow-accent)',
                              fontFamily: 'var(--font-body)',
                            }}
                          >
                            <span>🚀</span>
                            {lang === 'sk' ? 'Pokračovať na overovací pohovor' : 'Continue to verification interview'}
                          </button>
                        )}
                      </div>
                    ) : msg.isCvInterviewStartPrompt ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', minWidth: 260 }}>
                        <div>{msg.text}</div>
                        {i === messages.length - 1 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                            <button
                              onClick={() => handleStart(true, true, true)}
                              style={{
                                padding: '12px 18px',
                                borderRadius: 14,
                                border: 'none',
                                background: 'linear-gradient(135deg, var(--accent), #FF8C32)',
                                color: '#fff',
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                boxShadow: '0 4px 12px var(--shadow-accent)',
                                fontFamily: 'var(--font-body)',
                              }}
                            >
                              <Mic size={16} />
                              {lang === 'sk' ? 'Začať s hlasom (odporúčané)' : 'Start with Voice (recommended)'}
                            </button>
                            <button
                              onClick={() => handleStart(true, true, false)}
                              style={{
                                padding: '12px 18px',
                                borderRadius: 14,
                                border: '1px solid var(--border)',
                                background: 'transparent',
                                color: 'var(--text)',
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                fontFamily: 'var(--font-body)',
                              }}
                            >
                              {lang === 'sk' ? 'Začať s textom' : 'Start with Text'}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : msg.isNoCvIntro ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', minWidth: 260 }}>
                        <div>{msg.text}</div>
                        
                        {/* Compact Upload Box */}
                        <div 
                          onClick={() => uploadState !== 'uploading' && uploadState !== 'done' && cvFileInputRef.current?.click()}
                          style={{
                            border: '1px dashed var(--border)',
                            borderRadius: 12,
                            padding: '18px 14px',
                            background: 'var(--bg)',
                            textAlign: 'center',
                            cursor: uploadState === 'uploading' || uploadState === 'done' ? 'default' : 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 6,
                            transition: 'all 0.2s',
                          }}
                        >
                          <input
                            type="file"
                            ref={cvFileInputRef}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(file);
                            }}
                            accept=".pdf,.docx,.doc"
                            style={{ display: 'none' }}
                          />
                          {uploadState === 'uploading' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{
                                width: 16, height: 16, borderRadius: '50%',
                                border: '2px solid var(--accent-light)',
                                borderTopColor: 'var(--accent)',
                                animation: 'spin 1s linear infinite',
                              }} />
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {lang === 'sk' ? 'Nahrávam...' : 'Uploading...'}
                              </span>
                            </div>
                          ) : uploadState === 'done' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-success)', fontSize: 12, fontWeight: 700 }}>
                              <CheckCircle2 size={14} />
                              <span>{lang === 'sk' ? 'Úspešne nahraté!' : 'Upload successful!'}</span>
                            </div>
                          ) : (
                            <>
                              <Upload size={18} style={{ color: 'var(--text-muted)' }} />
                              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                                {lang === 'sk' ? 'Klikni pre výber životopisu (PDF, DOCX)' : 'Click to select CV file (PDF, DOCX)'}
                              </span>
                            </>
                          )}
                          {uploadError && (
                            <div style={{ color: 'var(--color-error)', fontSize: 11, fontWeight: 600 }}>
                              ⚠️ {uploadError}
                            </div>
                          )}
                        </div>

                        {/* Quick Interview Option */}
                        {(uploadState !== 'uploading' && uploadState !== 'done' && i === messages.length - 1) && (
                          <button
                            onClick={() => handleStart(voiceAllowed, true)}
                            style={{
                              padding: '12px 18px',
                              borderRadius: 14,
                              border: 'none',
                              background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
                              color: '#fff',
                              fontSize: 13,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              boxShadow: '0 4px 12px rgba(124,58,237,0.15)',
                              fontFamily: 'var(--font-body)',
                            }}
                          >
                            <span>📋</span>
                            {lang === 'sk' ? 'Pokračovať (Rýchly rozhovor)' : 'Continue (Quick Interview)'}
                          </button>
                        )}
                      </div>
                    ) : (
                      msg.text
                    )}
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

      {/* ── Recording overlay — covers bottom portion, question stays visible ── */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              height: '55%', minHeight: 220,
              zIndex: 50,
              borderRadius: '24px 24px 0 0',
              background: 'linear-gradient(180deg, rgba(255,92,0,0.97) 0%, rgba(255,120,40,0.95) 100%)',
              boxShadow: '0 -8px 40px rgba(255,92,0,0.3)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 16, padding: '24px 32px',
            }}
          >
            {/* Soundbar animation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 40 }}>
              {[...Array(16)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    height: [4 + Math.random() * 4, 14 + Math.random() * 26, 4 + Math.random() * 6, 18 + Math.random() * 22, 6 + Math.random() * 4],
                  }}
                  transition={{
                    duration: 0.7 + Math.random() * 0.4,
                    repeat: Infinity,
                    repeatType: 'reverse',
                    ease: 'easeInOut',
                    delay: i * 0.04,
                  }}
                  style={{
                    width: 3, borderRadius: 3,
                    background: 'rgba(255,255,255,0.8)',
                  }}
                />
              ))}
            </div>

            {/* Timer + label */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: '-1px', lineHeight: 1 }}>
                0:{recordingSeconds.toString().padStart(2, '0')}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                {lang === 'sk' ? 'Nahrávam odpoveď...' : 'Recording your answer...'}
              </div>
            </div>

            {/* Stop button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleRecording}
              style={{
                width: 60, height: 60, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.5)',
                background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', position: 'relative',
              }}
            >
              <motion.div
                animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0, 0.35] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{
                  position: 'absolute', inset: -6, borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.25)',
                }}
              />
              <div style={{ width: 18, height: 18, borderRadius: 3, background: '#fff' }} />
            </motion.button>

            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>
              {lang === 'sk' ? 'Klikni pre zastavenie a odoslanie' : 'Click to stop and send'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Anti-paste warning */}
      <AnimatePresence>
        {pasteWarning && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            style={{
              padding: '10px 16px',
              background: 'var(--color-error-bg)',
              borderTop: '1px solid var(--color-error-bg)',
              color: 'var(--color-error)',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>⚠️</span>
            {lang === 'sk'
              ? 'Vkladanie textu nie je povolené. Prosím, píšte odpovede vlastnými slovami.'
              : 'Pasting is not allowed. Please type your answers in your own words.'}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      {voiceOnlyMode ? (
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          flexDirection: 'column', gap: 10
        }}>
          {isIntroPending ? (
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
              {lang === 'sk' ? 'Dokončite výber vyššie' : 'Resolve the choices above'}
            </div>
          ) : (
            <>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={toggleRecording}
                disabled={isSending}
                style={{
                  width: '100%',
                  maxWidth: 320,
                  padding: '16px',
                  borderRadius: 16,
                  border: 'none',
                  background: 'linear-gradient(135deg, var(--accent), #FF8C32)',
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  boxShadow: '0 8px 24px var(--shadow-accent)',
                  fontFamily: 'var(--font-body)',
                  transition: 'all 0.2s',
                }}
              >
                <Mic size={20} />
                {lang === 'sk' ? 'Klikni a nahraj odpoveď' : 'Tap to record answer'}
              </motion.button>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {lang === 'sk' ? 'V tomto režime odpovedáš iba hlasom.' : 'In this mode, you answer using voice only.'}
              </div>
            </>
          )}
        </div>
      ) : (
        <div style={{
          padding: isMobile ? '8px 12px' : '14px 16px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg)',
          display: 'flex', gap: isMobile ? 6 : 8, alignItems: 'flex-end',
        }}>
          {/* Text input — paste blocked for anti-cheat */}
          <textarea
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (textInput.trim() && !isSending && !isRecording && !isIntroPending) {
                  submitAnswer({ answer: textInput.trim() });
                }
              }
            }}
            onPaste={e => {
              e.preventDefault();
              setPasteWarning(true);
              setTimeout(() => setPasteWarning(false), 3000);
            }}
            placeholder={lang === 'sk' ? 'Napíš svoju odpoveď...' : 'Type your answer...'}
            disabled={isSending || isRecording || isIntroPending}
            rows={isMobile ? 1 : 2}
            style={{
              flex: 1, padding: isMobile ? '8px 12px' : '10px 14px', borderRadius: 14,
              border: '1px solid var(--border)', background: 'var(--bg-card)',
              color: 'var(--text)', fontSize: 14, fontWeight: 500,
              outline: 'none', resize: 'none', lineHeight: 1.45,
              fontFamily: 'var(--font-body)',
              opacity: (isRecording || isIntroPending) ? 0.5 : 1,
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
          />

          {/* Voice toggle button (click to start/stop) */}
          {voiceAllowed && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleRecording}
              disabled={isSending || isIntroPending}
              title={lang === 'sk' ? 'Klikni pre nahrávanie' : 'Click to record'}
              style={{
                width: isMobile ? 40 : 48, height: isMobile ? 40 : 48, borderRadius: isMobile ? 12 : 14, border: 'none',
                background: 'linear-gradient(135deg, var(--accent), #FF8C32)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: isIntroPending ? 'default' : 'pointer', flexShrink: 0,
                boxShadow: '0 4px 12px var(--shadow-accent)',
                transition: 'all 0.2s',
                opacity: isIntroPending ? 0.5 : 1,
                pointerEvents: isIntroPending ? 'none' : 'auto',
              }}
            >
              <Mic size={isMobile ? 16 : 18} />
            </motion.button>
          )}

          {/* Send text button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (textInput.trim() && !isSending && !isRecording && !isIntroPending) {
                submitAnswer({ answer: textInput.trim() });
              }
            }}
            disabled={!textInput.trim() || isSending || isRecording || isIntroPending}
            style={{
              width: isMobile ? 40 : 48, height: isMobile ? 40 : 48, borderRadius: isMobile ? 12 : 14, border: 'none',
              background: textInput.trim() && !isSending && !isIntroPending
                ? 'linear-gradient(135deg, var(--accent), #FF8C32)'
                : 'var(--bg-card)',
              color: textInput.trim() && !isSending && !isIntroPending ? '#fff' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: textInput.trim() && !isSending && !isIntroPending ? 'pointer' : 'default',
              flexShrink: 0,
              border: textInput.trim() && !isSending && !isIntroPending ? 'none' : '1px solid var(--border)',
              transition: 'all 0.2s',
            }}
          >
            <Send size={isMobile ? 16 : 18} />
          </motion.button>
        </div>
      )}
    </div>
  );
}
