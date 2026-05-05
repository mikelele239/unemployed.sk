# employer-demo

Isolated employer portal demo — no Supabase auth required.

## Stack
- React + Vite, `basename="/employer-demo"`
- Mock data via `mockData.js`
- `demoMode.js` → always returns `true`

## Structure
```
src/
├── App.jsx              # Router, demo mode bypass
├── contexts.jsx         # AppState, I18n contexts
├── i18n.js              # SK/EN translations
├── mockData.js          # Demo data for listings, candidates
├── demoMode.js          # Returns true (demo always on)
├── index.css            # Global styles + mobile nav
├── design/tokens.css    # CSS custom properties
├── components/
│   ├── SideNav.jsx      # Responsive sidebar / mobile bottom nav
│   ├── Chart.jsx        # Line chart for analytics
│   ├── StatCard.jsx     # KPI stat cards
│   ├── CandidateCard.jsx
│   ├── MatchCard.jsx
│   ├── Toast.jsx
│   ├── ModernDatePicker.jsx
│   └── QuizStep.jsx
└── pages/
    ├── Dashboard.jsx
    ├── Listings.jsx
    ├── CreateListing.jsx
    ├── Candidates.jsx
    ├── Profile.jsx
    ├── EmployerAuth.jsx
    ├── Onboarding.jsx
    └── Inquiry.jsx
```

## Dev
```bash
npm install
npm run dev    # Vite dev server
npm run build  # Build to dist/
```
