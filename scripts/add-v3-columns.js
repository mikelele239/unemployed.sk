'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// SQL to add V3 columns to match_scores
const SQL = `
ALTER TABLE match_scores ADD COLUMN IF NOT EXISTS match_band text;
ALTER TABLE match_scores ADD COLUMN IF NOT EXISTS eligibility_tier text;
ALTER TABLE match_scores ADD COLUMN IF NOT EXISTS criteria_version integer DEFAULT 1;
ALTER TABLE match_scores ADD COLUMN IF NOT EXISTS insights jsonb DEFAULT '[]'::jsonb;
ALTER TABLE match_scores ADD COLUMN IF NOT EXISTS executive_summary text;
`;

console.log('Run this SQL in Supabase SQL Editor:');
console.log('=====================================');
console.log(SQL);
console.log('=====================================');
console.log('\nOR, the current data works fine without V3 columns.');
console.log('The API has fallback logic that serves basic columns when V3 columns are missing.');
console.log('\nVerifying basic query works...');

(async () => {
  const { data, error } = await sb.from('match_scores')
    .select('job_id, eligible, overall_score, breakdown, match_reasons, gaps, missing_required, calculated_at')
    .limit(3);
  
  if (error) {
    console.log('ERROR: Basic query fails too:', error.message);
  } else {
    console.log('Basic query OK:', data.length, 'rows');
    data.forEach(s => console.log('  job:', s.job_id, s.overall_score + '%'));
  }
})();
