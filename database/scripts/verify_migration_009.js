require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

const pg = new Client({
  connectionString: 'postgresql://postgres.jofrxyimqhbgxwwbqyvs:85Mwd%40%24w%2FKXD6bE@aws-0-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

pg.connect().then(async () => {
  // Sample profiles to see cv_id values
  const { rows } = await pg.query(
    "SELECT user_id, cv_id, onboarding_complete FROM profiles LIMIT 10"
  );
  console.log('Sample profiles:');
  rows.forEach(r => console.log(' ', r.user_id.substring(0,8), '| cv_id:', r.cv_id, '| onboarding:', r.onboarding_complete));
  await pg.end();
}).catch(e => { console.error(e.message); pg.end(); });
