# Unemployed.sk — Complete Project Overview

> **Version**: 3.0.0 | **Last Updated**: 2026-05-09
> This document is the single source of truth for the platform's architecture, feature set, and API surface.

---

## Mission

**Unemployed.sk** is an AI-powered career platform for Gen Z in Slovakia. Students discover jobs through interactive swiping, AI-driven matching, and a mobile-first UX. Employers manage listings, track recruitment analytics, and evaluate AI-scored candidates through a professional dashboard.

---

## Architecture

### Monorepo Structure

```
Unemployed.sk/
├── server.js                    # Express backend — API proxy, auth, CV parsing, AI matching
├── build.js                     # Build orchestrator for all apps
├── routes/                      # Modular API route handlers
│   ├── auth.js                  # Authentication, registration, password reset
│   ├── jobs.js                  # Job CRUD, employer search
│   └── ai-matching.js           # AI profile parsing, match scoring, criteria
├── lib/                         # AI & matching libraries
│   ├── ai-cv-parser.js          # GPT-4o-mini CV parser with rule-based fallback
│   ├── ai-extraction.js         # NLP text extraction pipeline
│   ├── ai-profile-builder.js    # Structured AI profile construction
│   ├── matching-engine.js       # Multi-dimensional candidate-job scoring
│   └── matching-config.js       # Scoring weights, synonyms, category mappings
├── apps/
│   ├── landing/                 # Public marketing page (served at /)
│   ├── student/                 # Student portal (served at /app)
│   ├── employer/                # Employer portal (served at /employer)
│   ├── student-demo/            # Demo: hardcoded data, no auth (/student-demo)
│   └── employer-demo/           # Demo: hardcoded data, no auth (/employer-demo)
├── database/scripts/            # SQL migration scripts (02–16)
├── scripts/                     # Maintenance utilities
├── tests/                       # Test suites
└── docs/                        # Technical documentation
```

### Technology Stack

| Layer       | Technology                                                    |
|-------------|---------------------------------------------------------------|
| Frontend    | React 18 + Vite (4 independent apps)                          |
| Animations  | Framer Motion (spring physics, layout transitions)            |
| Maps        | Leaflet + React-Leaflet (CartoDB dark tiles)                  |
| Backend     | Node.js + Express (`server.js` + modular routes)              |
| Database    | Supabase (PostgreSQL + Row Level Security)                    |
| Storage     | Supabase Storage (`cvs` bucket — private, signed URLs)        |
| Auth        | Supabase Auth (JWT, admin API for registration)               |
| AI/ML       | OpenAI GPT-4o-mini (CV parsing, bilingual profile generation) |
| Hosting     | Netlify (static) + VPS (Express server)                       |
| i18n        | Custom context-based (Slovak / English)                       |

### Portal Isolation

| Portal | Storage Key | Route |
|--------|-------------|-------|
| Student | `unemployed-student-auth` | `/app` |
| Employer | `unemployed-employer-auth` | `/employer` |
| Student Demo | (no auth) | `/student-demo` |
| Employer Demo | (no auth) | `/employer-demo` |

---

## Student Portal (`/app`)

### Pages & Features

| Page | File | Description | Status |
|------|------|-------------|--------|
| **Auth** | `CandidateAuth.jsx` | Login & register via server-side admin API (avoids email rate limits) | ✅ Live |
| **Onboarding** | `Onboarding.jsx` | CV upload → AI parse → profile review → skill selection → manual fallback | ✅ Live |
| **For You** | `ForYou.jsx` | Tinder swipe cards (mobile) + split-view (desktop) with AI match scores | ✅ Live |
| **Search** | `Search.jsx` | Text search + filter drawer + category tabs + employer search | ✅ Live |
| **Applications** | `Applications.jsx` | Track applied jobs, interview scheduling (accept/decline/counter-offer) | ✅ Live |
| **Profile** | `Profile.jsx` | Edit profile, single-CV management, avatar upload, skills, profile strength | ✅ Live |
| **Company** | `CompanyProfile.jsx` | Instagram-style company page with listings, stats, location map | ✅ Live |
| **Saved Jobs** | `SavedJobs.jsx` | Bookmarked job listings | ✅ Live |

### Components

| Component | File | Purpose |
|-----------|------|---------|
| `SwipeCard` | `SwipeCard.jsx` | Draggable Tinder-style job card with map hero |
| `JobDetail` | `JobDetail.jsx` | Full-screen job detail overlay with map + apply CTA |
| `MainLayout` | `MainLayout.jsx` | Bottom nav (mobile) + page outlet |
| `ModernDatePicker` | `ModernDatePicker.jsx` | Custom date/time picker for interviews |
| `NotificationBell` | `NotificationBell.jsx` | Real-time notifications with Supabase subscription |

### Services

| Service | File | Purpose |
|---------|------|---------|
| `cvApi` | `services/cvApi.js` | CV upload, download, delete via Supabase Storage |

---

## Employer Portal (`/employer`)

### Pages & Features

| Page | File | Description | Status |
|------|------|-------------|--------|
| **Auth** | `EmployerAuth.jsx` | Login via Supabase, role verification | ✅ Live |
| **Registration** | `Inquiry.jsx` | Account creation (admin API, auto-confirm) | ✅ Live |
| **Dashboard** | `Dashboard.jsx` | 5-card analytics with real-time metrics | ✅ Live |
| **Listings** | `Listings.jsx` | Full CRUD for job postings with edit modal | ✅ Live |
| **Create Listing** | `CreateListing.jsx` | Rich job creation form | ✅ Live |
| **Candidates** | `Candidates.jsx` | Browse & evaluate with AI profiles, CV preview | ✅ Live |
| **Profile** | `Profile.jsx` | Company info, logo, theme/language settings | ✅ Live |
| **Onboarding** | `Onboarding.jsx` | Company setup quiz | ✅ Live |

### Components

| Component | Purpose |
|-----------|---------|
| `SideNav` | Sidebar (desktop) + bottom nav (mobile) |
| `CandidateCard` | Rich candidate card with AI insights, CV preview, interview scheduling |
| `CandidateAvatar` | Dynamic avatar resolution from Supabase Storage |
| `Chart` | SVG bezier trend chart with animated reveal |
| `StatCard` | Metric card with label, value, change indicator |
| `MatchCard` | AI match result card |
| `NotificationBell` | Real-time employer notifications |
| `SkillChipInput` | Tag-style skill input for job requirements |
| `ModernDatePicker` | Interview date/time picker overlay |
| `Toast` | Notification toast |
| `QuizStep` | Onboarding quiz step wrapper |

### State Management (`contexts.jsx`)

| Context | Data |
|---------|------|
| `I18nProvider` | Language (SK/EN), `t()` translation function |
| `ThemeProvider` | Dark/Light theme |
| `AppStateProvider` | `listings`, `companyProfile`, `analytics`, `invitedIds`, `acceptedIds` |

---

## AI Matching Engine

### Pipeline Overview

1. **CV Upload** → Text extraction via `pdf-parse` (PDF) or `mammoth` (DOCX)
2. **AI Parsing** → GPT-4o-mini extracts structured profile data; rule-based NLP fallback
3. **Profile Storage** → Upserted into `ai_profiles` with bilingual content
4. **Match Scoring** → Multi-dimensional weighted scoring (0–100)
5. **Score Caching** → Pre-computed in `match_scores`, recalculated on changes
6. **Startup Reparse** → Server detects stale AI profiles on boot

### Scoring Dimensions

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Skills | 5 | Synonym-aware matching with transferable skill families |
| Education | 3 | Level + field matching (exact, related, partial) |
| Experience | 3 | Years + level compatibility |
| Location | 2 | City/region overlap with work model consideration |
| Languages | 2 | Required + preferred language matching |

### Bilingual AI Content

All AI-generated text produces bilingual JSON (`{sk: "...", en: "..."}`):
- Headlines, summaries, strengths, development areas, suggested roles, portfolio intros

### Rate Limits

- Global: 50 AI parses/day
- Per-user: 5 AI parses/day
- Fallback: Rule-based NLP when limits reached

---

## Landing Page (`/`)

| Feature | Description | Status |
|---------|-------------|--------|
| Hero section | Full-screen with dual CTA (Students / Employers) | ✅ Live |
| Lead capture | Email + phone signup → `submissions` table | ✅ Live |
| Demo iframes | Embedded student/employer demo portals | ✅ Live |
| i18n | Slovak (default) + English toggle | ✅ Live |
| Theme | Light (default) + Dark toggle | ✅ Live |

---

## Database Schema

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `profiles` | Student profiles | `user_id`, `first_name`, `last_name`, `skills[]`, `cv_id`, `avatar_url`, `ai_profile_ready` |
| `ai_profiles` | AI-extracted profiles | `user_id`, `hard_skills[]`, `soft_skills[]`, `languages[]`, `ai_headline`, `ai_summary`, `confidence_score` |
| `employers` | Employer profiles | `id`, `name`, `description`, `website`, `location`, `logo_url` |
| `jobs` | Job listings | `id`, `employer_id`, `title`, `company`, `rate`, `tags[]`, `lat`, `lng`, `work_model`, `views` |
| `applications` | Student applications | `id`, `job_id`, `candidate_id`, `employer_id`, `status`, `interview_dates`, `selected_date` |
| `match_scores` | Pre-computed scores | `user_id`, `job_id`, `overall_score`, `dimension_scores` |
| `job_match_criteria` | Job matching criteria | `job_id`, `required_skills[]`, `min_education`, `weights` |
| `notifications` | In-app notifications | `user_id`, `type`, `title`, `message`, `read` |
| `submissions` | Landing page leads | `email`, `phone`, `user_type`, `company_name`, `consented` |
| `user_roles` | Role enforcement | `user_id`, `role` |

### Migration Scripts (`database/scripts/`)

Scripts are numbered 02–16 and run sequentially. Key migrations:

| Script | Purpose |
|--------|---------|
| `02_auth_roles_schema.sql` | Core auth tables + profiles |
| `04_sync_schema.sql` | Employer tables, jobs FK, RLS policies |
| `06_complete_schema.sql` | Full schema with analytics functions |
| `12_notifications.sql` | Notification system |
| `14_ai_matching.sql` | AI profiles + match scores tables |
| `16_seed_test_jobs.sql` | Test job data seeding |

---

## Security Model

- **RLS Bypass**: All writes through `server.js` using service role key
- **JWT Validation**: `getUserFromToken()` with 3s timeout + JWT decode fallback
- **Admin Registration**: `admin.createUser()` auto-confirms without sending emails
- **Portal Isolation**: Separate Supabase storage keys
- **CSP Headers**: Restricts connections to `*.supabase.co`
- **File Blocking**: Server blocks `.env`, `package.json`, `node_modules`, database files

---

## Localization

| Portal | Implementation | Files |
|--------|---------------|-------|
| Student | `I18nContext.jsx` with `useTranslation()` | Inline translation objects |
| Employer | `i18n.js` with `useI18n()` context | Centralized translation file |
| Landing | Vanilla JS i18n | `landing.js` |

AI content uses bilingual JSON, rendered via `biLang()` / `biLangArr()` helpers.
