# Feature: Security Hardening

**Status:** ✅ Implemented (Code) | 📋 SQL Ready to Deploy  
**Last updated:** 2026-05-06  
**Owner:** Platform  

---

## Overview

This document covers all security measures implemented across the platform including Supabase RLS policies, function hardening, server-side authorization guards, and input validation.

---

## 1. Supabase Security Fixes

> **Action required:** Run `supabase_security_fixes.sql` in Supabase SQL Editor

### 1.1 Function Search Path Hardening
All `SECURITY DEFINER` functions now have `SET search_path = public` to prevent search_path injection attacks:

| Function | Fix Applied |
|----------|-------------|
| `public.get_user_role()` | Switched to `SECURITY INVOKER` + locked search_path |
| `public.get_employer_analytics(uuid)` | Locked search_path + added `auth.uid()` guard |
| `public.get_employer_matches(uuid)` | Locked search_path + added `auth.uid()` guard |

### 1.2 EXECUTE Privilege Revocation
Revoked `EXECUTE` from `anon` and `authenticated` roles on all admin-only functions:
- `get_user_role()` — anon revoked
- `get_employer_analytics(uuid)` — anon revoked
- `get_employer_matches(uuid)` — anon revoked  
- `rls_auto_enable()` — anon + authenticated revoked

### 1.3 RLS Policy Tightening

| Table | Old Policy | New Policy |
|-------|-----------|-----------|
| `applications` | `WITH CHECK (true)` — anyone | `WITH CHECK (auth.uid() = student_id)` |
| `job_views` | `WITH CHECK (true)` — open | `WITH CHECK (auth.uid() = student_id)` |
| `jobs` | `WITH CHECK (true)` — open | `WITH CHECK (auth.uid() = employer_id)` |
| `submissions` | `WITH CHECK (true)` — open | Email format validation check |

### 1.4 Employers Table Policies
`employers` had RLS enabled but zero policies (= nobody could access via REST API):
- `employers_select_own` — authenticated can read own row
- `employers_insert_own` — authenticated can insert own row
- `employers_update_own` — authenticated can update own row
- `employers_public_read` — anon/authenticated can read any employer (company pages)

---

## 2. Server-Side Authorization

### 2.1 PATCH /api/applications/:id
- Now fetches `student_id` from DB before updating
- Verifies `student_id === user.id OR student_email === user.email` before allowing update
- Returns `403 Forbidden` if check fails

### 2.2 POST /api/applications
- Checks for duplicate (Supabase unique constraint returns 409)
- Returns clear error message for already-applied case

### 2.3 CV Endpoints
- All CV endpoints require valid Bearer token
- CV download creates signed URLs (1hr expiry) — never exposes raw storage paths
- CV parse only runs for the authenticated user's own CV

---

## 3. Input Validation

### 3.1 Employer Registration
- Password minimum 8 characters (client + server)
- Password confirmation match (client)
- Visual password strength indicator (weak/medium/strong)
- GDPR disclaimer required

### 3.2 Onboarding
- All required fields validated before finalizeMatching
- Skills cannot be empty strings
- Name split into first/last before DB insert

### 3.3 Avatar Upload
- Max file size: 5MB (server enforced)
- Accepted types: JPEG, PNG, WebP only
- Stored with `upsert: true` — replaces existing avatar

---

## 4. GDPR Compliance

### 4.1 CV Storage
- CVs stored in private Supabase Storage bucket `cvs`
- Access only via server-side signed URLs (1hr expiry)
- Employer CV access requires: valid session + employed candidate ownership
- Students can delete their own CV at any time

### 4.2 Data Minimization
- `student_profile` JSONB on applications stores only: name, education, location, skills, cv_id
- No raw CV text stored in DB — only structured extracted fields

---

## 5. Pending (External Setup)

| Item | Action | Location |
|------|--------|----------|
| Leaked Password Protection | Enable "Prevent use of leaked passwords" | Supabase Dashboard → Auth → Email |
| Custom SMTP | Configure Resend.com | Supabase Dashboard → Auth → SMTP |
| Rate Limiting | Configure at reverse proxy level | Nginx/Vercel/Railway |

---

## 6. New Tables (from SQL script)

### `employer_notifications`
```sql
id, employer_id, type, application_id, message, read, created_at
```
Types: `new_application | counter_offer | interview_confirmed | new_message`

### `swipes`
```sql
id, student_id, job_id, direction, created_at
UNIQUE(student_id, job_id)
```
Used for permanent deduplication of For You feed (DB-backed, survives localStorage clear).

### `profiles.avatar_url`
New column for storing public avatar image URL from `avatars` storage bucket.

### `applications.ai_score`
Integer (0-100) computed at application time using Jaccard similarity between job tags and student skills.
