# Employers Model (`employers` table)

The `employers` table stores general company metadata and details shown in both the student portal (to candidates browsing jobs) and the employer portal.

## Table Schema

| Column | Data Type | Constraints / Default | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Unique company identifier. |
| `name` | `TEXT` | `NOT NULL` | Registered company/brand name. |
| `website` | `TEXT` | | Company web homepage. |
| `description` | `TEXT` | | Company description / details. |
| `location` | `TEXT` | | Company location. |
| `logo_url` | `TEXT` | | Signed URL reference pointing to logo in Supabase Storage. |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Record creation timestamp. |

## Relationships
- **Children**: 
  - `jobs(employer_id)` (1-to-many listings)
  - `employer_members(employer_id)` (1-to-many team members)
  - `applications(employer_id)` (1-to-many job applications)

## API Endpoints
- **`GET /api/employer/profile`**: Reads employer's own profile.
- **`POST /api/employer/ensure-profile`**: Upserts name, website, description, and location.
- **`POST /api/employer/logo-upload`**: Uploads logo to `cvs` storage bucket and saves signed URL to `logo_url`.
- **`GET /api/company/:name`**: Public endpoint returning company details, active listings, and stats.

## Row-Level Security (RLS) Policies
- Restricts direct client mutations. Mutations route via `server.js` using the admin service role key to bypass RLS.
- Publicly readable via company portal pages.
