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
  const { data, error } = await s.from('ai_profiles')
    .select('user_id, ai_summary, ai_headline, hard_skills');
  if (error) { console.error('Error:', error.message); return; }
  (data || []).forEach(p => {
    console.log(`\nUser: ${p.user_id.slice(0,8)}`);
    console.log(`  Headline: ${(p.ai_headline || 'NONE')}`);
    console.log(`  Skills: ${(p.hard_skills || []).join(', ')}`);
    console.log(`  Summary: ${(p.ai_summary || 'NONE').slice(0, 120)}...`);
  });
})();
