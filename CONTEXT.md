# Unemployed.sk — Production Context

> **Version**: 3.0.0 | **Last Updated**: 2026-05-09

This document provides a concise summary of the production architecture for AI coding assistants and developers.

## System Architecture

- **Server**: Express backend (`server.js`) — API proxy, auth, CV parsing, AI matching, static file serving
- **Route Modules**: `routes/auth.js`, `routes/jobs.js`, `routes/ai-matching.js`
- **AI Libraries**: `lib/ai-cv-parser.js`, `lib/ai-extraction.js`, `lib/ai-profile-builder.js`, `lib/matching-engine.js`, `lib/matching-config.js`
- **Database**: Supabase (PostgreSQL) with Row Level Security — all writes bypass RLS via service role key
- **Storage**: Supabase Storage (`cvs` bucket, private) — signed URLs only

### Portals

| Portal | Path | Auth Storage Key | Description |
|--------|------|-------------------|-------------|
| Landing | `/` | — | Static HTML marketing page |
| Student | `/app` | `unemployed-student-auth` | Candidate job swiping interface |
| Employer | `/employer` | `unemployed-employer-auth` | Recruitment management dashboard |
| Student Demo | `/student-demo` | — | Hardcoded demo, no auth |
| Employer Demo | `/employer-demo` | — | Hardcoded demo, no auth |

## Authentication

- **Registration**: Server-side `admin.createUser()` with `email_confirm: true` — auto-confirms without sending emails (bypasses Supabase email rate limits)
- **Portal Isolation**: Separate Supabase storage keys prevent session conflicts
- **Role Verification**: `user_roles` table + `user_metadata.role` enforced at login
- **Token Validation**: `getUserFromToken()` with 3-second timeout and JWT decode fallback

## Server Proxy Architecture

All database writes route through `server.js` to bypass RLS:

| Operation | Endpoint | Purpose |
|-----------|----------|---------|
| Student profile | `POST /api/student/profile` | Upsert with avatar_url, skills, cv_id |
| Employer profile | `POST /api/employer/ensure-profile` | Upsert with name, description, website, location |
| Application | `POST /api/applications` | Resolves employer_id, enriches with profile data |
| Candidate fetch | `GET /api/employer/candidates` | Enriches with profile + AI data |
| Status update | `PATCH /api/employer/candidates/:id` | Updates status + sends notification |
| CV upload | `POST /api/cvs/upload` | Storage upload + AI parse + match recalc |

## AI Matching Pipeline

1. **CV Upload** → `pdf-parse` (PDF) or `mammoth` (DOCX) extracts text
2. **AI Parse** → GPT-4o-mini extracts structured profile (`lib/ai-cv-parser.js`), falls back to rule-based NLP
3. **Profile Storage** → Upserted into `ai_profiles` table with bilingual content (`{sk: "...", en: "..."}`)
4. **Match Scoring** → `lib/matching-engine.js` scores candidates against jobs (0–100) across 5 dimensions
5. **Score Caching** → Pre-computed in `match_scores`, recalculated on CV upload, profile update, or criteria change
6. **Startup Reparse** → Server detects stale AI profiles on boot and re-parses them

### Scoring Dimensions
Skills (weight 5), Education (3), Experience (3), Location (2), Languages (2)

### Rate Limits
- Global: 50 AI parses/day
- Per-user: 5 AI parses/day
- Fallback: Rule-based NLP when limits reached or OpenAI unavailable

## Notification System

- **Table**: `notifications` (user_id, type, title, message, read)
- **Real-time**: Supabase Realtime subscription on `notifications` table
- **Triggers**: Status changes, interview invites, hiring decisions
- **UI**: `NotificationBell` component in both portals with scroll-hide behavior

## File Storage

- **Bucket**: `cvs` (private)
- **Naming**: `{uid}/avatar.{ext}`, `{uid}/{timestamp}_{filename}.pdf`, `{uid}/logo.{ext}`
- **Access**: All via `createSignedUrl()` (never `getPublicUrl()`)
- **Cleanup**: Old files deleted before new uploads
- **Single CV Model**: One CV per student, replacement on re-upload

## Key Tables

| Table | Purpose |
|-------|---------|
| `profiles` | Student profiles (name, skills, cv_id, avatar_url, ai_profile_ready) |
| `ai_profiles` | AI-extracted structured data (skills, education, languages, AI summaries) |
| `employers` | Company profiles (name, description, website, location) |
| `jobs` | Job listings (title, rate, tags, lat/lng, work_model, views) |
| `applications` | Student applications (status, interview_dates, selected_date) |
| `match_scores` | Pre-computed match scores (user_id, job_id, overall_score) |
| `job_match_criteria` | Employer-defined matching criteria per job |
| `notifications` | In-app notification system |
| `submissions` | Landing page lead capture |
| `user_roles` | Role enforcement (candidate/employer) |
