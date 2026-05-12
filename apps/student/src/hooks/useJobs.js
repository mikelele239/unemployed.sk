import { useState, useEffect } from 'react';
import { supabase, getAccessToken } from '../supabase';

// Generate a consistent color from a string (company name)
function stringToColor(str) {
  const colors = [
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
    '#f43f5e', '#ef4444', '#f97316', '#f59e0b', '#eab308',
    '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#7c3aed', '#9333ea', '#c026d3',
  ];
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function useJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        // Fetch jobs with employer info (logo_url)
        const { data, error: sbError } = await supabase
          .from('jobs')
          .select('*, employers(logo_url, name)')
          .eq('status', 'Active')
          .order('created_at', { ascending: false });

        if (sbError) throw sbError;

        // Normalise field names to match what SwipeCard/JobDetail expect
        const parsed = (data || []).map(j => {
          const emp = j.employers || {};
          const companyName = j.company || emp.name || '';

          // Normalize tags: DB may return string, JSON string, array, or null
          let normalizedTags = [];
          if (Array.isArray(j.tags)) {
            normalizedTags = j.tags;
          } else if (typeof j.tags === 'string' && j.tags.trim()) {
            try {
              const parsed = JSON.parse(j.tags);
              normalizedTags = Array.isArray(parsed) ? parsed : [j.tags];
            } catch {
              normalizedTags = j.tags.split(',').map(t => t.trim()).filter(Boolean);
            }
          }

          return {
            ...j,
            tags: normalizedTags,
            match: j.match_score,
            rateUnit: j.rate_unit,
            startDate: j.start_date,
            workModel: j.work_model,
            logo_url: emp.logo_url || null,
            logo: companyName.charAt(0)?.toUpperCase() || '?',
            color: stringToColor(companyName),
          };
        });

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
