# Changelog

## Codebase Audit (2026-05-06)

### Phase 1: Project Overview
- Mapped full project structure (5 apps, Express backend, Supabase)
- Identified 13 key issues across security, code quality, and organization

### Phase 2: Code Simplification
- Replaced all inline auth checks in server.js with shared `getUserFromToken` helper
- Simplified job update route using field allowlist loop instead of 12 if-statements
- Removed unused `React` imports from 27 JSX files (React 19 JSX transform)
- Fixed `React.useRef`/`React.Fragment` references to use named imports
- Removed unused files: `react.svg`, `vite.svg`, `hero.png` (Vite boilerplate) from all 4 apps
- Removed unused `CVUploadExample.jsx` and `NotFound.jsx` components
- Removed unused `getAccessTokenAsync` export from student supabase.js
- Simplified `getAccessToken` by removing verbose comments
- Removed decorative ASCII-art comment banners from server.js and auth.js
- Fixed student `package.json` name from "employee" to "student"
- Removed unused `useAppState` import from employer App.jsx

### Phase 3: Security Audit & Patching
- **[High]** Added authorization to `PATCH /api/employer/candidates/:id` — now verifies the employer owns the job
- **[High]** Added auth to `POST /api/jobs` and `DELETE /api/jobs/:id` — now requires token + ownership check
- **[High]** Job creation now sets `employer_id` from authenticated user
- **[High]** Removed hardcoded Supabase anon key from Netlify function fallback
- **[Medium]** Replaced `X-Frame-Options: ALLOWALL` with `SAMEORIGIN`
- **[Medium]** Added `X-Content-Type-Options: nosniff` and `Referrer-Policy` headers
- **[Medium]** Replaced wildcard CORS (`*`) with allowlist of known origins
- **[Medium]** Removed `'unsafe-eval'` from CSP script-src directive
- **[Medium]** Added CORS preflight (OPTIONS) handling
- **[Medium]** Removed unused duplicate `/api/job-view` endpoint (had race condition)
- **[Low]** Removed hardcoded Supabase project URL from netlify.toml comments
- Flagged TODO: Replace manual multipart CV parser with multer
- Flagged TODO: Move landing page Supabase key to build-time injection

### Phase 4: File Organization
- Moved root `supabase_migrations.sql` into `database/001_initial_migrations.sql`
- Removed stale `CONTEXT.md` and `CONTEXT_VIEWS.md` (replaced by README)
- Added `artifacts/` to `.gitignore`
- Simplified root `index.html` redirect
- Confirmed naming consistency across all apps (PascalCase, proper directories)

### Phase 5: Documentation
- Rewrote `README.md` with setup instructions, API reference, env vars, and project structure
- Created this `CHANGELOG.md`
