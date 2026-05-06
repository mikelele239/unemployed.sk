# Unemployed.sk — Complete Project Overview

> **Last Updated**: 2026-05-06 (v2.4.0)  
> This document is the single source of truth for the platform's architecture, feature set, and API surface.

---

## 🚀 Mission

**Unemployed.sk** is a Tinder-style career platform for Gen Z in Slovakia. Students discover jobs through interactive swiping, AI-driven matching, and a mobile-first philosophy. Employers manage listings, track analytics, and evaluate candidates through a professional dashboard.

---

## 🏗️ Architecture

### Monorepo Structure

```
Unemployed.sk/
├── server.js                  # Express backend — API proxy, auth, static serving
├── build.js                   # Build orchestrator for all 4 apps
├── apps/
│   ├── landing/               # Public marketing page (served at /)
│   ├── student/               # Student portal (served at /app)
│   ├── employer/              # Employer portal (served at /employer)
│   ├── student-demo/          # Student demo — hardcoded data (served at /student-demo)
│   └── employer-demo/         # Employer demo — hardcoded data (served at /employer-demo)
├── database/
│   └── scripts/               # SQL migration scripts (01–10)
├── docs/                      # Technical documentation
│   ├── PROJECT_OVERVIEW.md    # This file
│   ├── DESIGN_SYSTEM.md       # Colors, typography, spacing tokens
│   └── FONTS.md               # Font stack reference
├── artifacts/                 # Feature-specific documentation
├── CONTEXT.md                 # Production architecture context
└── CONTEXT_VIEWS.md           # Data sync & debugging context
```

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite (4 independent apps) |
| Animations | Framer Motion (spring physics, layout transitions) |
| Maps | Leaflet + React-Leaflet (CartoDB tiles) |
| Backend | Node.js + Express (single `server.js`) |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Storage | Supabase Storage (`cvs` bucket — private, signed URLs) |
| Auth | Supabase Auth (JWT, session-based) |
| Hosting | Netlify (static) + VPS/local (server) |
| i18n | Custom context-based (SK/EN) |

### Portal Isolation

Each portal uses its own Supabase storage key to prevent session conflicts:

| Portal | Storage Key | Route |
|--------|-------------|-------|
| Student | `unemployed-student-auth` | `/app` |
| Employer | `unemployed-employer-auth` | `/employer` |
| Student Demo | (no auth) | `/student-demo` |
| Employer Demo | (no auth) | `/employer-demo` |

---

## 📱 Student Portal (`/app`)

### Pages & Features

| Page | File | Description | Status |
|------|------|-------------|--------|
| **Auth** | `CandidateAuth.jsx` | Email/password login & registration via Supabase | ✅ Live |
| **Onboarding** | `Onboarding.jsx` | CV upload → AI parse → profile review → skill selection | ✅ Live |
| **For You** | `ForYou.jsx` | Tinder swipe cards (mobile) + split-view (desktop) | ✅ Live |
| **Search** | `Search.jsx` | Job search with text query + filter drawer + category tabs + employer search | ✅ Live |
| **Applications** | `Applications.jsx` | Track applied jobs, interview scheduling (accept/decline/counter-offer) | ✅ Live |
| **Profile** | `Profile.jsx` | Edit profile, single-CV management, avatar upload (signed URL), skills, profile strength meter | ✅ Live |
| **Company Profile** | `CompanyProfile.jsx` | Instagram-style company page with listings + location display | ✅ Live |

### Components

| Component | File | Purpose |
|-----------|------|---------|
| `SwipeCard` | `components/SwipeCard.jsx` | Draggable Tinder-style job card with map hero |
| `JobDetail` | `components/JobDetail.jsx` | Full-screen job detail overlay with map + apply CTA |
| `MainLayout` | `components/MainLayout.jsx` | Bottom nav + page outlet |
| `CVUploadExample` | `components/CVUploadExample.jsx` | Standalone CV upload widget |

### Key Interactions

- **Swipe Right** → Creates application via `POST /api/applications`
- **Company Name Click** → Navigates to `/company/:name`
- **CV Upload** → Single-CV model: old CVs deleted, new one uploaded to Supabase Storage
- **Avatar Upload** → Uploads to `{uid}/avatar.{ext}`, generates signed URL, saves via server proxy
- **Search Filters** → Right-sliding drawer with min rate + focus area filters
- **Interview Scheduling** → ModernDatePicker for counter-offer date selection

---

## 🏢 Employer Portal (`/employer`)

### Pages & Features

| Page | File | Description | Status |
|------|------|-------------|--------|
| **Auth** | `EmployerAuth.jsx` | Email/password login for employers | ✅ Live |
| **Onboarding** | `Onboarding.jsx` | Company setup quiz (name, industry, location, hiring needs) | ✅ Live |
| **Dashboard** | `Dashboard.jsx` | 5-card analytics: active jobs, candidates, interviews, conversion, pipeline | ✅ Live |
| **Listings** | `Listings.jsx` | CRUD for job postings with full edit modal | ✅ Live |
| **Create Listing** | `CreateListing.jsx` | Full job creation form (title, rate, type, model, description, requirements) | ✅ Live |
| **Candidates** | `Candidates.jsx` | Browse & evaluate candidates with avatars, CV preview, interview scheduling | ✅ Live |
| **Profile** | `Profile.jsx` | Company info (name, desc, website, location), logo upload, theme/lang settings | ✅ Live |
| **Inquiry** | `Inquiry.jsx` | Public access request form for new employers | ✅ Live |

### Components

| Component | File | Purpose |
|-----------|------|---------|
| `SideNav` | `components/SideNav.jsx` | Sidebar navigation (desktop) + bottom nav (mobile) |
| `Chart` | `components/Chart.jsx` | SVG bezier trend chart with animated reveal |
| `StatCard` | `components/StatCard.jsx` | Metric card with label, value, change indicator |
| `CandidateCard` | `components/CandidateCard.jsx` | Rich candidate card with avatar (signed URL), CV preview, interview scheduling |
| `MatchCard` | `components/MatchCard.jsx` | AI match result card |
| `ModernDatePicker` | `components/ModernDatePicker.jsx` | Custom date/time picker overlay for interview scheduling |
| `Toast` | `components/Toast.jsx` | Notification toast |
| `QuizStep` | `components/QuizStep.jsx` | Onboarding quiz step wrapper |

### State Management (`contexts.jsx`)

| Context | Data |
|---------|------|
| `I18nProvider` | Language (SK/EN), `t()` translation function |
| `ThemeProvider` | Dark/Light theme |
| `AppStateProvider` | `listings`, `companyProfile` (incl. location), `analytics`, `invitedIds`, `acceptedIds`, `refreshAnalytics()` |

---

## 🌐 Landing Page (`/`)

| Feature | Description | Status |
|---------|-------------|--------|
| Hero section | Full-screen hero with dual CTA (Students / Employers) | ✅ Live |
| Lead capture | Email + phone signup form → Supabase `submissions` table | ✅ Live |
| Demo iframes | Embedded student/employer demo portals | ✅ Live |
| i18n | Slovak (default) + English toggle | ✅ Live |
| Theme | Light (default) + Dark toggle | ✅ Live |

---

## 🔌 API Reference (`server.js`)

### Authentication & Profiles

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/employer/ensure-profile` | JWT | Create/update employer profile (name, desc, website, location) |
| `GET` | `/api/employer/profile` | JWT | Get employer profile |
| `POST` | `/api/student/profile` | JWT | Create/update student profile (name, skills, avatar_url, cv_id) |
| `GET` | `/api/student/profile` | JWT | Get student profile |

### CV & File Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/cvs/upload` | JWT | Upload CV (multipart → Supabase Storage) |
| `GET` | `/api/cvs` | JWT | List user's uploaded CVs |
| `GET` | `/api/cvs/download/:cvId` | JWT | Get signed download URL |
| `DELETE` | `/api/cvs/:cvId` | JWT | Delete CV from storage + profile |
| `GET` | `/api/employer/cv/:cvId/signed-url` | JWT | Employer access to candidate CVs |

### Jobs & Applications

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/job-view` | No | Track job card impressions |
| `POST` | `/api/applications` | JWT | Create application (student swipe right) |
| `GET` | `/api/applications` | JWT | List user's applications |
| `PATCH` | `/api/applications/:id` | JWT | Update status (accept/decline/interview/counter-offer) |

### Employer Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `PATCH` | `/api/employer/jobs/:id` | JWT | Update job listing |
| `GET` | `/api/employer/candidates` | JWT | List candidates with profiles (avatar_url, skills, CV) |
| `PATCH` | `/api/employer/candidates/:id` | JWT | Update candidate status |
| `GET` | `/api/employer/analytics` | JWT | Dashboard analytics |
| `GET` | `/api/employers` | No | List all employers (for student search) |

### Company Pages (Public)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/company/:name` | No | Company profile + stats + all job listings |

---

## 🗄️ Database Schema (Supabase)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `jobs` | Job listings | `id`, `employer_id`, `title`, `company`, `rate`, `tags`, `lat`, `lng`, `work_model`, `duration`, `start_date` |
| `applications` | Student applications | `id`, `job_id`, `candidate_id`, `employer_id`, `status`, `interview_dates`, `selected_date` |
| `profiles` | Student profiles | `user_id`, `first_name`, `last_name`, `skills`, `education`, `location`, `avatar_url`, `cv_id`, `original_filename` |
| `employers` | Employer profiles | `id`, `name`, `description`, `website`, `location`, `logo_url` |
| `employer_members` | Employer team membership | `employer_id`, `user_id`, `role` |
| `submissions` | Landing page leads | `email`, `phone`, `consented`, `company_name` |
| `job_views` | View tracking | `job_id`, `user_id`, `employer_id` |
| `user_roles` | Role enforcement | `user_id`, `role` (candidate/employer) |
| `user_cvs` | CV metadata | `id`, `user_id`, `storage_path`, `original_filename` |

---

## 📦 Storage Architecture

- **Bucket**: `cvs` (private)
- **File Naming**: `{user_id}/avatar.{ext}`, `{user_id}/{timestamp}_{filename}.pdf`, `{user_id}/logo.{ext}`
- **URL Strategy**: Always use **signed URLs** — the bucket is private, public URLs return 403
- **Avatar Resolution**: Components resolve avatars on mount by listing storage files and generating fresh signed URLs
- **Single CV Model**: One CV per student; old CVs are deleted before uploading a new one
- **Cleanup**: Avatar and logo uploads delete previous files before uploading to prevent stale entries

---

## 🔐 Security Model

- **RLS Bypass**: All sensitive operations go through `server.js` using `SUPABASE_KEY` (service role)
- **JWT Validation**: `getUserFromToken()` helper validates tokens on every protected request
- **Portal Isolation**: Separate Supabase storage keys prevent cross-portal session conflicts
- **CSP Headers**: Content Security Policy restricts connections to `*.supabase.co` (https + wss)
- **File Access Control**: Server blocks access to `.env`, `package.json`, database files

---

## 🌍 Localization

Both portals support Slovak (SK) and English (EN):

| Portal | Implementation | Files |
|--------|---------------|-------|
| Student | `I18nContext.jsx` with `useTranslation()` hook | Inline translation objects |
| Employer | `i18n.js` with `useI18n()` context | Centralized translation file |

---

## 📂 Feature Documentation

Detailed per-feature documentation lives in `artifacts/`:

| Document | Feature |
|----------|---------|
| `feature_security_production.md` | Security hardening & env management |
| `feature_student_auth_onboarding.md` | Student registration & onboarding flow |
| `feature_cv_management.md` | CV upload, preview, delete system |
| `feature_company_pages.md` | Instagram-style company profiles |
| `feature_search_filters.md` | Search filter drawer & filtering logic |
| `feature_employer_dashboard.md` | Live analytics dashboard |
| `feature_applications_interviews.md` | Application tracking & interview scheduling |
