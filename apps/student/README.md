# student (Live)

Production student portal — fully Supabase-authenticated.

## Stack
- React + Vite, `basename="/app"`
- Supabase Auth (JWT Bearer tokens)
- `demoMode.js` → returns `false` in production

## Structure
```
src/
├── App.jsx              # Router, Supabase session, onboarding gate
├── I18nContext.jsx      # SK/EN translation provider
├── demoMode.js          # Returns false in live, true for local dev override
├── supabase.js          # Supabase client + getAccessToken helper
├── index.css            # Global styles
├── design/tokens.css    # CSS custom properties
├── components/
│   ├── MainLayout.jsx   # Desktop sidebar + mobile bottom nav
│   ├── SwipeCard.jsx    # Tinder swipe card
│   └── JobDetail.jsx    # Job bottom sheet
├── hooks/
│   ├── useJobs.js       # Fetches from /api/jobs with auth token
│   └── useApplications.js
├── services/
│   └── cvApi.js         # CV upload to /api/cv
├── data/
│   └── mockJobs.js      # Fallback data for empty states
└── pages/
    ├── Onboarding.jsx   # Profile setup wizard
    ├── ForYou.jsx       # Swipe deck (main screen)
    ├── Search.jsx       # Browse & filter jobs
    ├── Applications.jsx # Applied jobs tracker
    ├── Profile.jsx      # User profile editor
    └── CandidateAuth.jsx # Login / register gate
```

## Dev
```bash
npm install
npm run dev    # Vite dev server
npm run build  # Build to dist/
```

## Auth Flow
1. User visits `/app` → `CandidateAuth.jsx` checks Supabase session
2. Register via `/api/auth/student/register` (admin API, auto-confirms)
3. Login via Supabase client directly (`signInWithPassword`)
4. Onboarding runs once; completion flag stored in `localStorage`
