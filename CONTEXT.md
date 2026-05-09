# Unemployed.sk - Live Production Context

> **Last Updated**: 2026-05-06 (v2.4.0)

This document provides a comprehensive summary of the architecture, authentication, and logic implemented for the Unemployed.sk live production system.

## 🏗️ System Architecture
The platform is built as a modular multi-app system served by a single centralized Node.js core.

- **Root Server (`server.js`)**: Express backend handling API routes, authentication, file serving, and all database writes (bypasses RLS with service role key).
- **Portals**:
  - `apps/landing`: The public-facing marketing page (served at `/`).
  - `apps/student`: The "Swipe" interface for candidates (served at `/app`).
  - `apps/employer`: The management dashboard for firms (served at `/employer`).
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS) enforcement.
- **Storage**: Supabase Storage (`cvs` bucket, private) — stores CVs, avatars, and employer logos. All URLs are signed.

## 🔐 Authentication & Session Management
A critical "Portal Isolation" strategy is used to prevent session conflicts between Students and Employers.

- **Storage Isolation**: 
  - Student app uses `unemployed-student-auth` storage key.
  - Employer app uses `unemployed-employer-auth` storage key.
- **Admin Registration API**: User registration (student/employer) is handled via a backend Admin API (`supabaseAdmin`) to bypass email rate limits and ensure automatic user confirmation.
- **Role Verification**: A `user_roles` table in the database strictly enforces access. Roles are assigned at the moment of registration via `raw_user_meta_data`.

## 🔄 Server Proxy Architecture
All database writes are routed through `server.js` endpoints to bypass RLS:

| Operation | Endpoint | Reason |
|-----------|----------|--------|
| Student profile save | `POST /api/student/profile` | Upserts profile with avatar_url, skills, cv_id |
| Employer profile save | `POST /api/employer/ensure-profile` | Upserts employer with name, description, website, location |
| Application create | `POST /api/applications` | Resolves employer_id, creates application |
| Candidate data | `GET /api/employer/candidates` | Enriches with profile data including avatar_url |
| Employer search | `GET /api/employers` | Returns all employers (bypasses RLS for student search) |

## 📦 File Storage Strategy
- **Bucket**: `cvs` (private) — shared for CVs, avatars, and logos
- **File naming**: `{uid}/avatar.{ext}`, `{uid}/{timestamp}_{filename}.pdf`, `{uid}/logo.{ext}`
- **Signed URLs**: All file access uses `createSignedUrl()` — never `getPublicUrl()` (bucket is private)
- **Dynamic resolution**: On page load, components list storage files and generate fresh signed URLs rather than relying on stale database values
- **Cleanup on upload**: Old files (avatar/logo/CV) are deleted before new uploads to prevent accumulation

## 📈 Real-Time Analytics Engine
The platform uses a live tracking system with real data:

- **Engagement Tracking**: Every job card view inserts a record into `job_views` with `employer_id`.
- **Analytics API**: `/api/employer/analytics` aggregates views, applications, pipeline stats, and 7-day trends.
- **Dashboard**: 5-card layout showing active jobs, total candidates, interview activity, conversion rate, and pipeline breakdown.
- **Skill-Based Matching**: SQL matching engine calculates skill/location overlap between students and job requirements.

## 🛠️ Key Logic Refinements
- **Self-Healing Membership**: When an employer posts a job, the server auto-creates missing company links.
- **Pure Dashboard Flow**: New employers access the dashboard immediately upon registration (no mandatory onboarding).
- **Auto-Login Sync**: After registration, hard session sync via `supabase.auth.setSession` + redirect.
- **Single CV Model**: Students maintain one CV at a time; uploads replace the previous file.
- **Avatar Resolution**: Profile pictures are resolved from storage on mount with fresh signed URLs to handle expired/stale URLs gracefully.

## 🤖 AI Matching Engine
The platform uses a server-side matching engine to score candidate-job compatibility:

- **CV Parsing**: On upload, `pdf-parse` extracts text from CVs. A rule-based NLP pipeline then extracts skills, languages, education, experience, and contact info into the `ai_profiles` table.
- **Structured Job Criteria**: Employers fill in matching criteria per job (required/preferred skills, min education, languages, experience, culture fit) stored in `job_match_criteria`.
- **Scoring Algorithm**: Multi-dimensional weighted scoring (0–100) across 5 dimensions: skills, education, experience, location, languages. Employers can adjust dimension weights (1–5).
- **Match Scores**: Pre-computed and cached in `match_scores` table. Recalculated on CV upload, profile update, or job criteria change.
- **API Routes** (`routes/ai-matching.js`):
  - `POST /api/ai-profile/parse` — parse CV and create/update AI profile
  - `GET /api/ai-profile` — get student's AI profile
  - `PATCH /api/ai-profile` — student updates AI profile
  - `GET /api/match-scores` — student's match scores for all jobs
  - `GET /api/employer/match-scores/:jobId` — ranked candidates for a job
  - `POST /api/job-criteria` — upsert job matching criteria
  - `GET /api/job-criteria/:jobId` — read job criteria
  - `POST /api/match/recalculate` — trigger recalculation

## 📂 Configuration
- **Supabase**: Managed via central `supabase.js` files in each portal with dedicated storage keys.
- **Server**: Uses service role key for all DB writes. CSP allows `https://*.supabase.co` and `wss://*.supabase.co`.
- **Database Migrations**: Sequential SQL scripts in `database/scripts/` (01–10).
