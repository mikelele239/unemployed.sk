// Manually trigger match score recalculation for all students against all jobs
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { calculateCandidateJobMatch } = require('../lib/matching-engine');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function recalcAll() {
  // Get all AI profiles
  const { data: profiles, error: pErr } = await supabase.from('ai_profiles').select('*');
  if (pErr) { console.error('Profiles error:', pErr.message); return; }
  console.log(`Found ${(profiles||[]).length} AI profiles`);

  // Get all active jobs
  const { data: jobs, error: jErr } = await supabase.from('jobs').select('*').eq('status', 'Active');
  if (jErr) { console.error('Jobs error:', jErr.message); return; }
  console.log(`Found ${(jobs||[]).length} active jobs`);

  // Get all match criteria
  const { data: criteria } = await supabase.from('job_match_criteria').select('*');
  const cMap = {};
  (criteria || []).forEach(c => { cMap[c.job_id] = c; });
  console.log(`Found ${(criteria||[]).length} job criteria\n`);

  let total = 0;
  for (const profile of (profiles || [])) {
    for (const job of (jobs || [])) {
      const result = calculateCandidateJobMatch(profile, job, cMap[job.id] || {});
      
      console.log(`${profile.full_name || profile.user_id} × ${job.title}: ${result.match_score}%`);
      console.log(`  Reasons: ${result.match_reasons.slice(0,3).join(', ')}`);
      console.log(`  Gaps: ${result.gaps.slice(0,3).join(', ')}`);
      console.log(`  Breakdown:`, JSON.stringify(result.score_breakdown));
      console.log();

      const { error: uErr } = await supabase.from('match_scores').upsert({
        user_id: profile.user_id,
        job_id: job.id,
        eligible: result.eligible,
        overall_score: result.match_score,
        breakdown: result.score_breakdown,
        match_reasons: result.match_reasons,
        gaps: result.gaps,
        missing_required: result.gaps.filter(g => g.startsWith('Missing required')),
        calculated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,job_id' });

      if (uErr) console.error('  Save error:', uErr.message);
      else total++;
    }
  }

  console.log(`\n✅ Saved ${total} match scores`);
}

recalcAll().catch(console.error);
