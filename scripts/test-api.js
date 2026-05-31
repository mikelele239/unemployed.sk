// Quick test of the AI profiles endpoint
const http = require('http');

// ── Production Safety Guard ──────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production' || process.env.NETLIFY) {
  console.error('\n❌ FATAL: This script must NOT run in production!');
  console.error('Set NODE_ENV=development to proceed.\n');
  process.exit(1);
}

const body = JSON.stringify({ candidate_ids: ['aee46dd0-3a38-4890-bfe8-912750778593'] });

const req = http.request({
  hostname: 'localhost', port: 3000, path: '/api/employer/ai-profiles',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    const parsed = JSON.parse(data);
    console.log('Profiles count:', Object.keys(parsed.profiles || {}).length);
    for (const [id, p] of Object.entries(parsed.profiles || {})) {
      console.log(`  ${id.slice(0,8)}: ${p.ai_headline}`);
      console.log(`  Summary: ${(p.ai_summary || '').slice(0,100)}...`);
      console.log(`  Skills: ${(p.hard_skills || []).length}`);
    }
  });
});

req.write(body);
req.end();
