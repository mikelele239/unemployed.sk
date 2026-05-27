const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.jofrxyimqhbgxwwbqyvs:85Mwd%40%24w%2FKXD6bE@aws-0-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

client.connect().then(async () => {
  const cols = await client.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'cv_verifications' ORDER BY ordinal_position"
  );
  console.log('Table columns:');
  cols.rows.forEach(r => console.log('  -', r.column_name, ':', r.data_type));

  const pols = await client.query(
    "SELECT policyname, cmd FROM pg_policies WHERE tablename = 'cv_verifications'"
  );
  console.log('RLS Policies:');
  pols.rows.forEach(r => console.log('  -', r.policyname, '(', r.cmd, ')'));

  const trg = await client.query(
    "SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'cv_verifications'"
  );
  console.log('Triggers:', trg.rows.map(r => r.trigger_name).join(', ') || 'none');

  await client.end();
  console.log('\nAll good!');
}).catch(e => { console.error(e.message); client.end(); });
