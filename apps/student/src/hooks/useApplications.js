import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export function useApplications() {
  const storageKey = 'unemployed_apps';

  const [applications, setApplications] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey)) || []; }
    catch { return []; }
  });

  // Helper to get auth token
  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  // ── Add application (swipe right or click Apply) ──────────────────────────
  const addApplication = async (job) => {
    // Optimistic local update first
    setApplications(prev => {
      if (prev.find(a => a.id === job.id)) return prev;
      const next = [{ ...job, status: 'Pending', timestamp: new Date().toISOString() }, ...prev];
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });

    // Sync via server API (bypasses RLS)
    try {
      const token = await getToken();
      if (!token) return;

      // Get full profile info for application
      let studentName = '';
      let studentProfile = {};
      try {
        const profRes = await fetch('/api/student/profile', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (profRes.ok) {
          const { profile } = await profRes.json();
          if (profile) {
            studentName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
            studentProfile = {
              first_name: profile.first_name || '',
              last_name: profile.last_name || '',
              education: profile.education || '',
              location: profile.location || '',
              skills: profile.skills || [],
              cv_id: profile.cv_id || null,
              original_filename: profile.original_filename || null,
              school: profile.education || '',
            };
          }
        }
      } catch {}

      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          job_id: job.id,
          student_name: studentName || undefined,
          student_profile: studentProfile,
          ai_score: 50,
          ai_reasoning: 'Submitted via Unemployed.sk',
        })
      });

      if (!res.ok && res.status !== 409) {
        const err = await res.json();
        console.error('[useApplications] Server error:', err);
      }
    } catch (err) {
      console.error('[useApplications] Sync error:', err);
    }
  };

  // ── Fetch applications from server API ──────────────────────────────────
  const fetchApplications = async () => {
    try {
      const token = await getToken();
      if (!token) {
        try { setApplications(JSON.parse(localStorage.getItem(storageKey)) || []); } catch {}
        return;
      }

      const res = await fetch('/api/applications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to fetch applications');

      const { applications: data } = await res.json();

      // Flatten: merge job fields into application for UI compatibility
      const enriched = (data || []).map(app => ({
        ...app.job,
        ...app,
        id: app.job_id,
        appId: app.id,
        status: app.status || 'Pending',
      }));

      setApplications(enriched);
      try { localStorage.setItem(storageKey, JSON.stringify(enriched)); } catch {}
    } catch (err) {
      console.error('[useApplications] Fetch error:', err);
      try { setApplications(JSON.parse(localStorage.getItem(storageKey)) || []); } catch {}
    }
  };

  // ── Update application status (decline) ──────────────────────────────────
  const updateStatus = async (appId, status) => {
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`/api/applications/${appId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (!res.ok) throw new Error('Failed to update status');

      setApplications(prev => prev.map(a => a.appId === appId ? { ...a, status } : a));
    } catch (err) {
      console.error('[useApplications] Status update error:', err);
    }
  };

  useEffect(() => { fetchApplications(); }, []);

  const hasApplied = (jobId) => !!applications.find(a => a.id === jobId || a.job_id === jobId);

  return { applications, addApplication, hasApplied, fetchApplications, updateStatus };
}
