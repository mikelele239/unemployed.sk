import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jofrxyimqhbgxwwbqyvs.supabase.co';
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseKey = (typeof rawKey === 'string' && rawKey.length > 20 && rawKey !== 'undefined')
  ? rawKey
  : 'sb_publishable_x88V1MKZnvNi5YW1T6ozmA_j9XmzHXf';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storageKey: 'unemployed-student-auth',
    autoRefreshToken: true,
    persistSession: true,
  }
});

export const getAccessToken = () => {
  try {
    const raw = localStorage.getItem('unemployed-student-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.access_token
      || parsed?.currentSession?.access_token
      || parsed?.session?.access_token
      || null;
  } catch {
    return null;
  }
};

