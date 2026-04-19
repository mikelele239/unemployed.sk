import React, { useState, useEffect } from 'react';
import { useI18n, useAppState } from '../contexts';
import { AI_MATCHES } from '../mockData';
import CandidateCard from '../components/CandidateCard';
import MatchCard from '../components/MatchCard';
import Toast from '../components/Toast';
import { motion, AnimatePresence } from 'framer-motion';

const Candidates = () => {
  const { t } = useI18n();
  const { invitedIds, setInvitedIds, acceptedIds, setAcceptedIds, companyProfile } = useAppState();
  
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [skippedMatches, setSkippedMatches] = useState([]);

  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        const companyName = companyProfile?.name || 'Compx';
        const res = await fetch(`/api/applications?company=${encodeURIComponent(companyName)}`);
        const data = await res.json();
        setCandidates(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCandidates();
  }, [companyProfile]);

  const handleInvite = (id) => {
    if (!invitedIds.includes(id)) {
      setInvitedIds([...invitedIds, id]);
      setToastMsg(t('toastInvite'));
      setShowToast(true);
    }
  };

  const handleAcceptMatch = (id) => {
    if (!acceptedIds.includes(id)) {
      setAcceptedIds([...acceptedIds, id]);
      setToastMsg(t('toastMatch'));
      setShowToast(true);
    }
  };

  const handleSkipMatch = (id) => {
    setSkippedMatches([...skippedMatches, id]);
  };

  const filteredCandidates = candidates.filter(c => 
    !invitedIds.includes(c.id) && (
      c.student_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (c.student_profile?.field || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.student_profile?.school || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const visibleMatches = AI_MATCHES.filter(m => !skippedMatches.includes(m.id) && !acceptedIds.includes(m.id));

  return (
    <div style={{ animation: 'tabSlideIn 0.3s cubic-bezier(0.4, 0, 0.15, 1)' }}>
      {/* Candidates Header */}
      <div style={{ padding: '16px 18px 10px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700' }}>{t('candTitle')}</h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('candSub')}</p>
      </div>

      {/* Search Input */}
      <div style={{ 
        margin: '0 18px 12px', display: 'flex', alignItems: 'center', gap: '6px', 
        padding: '9px 12px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--border)' 
      }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px', color: 'var(--text-muted)', flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
        </svg>
        <input 
          type="text" 
          placeholder={t('candSearch')} 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, border: 'none', background: 'none', fontSize: '13px', fontFamily: 'var(--font-body)', outline: 'none', color: 'var(--text)' }}
        />
      </div>

      {/* Candidates List */}
      <div style={{ padding: '0 18px' }}>
        <AnimatePresence mode="popLayout">
          {filteredCandidates.length === 0 ? (
            <motion.div 
              key="empty-candidates"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}
            >
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🕵️</div>
              <p style={{ fontSize: '13px' }}>{t('noResults')}</p>
            </motion.div>
          ) : (
            filteredCandidates.map(c => (
              <motion.div
                key={c.id}
                layout="position"
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              >
                <CandidateCard 
                  candidate={c} 
                  isInvited={invitedIds.includes(c.id)} 
                  onInvite={handleInvite} 
                />
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* AI Matches Header */}
      <div style={{ padding: '16px 18px 10px', marginTop: '8px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700' }}>{t('matchTitle')}</h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('matchSub')}</p>
      </div>

      {/* AI Matches List */}
      <div style={{ padding: '0 18px' }}>
        <AnimatePresence mode="popLayout">
          {visibleMatches.map(m => (
            <motion.div
              key={m.id}
              layout="position"
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            >
              <MatchCard 
                match={m} 
                isAccepted={acceptedIds.includes(m.id)} 
                onAccept={handleAcceptMatch} 
                onSkip={handleSkipMatch} 
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Toast message={toastMsg} show={showToast} onHide={() => setShowToast(false)} />
    </div>
  );
};

export default Candidates;
