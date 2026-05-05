import { useState, useEffect } from 'react';
import { supabase, getAccessToken } from '../supabase';

export function useJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const { data, error: sbError } = await supabase
          .from('jobs')
          .select('*')
          .order('created_at', { ascending: false });

        if (sbError) throw sbError;

        // Normalise field names to match what SwipeCard/JobDetail expect
        const parsed = (data || []).map(j => ({
          ...j,
          match: j.match_score,
          rateUnit: j.rate_unit,
          startDate: j.start_date,
          workModel: j.work_model,
        }));

        setJobs(parsed);
      } catch (err) {
        console.error('[useJobs] Supabase fetch error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, []);

  return { jobs, loading, error };
}
