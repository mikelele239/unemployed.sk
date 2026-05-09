# Unemployed.sk

> **AI-powered career platform for Gen Z in Slovakia.**
> Students discover jobs through Tinder-style swiping and AI matching.
> Employers manage listings, evaluate candidates, and track recruitment analytics.
>
> **Version**: 3.0.0 | **Last Updated**: 2026-05-09

---

## Architecture

```
Unemployed.sk/
├── server.js                    # Express backend — API proxy, auth, CV parsing, AI matching
├── build.js                     # Build orchestrator for all apps
├── apps/
│   ├── landing/                 # Public marketing page (served at /)
│   ├── student/                 # Student portal — React + Vite (served at /app)
│   ├── employer/                # Employer portal — React + Vite (served at /employer)
│   ├── student-demo/            # Demo: hardcoded data, no auth (served at /student-demo)
│   └── employer-demo/           # Demo: hardcoded data, no auth (served at /employer-demo)
├── routes/
│   ├── auth.js                  # Authentication, registration, password reset
│   ├── jobs.js                  # Job CRUD, employer search
│   └── ai-matching.js           # AI profile parsing, match scoring, criteria
├── lib/
│   ├── ai-cv-parser.js          # GPT-4o-mini CV parser with rule-based fallback
│   ├── ai-extraction.js         # NLP text extraction pipeline
│   ├── ai-profile-builder.js    # Structured AI profile construction
│   ├── matching-engine.js       # Multi-dimensional candidate-job scoring (0–100)
│   └── matching-config.js       # Scoring weights, skill synonyms, category mappings
├── database/
│   ├── scripts/                 # SQL migration scripts (02–16)
│   └── *.sql                    # RLS policies and schema patches
├── docs/
│   ├── PROJECT_OVERVIEW.md      # Full architecture & feature reference
│   ├── DESIGN_SYSTEM.md         # Colors, typography, spacing tokens
│   └── FONTS.md                 # Font stack reference
├── scripts/                     # Maintenance utilities (reparse CVs, recalc matches, etc.)
├── tests/                       # Test suites
├── netlify/functions/           # Netlify serverless fallback (submit.js)
├── artifacts/                   # Feature-specific documentation
├── _redirects                   # Netlify SPA fallbacks
└── _headers                     # Security & CSP headers
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
| AI/ML       | OpenAI GPT-4o-mini (CV parsing, profile generation)           |
| Hosting     | Netlify (static) + VPS (Express server)                       |
| i18n        | Custom context-based (Slovak / English)                       |

---

## Student Portal (`/app`)

### Pages

| Page              | File                    | Features                                                                                   |
|-------------------|-------------------------|--------------------------------------------------------------------------------------------|
| **Auth**          | `CandidateAuth.jsx`     | Login / Register via server-side admin API (avoids email rate limits), password reset       |
| **Onboarding**    | `Onboarding.jsx`        | CV upload → AI parse → profile review → skill selection → manual entry fallback            |
| **For You**       | `ForYou.jsx`            | Tinder swipe cards (mobile) + split-view detail (desktop), AI match scores, map hero       |
| **Search**        | `Search.jsx`            | Text search + filter drawer (rate, focus area, category tabs) + employer search             |
| **Applications**  | `Applications.jsx`      | Track applied jobs, interview scheduling (accept/decline/counter-offer with date picker)   |
| **Profile**       | `Profile.jsx`           | Edit name/bio/education/location, CV management, avatar upload, skills, profile strength   |
| **Company**       | `CompanyProfile.jsx`    | Instagram-style company page with listings, stats, and location map                        |
| **Saved Jobs**    | `SavedJobs.jsx`         | Bookmarked job listings                                                                    |

### Components

| Component            | Purpose                                                     |
|----------------------|-------------------------------------------------------------|
| `SwipeCard`          | Draggable Tinder-style job card with map hero               |
| `JobDetail`          | Full-screen job detail overlay with map + apply CTA         |
| `MainLayout`         | Bottom nav (mobile) + sidebar (desktop) with page outlet    |
| `ModernDatePicker`   | Custom date/time picker for interview scheduling            |
| `NotificationBell`   | Real-time notification system with Supabase subscription    |

### Key Interactions

- **Swipe Right** → Creates application via `POST /api/applications` with AI match score
- **CV Upload** → Single-CV model: uploads to Supabase Storage → AI parse → profile enrichment
- **Avatar Upload** → Stores at `{uid}/avatar.{ext}` → generates signed URL → saves via server proxy
- **Interview Scheduling** → Accept, decline, or counter-offer with custom date picker

---

## Employer Portal (`/employer`)

### Pages

| Page              | File                    | Features                                                                                   |
|-------------------|-------------------------|--------------------------------------------------------------------------------------------|
| **Auth**          | `EmployerAuth.jsx`      | Login via Supabase, role verification (rejects student accounts)                           |
| **Registration**  | `Inquiry.jsx`           | Account creation with company name, email, password (admin API, auto-confirm)              |
| **Dashboard**     | `Dashboard.jsx`         | 5-card analytics: active jobs, total candidates, interviews, conversion rate, pipeline     |
| **Listings**      | `Listings.jsx`          | Full CRUD for job postings with rich edit modal (all fields + AI match criteria)            |
| **Create Listing**| `CreateListing.jsx`     | Job creation form (title, rate, type, model, location, description, requirements, tags)    |
| **Candidates**    | `Candidates.jsx`        | Browse & evaluate applicants with AI profiles, CV preview, interview scheduling            |
| **Profile**       | `Profile.jsx`           | Company info, logo upload, theme/language settings, sign out                               |

### Components

| Component            | Purpose                                                     |
|----------------------|-------------------------------------------------------------|
| `SideNav`            | Sidebar navigation (desktop) + bottom nav (mobile)          |
| `CandidateCard`      | Rich candidate card with AI insights, CV preview, scheduling|
| `CandidateAvatar`    | Dynamic avatar resolution from Supabase Storage             |
| `Chart`              | SVG bezier trend chart with animated reveal                 |
| `StatCard`           | Metric card with label, value, change indicator             |
| `MatchCard`          | AI match result card                                        |
| `ModernDatePicker`   | Interview date/time picker overlay                          |
| `NotificationBell`   | Real-time employer notifications                            |
| `SkillChipInput`     | Tag-style skill input for job requirements                  |
| `Toast`              | Notification toast                                          |

### State Management (`contexts.jsx`)

| Context              | Data                                                        |
|----------------------|-------------------------------------------------------------|
| `I18nProvider`       | Language (SK/EN), `t()` translation function                |
| `ThemeProvider`      | Dark/Light theme toggle                                     |
| `AppStateProvider`   | Listings, company profile, analytics, pipeline data         |

---

## AI Matching Engine

### Pipeline

1. **CV Upload** → `pdf-parse` / `mammoth` extracts text from PDF/DOCX
2. **AI Parsing** → GPT-4o-mini extracts structured profile data (with rule-based NLP fallback)
3. **Profile Storage** → Parsed data saved to `ai_profiles` table
4. **Match Scoring** → Multi-dimensional weighted scoring (0–100) against all active jobs
5. **Score Caching** → Pre-computed scores in `match_scores` table, recalculated on any change

### Scoring Dimensions

| Dimension    | Weight | Description                                                |
|--------------|--------|------------------------------------------------------------|
| Skills       | 5      | Synonym-aware matching with transferable skill families     |
| Education    | 3      | Level + field matching (exact, related, or partial)        |
| Experience   | 3      | Years + level compatibility                                |
| Location     | 2      | City/region overlap with work model consideration          |
| Languages    | 2      | Required + preferred language matching                     |

### AI-Generated Content (Bilingual)

All AI-generated text fields produce bilingual JSON (`{sk: "...", en: "..."}`):
- `ai_headline` — Professional one-liner
- `ai_summary` — Executive summary
- `ai_strengths` — Top 3–5 strengths
- `ai_development_areas` — Growth opportunities
- `ai_suggested_roles` — Recommended job titles
- `ai_portfolio_intro` — Portfolio introduction

### API Routes (`routes/ai-matching.js`)

| Method  | Endpoint                          | Description                              |
|---------|-----------------------------------|------------------------------------------|
| `POST`  | `/api/ai-profile/parse`           | Parse CV text and create/update AI profile|
| `GET`   | `/api/ai-profile`                 | Get student's AI profile                 |
| `PATCH` | `/api/ai-profile`                 | Student updates AI profile fields        |
| `GET`   | `/api/match-scores`               | Student's match scores for all jobs      |
| `GET`   | `/api/employer/match-scores/:id`  | Ranked candidates for a specific job     |
| `POST`  | `/api/job-criteria`               | Upsert job matching criteria             |
| `GET`   | `/api/job-criteria/:jobId`        | Read job criteria                        |
| `POST`  | `/api/match/recalculate`          | Trigger full recalculation               |

---

## API Reference

### Authentication & Registration

| Method | Endpoint                           | Auth | Description                                       |
|--------|--------------------------------------|------|---------------------------------------------------|
| `POST` | `/api/auth/student/register`         | No   | Student registration (admin API, auto-confirm)    |
| `POST` | `/api/auth/employer/register`        | No   | Employer registration (admin API, auto-confirm)   |
| `POST` | `/api/auth/employer/login`           | No   | Employer login → Supabase session                 |
| `POST` | `/api/auth/employer/inquiry`         | No   | Employer access request (saves to submissions)    |
| `POST` | `/api/auth/forgot-password`          | No   | Password reset email                              |
| `POST` | `/api/auth/update-password`          | No   | Set new password with reset token                 |
| `POST` | `/api/submit`                        | No   | Landing page email/phone signup (rate-limited)    |

### Profiles

| Method | Endpoint                           | Auth | Description                                       |
|--------|--------------------------------------|------|---------------------------------------------------|
| `POST` | `/api/student/profile`               | JWT  | Upsert student profile                            |
| `GET`  | `/api/student/profile`               | JWT  | Get student profile                               |
| `POST` | `/api/employer/ensure-profile`       | JWT  | Upsert employer profile (name, desc, website, location) |
| `GET`  | `/api/employer/profile`              | JWT  | Get employer profile                              |
| `GET`  | `/api/profile`                       | JWT  | Legacy student profile endpoint                   |

### CV & File Management

| Method   | Endpoint                           | Auth | Description                                     |
|----------|--------------------------------------|------|-------------------------------------------------|
| `POST`   | `/api/cvs/upload`                    | JWT  | Upload CV (multipart) → AI parse → match recalc|
| `GET`    | `/api/cvs`                           | JWT  | List user's CVs                                 |
| `GET`    | `/api/cvs/download/:cvId`            | JWT  | Get signed download URL                         |
| `DELETE` | `/api/cvs/:cvId`                     | JWT  | Delete CV from storage + profile                |
| `GET`    | `/api/employer/cv/:cvId/signed-url`  | JWT  | Employer access to candidate CVs                |

### Jobs & Applications

| Method  | Endpoint                           | Auth | Description                                      |
|---------|--------------------------------------|------|--------------------------------------------------|
| `GET`   | `/api/jobs`                          | JWT  | Fetch all active job listings                    |
| `POST`  | `/api/jobs`                          | JWT  | Create new job listing                           |
| `PATCH` | `/api/employer/jobs/:id`             | JWT  | Update job listing fields                        |
| `DELETE`| `/api/jobs/:id`                      | JWT  | Delete job listing                               |
| `POST`  | `/api/job-view`                      | No   | Track job card impressions                       |
| `POST`  | `/api/applications`                  | JWT  | Submit application (auto-enriches with profile)  |
| `GET`   | `/api/applications`                  | JWT  | List user's applications                         |
| `PATCH` | `/api/applications/:id`              | JWT  | Update status (accept/decline/counter-offer)     |

### Employer Management

| Method | Endpoint                           | Auth | Description                                       |
|--------|--------------------------------------|------|---------------------------------------------------|
| `GET`  | `/api/employer/candidates`           | JWT  | List candidates with enriched profiles            |
| `PATCH`| `/api/employer/candidates/:id`       | JWT  | Update candidate status + send notification       |
| `GET`  | `/api/employer/analytics`            | JWT  | Dashboard analytics (views, pipeline, trend)      |
| `GET`  | `/api/employers`                     | No   | List all employers (for student search)           |

### Public

| Method | Endpoint                           | Auth | Description                                       |
|--------|--------------------------------------|------|---------------------------------------------------|
| `GET`  | `/api/company/:name`                 | No   | Company profile + stats + job listings            |

### Notifications

| Method | Endpoint                           | Auth | Description                                       |
|--------|--------------------------------------|------|---------------------------------------------------|
| `GET`  | `/api/notifications`                 | JWT  | Get user's notifications                          |
| `POST` | `/api/notifications/read`            | JWT  | Mark notification(s) as read                      |
| `POST` | `/api/notifications/read-all`        | JWT  | Mark all notifications as read                    |
| `POST` | `/api/notifications/status-changed`  | JWT  | Trigger notification for status change            |

---

## Database Schema (Supabase)

### Core Tables

| Table              | Purpose                              | Key Columns                                                    |
|--------------------|--------------------------------------|----------------------------------------------------------------|
| `profiles`         | Student profiles                     | `user_id`, `first_name`, `last_name`, `skills[]`, `cv_id`, `avatar_url`, `ai_profile_ready` |
| `employers`        | Employer profiles                    | `id`, `name`, `description`, `website`, `location`, `logo_url` |
| `jobs`             | Job listings                         | `id`, `employer_id`, `title`, `company`, `rate`, `tags[]`, `lat`, `lng`, `work_model`, `views` |
| `applications`     | Student-to-job applications          | `id`, `job_id`, `candidate_id`, `employer_id`, `status`, `interview_dates`, `selected_date` |
| `user_roles`       | Role enforcement                     | `user_id`, `role` (`candidate` / `employer`)                   |

### AI & Matching Tables

| Table              | Purpose                              | Key Columns                                                    |
|--------------------|--------------------------------------|----------------------------------------------------------------|
| `ai_profiles`      | AI-extracted student profiles        | `user_id`, `hard_skills[]`, `soft_skills[]`, `languages[]`, `ai_headline`, `ai_summary`, `confidence_score` |
| `match_scores`     | Pre-computed match scores            | `user_id`, `job_id`, `overall_score`, `dimension_scores`       |
| `job_match_criteria`| Employer-defined matching criteria  | `job_id`, `required_skills[]`, `min_education`, `weights`      |

### Supporting Tables

| Table              | Purpose                              | Key Columns                                                    |
|--------------------|--------------------------------------|----------------------------------------------------------------|
| `submissions`      | Landing page leads                   | `email`, `phone`, `user_type`, `company_name`, `consented`     |
| `notifications`    | In-app notifications                 | `user_id`, `type`, `title`, `message`, `read`                  |
| `employer_members` | Employer team membership             | `employer_id`, `user_id`, `role`                               |
| `employer_notes`   | Internal notes on candidates         | `employer_id`, `candidate_id`, `note`                          |

---

## Environment Variables

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=sk-xxx                      # For AI CV parsing (optional, falls back to rule-based)
PORT=3000
```

---

## Development

```bash
# Install all dependencies (root + student + employer)
npm install

# Start local dev server
npm start
# or
node server.js

# Build all apps (student, employer, demos, landing)
npm run build
# or
node build.js

# Build individual apps
cd apps/student && npx vite build
cd apps/employer && npx vite build
```

---

## Storage & File Management

- **Bucket**: `cvs` (private) — shared for CVs, avatars, and employer logos
- **File Structure**: `{uid}/avatar.{ext}`, `{uid}/{timestamp}_{filename}.pdf`, `{uid}/logo.{ext}`
- **URL Strategy**: All file URLs use **signed URLs** — the bucket is private
- **Avatar Resolution**: Components resolve fresh signed URLs on mount
- **Single CV Model**: One CV per student; old CVs are deleted on new upload

---

## Security Model

- **RLS Bypass**: All writes go through `server.js` using the service role key
- **JWT Validation**: `getUserFromToken()` validates tokens with 3s timeout and JWT decode fallback
- **Admin Registration**: `admin.createUser()` with `email_confirm: true` auto-confirms without sending emails (avoids rate limits)
- **Portal Isolation**: Separate Supabase storage keys (`unemployed-student-auth`, `unemployed-employer-auth`)
- **CSP Headers**: Restricts connections to `*.supabase.co` (https + wss)
- **File Access Control**: Server blocks access to `.env`, `package.json`, `node_modules`, database files

---

## Localization

Both portals support **Slovak (default)** and **English**:

| Portal   | Implementation                              |
|----------|---------------------------------------------|
| Student  | `I18nContext.jsx` with `useTranslation()`   |
| Employer | `i18n.js` with `useI18n()` context          |
| Landing  | Vanilla JS i18n with language toggle        |

AI-generated content is bilingual (`{sk: "...", en: "..."}`), rendered via `biLang()` helper.

---

## Maintenance Scripts (`scripts/`)

| Script              | Purpose                                           |
|---------------------|---------------------------------------------------|
| `recalc-matches.js` | Recalculate all match scores                      |
| `reparse-cvs.js`    | Re-parse all uploaded CVs through AI pipeline     |
| `check-ai-data.js`  | Audit AI profile data quality                     |
| `debug-candidates.js`| Debug candidate visibility issues                |
| `check-langs.js`    | Verify bilingual content generation               |
