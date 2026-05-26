# Unemployed.sk — Production Context

> **Version**: 3.1.0 | **Last Updated**: 2026-05-20

This document provides a concise summary of the production architecture for AI coding assistants and developers.

## System Architecture

Detailed module documentation is located in the respective subfolder `README.md` files:
- **Server Backend**: [routes/](file:///c:/Users/Zephyrus/Desktop/Unemployed.sk/routes/README.md) details standard endpoint routing and JWT auth verification.
- **AI & Matching Engine**: [lib/](file:///c:/Users/Zephyrus/Desktop/Unemployed.sk/lib/README.md) details matching engine, parsing configs, and extraction logic.
- **Database & Schemas**: [database/](file:///c:/Users/Zephyrus/Desktop/Unemployed.sk/database/README.md) details Postgres schema updates, RLS policy gates, and triggers.
- **Management Scripts**: [scripts/](file:///c:/Users/Zephyrus/Desktop/Unemployed.sk/scripts/README.md) details diagnostic, seeder, and maintenance script files.
- **Static Portals**: [apps/landing](file:///c:/Users/Zephyrus/Desktop/Unemployed.sk/apps/landing/README.md) details marketing page setup.
- **Storage**: Supabase Storage (`cvs` bucket, private) — signed URLs only.

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

## AI Matching Pipeline (V3)

1. **CV Upload** → `pdf-parse` (PDF) or `mammoth` (DOCX) extracts raw text.
2. **AI Parse** → GPT-4o-mini parses structured profile attributes (`lib/ai-cv-parser.js`), falling back to rule-based NLP.
3. **Profile Storage** → Upserted into `ai_profiles` table with bilingual content (`{sk: "...", en: "..."}`).
4. **Match Scoring** → `lib/matching-engine.js` runs V3 multi-tiered match score (0-100) mapping to Bands `A`–`E` and filters via three-tier eligibility (`eligible`, `near_miss`, `not_eligible`).
5. **Score Caching** → Pre-computed and saved in `match_scores`, recalculated on CV uploads, updates, or criteria tweaks.
6. **Startup Reparse** → Server detects stale AI profiles on boot and re-parses them.

### Calibration & Weights (V3)
- **Hard Gates**: Enforces mandatory checks (such as language levels or strict location compliance).
- **Success Factors**: Employers calibrate weights across 8 dimensions (technical skills, availability, education, location, languages, industry experience, portfolio, and communication).
- **Match Bands**: Maps overall percentage score to bands (Band `A`: 85–100, `B`: 70–84, `C`: 55–69, `D`: 40–54, `E`: 0–39).

### Rate Limits & Fallback
- Global: 50 AI parses/day
- Per-user: 5 AI parses/day
- Fallback: Rule-based NLP parsing when limits are hit or OpenAI is offline.

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

| Table | Purpose | Context Document |
|-------|---------|------------------|
| `profiles` | Student profiles (name, skills, cv_id, avatar_url, ai_profile_ready) | [profiles](file:///c:/Users/Zephyrus/Desktop/Unemployed.sk/database/models/profiles/README.md) |
| `ai_profiles` | AI-extracted structured data (skills, education, languages, AI summaries) | [ai_profiles](file:///c:/Users/Zephyrus/Desktop/Unemployed.sk/database/models/ai_profiles/README.md) |
| `employers` | Company profiles (name, description, website, location) | [employers](file:///c:/Users/Zephyrus/Desktop/Unemployed.sk/database/models/employers/README.md) |
| `jobs` | Job listings (title, rate, tags, lat/lng, work_model, views) | [jobs](file:///c:/Users/Zephyrus/Desktop/Unemployed.sk/database/models/jobs/README.md) |
| `applications` | Student applications (status, interview_dates, selected_date) | [applications](file:///c:/Users/Zephyrus/Desktop/Unemployed.sk/database/models/applications/README.md) |
| `match_scores` | Pre-computed match scores (user_id, job_id, overall_score) | [match_scores](file:///c:/Users/Zephyrus/Desktop/Unemployed.sk/database/models/match_scores/README.md) |
| `job_match_criteria` | Employer-defined matching criteria per job | [job_match_criteria](file:///c:/Users/Zephyrus/Desktop/Unemployed.sk/database/models/job_match_criteria/README.md) |
| `notifications` | In-app notification system | [notifications](file:///c:/Users/Zephyrus/Desktop/Unemployed.sk/database/models/notifications/README.md) |
| `submissions` | Landing page lead capture | [submissions](file:///c:/Users/Zephyrus/Desktop/Unemployed.sk/database/models/submissions/README.md) |
| `user_roles` | Role enforcement (candidate/employer) | [user_roles](file:///c:/Users/Zephyrus/Desktop/Unemployed.sk/database/models/user_roles/README.md) |
