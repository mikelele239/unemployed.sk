# API Routers (`routes/`)

This directory houses the modular controllers and endpoint routing of the Express backend. All operations interact directly with Supabase via the server-side client, using administrative permissions to ensure secure writes while enforcing validation rules.

## Router Modules

### 1. Authentication & Profiles (`auth.js`)
Handles client authorization, registration flows, and user profile management.
- **`POST /api/auth/student/register`**: Registers candidates via the admin API (avoiding confirmation emails).
- **`POST /api/auth/employer/register`**: Registers employers and inserts company profile records.
- **`POST /api/auth/employer/login`**: Authenticates employers; rejects candidates trying to access employer dashboards.
- **`POST /api/auth/forgot-password` & `/api/auth/update-password`**: Security flows for resetting password.
- **`GET` & `POST` `/api/student/profile`**: Upserts student personal details, skill tags, and associated CV files.
- **`POST /api/submit`**: Handles email/phone inquiries from the landing page.

### 2. Job Postings & Listings (`jobs.js`)
Manages listing creations, view counts, and general availability filters.
- **`GET /api/jobs`**: Lists all active job postings.
- **`POST /api/jobs`**: Creates a new job posting for an authenticated employer.
- **`DELETE /api/jobs/:id`**: Deletes a job listing (requires ownership validation).
- **`POST /api/jobs/:id/view`**: Increments job impression counts via custom RPC.

### 3. AI & Matching Engine Pipeline (`ai-matching.js`)
Integrates candidate CV parsed datasets against job requirements.
- **`POST /api/ai-profile/parse`**: Re-parses an existing CV through the AI pipeline.
- **`GET` & `PATCH` `/api/ai-profile`**: Views and updates structural AI-parsed resumes.
- **`GET /api/match-scores`**: Retrieves matches for the student portal.
- **`GET /api/employer/match-scores/:jobId`**: Retrieves ranked matching candidate cards for a specific job.
- **`POST /api/job-criteria`**: Enforces technical weights, success factor calibrations (V2), and hard gates.
- **`POST /api/match/recalculate`**: Forces a match score update.

## Middleware & Security Patterns
- **`getUserFromToken`**: Decodes JWT and validates authorization tokens against Supabase auth.
- **`rateLimit`**: IP-based limits for sensitive signups (e.g. `/api/submit`).
- **Input Sanitization**: Body payload limits are enforced at the root (`server.js`).
