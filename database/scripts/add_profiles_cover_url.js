const { Client } = require('pg');

// ── Production Safety Guard ──────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production' || process.env.NETLIFY) {
  console.error('\n❌ FATAL: This script must NOT run in production!');
  console.error('Set NODE_ENV=development to proceed.\n');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

const pg = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pg.connect().then(async () => {
  console.log('Connected to database.');
  await pg.query("ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_url TEXT;");
  console.log('Added cover_url column to public.profiles table (if not exists).');
  await pg.end();
}).catch(e => {
  console.error('Error running migration:', e.message);
  pg.end();
});
