# Profiles Model (`profiles` table)

The `profiles` table stores structural metadata representing a student's profile inside the candidate portal. It is used to present candidate details to recruiters and manage profile states.

## Table Schema

| Column | Data Type | Constraints / Default | Description |
|---|---|---|---|
| `user_id` | `UUID` | `PRIMARY KEY`, `REFERENCES auth.users(id) ON DELETE CASCADE` | Link to identity record. |
| `first_name` | `TEXT` | | Student's first name. |
| `last_name` | `TEXT` | | Student's last name. |
| `bio` | `TEXT` | | Profile intro/bio. |
| `education` | `TEXT` | | General education description. |
| `location` | `TEXT` | | Standardized candidate location. |
| `skills` | `TEXT[]` | `DEFAULT '{}'` | Extracted key skills array. |
| `job_preferences` | `TEXT[]` | `DEFAULT '{}'` | Array of chosen categories. |
| `avatar_url` | `TEXT` | | Location of avatar image in Supabase storage bucket. |
| `cv_id` | `TEXT` | | Storage path of CV file. |
| `original_filename` | `TEXT` | | Filename of uploaded resume. |
| `ai_profile_ready` | `BOOLEAN` | `DEFAULT false` | Flag set to true once background AI CV parsing completes. |
| `last_cv_parsed_at` | `TIMESTAMPTZ` | | Time when the last parse was processed. |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Record creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Record update timestamp. |

## Relationships
- **Parent**: `auth.users(id)` (1-to-1 matching) via `user_id`.
- **Children**: None directly, but matches against `ai_profiles(user_id)`.

## API Endpoints
- **`GET /api/student/profile`**: Reads candidate's own profile.
- **`POST /api/student/profile`**: Upserts profile variables (name, school, location, etc.).
- **`GET /api/employer/candidates`**: Allows employers to view profiles of applicants.

## Row-Level Security (RLS) Policies
- **`Users manage own profile`**: Allows authenticated users full CRUD operations if `auth.uid() = user_id`.
- **`Employers read applicant profiles`**: Allows employers to `SELECT` profiles if the candidate has applied to a job listing belonging to their company.
