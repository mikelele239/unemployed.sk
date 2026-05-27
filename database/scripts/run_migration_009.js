require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(url, key);

// Split the SQL into individual statements and run them
const statements = [
  `CREATE TABLE IF NOT EXISTS cv_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    results JSONB NOT NULL DEFAULT '{}',
    full_transcript JSONB NOT NULL DEFAULT '[]',
    session_state JSONB DEFAULT '{}',
    overall_score FLOAT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS cv_verifications_user_id_idx ON cv_verifications (user_id)`,
  `ALTER TABLE cv_verifications ENABLE ROW LEVEL SECURITY`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cv_verifications' AND policyname='student_read_own_verification') THEN
      CREATE POLICY "student_read_own_verification" ON cv_verifications FOR SELECT USING (auth.uid() = user_id);
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cv_verifications' AND policyname='student_insert_own_verification') THEN
      CREATE POLICY "student_insert_own_verification" ON cv_verifications FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cv_verifications' AND policyname='student_update_own_verification') THEN
      CREATE POLICY "student_update_own_verification" ON cv_verifications FOR UPDATE USING (auth.uid() = user_id);
    END IF;
  END $$`,
];

async function run() {
  for (const stmt of statements) {
    const { error } = await supabase.rpc('exec', { query: stmt }).catch(() => ({ error: { message: 'rpc not found' } }));
    if (error) {
      // Try direct insert to check if table exists
      console.log(`Stmt skipped (no exec RPC): ${stmt.substring(0, 50)}...`);
    } else {
      console.log(`✅ OK: ${stmt.substring(0, 50)}...`);
    }
  }

  // Verify table exists
  const { data, error: checkErr } = await supabase.from('cv_verifications').select('id').limit(1);
  if (checkErr) {
    console.log('\n⚠️  Table cv_verifications not found in schema cache.');
    console.log('📋 Please run the SQL migration manually in Supabase:');
    console.log('   → Go to Supabase Dashboard → SQL Editor');
    console.log('   → Paste contents of: database/009_ai_verification.sql');
    console.log('   → Click Run');
  } else {
    console.log('\n✅ cv_verifications table is live and accessible!');
  }
}

run();
