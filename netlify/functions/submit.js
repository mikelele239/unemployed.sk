// Netlify Serverless Function: POST /api/submit
// Uses only the PUBLIC Supabase anon key — no secrets needed.
// Duplicate detection is handled by Supabase's UNIQUE constraint on email.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://jofrxyimqhbgxwwbqyvs.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_x88V1MKZnvNi5YW1T6ozmA_j9XmzHXf';

const VALID_TYPES = new Set(['Stredoškolák', 'Vysokoškolák', 'Absolvent', 'Zamestnávateľ']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const { createHash } = require('crypto');
function hashIp(ip) { return createHash('sha256').update(ip || '').digest('hex'); }

// Simple in-memory rate limiter (resets on cold start, good enough for a signup form)
const rateMap = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) { rateMap.set(ip, { count: 1, resetAt: now + 60_000 }); return false; }
  if (entry.count >= 5) return true;
  entry.count++;
  return false;
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  if (event.httpMethod !== 'POST')
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  // Parse body (URL-encoded or JSON)
  let b = {};
  try {
    const ct = (event.headers['content-type'] || '');
    if (ct.includes('application/json')) {
      b = JSON.parse(event.body || '{}');
    } else {
      for (const [k, v] of new URLSearchParams(event.body || '').entries()) b[k] = v;
    }
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bad request' }) };
  }

  const { email, phonePrefix, phone, userType, consented, marketingConsent } = b;

  if (!email || !EMAIL_RE.test(email.trim()))
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Platný e-mail je povinný.' }) };
  if (!userType || !VALID_TYPES.has(userType))
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Neplatný typ používateľa.' }) };
  if (!consented || consented === '0' || consented === 'false')
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Súhlas so spracovaním údajov je povinný.' }) };

  const ip = (event.headers['x-forwarded-for'] || '').split(',')[0].trim() || '';
  if (isRateLimited(ip))
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'Príliš veľa požiadaviek. Skúste to neskôr.' }) };

  // POST directly to Supabase REST API using the public anon key
  const response = await fetch(`${SUPABASE_URL}/rest/v1/submissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({
      email: email.toLowerCase().trim(),
      phone_prefix: phonePrefix || null,
      phone: phone || null,
      user_type: userType,
      consented: true,
      marketing_consent: marketingConsent === '1' || marketingConsent === 'true',
      ip_hash: hashIp(ip),
    }),
  });

  if (response.ok) {
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  }

  // Handle Supabase error codes
  let errBody = {};
  try { errBody = await response.json(); } catch {}

  // 23505 = unique_violation (email already in DB — UNIQUE constraint on submissions.email)
  if (errBody.code === '23505' || response.status === 409) {
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'Už ste registrovaný.' }) };
  }

  console.error('Supabase insert error:', response.status, errBody);
  return { statusCode: 500, headers, body: JSON.stringify({ error: 'Chyba pri spracovaní.' }) };
};
