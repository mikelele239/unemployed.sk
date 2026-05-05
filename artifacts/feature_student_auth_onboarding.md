# Feature: Student Auth & Onboarding
**Status**: 🛠️ Refinement in Progress
**App**: `apps/student`

## Purpose
Manages the entry of new and existing students into the platform, ensuring secure data collection and AI-driven profile creation.

## Auth Flow
- **Portal**: `CandidateAuth.jsx`
- **Logic**: Uses Supabase `signInWithPassword` for login and a custom `/api/auth/student/register` endpoint for registration (via the server for additional security/validation).
- **Session Management**: Tokens are stored in `localStorage` under `unemployed-student-auth`.

## Onboarding Flow
- **Portal**: `Onboarding.jsx`
- **Steps**:
  1. **CV Upload**: Real-time upload to Supabase storage via the server proxy.
  2. **AI Parsing**: Simulated progress bar while the backend processes the CV.
  3. **Profile Review**: User verifies the extracted data (Name, Education, Location, Skills).
  4. **Live Sync**: Finalized data is sent to `/api/profile` and saved to the Supabase `profiles` table.

## Security Features
- **Token-Based API**: All profile operations require a valid JWT Bearer token.
- **Service Role Isolation**: High-privilege operations are strictly restricted to the Node.js server.
- **Demo Switch**: `isDemoMode()` prevents accidental data modification during prototype testing.

## Known Issues / TODOs
- [ ] Ensure `dist` folder is rebuilt with latest security logic.
- [ ] Add better error handling for failed CV uploads in live mode.
