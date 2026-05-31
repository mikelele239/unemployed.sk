import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export function useApplications() {
  const storageKey = 'unemployed_apps';

  const [applications, setApplications] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey)) || []; }
    catch { return []; }
  });

  // ── Add application (swipe right or click Apply) ──────────────────────────
  const addApplication = async (job) => {
    // Optimistic local update first
    setApplications(prev => {
      if (prev.find(a => a.id === job.id || a.job_id === job.id)) return prev;
      const next = [{ ...job, status: 'Pending', timestamp: new Date().toISOString() }, ...prev];
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });

    // Sync directly to Supabase
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const uid = session.user.id;

      // Get student profile for the application
      let studentName = '';
      let studentProfile = {};
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, education, location, skills, cv_id, original_filename')
          .eq('user_id', uid)
          .maybeSingle();

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
      } catch {}

      const { data: newApp, error } = await supabase
        .from('applications')
        .insert({
          job_id: job.id,
          candidate_id: uid,
          student_name: studentName || session.user.email?.split('@')[0] || 'Kandidát',
          student_email: session.user.email || '',
          student_profile: studentProfile,
          status: 'Pending',
        })
        .select()
        .maybeSingle();

      if (error && error.code !== '23505') { // 23505 = unique violation (already applied)
        console.error('[useApplications] Insert error:', error);
      } else {
        // Notify employer about the new application (fire-and-forget)
        try {
          fetch('/api/notifications/application-received', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ job_id: job.id, job_title: job.title, application_id: newApp?.id }),
          }).catch(() => {}); // Non-blocking
        } catch {}
      }
    } catch (err) {
      console.error('[useApplications] Sync error:', err);
    }
  };

  // ── Fetch applications from Supabase ──────────────────────────────────────
  const fetchApplications = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        try { setApplications(JSON.parse(localStorage.getItem(storageKey)) || []); } catch {}
        return;
      }

      // Fetch applications with the associated job + employer data
      const { data: apps, error } = await supabase
        .from('applications')
        .select('*, jobs(*, employer:employer_id(name, logo_url))')
        .eq('candidate_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Generate a consistent color from company name
      const companyColor = (name) => {
        if (!name) return '#6366f1';
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        const h = Math.abs(hash) % 360;
        return `hsl(${h}, 65%, 45%)`;
      };

      // Flatten: merge job fields into application for UI compatibility
      const enriched = (apps || []).map(app => {
        const employer = app.jobs?.employer || {};
        const company = app.jobs?.company || employer.name || '';
        return {
          ...(app.jobs || {}),
          ...app,
          id: app.job_id,
          appId: app.id,
          status: app.status || 'Pending',
          job_title: app.jobs?.title || '',
          rateUnit: app.jobs?.rate_unit || '',
          startDate: app.jobs?.start_date || '',
          workModel: app.jobs?.work_model || '',
          company: company,
          logo_url: employer.logo_url || '',
          logo: (company || '?').charAt(0).toUpperCase(),
          color: companyColor(company),
          interviewInfo: {
            offered_dates: app.interview_dates || [],
            selected_date: app.selected_date || null,
            declined: app.status === 'Declined',
          },
        };
      });

      setApplications(enriched);
      try { localStorage.setItem(storageKey, JSON.stringify(enriched)); } catch {}
    } catch (err) {
      console.error('[useApplications] Fetch error:', err);
      try { setApplications(JSON.parse(localStorage.getItem(storageKey)) || []); } catch {}
    }
  };

  // ── Update application status (e.g. student declines interview) ───────────
  const updateStatus = async (appId, status, extras = {}) => {
    try {
      const { error } = await supabase
        .from('applications')
        .update({ status, ...extras })
        .eq('id', appId);

      if (error) throw error;

      setApplications(prev => prev.map(a => a.appId === appId ? { ...a, status, ...extras } : a));
    } catch (err) {
      console.error('[useApplications] Status update error:', err);
    }
  };

  useEffect(() => { fetchApplications(); }, []);

  const hasApplied = (jobId) => !!applications.find(a => a.id === jobId || a.job_id === jobId);

  return { applications, addApplication, hasApplied, fetchApplications, updateStatus };
}
