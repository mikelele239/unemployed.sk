import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables. Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storageKey: 'unemployed-student-auth',
    autoRefreshToken: true,
    persistSession: true,
  }
});

// Helper to safely extract the access token for raw fetch calls
// Uses supabase.auth.getSession() which is the only reliable method across all Supabase versions.
// Falls back to localStorage parsing only if the async call can't be used.
export const getAccessToken = () => {
  try {
    // The Supabase JS client stores session data in localStorage under the storageKey.
    // But the internal format varies by version. The safest approach is to look for
    // the known patterns used by Supabase v2.
    const storageKey = 'unemployed-student-auth';
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    
    // Supabase v2 stores: { access_token, refresh_token, ... } directly
    if (parsed?.access_token) return parsed.access_token;
    
    // Some versions nest it: { currentSession: { access_token } }
    if (parsed?.currentSession?.access_token) return parsed.currentSession.access_token;
    
    // Supabase v2.x may also use: { session: { access_token } }
    if (parsed?.session?.access_token) return parsed.session.access_token;
    
    return null;
  } catch (e) {
    return null;
  }
};

// Async version — always correct. Use this whenever possible.
export const getAccessTokenAsync = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch {
    return null;
  }
};
