# Match Scores Model (`match_scores` table)

The `match_scores` table acts as the cache layer for pre-computed compatibility scores between candidates and active job listings. It is calculated by the background matching engine (`lib/matching-engine.js`).

## Table Schema

| Column | Data Type | Constraints / Default | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Unique match record ID. |
| `user_id` | `UUID` | `NOT NULL`, `REFERENCES auth.users(id) ON DELETE CASCADE` | Candidate reference. |
| `job_id` | `BIGINT` | `NOT NULL`, `REFERENCES public.jobs(id) ON DELETE CASCADE` | Job listing reference. |
| `overall_score` | `INTEGER` | `NOT NULL`, `DEFAULT 0` | Standard match percentage (0 to 100). |
| `match_band` | `TEXT` | | V3 score classification (Bands `A`, `B`, `C`, `D`, `E`). |
| `eligibility_tier` | `TEXT` | `DEFAULT 'eligible'` | Hard constraint compliance (`eligible`, `near_miss`, `not_eligible`). |
| `eligible` | `BOOLEAN` | `DEFAULT true` | Logical filter mapping whether candidate meets basic criteria. |
| `breakdown` | `JSONB` | `DEFAULT '{}'` | Category breakdown scores (skills, location, rate, etc.). |
| `match_reasons` | `TEXT[]` | `DEFAULT '{}'` | Human-readable points explaining match strengths. |
| `gaps` | `TEXT[]` | `DEFAULT '{}'` | Identified missing items or weak points. |
| `missing_required`| `TEXT[]` | `DEFAULT '{}'` | Required skills or gates candidate failed to satisfy. |
| `criteria_version` | `INTEGER` | `DEFAULT 1` | Associated job requirement criteria version. |
| `calculated_at` | `TIMESTAMPTZ`| `DEFAULT NOW()` | Score calculation timestamp. |

## Match Classification V3

### 1. Match Bands
- **`A`**: 85 - 100 (Exceptional match)
- **`B`**: 70 - 84 (Strong match)
- **`C`**: 55 - 69 (Good match)
- **`D`**: 40 - 54 (Average match)
- **`E`**: 0 - 39 (Weak match)

### 2. Eligibility Tiers
- **`eligible`**: All critical hard gates and mandatory fields matched.
- **`near_miss`**: Missing one non-critical gate or trainable requirement.
- **`not_eligible`**: Fails mandatory criteria (e.g. location mismatch, no work permit).

## API Endpoints
- **`GET /api/match-scores`**: Candidates view jobs sorted by score.
- **`GET /api/employer/match-scores/:jobId`**: Employers read candidate match cards.
- **`POST /api/match/recalculate`**: Server recomputes table contents.

## Row-Level Security (RLS) Policies
- **`ms_select_own`**: Candidates read own matches if `auth.uid() = user_id`.
- **`ms_service`**: Bypassed for internal backend writes using `service_role`.
