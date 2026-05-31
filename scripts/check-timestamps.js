require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── Production Safety Guard ──────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production' || process.env.NETLIFY) {
  console.error('\n❌ FATAL: This script must NOT run in production!');
  console.error('Set NODE_ENV=development to proceed.\n');
  process.exit(1);
}

(async () => {
  // Check what CV is currently stored for the user
  const { data: profile } = await s.from('profiles')
    .select('user_id, first_name, last_name, cv_id, original_filename, last_cv_parsed_at, ai_profile_ready')
    .eq('user_id', 'aee46dd0-3a38-4890-bfe8-912750778593')
    .single();
  
  console.log('Profile:', JSON.stringify(profile, null, 2));
  
  // Check ai_profiles timestamp
  const { data: ai } = await s.from('ai_profiles')
    .select('user_id, full_name, ai_headline, ai_generated_at, updated_at, extraction_source')
    .eq('user_id', 'aee46dd0-3a38-4890-bfe8-912750778593')
    .single();
    
  console.log('\nAI Profile:', JSON.stringify(ai, null, 2));
})();
