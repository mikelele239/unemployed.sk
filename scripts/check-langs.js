require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { scoreLanguage } = require('../lib/matching-engine');

// ── Production Safety Guard ──────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production' || process.env.NETLIFY) {
  console.error('\n❌ FATAL: This script must NOT run in production!');
  console.error('Set NODE_ENV=development to proceed.\n');
  process.exit(1);
}

(async () => {
  const { data: profiles } = await s.from('ai_profiles').select('user_id, full_name, languages');
  const { data: criteria } = await s.from('job_match_criteria').select('job_id, required_languages');
  const { data: jobs } = await s.from('jobs').select('id, title');
  const jobMap = {};
  (jobs || []).forEach(j => { jobMap[j.id] = j.title; });

  const candidate = profiles[0];
  console.log(`Candidate: ${candidate.full_name}`);
  console.log(`Languages: ${JSON.stringify(candidate.languages)}\n`);

  for (const c of criteria || []) {
    const reasons = [];
    const gaps = [];
    const score = scoreLanguage(candidate, c, reasons, gaps);
    console.log(`Job: ${jobMap[c.job_id]}`);
    console.log(`  Required: ${JSON.stringify(c.required_languages)}`);
    console.log(`  Score: ${score}`);
    console.log(`  Reasons: ${reasons.join(', ')}`);
    console.log(`  Gaps: ${gaps.join(', ')}\n`);
  }

  // Test with no language requirements
  const reasons2 = [];
  const gaps2 = [];
  console.log('No requirements:', scoreLanguage(candidate, { required_languages: [] }, reasons2, gaps2));
  console.log('  Reasons:', reasons2, 'Gaps:', gaps2);
})();
