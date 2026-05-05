import { useState, useEffect } from 'react';

export function useApplications() {
  const storageKey = 'unemployed_apps';

  const [applications, setApplications] = useState(() => {
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  });

  const addApplication = async (job) => {
    // 1. Get student profile from localStorage
    const profile = JSON.parse(localStorage.getItem('unemployed_profile')) || { name: 'Anonym', email: 'unknown@example.com' };

    // 2. Call backend for real sync + AI screening — ONLY in live mode
    if (!demo) {
      try {
        await fetch('/api/applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId: job.id,
            studentName: profile.name,
            studentEmail: profile.email,
            studentProfile: profile
          })
        });
      } catch (err) {
        console.error('Failed to sync application:', err);
      }
    }

    // 3. Update local state for immediate UI feedback
    setApplications((prev) => {
      if (prev.find(a => a.id === job.id)) return prev;
      const newApps = [{ ...job, status: 'Pending', timestamp: new Date().toISOString() }, ...prev];
      localStorage.setItem(storageKey, JSON.stringify(newApps));
      return newApps;
    });
  };

  const fetchApplications = async () => {
    if (demo) {
      setApplications(JSON.parse(localStorage.getItem(storageKey)) || []);
      return;
    }
    try {
      const token = localStorage.getItem('sb-access-token'); // Or wherever it's stored
      const res = await fetch('/api/applications', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setApplications(data);
        localStorage.setItem(storageKey, JSON.stringify(data));
      }
    } catch (e) {
      console.error('Fetch apps error:', e);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const hasApplied = (jobId) => !!applications.find(a => a.id === jobId);

  return { applications, addApplication, hasApplied, fetchApplications };
}
