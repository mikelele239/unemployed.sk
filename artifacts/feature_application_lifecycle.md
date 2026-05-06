# Feature: Application Lifecycle

**Status:** ✅ Implemented  
**Last updated:** 2026-05-06  
**Owner:** Platform  

---

## Overview

The full application lifecycle from student swipe → employer review → interview scheduling → outcome.

---

## Application States

```
Pending → [Employer] → Interview → [Student] → Interview-Confirmed
                     ↘               ↘→ Counter-Offer → [Employer] → Accept/Decline
                      → Rejected
                      → Hired

[Student] → Withdrawn (only from Pending)
[Student] → Declined (from Interview invite)
```

---

## Status Reference

| Status | Color | Who Sets | Visible To |
|--------|-------|----------|------------|
| `Pending` | Grey | Auto on apply | Both |
| `Viewed` | Blue | Auto when employer opens | Student |
| `Interview` | Orange | Employer | Student |
| `Interview-Confirmed` | Green | Student | Both |
| `Counter-Offer` | Purple | Student | Both |
| `Hired` 🎉 | Green | Employer | Student (celebration) |
| `Rejected` | Red | Employer | Student (with reason) |
| `Declined` | Red | Student | Both |
| `Withdrawn` | Grey | Student | Both |

---

## Student Actions

### Apply (ForYou swipe right)
- `POST /api/applications` with `{ job_id }`
- Duplicate check: returns 409 if already applied
- AI score computed server-side (Jaccard similarity, see below)

### Withdraw (Pending only)
- `PATCH /api/applications/:id` with `{ status: 'Withdrawn' }`
- Requires ownership check (`student_id === user.id`)
- Confirmation dialog shown before sending

### Confirm Interview Date
- `PATCH /api/applications/:id` with `{ selected_date: ISO_string }`
- Status auto-set to `Interview-Confirmed`

### Counter-Offer
- `PATCH /api/applications/:id` with `{ counter_date: ISO_string }`
- Status set to `Counter-Offer`

### Decline Interview
- `PATCH /api/applications/:id` with `{ status: 'Declined' }`
- Sets `interview_dates.declined = true`

---

## Employer Actions

### Set Interview Dates
- `PATCH /api/employer/candidates/:id` with `{ interview_dates: [ISO, ISO] }`
- Status auto-set to `Interview`

### Accept Counter-Offer
- `PATCH /api/employer/candidates/:id` with `{ counter_action: 'accept' }`
- Uses student's `counter_date` as `selected_date`
- Status → `Interview-Confirmed`

### Decline Counter-Offer
- `PATCH /api/employer/candidates/:id` with `{ counter_action: 'decline' }`
- Clears counter_date, keeps status as `Interview`

### Hire
- `PATCH /api/employer/candidates/:id` with `{ status: 'Hired' }`
- Triggers `POST /api/employer/notify-hired` (email)

### Reject
- `PATCH /api/employer/candidates/:id` with `{ status: 'Rejected', rejection_reason: string }`
- Reason stored in `interview_dates.rejection_reason`
- Shown to student in Applications with styled quote

---

## AI Match Scoring

**Algorithm:** Jaccard Similarity

```
score = |job.tags ∩ student.skills| / |job.tags ∪ student.skills| × 100
```

- Minimum: 10 (no zero scores)
- Penalty: 30 if student has no skills
- Default: 50 (fallback)
- Stored in `applications.ai_score` (integer, 0-100)

---

## Notifications

### Student (badge on Applications tab)
- Polls `/api/applications` every 30 seconds
- Counts status changes to actionable states: `Interview`, `Hired`, `Rejected`, `Counter-Offer`
- Red badge dot appears on Applications tab icon
- Clears when user navigates to Applications

### Employer (planned — table ready)
- `employer_notifications` table created with types: `new_application`, `counter_offer`, `interview_confirmed`
- Backend notification insert not yet wired to triggers

---

## Data Model

### `applications` table
```sql
id             uuid PK
job_id         uuid FK → jobs
candidate_id   uuid FK → auth.users
student_id     uuid FK → auth.users  -- same as candidate_id, explicit for RLS
student_email  text
student_name   text
student_profile jsonb  -- snapshot of profile at application time
status         text    -- state machine above
interview_dates jsonb  -- {offered_dates[], selected_date, counter_date, declined, rejection_reason}
ai_score       integer -- Jaccard similarity 0-100
created_at     timestamptz
```
