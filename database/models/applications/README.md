# Applications Model (`applications` table)

The `applications` table records the matching and communication lifecycle between candidates and employers for specific job listings. It supports interview scheduling, offer tracking, and AI reasoning preservation.

## Table Schema

| Column | Data Type | Constraints / Default | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Unique application tracking ID. |
| `job_id` | `BIGINT` | `REFERENCES public.jobs(id) ON DELETE CASCADE` | Job listing applied for. |
| `candidate_id` | `UUID` | `REFERENCES auth.users(id) ON DELETE CASCADE` | Applicant reference. |
| `employer_id` | `UUID` | `REFERENCES public.employers(id) ON DELETE CASCADE` | Reference to hiring company. |
| `student_name` | `TEXT` | `NOT NULL` | Full name of candidate. |
| `student_email` | `TEXT` | `NOT NULL` | Direct communication email. |
| `student_profile` | `JSONB` | | Snapshot of school, field, and bio attributes at submission. |
| `ai_score` | `INTEGER` | | Matching score (0 to 100) captured during apply. |
| `ai_reasoning` | `TEXT` | | AI reasoning explaining why the candidate matches the job. |
| `status` | `TEXT` | `DEFAULT 'Pending'` | Lifecycle state (see [Application Statuses](#application-statuses)). |
| `interview_dates` | `JSONB` | `DEFAULT '[]'::jsonb` | Proposed list of interview dates/times. |
| `selected_date` | `TIMESTAMPTZ` | | Employer-confirmed single interview date. |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Submission timestamp. |

## Application Statuses
- **`Pending`**: Standard default state.
- **`Viewed`**: Employer has read/opened the profile.
- **`Interview`**: Interview dates proposed by employer.
- **`Interview-Confirmed`**: Candidate has chosen one of the proposed dates.
- **`Hired`**: Employer extended successful offer.
- **`Rejected`**: Candidate dismissed by employer.
- **`Declined`**: Candidate declined interview or job offer.
- **`Counter-Offer`**: Custom negotiation state.

## Row-Level Security (RLS) Policies
- **Students read/insert/update own applications**: Restricted using `auth.uid() = candidate_id`.
- **Employers read/update applications for own jobs**: Checked by checking if `jobs.employer_id` equals `auth.uid()` or matching the corresponding linked job ID.
