import { useState, useEffect } from 'react';
import { getAccessToken } from '../supabase';
import { isDemoMode } from '../demoMode';
import { JOBS as MOCK_JOBS } from '../data/mockJobs';


export function useJobs() {
  const demo = isDemoMode();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchJobs = async () => {
    // Demo mode: use hardcoded mock jobs
    if (demo) {
      setJobs(MOCK_JOBS);
      setLoading(false);
      return;
    }

    // Live mode: fetch from API with auth
    const token = getAccessToken();
    try {
      const res = await fetch('/api/jobs', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error('Failed to fetch jobs');
      const data = await res.json();
      console.log(`[DEBUG] Jobs fetched: ${data.length}`, data);
      setJobs(data);
      setLoading(false);
    } catch (err) {
      console.error('[DEBUG] Fetch jobs error:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  return { jobs, loading, error };
}
