# CONTEXT_VIEWS.md: Data Synchronization & Visibility

> **Last Updated**: 2026-05-06 (v2.4.0)

This document provides an overview of the data synchronization architecture between the Student and Employer portals, including the database schema, known resolved issues, and debugging tools.

---

## 🏗️ System Architecture

- **Backend**: Node.js Express server (`server.js`) acting as a secure proxy for Supabase (service role key bypasses RLS).
- **Portals**:
  - **Student Portal** (`/app`): Tinder-style job swiping interface.
  - **Employer Portal** (`/employer`): Dashboard for job management and candidate screening.
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS).
- **Authentication**: Supabase Auth (JWT based), portal-isolated storage keys.

---

## 📊 Database Schema (Key Tables)

### `public.jobs`
| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | `BIGINT` | Primary Key |
| `employer_id` | `UUID` | References `public.employers.id` |
| `title` | `TEXT` | Job title |
| `rate` | `TEXT` | Hourly/monthly rate |
| `work_model` | `TEXT` | Remote/On-site/Hybrid |

### `public.applications`
| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | `UUID` | Primary Key |
| `job_id` | `BIGINT` | References `public.jobs.id` |
| `candidate_id` | `UUID` | References `auth.users.id` |
| `employer_id` | `UUID` | Populated server-side for employer visibility |
| `status` | `TEXT` | Default: 'Pending'. Values: Pending, Interview, Interview-Confirmed, Counter-Offer, Hired, Rejected, Declined |
| `interview_dates` | `JSONB` | Array of offered interview date/times |
| `selected_date` | `TIMESTAMPTZ` | Candidate-selected or confirmed date |

### `public.profiles`
| Column | Type | Notes |
| :--- | :--- | :--- |
| `user_id` | `UUID` | Primary Key, references `auth.users.id` |
| `first_name` | `TEXT` | Student first name |
| `last_name` | `TEXT` | Student last name |
| `skills` | `TEXT[]` | Array of skill strings |
| `education` | `TEXT` | Education info |
| `location` | `TEXT` | City/region |
| `avatar_url` | `TEXT` | Signed URL to avatar in storage |
| `cv_id` | `TEXT` | Storage path to current CV |

### `public.employers`
| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | `UUID` | Primary Key |
| `name` | `TEXT` | Company name |
| `description` | `TEXT` | Company description |
| `website` | `TEXT` | Company website |
| `location` | `TEXT` | Company headquarters location |
| `logo_url` | `TEXT` | Signed URL to logo in storage |

### `public.job_views`
| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | `UUID` | Primary Key |
| `job_id` | `BIGINT` | References `public.jobs.id` |
| `user_id` | `UUID` | References `auth.users.id` (Optional) |
| `employer_id` | `UUID` | For direct RLS and dashboard visibility |

---

## 🔄 Data Synchronization Flow

### Application Flow
1. **Swipe Event**: Student swipes right in the Student Portal.
2. **API Call**: `POST /api/applications` with `{ jobId }`.
3. **Backend** (`server.js`):
   - Resolves `candidate_id` from JWT.
   - Fetches `employer_id` from `jobs` table.
   - Inserts into `applications` with both IDs.
4. **Employer Portal**: Queries applications filtered by `employer_id`.

### Candidate Data Enrichment
1. **Employer** calls `GET /api/employer/candidates`.
2. **Server** fetches applications → enriches with profile data (avatar_url, skills, CV).
3. **CandidateCard** resolves avatar from storage with fresh signed URL on mount.

### Avatar/File Sync
1. **Upload**: Student uploads avatar → stored at `{uid}/avatar.{ext}` in `cvs` bucket.
2. **Signed URL**: `createSignedUrl()` generates a 1-year URL saved to `profiles.avatar_url`.
3. **Display**: Components resolve fresh signed URLs from storage on mount (not relying on DB value).

---

## ✅ Resolved Issues

| Issue | Resolution |
|-------|-----------|
| Blank Dashboard | Added `employer_id` to `job_views`, backfilled via `09_unified_sync_fix.sql` |
| ID Type Mismatch | Standardized `applications.id` as UUID |
| Column Naming | `employer_members.role` unified (was `member_role`) |
| Avatar Broken Images | Switched from `getPublicUrl()` to `createSignedUrl()` (bucket is private) |
| CV Spam (avatars in CV list) | Filter out files starting with `avatar.` or `logo.` from CV listing |
| Profile Save 400 Error | Routed saves through server proxy (bypasses RLS) |
| Employer Location Missing | Added `location` column via `10_add_employer_location.sql` |

---

## 🛠️ Debugging Toolkit

### Server Logs
Look for `[SYNC]` tags in the console output for:
- Resolution of `employer_id` during applications.
- Detection of `employer_id` for job views.
- Fallback events when direct links are missing.

### Recommended SQL Verification
```sql
-- Check applications are correctly linked to employers
SELECT a.id, a.job_id, a.employer_id, j.title, e.name as employer_name
FROM public.applications a
JOIN public.jobs j ON a.job_id = j.id
JOIN public.employers e ON a.employer_id = e.id;

-- Check profiles have avatar_url
SELECT user_id, first_name, last_name, avatar_url, cv_id
FROM public.profiles;

-- Check employers have location
SELECT id, name, location, logo_url FROM public.employers;
```
