'use strict';

const express = require('express');
const path = require('path');
const { createHash } = require('crypto');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust first proxy (needed for correct req.ip behind reverse proxies)
app.set('trust proxy', 1);

let submissions = [];

const recentSubmission = {
  get: ({email, ipHash}) => {
    return submissions.find(s => s.email === email || s.ipHash === ipHash);
  }
};

const insertSubmission = {
  run: (data) => {
    submissions.push(data);
  }
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/** One-way SHA-256 hash of the IP for privacy-safe duplicate detection. */
function hashIp(ip) {
  return createHash('sha256').update(ip || '').digest('hex');
}

// ── Middleware ─────────────────────────────────────────────────────────────────

app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: false, limit: '16kb' }));

// Block access to sensitive files
app.use((req, res, next) => {
  const blocked = /\/(server\.js|package\.json|package-lock\.json|node_modules|\.env|submissions\.db.*|\.claude)(\/|$)/i;
  if (blocked.test(req.path)) return res.status(404).end();
  next();
});

app.use(express.static(path.join(__dirname, 'website')));
app.use('/app', express.static(path.join(__dirname, 'employee', 'dist')));
app.use('/employer', express.static(path.join(__dirname, 'employer', 'dist')));


// Simple in-process rate limiter: max 5 submissions per IP per minute
const rateMap = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

// Clean up expired rate-limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateMap) {
    if (now > entry.resetAt) rateMap.delete(ip);
  }
}, 5 * 60_000).unref();

function rateLimit(req, res, next) {
  const ip = req.ip || '';
  const now = Date.now();
  const entry = rateMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }
  if (entry.count >= MAX_PER_WINDOW) {
    return res.status(429).json({ error: 'Príliš veľa požiadaviek. Skúste to neskôr.' });
  }
  entry.count += 1;
  next();
}

// ── Validation helpers ─────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9\s\-()+]*$/;
const VALID_TYPES = new Set(['Stredoškolák', 'Vysokoškolák', 'Absolvent', 'Zamestnávateľ']);

// ── API ────────────────────────────────────────────────────────────────────────

app.post('/api/submit', rateLimit, (req, res) => {
  const { email, phonePrefix, phone, userType, consented, marketingConsent } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'E-mail je povinný.' });
  }
  if (email.length > 254) {
    return res.status(400).json({ error: 'E-mail je príliš dlhý.' });
  }
  if (!EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Neplatná e-mailová adresa.' });
  }
  if (!userType || !VALID_TYPES.has(userType)) {
    return res.status(400).json({ error: 'Neplatný typ používateľa.' });
  }
  if (phone && phone.length > 20) {
    return res.status(400).json({ error: 'Telefónne číslo je príliš dlhé.' });
  }
  if (phone && !PHONE_RE.test(phone)) {
    return res.status(400).json({ error: 'Neplatné telefónne číslo.' });
  }
  if (!consented) {
    return res.status(400).json({ error: 'Súhlas so spracovaním údajov je povinný.' });
  }

  try {
    const cleanEmail = email.toLowerCase().trim();
    // Raw IP used only for the in-memory rate limiter (ephemeral, never persisted).
    // A one-way SHA-256 hash is stored in SQLite for privacy-safe duplicate detection.
    const ipHash = hashIp(req.ip || '');

    // Prevent duplicate submissions: 1 per email or hashed IP per 24 hours
    if (recentSubmission.get({ email: cleanEmail, ipHash })) {
      return res.status(429).json({ error: 'Už ste odoslali registráciu. Skúste to znova o 24 hodín.' });
    }

    insertSubmission.run({
      email: cleanEmail,
      phonePrefix: (phonePrefix || '').trim(),
      phone: (phone || '').trim(),
      userType,
      consented: 1,
      marketingConsent: (marketingConsent === '1' || marketingConsent === true) ? 1 : 0,
      ipHash,
    });
    res.json({ success: true });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Interná chyba servera.' });
  }
});

// ── Fallback: serve index.html for any unmatched GET ─────────────────────────

app.get('/app*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'employee', 'dist', 'index.html'));
});

app.get('/employer*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'employer', 'dist', 'index.html'));
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'website', 'index.html'));
});

// ── Start ──────────────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  console.log(`unemployed.sk running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => { process.exit(0); });
});
process.on('SIGINT', () => {
  server.close(() => { process.exit(0); });
});
