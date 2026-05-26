# Job Match Criteria Model (`job_match_criteria` table)

The `job_match_criteria` table holds the precise requirements, weights, hard gates, and preferred profiles for each job posting. It dictates how the matching engine evaluates and scores candidate profiles.

## Table Schema

| Column | Data Type | Constraints / Default | Description |
|---|---|---|---|
| `job_id` | `BIGINT` | `PRIMARY KEY`, `REFERENCES public.jobs(id) ON DELETE CASCADE` | Job listing link. |
| `required_skills` | `TEXT[]` | `DEFAULT '{}'` | Array of mandatory skill requirements. |
| `preferred_skills` | `TEXT[]` | `DEFAULT '{}'` | Desirable secondary skills. |
| `trainable_skills` | `TEXT[]` | `DEFAULT '{}'` | Skills employer is willing to teach. |
| `nice_to_haves` | `TEXT[]` | `DEFAULT '{}'` | Helpful nice-to-have skill assets. |
| `min_education_level` | `TEXT` | | Minimum level expected. |
| `min_experience_years`| `SMALLINT`| `DEFAULT 0` | Minimum years of experience. |
| `required_languages` | `JSONB` | `DEFAULT '[]'` | Required languages and levels. |
| `work_model` | `TEXT` | | Remote, Hybrid, On-site requirement. |
| `location_strict` | `BOOLEAN` | `DEFAULT false` | If true, location matches are treated as hard gates. |
| `salary_min` | `INTEGER` | | Low end of budget. |
| `salary_max` | `INTEGER` | | High end of budget. |
| `category` | `TEXT` | | Industry category. |
| `role_family` | `TEXT` | | Standard role template tag (e.g. `Developer`). |
| `role_level` | `TEXT` | | Target level (e.g. `Junior`, `Medior`). |
| `hard_gates` | `JSONB` | `DEFAULT '[]'` | Custom critical compliance rules. |
| `success_factors` | `JSONB` | `DEFAULT '[]'` | Custom V2/V3 success factor weights. |
| `criteria_version` | `INTEGER` | `DEFAULT 1` | Version for change audit trail. |
| `calibration_snapshot`| `JSONB` | | Last calibration variables. |
| `weight_skills` | `SMALLINT` | `DEFAULT 30` | Priority weighting for skills (0-100). |
| `weight_location` | `SMALLINT` | `DEFAULT 15` | Priority weighting for location (0-100). |
| `weight_job_type` | `SMALLINT` | `DEFAULT 15` | Priority weighting for job type. |
| `weight_availability` | `SMALLINT` | `DEFAULT 10` | Priority weighting for availability. |
| `weight_education` | `SMALLINT` | `DEFAULT 10` | Priority weighting for education. |
| `weight_experience` | `SMALLINT` | `DEFAULT 10` | Priority weighting for experience. |
| `weight_language` | `SMALLINT` | `DEFAULT 5` | Priority weighting for language skill. |
| `weight_salary` | `SMALLINT` | `DEFAULT 3` | Priority weighting for salary. |
| `weight_work_mode` | `SMALLINT` | `DEFAULT 2` | Priority weighting for work model. |

## Associated Tables
- **`criteria_audit_log`**: Tracks edits made to matching criteria for transparency.
  - `id` (UUID PRIMARY KEY)
  - `job_id` (BIGINT REFERENCES jobs)
  - `employer_id` (UUID)
  - `action` (TEXT)
  - `criteria_snapshot` (JSONB)
  - `created_at` (TIMESTAMPTZ)

## API Endpoints
- **`POST /api/job-criteria`**: Sets or calibrates job requirements (Employer auth needed).
- **`GET /api/job-criteria/:jobId`**: Reads criteria configuration for calibration interface.

## Row-Level Security (RLS) Policies
- **`jmc_select_all`**: Any authenticated user can read criteria profiles.
- **`jmc_service`**: Internal backend operations bypass via `service_role`.
