# Feature: Employer Dashboard (Live Analytics)
**Status**: ✅ Active
**App**: `apps/employer`

## Purpose
Provides employers with a real-time analytics dashboard showing live metrics about their job listings, applications, recruitment pipeline, and a 7-day application trend chart.

## Data Flow
1. `AppStateProvider` (`contexts.jsx`) calls `loadAll()` on mount and every 15 seconds
2. `loadAll()` queries Supabase for:
   - Employer profile (`/api/employer/profile`)
   - All jobs by `employer_id` (`supabase.from('jobs')`)
   - All applications for those jobs (`supabase.from('applications')`)
3. Computes analytics from real data
4. Dashboard reads from `analytics` context state

## Live Metrics

| Metric | Source | Computation |
|--------|--------|-------------|
| **Total Views** | `jobs.views` | `SUM(views)` across all employer's jobs |
| **Total Applications** | `applications` | `COUNT(*)` for employer's job IDs |
| **Active Jobs** | `jobs` | `COUNT(*)` of employer's jobs |
| **Avg Match Score** | `jobs.match_score` | `AVG(match_score)` |
| **Pipeline** | `applications.status` | Grouped count by status (Pending/Viewed/Interview/Hired/Rejected) |
| **7-Day Trend** | `applications.created_at` | Daily bucketed count for last 7 days |

## Stat Card Subtexts (Dynamic)
Instead of hardcoded strings like "+24% this week", subtexts are now computed:

| Card | Example Dynamic Text |
|------|---------------------|
| Views | "12 celkovo zo všetkých ponúk" |
| Applications | "+2 dnes · 5 za 7 dní" |
| Process State | "3 čaká na vyjadrenie" or "Všetko vybavené ✓" |
| Active Listings | "2 ponuky aktívne" |

## Dashboard Components

### StatCard Grid (4 cards)
- Views, Applications, Recruitment State, Active Listings
- Each shows value + dynamic subtext + trend indicator

### Pipeline Distribution
- Visual bar chart showing Pending/Viewed/Interview/Hired/Rejected
- Percentage fill bars with status-specific colors
- Computed from actual `applications.status` values

### 7-Day Trend Chart (`Chart.jsx`)
- SVG bezier curve with animated reveal
- Data: 7-element array, one per day (Mon–Sun)
- Points show values on hover, grid lines at 0/50/100%

## Auto-Refresh
```js
const interval = setInterval(refreshAnalytics, 15000); // every 15s
```

## Previous Issues Fixed
- ❌ `total_views = allApps.length * 12` → ✅ `SUM(jobs.views)`
- ❌ `ai_score || 50` (nonexistent field) → ✅ `jobs.match_score`
- ❌ `[0,0,0,0,0,0, total]` (fake trend) → ✅ Real daily buckets from `created_at`
- ❌ `pipeline.pending` (lowercase, never matched) → ✅ `pipeline.Pending`
- ❌ Hardcoded "+24% tento týždeň" → ✅ Dynamic computed text

## Files
- `apps/employer/src/contexts.jsx` — `loadAll()` analytics computation
- `apps/employer/src/pages/Dashboard.jsx` — Dashboard rendering + stat cards
- `apps/employer/src/components/Chart.jsx` — SVG trend chart
- `apps/employer/src/components/StatCard.jsx` — Individual metric card
