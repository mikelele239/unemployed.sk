# CONTEXT_VIEWS.md: Data Synchronization & Visibility Debugging

This document provides a comprehensive overview of the current system architecture, database schema, and known issues regarding the data synchronization failure between the Student and Employer portals.

---

## 🏗️ System Architecture

- **Backend**: Node.js Express server (`server.js`) acting as a secure proxy for Supabase.
- **Portals**:
  - **Student Portal**: Tinder-style job swiping interface.
  - **Employer Portal**: Dashboard for job management and candidate screening.
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS).
- **Authentication**: Supabase Auth (JWT based).

---

## 📊 Database Schema (Key Tables)

### `public.jobs`
| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | `BIGINT` | Primary Key |
| `employer_id` | `UUID` | References `public.employers.id` |
| `title` | `TEXT` | Job title |

### `public.applications`
| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | `UUID` | Primary Key |
| `job_id` | `BIGINT` | References `public.jobs.id` |
| `candidate_id` | `UUID` | References `auth.users.id` |
| `employer_id` | `UUID` | **CRITICAL**: Reseach indicates this must be populated for employer visibility. |
| `status` | `TEXT` | Default: 'Pending' |

### `public.job_views`
| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | `UUID` | Primary Key |
| `job_id` | `BIGINT` | References `public.jobs.id` |
| `user_id` | `UUID` | References `auth.users.id` (Optional) |
| `employer_id` | `UUID` | **FIXED**: Added to enable direct RLS and dashboard visibility. |

### `public.employer_members`
| Column | Type | Notes |
| :--- | :--- | :--- |
| `employer_id` | `UUID` | |
| `user_id` | `UUID` | |
| `role` | `TEXT` | **RESOLVED**: Unified naming (was member_role). |

---

## 🔄 Data Synchronization Flow

1.  **Swipe Event**: Student swipes right (Like) in the Student Portal.
2.  **API Call**: `POST /api/applications` is called with `{ jobId }`.
3.  **Backend Processing** (`server.js`):
    - Resolves `candidate_id` from the JWT.
    - **Crucial Step**: Fetches the `employer_id` from the `jobs` table using the provided `job_id`.
    - Inserts a record into `public.applications` containing both `job_id` and the resolved `employer_id`.
4.  **Employer Portal**:
    - Calls `GET /api/applications`.
    - Server filters applications by the `employer_id` associated with the logged-in employer's user account.
    - **RLS Policy**: Row-level security on Supabase should also enforce that employers can only see applications where `employer_id` matches their own.

---

## 🔍 Known Issues & Blockers

### 1. The "Blank Dashboard" Problem (RESOLVED)
Issue was caused by missing `employer_id` in `job_views`. 
- **Fix**: Added column and automated backfill via `09_unified_sync_fix.sql`.
- **Harden**: `server.js` now has multi-stage fallback (Job ID -> Company Name Match -> Master Admin).

### 2. ID Type Mismatch (RESOLVED)
- **Standard**: `applications.id` is standardized as **UUID** in sync with `employers.id`.

### 3. Column naming (RESOLVED)
- **Standard**: `employer_members` table now uses `role` globally (renamed from `member_role`).

---

## 🛠️ Debugging Toolkit

### Server Logs
Look for `[SYNC]` tags in the console output. These indicate:
- Resolution of `employer_id` during applications.
- Detection of `employer_id` for job views.
- Fallback events when direct links are missing.

### Recommended SQL Verification
Run this to see if applications are correctly linked to employers:
```sql
SELECT a.id, a.job_id, a.employer_id, j.title, e.name as employer_name
FROM public.applications a
JOIN public.jobs j ON a.job_id = j.id
JOIN public.employers e ON a.employer_id = e.id;
```

---

## 📝 Recent Actions Taken
- **Employer Access Protection**: Decommissioned public self-registration. Replaced the "Register" flow with a dedicated "Request Access" portal at `/employer/inquiry`.
- **Lead Capture Backend**: Implemented `POST /api/auth/employer/inquiry` and added `company_name` to the `submissions` table.
- **Enhanced Sync Logging**: Added comprehensive `[SYNC]` tags across `ForYou.jsx`, `useApplications.js`, and `server.js` to track Job Views and Application creation in real-time.
- **Production Build Sync**: Standardized on full rebuilds (`npm run build:all`) to ensure all `src` changes are reflected in the `dist` folders served by Node.
- Unified `employer_members` column naming to `role`.
- Implemented robust `employer_id` fallbacks in `server.js` for both applications and views.
- Verified that `get_employer_analytics` RPC handles the new schema correctly.

