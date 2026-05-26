const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error('❌ Error: SUPABASE_DB_URL is missing in your .env file!');
  process.exit(1);
}

const sqlFilePath = path.join(__dirname, '20_dedicated_messages_table.sql');
if (!fs.existsSync(sqlFilePath)) {
  console.error(`❌ Error: SQL file not found at ${sqlFilePath}`);
  process.exit(1);
}

const sql = fs.readFileSync(sqlFilePath, 'utf8');

async function run() {
  console.log('⚡ Connecting to Supabase PostgreSQL database...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false } // Required for Supabase ssl connections
  });

  try {
    await client.connect();
    console.log('✔ Connected successfully.');
    
    console.log('⚡ Executing SQL script (20_dedicated_messages_table.sql)...');
    await client.query(sql);
    
    console.log('✔ SQL executed successfully! Dedicated table application_messages is now created and realtime is enabled!');
  } catch (err) {
    console.error('❌ Database migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
