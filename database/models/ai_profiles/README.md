# AI Profiles Model (`ai_profiles` table)

The `ai_profiles` table stores detailed structured output from the OpenAI CV parsing engine. It serves as the data layer for candidate profile pages, holding parsed education details, languages, preferences, and AI-generated headlines/summaries.

## Table Schema

| Column | Data Type | Constraints / Default | Description |
|---|---|---|---|
| `user_id` | `UUID` | `PRIMARY KEY`, `REFERENCES auth.users(id) ON DELETE CASCADE` | Link to student user. |
| `full_name` | `TEXT` | | Full parsed candidate name. |
| `email` | `TEXT` | | Candidate email address. |
| `phone` | `TEXT` | | Parsed phone number. |
| `location` | `TEXT` | | Standard location text. |
| `hard_skills` | `TEXT[]` | `DEFAULT '{}'` | Array of parsed hard skills. |
| `soft_skills` | `TEXT[]` | `DEFAULT '{}'` | Array of parsed soft skills. |
| `languages` | `JSONB` | `DEFAULT '[]'` | Parsed language objects `{ name, level }`. |
| `certifications` | `TEXT[]` | `DEFAULT '{}'` | Academic and technical certificates. |
| `experience_years` | `SMALLINT`| `DEFAULT 0` | Total work experience. |
| `experience_level`| `TEXT` | `DEFAULT 'unknown'` | Level from `no_experience` to `experienced`. |
| `work_experience` | `JSONB` | `DEFAULT '[]'` | Detail lists of past job items. |
| `education_level` | `TEXT` | | Highest degree achieved. |
| `education_field` | `TEXT` | | Field of study (e.g. Computer Science). |
| `education_school`| `TEXT` | | School/university name. |
| `graduation_year` | `SMALLINT`| | Year of graduation. |
| `preferred_job_types` | `TEXT[]` | `DEFAULT '{}'` | Preferred types (e.g. Intern, Freelance). |
| `preferred_work_models` | `TEXT[]` | `DEFAULT '{}'` | remote, hybrid, or on-site. |
| `preferred_locations` | `TEXT[]` | `DEFAULT '{}'` | List of cities. |
| `min_salary` | `INTEGER`| | Minimum salary requirement. |
| `availability` | `TEXT` | | immediate, 2_weeks, 1_month, flexible. |
| `availability_hours` | `SMALLINT`| | Targeted working hours per week. |
| `salary_expectation` | `INTEGER`| | Monthly/hourly expectations. |
| `ai_headline` | `TEXT` | | Brief marketing headline. |
| `ai_summary` | `TEXT` | | Dynamic resume profile summary. |
| `ai_strengths` | `TEXT[]` | `DEFAULT '{}'` | AI highlighted candidate strengths. |
| `ai_development_areas`| `TEXT[]` | `DEFAULT '{}'` | AI identified improvement fields. |
| `ai_suggested_roles` | `TEXT[]` | `DEFAULT '{}'` | Suggested jobs best fitting profile. |
| `ai_profile_approved` | `BOOLEAN` | `DEFAULT false` | True when candidate approves parsed info. |
| `profile_completion_score` | `INTEGER` | `DEFAULT 0` | 0-100 calculated completeness metric. |
| `parse_status` | `TEXT` | `DEFAULT 'pending'` | pending, ready, needs_review, failed. |
| `raw_cv_text` | `TEXT` | | Extracted text from uploaded PDF/Docx. |
| `created_at` | `TIMESTAMPTZ`| `DEFAULT NOW()` | Record creation time. |
| `updated_at` | `TIMESTAMPTZ`| `DEFAULT NOW()` | Record modification time. |

## Relationships
- **Parent**: `auth.users(id)`
- **Related**: `profiles` table (contains basic presentation data sync).

## API Endpoints
- **`POST /api/cv/upload`**: Triggers async background parser storing results in `ai_profiles`.
- **`GET /api/ai-profile`**: Reads candidate's structured profile data.
- **`PATCH /api/ai-profile`**: Candidates update/save structural changes.

## Row-Level Security (RLS) Policies
- **`ai_profiles_select_own`**: Candidates `SELECT` own parsed data if `auth.uid() = user_id`.
- **`ai_profiles_update_own`**: Candidates `UPDATE` own parsed data.
- **`ai_profiles_employer_read`**: Employers can read profiles ONLY if `ai_profile_approved = true`.
- **`ai_profiles_service`**: Bypassed for internal server operations using `service_role`.
