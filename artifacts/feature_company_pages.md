# Feature: Company Pages
**Status**: ✅ Active
**App**: `apps/student` + `server.js`

## Purpose
Instagram-style company profile pages accessible from the student portal. Students can click any company name to view a branded page showing the company's profile, stats, and all active job listings.

## User Flow
1. Student sees a company name anywhere in the app (ForYou, Search, Applications, JobDetail)
2. Company name is clickable (highlights on hover)
3. Click navigates to `/company/:companyName`
4. `CompanyProfile.jsx` fetches data from `GET /api/company/:name`
5. Page displays: gradient logo, stats, about section, and job grid
6. Student can view details and apply to any job directly

## API Endpoint

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/company/:name` | No | Returns company profile, stats, and all jobs |

### Response Shape
```json
{
  "company": { "name", "description", "website", "color", "logo" },
  "stats": { "activeJobs", "totalApplications", "avgMatchScore" },
  "jobs": [ { ...jobFields, "applications": count } ]
}
```

## Navigation Entry Points
Company names are clickable in **5 locations**:

| Component | File | How |
|-----------|------|-----|
| ForYou (desktop) | `pages/ForYou.jsx` | `navigate(/company/...)` on click |
| SwipeCard (mobile) | `components/SwipeCard.jsx` | `navigate(/company/...)` with `stopPropagation` |
| Search cards | `pages/Search.jsx` | Hover highlight + navigate |
| JobDetail overlay | `components/JobDetail.jsx` | Closes overlay → navigates |
| Applications list | `pages/Applications.jsx` | Hover highlight + navigate |

## UI Design
- **Header**: 80px gradient company logo, name, website link, background glow effect
- **Stats Row**: 3 cards (Jobs, Applicants, AI Match) with icon + number
- **About Section**: Collapsible description with "Show more" toggle
- **Job Grid**: Staggered Framer Motion reveal, cards match Search page styling
- **Empty State**: 📭 icon with "No active listings" message

## Route
- Path: `/company/:companyName` (inside MainLayout)
- Registered in `apps/student/src/App.jsx`

## Files
- `server.js` — `GET /api/company/:name` endpoint
- `apps/student/src/pages/CompanyProfile.jsx` — Full page component
- `apps/student/src/App.jsx` — Route registration
- 5 files updated for clickable company names
