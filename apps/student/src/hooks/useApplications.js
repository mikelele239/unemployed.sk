import { useState, useEffect } from 'react';

export function useApplications() {
  const [applications, setApplications] = useState(() => {
    return JSON.parse(localStorage.getItem('unemployed_apps')) || [];
  });

  const addApplication = async (job) => {
    // 1. Get student profile from localStorage
    const profile = JSON.parse(localStorage.getItem('unemployed_profile')) || { name: 'Anonym', email: 'unknown@example.com' };

    // 2. Call backend for real sync + AI screening
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

    // 3. Update local state for immediate UI feedback
    setApplications((prev) => {
      if (prev.find(a => a.id === job.id)) return prev;
      const newApps = [{ ...job, status: 'Pending', timestamp: new Date().toISOString() }, ...prev];
      localStorage.setItem('unemployed_apps', JSON.stringify(newApps));
      return newApps;
    });
  };

  const hasApplied = (jobId) => !!applications.find(a => a.id === jobId);

  return { applications, addApplication, hasApplied };
}
