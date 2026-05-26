# Administrative & Diagnostic Scripts (`scripts/`)

This directory contains standalone Node.js scripts designed for seeding mock data, performing batch database corrections, recalculating algorithmic scores, and diagnosing environment configuration states.

## Seeding & Demo Setup

### 1. Lidl Employer Demo (`setup-lidl-demo.js`)
Configures a dedicated showcase employer profile ("Lidl Slovenská republika") and inserts tailored jobs (such as store managers, logistics associates, and cashiers) alongside corresponding custom match criteria.

### 2. General Jobs Seeder (`seed-10-jobs.js`)
Seeds 10 distinct job listings spanning diverse sectors (e.g. hospitality, logistics, administration, retail, and IT) to flesh out candidate swipe decks during testing.

### 3. Bratislava Geolocation Seeder (`seed-3-map-jobs.js`)
Seeds 3 listings with explicit coordinate bounds mapping within central Bratislava (Staré Mesto, Ružinov, Petržalka). Used to verify candidate Tinder-like swipe maps (utilizing Leaflet).

---

## Batch Operations & Maintenance

### 4. Recalculate Match Scores (`recalc-matches.js`)
Queries all approved candidate `ai_profiles` and active `job_match_criteria` configurations, executing the full V3 matching logic before updating cache records in `match_scores`.

### 5. CV Reparsing Engine (`reparse-cvs.js`)
Pulls raw resumes from storage buckets for candidates lacking valid parsed records and streams them through the OpenAI text-parsing pipeline.

### 6. OpenAI Prompt Modifier (`update-prompt.js`)
Directly edits and deploys system prompt directives to calibrate parsed outputs from GPT-4o-mini.

---

## Diagnostics & Verification

### 7. Language Sync Check (`check-langs.js`)
Scans parsed JSON arrays in `ai_profiles` to verify bilingual translation compliance (e.g. correct English vs. Slovak translation fields).

### 8. AI Attributes Inspector (`check-ai-data.js`)
Validates that AI profile attributes adhere to type declarations (e.g. `hard_skills` parsed as array, `experience_years` as integers).

### 9. Candidate Debugger (`debug-candidates.js`)
Prints active profile lists, checking auth states, parse logs, and completion levels.

### 10. Timestamp Checker (`check-timestamps.js`)
Validates that updated/created dates correctly align across related `profiles` and `ai_profiles` documents.

### 11. Schema Migrator (`add-v3-columns.js`)
Performs additive column alterations for V3 migration on database instances.

### 12. Local API Tester (`test-api.js`)
Executes basic request checks against `localhost:3000` endpoints to ensure service status.
