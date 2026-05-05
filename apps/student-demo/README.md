# student-demo

Isolated student portal demo — no Supabase auth required.

## Stack
- React + Vite, `basename="/student-demo"`
- Mock jobs from `data/mockJobs.js`
- `demoMode.js` → always returns `true`

## Structure
```
src/
├── App.jsx              # Router, demo mode bypass, session handling
├── I18nContext.jsx      # SK/EN translation provider
├── demoMode.js          # Returns true (demo always on)
├── supabase.js          # Supabase client (unused in demo mode)
├── index.css            # Global styles + touch handling
├── design/tokens.css    # CSS custom properties
├── components/
│   ├── MainLayout.jsx   # Desktop sidebar + mobile bottom nav
│   ├── SwipeCard.jsx    # Tinder swipe card (framer-motion + leaflet map)
│   ├── JobDetail.jsx    # Job details bottom sheet
│   └── onboarding/      # Onboarding phases (split for modularity)
│       ├── WelcomePhase.jsx
│       ├── UploadPhase.jsx
│       ├── ParsingPhase.jsx
│       ├── ReviewPhase.jsx
│       ├── ManualPhase.jsx
│       └── ClimaxPhase.jsx
├── hooks/
│   ├── useJobs.js       # Fetches jobs (mock in demo, API in live)
│   └── useApplications.js
├── services/
│   └── cvApi.js         # CV upload service
├── data/
│   └── mockJobs.js      # Demo job listings
└── pages/
    ├── Onboarding.jsx   # Orchestrator (delegates to onboarding/ components)
    ├── ForYou.jsx       # Swipe deck
    ├── Search.jsx
    ├── Applications.jsx
    ├── Profile.jsx
    └── CandidateAuth.jsx
```

## Dev
```bash
npm install
npm run dev    # Vite dev server
npm run build  # Build to dist/
```
