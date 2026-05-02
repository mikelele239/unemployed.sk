import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jofrxyimqhbgxwwbqyvs.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storageKey: 'unemployed-student-auth',
    autoRefreshToken: true,
    persistSession: true,
  }
});

// Helper to safely extract the access token for raw fetch calls
export const getAccessToken = () => {
  try {
    const sessionStr = localStorage.getItem('unemployed-student-auth');
    if (!sessionStr) return null;
    const session = JSON.parse(sessionStr);
    return session?.access_token || null;
  } catch (e) {
    return null;
  }
};

