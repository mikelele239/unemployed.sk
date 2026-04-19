import React, { useState } from 'react';
import { useI18n, useAppState } from '../contexts';
import { CANDIDATES, AI_MATCHES } from '../mockData';
import CandidateCard from '../components/CandidateCard';
import MatchCard from '../components/MatchCard';
import Toast from '../components/Toast';

const Candidates = () => {
  const { t } = useI18n();
  const { invitedIds, setInvitedIds, acceptedIds, setAcceptedIds } = useAppState();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [skippedMatches, setSkippedMatches] = useState([]);

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

  const filteredCandidates = CANDIDATES.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.field.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.school.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const visibleMatches = AI_MATCHES.filter(m => !skippedMatches.includes(m.id));

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
        {filteredCandidates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🕵️</div>
            <p style={{ fontSize: '13px' }}>{t('noResults')}</p>
          </div>
        ) : (
          filteredCandidates.map(c => (
            <CandidateCard 
              key={c.id} 
              candidate={c} 
              isInvited={invitedIds.includes(c.id)} 
              onInvite={handleInvite} 
            />
          ))
        )}
      </div>

      {/* AI Matches Header */}
      <div style={{ padding: '16px 18px 10px', marginTop: '8px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700' }}>{t('matchTitle')}</h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('matchSub')}</p>
      </div>

      {/* AI Matches List */}
      <div style={{ padding: '0 18px' }}>
        {visibleMatches.map(m => (
          <MatchCard 
            key={m.id} 
            match={m} 
            isAccepted={acceptedIds.includes(m.id)} 
            onAccept={handleAcceptMatch} 
            onSkip={handleSkipMatch} 
          />
        ))}
      </div>

      <Toast message={toastMsg} show={showToast} onHide={() => setShowToast(false)} />
    </div>
  );
};

export default Candidates;
