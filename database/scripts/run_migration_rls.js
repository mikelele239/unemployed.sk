const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error('❌ Error: SUPABASE_DB_URL is missing in your .env file!');
  process.exit(1);
}

const sqlFilePath = path.join(__dirname, '21_messages_rls.sql');
if (!fs.existsSync(sqlFilePath)) {
  console.error(`❌ Error: SQL file not found at ${sqlFilePath}`);
  process.exit(1);
}

const sql = fs.readFileSync(sqlFilePath, 'utf8');

async function run() {
  console.log('⚡ Connecting to Supabase PostgreSQL database...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✔ Connected successfully.');
    
    console.log('⚡ Executing SQL script (21_messages_rls.sql)...');
    await client.query(sql);
    
    console.log('✔ SQL executed successfully! Row Level Security (RLS) is now enabled and configured on application_messages!');
  } catch (err) {
    console.error('❌ Database migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
