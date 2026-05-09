require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Check what candidate_ids are in applications
  const { data: apps } = await s.from('applications').select('candidate_id, job_id').limit(5);
  console.log('Sample applications:');
  (apps || []).forEach(a => console.log(`  candidate: ${a.candidate_id} → job: ${a.job_id}`));
  
  const candidateIds = [...new Set((apps || []).map(a => a.candidate_id))];
  console.log('\nUnique candidate IDs:', candidateIds);
  
  // Check if those IDs match ai_profiles
  const { data: profiles } = await s.from('ai_profiles').select('user_id, ai_headline').in('user_id', candidateIds);
  console.log('\nAI profiles found for these candidates:');
  (profiles || []).forEach(p => console.log(`  ${p.user_id} → ${p.ai_headline}`));
  
  if ((profiles || []).length === 0) {
    console.log('\n⚠️ NO AI profiles match the candidate_ids from applications!');
    const { data: allProfiles } = await s.from('ai_profiles').select('user_id');
    console.log('\nAll AI profile user_ids:');
    (allProfiles || []).forEach(p => console.log(`  ${p.user_id}`));
  }
})();
