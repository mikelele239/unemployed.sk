import { supabase } from '../supabase';

/**
 * Start a new AI verification session.
 * @param {string} lang - 'sk' or 'en'
 * @returns {{ sessionId, attribute, attributeLabel, questionIndex, totalQuestions, question, ... }}
 */
export const startVerification = async (lang = 'sk') => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const res = await fetch('/api/verify/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ lang }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(err.error || 'Failed to start verification'), { status: res.status, data: err });
  }
  return res.json();
};

/**
 * Submit one answer turn (text or audio) and get the next question.
 * @param {{ sessionId: string, answer?: string, audioBase64?: string, audioMimeType?: string }}
 */
export const submitTurn = async ({ sessionId, answer, audioBase64, audioMimeType }) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const res = await fetch('/api/verify/turn', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ sessionId, answer, audioBase64, audioMimeType }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to submit answer');
  }
  return res.json();
};

/**
 * Get the current verification status for the authenticated student.
 * @returns {{ verification: null | { id, status, results, overall_score, completed_at } }}
 */
export const getVerificationStatus = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { verification: null };

  const res = await fetch('/api/verify/status', {
    headers: { 'Authorization': `Bearer ${session.access_token}` },
  });
  if (!res.ok) return { verification: null };
  return res.json();
};

/**
 * (Employer) Fetch a candidate's completed verification.
 * @param {string} candidateId
 */
export const getCandidateVerification = async (candidateId) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  const res = await fetch(`/api/employer/candidate/${candidateId}/verification`, {
    headers: { 'Authorization': `Bearer ${session.access_token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.verification || null;
};
