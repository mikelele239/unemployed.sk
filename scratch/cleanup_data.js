const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function cleanup() {
  console.log('Fetching jobs...');
  const { data: jobs, error } = await supabase.from('jobs').select('id, title');
  
  if (error) {
    console.error('Error fetching jobs:', error);
    return;
  }

  const badKeywords = ['nigger', 'badword1', 'badword2']; // Add more if needed

  for (const job of jobs) {
    if (badKeywords.some(kw => job.title.toLowerCase().includes(kw))) {
      console.log(`Deleting bad job: ${job.title} (${job.id})`);
      const { error: delError } = await supabase.from('jobs').delete().eq('id', job.id);
      if (delError) console.error('Error deleting:', delError);
    }
  }
  console.log('Cleanup finished.');
}

cleanup();
