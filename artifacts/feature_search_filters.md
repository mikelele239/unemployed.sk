# Feature: Search Filters
**Status**: ✅ Active
**App**: `apps/student`

## Purpose
Provides students with functional filtering tools to narrow down job listings by minimum hourly rate and industry focus area.

## Filter Types

### 1. Minimum Rate Filter
- Options: `5€+`, `7€+`, `10€+` (toggleable, single-select)
- Logic: Parses the `job.rate` string (e.g. `"8.00€"`) → extracts numeric value → compares against threshold
- Parser: `parseRate()` function handles various rate string formats

### 2. Focus Area Filter
- Options: `Marketing`, `IT & Tech`, `Gastro`, `Retail`, `Administratíva`, `Sklad` (multi-select)
- Logic: Joins `job.title` + `job.tags[]` into a single string → case-insensitive match against selected areas

### 3. Category Tabs
- Options: `Všetky`, `Brigády`, `Stáže`, `Jednorázovky`
- Logic: Filters by `job.type` field

### 4. Text Search
- Input field with search icon
- Logic: Filters by `job.title` and `job.company` (case-insensitive `includes`)

## UI Components

### Filter Button (Search bar)
- Shows filter count badge when active (orange circle with number)
- Border turns accent-colored when filters are active

### Filter Drawer
- **Slides from the right** side (not bottom)
- Max-width: 340px, full height
- Spring animation: `x: '100%' → '0%'`
- Left-rounded corners with shadow
- Contains: rate buttons, focus area chips, apply button, reset button

### Active Filter Pills
- Appear below search bar when filters are active
- Each pill shows filter value + ✕ remove button
- "Clear all" link to reset everything

## Files
- `apps/student/src/pages/Search.jsx` — All filter logic and UI
