# Core AI & Matching Engines (`lib/`)

This directory houses the foundational libraries, data algorithms, and OpenAI parsing orchestrators that power **unemployed.sk**.

## Core Components

### 1. CV Parsing Pipeline (`ai-cv-parser.js`)
Parses CV text through OpenAI GPT-4o-mini to build a structured candidate profile.
- Restructures output into bilingual formats (`{sk: "...", en: "..."}`) for descriptions and summaries.
- Implements fallback rule-based parser when API limits or network timeouts are reached.
- Manages cost and API rate tracking (`usageTracker`) with daily budget controls.
- Shared `usageTracker` also gates AI verification interview calls (`ai-verification.js`).
- Per-user limit: 50 calls/day. Global daily budget: $1.00 USD.

### 2. NLP Extraction Pipeline (`ai-extraction.js`)
Performs client-side token extraction and pre-parsing filtering.
- Implements standard regex token matching for emails, phone numbers, cities, and URLs.
- Sanitizes input text, matching normalized keywords for languages and tools.

### 3. Profile Constructor (`ai-profile-builder.js`)
Aggregates CV datasets, user edits, and AI assumptions into an organized profile structure.
- Builds a unified format containing `hard_skills`, `soft_skills`, `experience_years`, `education`, and `languages`.
- Produces contextual summaries and suggested roles.

### 4. Matching Calibration (`matching-config.js`)
Houses static weights, matching rules, skill mappings, and industry categories.
- Includes pre-built templates for standard roles (e.g. Frontend Developer, QA Engineer).
- Maps success factors (such as technical proficiency, availability, and location) to target dimensions.

### 5. Matching Scoring Engine (`matching-engine.js`)
Computes candidate-to-job matching compatibility scores (0 to 100).
- **Match Bands**: Maps scores to classes `A` (85-100) down to `E` (0-39).
- **Eligibility Tiers**: Evaluates compliance against hard constraints, designating candidates as `eligible`, `near_miss`, or `not_eligible`.
- **Profile Strength**: Calculates completion completeness percentages based on missing attributes.
