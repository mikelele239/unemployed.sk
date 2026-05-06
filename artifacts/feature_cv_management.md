# Feature: CV Management
**Status**: ✅ Active
**App**: `apps/student` + `server.js`

## Purpose
Enables students to upload, manage, preview, and delete their CVs/resumes. Files are stored in Supabase Storage via server-side proxy to bypass RLS.

## Upload Flow
1. **Frontend**: `Profile.jsx` → `<input type="file">` triggers file selection
2. **API Call**: `POST /api/cvs/upload` with `multipart/form-data`
3. **Server Processing** (`server.js`):
   - Parses raw body using boundary splitting (no external dependencies)
   - Extracts filename and file buffer
   - Uploads to Supabase Storage bucket `cvs` under path `{userId}/{filename}`
   - Updates `profiles.cv_url` and `profiles.cv_filename` in the database
4. **Response**: Returns `{ cv_url, cv_filename }` to the client

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/cvs/upload` | Upload CV file (multipart/form-data) |
| `GET` | `/api/cvs` | List all CVs for authenticated user |
| `GET` | `/api/cvs/download/:cvId` | Generate signed download URL (60 min expiry) |
| `DELETE` | `/api/cvs/:cvId` | Remove CV from storage + clear profile reference |
| `GET` | `/api/employer/cv/:cvId/signed-url` | Employer access to candidate CVs |

## Security
- All endpoints require valid JWT Bearer token
- File upload uses `service_role` key on server side — no client-side storage access
- File paths are scoped to `{userId}/` to prevent cross-user access
- Supported types: `.pdf`, `.doc`, `.docx`

## Frontend Integration
- **Profile.jsx**: Upload button, preview link, delete button
- **Onboarding.jsx**: CV upload as first onboarding step (optional)
- **services/cvApi.js**: Client-side API wrappers (`uploadCV`, `listCVs`, `downloadCV`, `deleteCV`)

## Files Modified
- `server.js` — Lines 298–405 (4 endpoints)
- `apps/student/src/pages/Profile.jsx` — Upload/preview/delete handlers
- `apps/student/src/services/cvApi.js` — API wrappers
