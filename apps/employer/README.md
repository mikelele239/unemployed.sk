# employer (Live)

Production employer portal — fully Supabase-authenticated.

## Stack
- React + Vite, `basename="/employer"`
- Supabase Auth (JWT Bearer tokens)
- `demoMode.js` → returns `false` in production

## Structure
```
src/
├── App.jsx              # Router, Supabase session management, role guard
├── contexts.jsx         # AppState, I18n contexts
├── i18n.js              # SK/EN translations
├── mockData.js          # Fallback data for empty states
├── demoMode.js          # Returns false in live, true for local dev override
├── supabase.js          # Supabase client (anon key)
├── index.css            # Global styles
├── design/tokens.css    # CSS custom properties
├── components/
│   ├── SideNav.jsx
│   ├── Chart.jsx
│   ├── StatCard.jsx
│   ├── CandidateCard.jsx
│   ├── MatchCard.jsx
│   ├── Toast.jsx
│   ├── ModernDatePicker.jsx
│   └── QuizStep.jsx
└── pages/
    ├── Dashboard.jsx    # Analytics, pipeline stats
    ├── Listings.jsx     # Active job listings
    ├── CreateListing.jsx
    ├── Candidates.jsx   # Applicant management
    ├── Profile.jsx
    ├── EmployerAuth.jsx # Login gate
    ├── Onboarding.jsx   # Company setup
    └── Inquiry.jsx      # Contact form for non-registered employers
```

## Dev
```bash
npm install
npm run dev    # Vite dev server (connects to Supabase via /api proxy)
npm run build  # Build to dist/
```

## Auth Flow
1. User visits `/employer` → `EmployerAuth.jsx` checks session
2. Login via `/api/auth/employer/login` → server validates role
3. Session stored in `localStorage` as `employer_token`
4. All API calls send `Authorization: Bearer <token>`
