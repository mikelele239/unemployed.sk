import { useState, useEffect } from 'react';

export function useApplications() {
  const [applications, setApplications] = useState(() => {
    return JSON.parse(localStorage.getItem('unemployed_apps')) || [];
  });

  const addApplication = (job) => {
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
