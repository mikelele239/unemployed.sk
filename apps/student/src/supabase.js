import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jofrxyimqhbgxwwbqyvs.supabase.co';
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseKey = (rawKey && rawKey !== 'undefined' && rawKey !== '') 
  ? rawKey 
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1bW15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDQwNjcyMDAsImV4cCI6MjAyMDY0MzIwMH0.dummy';

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

