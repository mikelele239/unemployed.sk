# AI Matching v3 — Phase 1 + Phase 2 Changelog

**Date:** 2026-05-11  
**Status:** Implemented

---

## Phase 1 Changes

### Matching Engine (`lib/matching-engine.js`)
- **Match Bands (A–E):** Every score includes `match_band` and `match_band_label` (bilingual)
- **Three-tier Eligibility:** `eligible`, `near_miss`, `not_eligible`
- **Trainable Skills:** Reduced penalty (0.3 instead of 0.0) for flagged trainable skills
- **Bilingual Gap/Reason Strings:** JSON `{sk, en}` format via `biGap()`/`biReason()` helpers
- **New exports:** `getMatchBand()`, `MATCH_BANDS`

### Routes (`routes/ai-matching.js`)
- Updated both recalculate upserts to handle bilingual JSON gap strings and persist `match_band`, `eligibility_tier`, `criteria_version`

### Employer Portal
- **CandidateCard:** Colored match band labels, eligibility tier badges, trainable gap indicators (⚡), AI disclaimer
- **Candidates.jsx:** Passes `match_band` and `eligibility_tier` to CandidateCard
- **CreateListing.jsx:** Removed dead weight sliders

### Student Portal
- **ForYou.jsx:** Bilingual match reasons/gaps, band labels in match summary pill and drawer

---

## Phase 2 Changes

### Matching Engine V2 Criteria Support
- **`deriveWeightsFromFactors()`**: Converts 100-point success factor budget into engine dimension weights using `SUCCESS_FACTOR_DIMENSION_MAP`
- **`evaluateHardGate()`**: Evaluates structured hard requirements (language, availability, location, education) with cross-language synonym matching (Angličtina ↔ English etc.)
- **V2 eligibility**: Hard gate failures drive eligibility in V2 mode (vs skill gaps in V1)
- **`criteria_version`**: Track whether score was generated from V1 or V2 criteria

### Matching Config (`lib/matching-config.js`)
- **`SUCCESS_FACTOR_DIMENSION_MAP`**: Maps each factor to engine scoring dimensions with influence weights
- **`HARD_GATE_TYPES`**: Allowed types: language, availability, location, certification, education
- **`ROLE_TEMPLATES`**: 5 pre-built templates:
  - Frontend Developer
  - Marketing Intern
  - Administrative Assistant
  - Retail / Sales
  - Gastro / Hospitality

### API Endpoints
- **`POST /api/job-criteria`**: Now accepts V2 fields (`success_factors`, `hard_gates`, `trainable_skills`, `role_family`, `role_level`, `nice_to_haves`), auto-detects criteria version, writes audit log
- **`GET /api/role-templates`**: Returns all available role templates

### Employer Portal UI
- **`SuccessFactorBudget.jsx`**: New component — interactive 100-point budget distribution across 3-6 factors with visual progress bars
- **`HardGates.jsx`**: New component — structured hard requirement builder (max 4 gates)
- **`CreateListing.jsx`**: Role Calibration section with template picker, success factor budget, hard gates, and trainable skills

### Database Migration (`database/scripts/17_matching_v3_improvements.sql`)
- `job_match_criteria`: Added `trainable_skills`, `role_family`, `role_level`, `hard_gates`, `success_factors`, `nice_to_haves`, `criteria_version`, `calibration_snapshot`
- `match_scores`: Added `match_band`, `eligibility_tier`, `criteria_version`
- Created `criteria_audit_log` table

---

## Backward Compatibility
- Engine auto-detects V1/V2 criteria — V1 jobs with no `success_factors` use hardcoded `MATCH_WEIGHTS`
- All DB changes are additive (no columns removed)
- Old gap/reason format still parsed by frontend `biLang()` helper
- Weight columns still exist in DB but are no longer set from UI
