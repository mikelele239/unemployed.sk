// Netlify Serverless Function: POST /api/submit
// This is the ONLY backend endpoint needed on Netlify static hosting.
// It saves landing page signups directly to Supabase.

const { createClient } = require('@supabase/supabase-js');
const { createHash } = require('crypto');

const VALID_TYPES = new Set(['Stredoškolák', 'Vysokoškolák', 'Absolvent', 'Zamestnávateľ']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Simple in-memory rate limiter (resets on cold start)
const rateMap = new Map();
function rateLimit(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false; // not limited
  }
  if (entry.count >= 5) return true; // limited
  entry.count += 1;
  return false;
}

function hashIp(ip) {
  return createHash('sha256').update(ip || '').digest('hex');
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Parse body (supports both JSON and URL-encoded)
  let body = {};
  try {
    const ct = event.headers['content-type'] || '';
    if (ct.includes('application/json')) {
      body = JSON.parse(event.body || '{}');
    } else {
      // URL-encoded form data
      const params = new URLSearchParams(event.body || '');
      for (const [k, v] of params.entries()) body[k] = v;
    }
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const { email, phonePrefix, phone, userType, consented, marketingConsent } = body;

  // ── Validation ────────────────────────────────────────────────────────────
  if (!email || !EMAIL_RE.test(email.trim()))
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Platný e-mail je povinný.' }) };
  if (!userType || !VALID_TYPES.has(userType))
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Neplatný typ používateľa.' }) };
  if (!consented || consented === '0' || consented === 'false')
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Súhlas so spracovaním údajov je povinný.' }) };

  // ── Rate limit by IP ──────────────────────────────────────────────────────
  const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || event.headers['client-ip'] || '';
  if (rateLimit(ip))
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'Príliš veľa požiadaviek. Skúste to neskôr.' }) };

  // ── Supabase ──────────────────────────────────────────────────────────────
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // service role to bypass RLS for insert
  );

  try {
    const cleanEmail = email.toLowerCase().trim();
    const ipHash = hashIp(ip);

    // Check for duplicate by email (IP check excluded — dynamic IPs vary too much)
    const { data: existing } = await supabase
      .from('submissions')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existing)
      return { statusCode: 429, headers, body: JSON.stringify({ error: 'Už ste registrovaný.' }) };

    // Insert
    const { error } = await supabase.from('submissions').insert([{
      email: cleanEmail,
      phone_prefix: phonePrefix || null,
      phone: phone || null,
      user_type: userType,
      consented: true,
      marketing_consent: marketingConsent === '1' || marketingConsent === 'true' || marketingConsent === true,
      ip_hash: ipHash,
    }]);

    if (error) {
      // 23505 = unique_violation (email already exists in DB)
      if (error.code === '23505')
        return { statusCode: 429, headers, body: JSON.stringify({ error: 'Už ste registrovaný.' }) };
      console.error('Supabase insert error:', error);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Chyba pri spracovaní.' }) };
    }

    console.log(`✅ New signup: ${cleanEmail} (${userType})`);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('Submit function error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Chyba pri spracovaní.' }) };
  }
};
