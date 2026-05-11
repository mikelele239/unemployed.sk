# Unemployed.sk — AI Matching Pipeline: Full Technical Context

> **Last updated:** 2026-05-11  
> **Source files:** `lib/ai-cv-parser.js`, `lib/ai-extraction.js`, `lib/ai-profile-builder.js`, `lib/matching-config.js`, `lib/matching-engine.js`, `routes/ai-matching.js`, `server.js`

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Pipeline Stages](#2-pipeline-stages)
3. [Stage 1 — CV Upload & Text Extraction](#3-stage-1--cv-upload--text-extraction)
4. [Stage 2 — AI CV Parsing (GPT-4o-mini)](#4-stage-2--ai-cv-parsing-gpt-4o-mini)
5. [Stage 3 — Rule-Based Fallback Extraction](#5-stage-3--rule-based-fallback-extraction)
6. [Stage 4 — Profile Builder (AI Summary Generation)](#6-stage-4--profile-builder)
7. [Stage 5 — Normalization & DB Storage (ai_profiles)](#7-stage-5--normalization--db-storage)
8. [Stage 6 — Matching Engine (Scoring)](#8-stage-6--matching-engine)
9. [Stage 7 — Score Storage & Recalculation](#9-stage-7--score-storage--recalculation)
10. [All Fields Reference](#10-all-fields-reference)
11. [Matching Dimensions Deep Dive](#11-matching-dimensions-deep-dive)
12. [API Endpoints](#12-api-endpoints)
13. [Cost Controls & Rate Limiting](#13-cost-controls--rate-limiting)
14. [Security Model](#14-security-model)

---

## 1. High-Level Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────────┐     ┌──────────────┐
│  CV Upload   │────▶│ Text Extract │────▶│  AI Parse     │────▶│  ai_profiles │────▶│  Matching    │
│  (PDF/DOCX)  │     │ (pdf-parse/  │     │ (GPT-4o-mini  │     │  (Supabase)  │     │  Engine      │
│              │     │  mammoth)    │     │  or fallback) │     │              │     │  (10 dims)   │
└─────────────┘     └──────────────┘     └───────────────┘     └──────────────┘     └──────┬───────┘
                                                                                           │
                                              ┌────────────────┐     ┌─────────────────────▼──────┐
                                              │ job_match_     │────▶│  match_scores              │
                                              │ criteria       │     │  (user_id, job_id, score,  │
                                              │ (employer set) │     │   breakdown, reasons, gaps)│
                                              └────────────────┘     └────────────────────────────┘
```

**Key principle:** The pipeline is **event-driven**. A CV upload triggers the entire chain automatically: extract → parse → store → match against all active jobs. Employers setting job criteria triggers re-scoring of all candidates against that job.

---

## 2. Pipeline Stages

| # | Stage | File(s) | Trigger |
|---|-------|---------|---------|
| 1 | CV Upload & Text Extraction | `server.js` (POST `/api/cvs/upload`) | Student uploads CV |
| 2 | AI CV Parsing | `lib/ai-cv-parser.js` | Automatic after extraction |
| 3 | Rule-Based Fallback | `lib/ai-extraction.js` | When OpenAI unavailable/blocked |
| 4 | Profile Builder | `lib/ai-profile-builder.js` | Fallback summary generation |
| 5 | Normalization & Storage | `lib/ai-cv-parser.js` → `server.js` | After parsing completes |
| 6 | Matching Engine | `lib/matching-engine.js` + `lib/matching-config.js` | After profile saved |
| 7 | Score Storage | `routes/ai-matching.js` | After matching completes |

---

## 3. Stage 1 — CV Upload & Text Extraction

**Endpoint:** `POST /api/cvs/upload` (server.js, line ~418)  
**Middleware:** `multer` (memory storage, field name `file`)

### Supported Formats
| Format | Library | Notes |
|--------|---------|-------|
| PDF | `pdf-parse` | Primary format. Fails silently on scanned/image PDFs |
| DOCX | `mammoth` | Full support via `extractRawText()` |
| DOC | `mammoth` (best-effort) | Legacy format, limited extraction |

### Flow
1. Authenticate user via Bearer token
2. Validate file exists and is PDF/DOCX/DOC
3. Upload binary to **Supabase Storage** bucket `cvs` at path `{userId}/{timestamp}_{filename}`
4. Upsert `profiles` table with `cv_id` = storage path
5. Extract raw text from buffer based on MIME type
6. If text ≥ 50 chars → proceed to AI parsing. Otherwise → warning, skip AI

---

## 4. Stage 2 — AI CV Parsing (GPT-4o-mini)

**File:** `lib/ai-cv-parser.js`  
**Model:** `gpt-4o-mini` | **Temperature:** 0.1 | **Max tokens:** 2500  
**Response format:** `json_object` (enforced structured output)

### Input Sanitization
Before sending to GPT, the CV text is:
- Truncated to **8000 chars** max
- Stripped of prompt injection patterns (e.g., "ignore previous instructions", "you are now", `<script>` tags, code blocks)
- Control characters removed
- Excessive whitespace collapsed

### System Prompt Rules
The system prompt instructs GPT to:
- Extract truthful, employer-friendly structured data
- **Never invent** facts, skills, degrees, or certifications
- **Never rank** candidates or assign match scores
- Treat student projects/volunteering as valid experience (labeled accurately)
- Generate **bilingual output** (Slovak `sk` + English `en`) for all text fields
- Normalize skills to English lowercase
- Use specific enum values for experience levels and job categories
- Exclude protected characteristics (race, religion, health, etc.)

### GPT Output Schema (exact JSON structure requested)

The prompt requests this exact structure from GPT:

```
candidate_identity        → name, email, phone, location, links
education[]               → school, degree, field, level, dates, confidence
work_experience[]         → title, company, type, dates, description, skills, confidence
projects[]                → name, description, skills, confidence
skills                    → raw, normalized, technical, soft, tools, confidence notes
languages[]               → language, level (CEFR A1-C2), confidence
certifications[]          → name, issuer, year, confidence
candidate_classification  → experience_level, candidate_type, categories, roles, job types, availability, work mode, salary
ai_profile                → headline, short_summary, portfolio_intro, employer_summary, strengths[], development_areas[], career_direction, quality_notes
profile_completion        → score, missing_fields, recommended_actions
matching_features         → normalized location, skills, languages, field, experience, hours, salary, work mode
risk_and_uncertainty      → uncertainty_notes, parsing_issues, low_confidence_fields
```

### Confidence Scoring (AI)
After parsing, a confidence score (0.0–1.0) is calculated:

| Signal | Points |
|--------|--------|
| Base score | +0.50 |
| Full name found | +0.06 |
| ≥1 hard skill | +0.10 |
| ≥6 hard skills | +0.05 |
| ≥1 language | +0.06 |
| Education level | +0.06 |
| Education field | +0.04 |
| Email or phone | +0.03 |
| Location | +0.04 |
| Known experience level | +0.03 |
| AI summary generated | +0.05 |
| AI headline generated | +0.03 |
| Suggested roles exist | +0.03 |
| **Maximum** | **1.00** |

- Score ≥ 0.50 → `parse_status = "ready"`
- Score < 0.50 → `parse_status = "needs_review"`
- Text < 50 chars → `parse_status = "failed"`

---

## 5. Stage 3 — Rule-Based Fallback Extraction

**File:** `lib/ai-extraction.js`  
**Triggered when:** No OpenAI API key, rate limit hit, budget exhausted, or API error.

### What It Extracts (regex/dictionary-based)

| Field | Method |
|-------|--------|
| **Full name** | First 5 lines, 2-4 capitalized words |
| **Email** | Standard email regex |
| **Phone** | Slovak format `+421` or `0` prefix |
| **Location** | Dictionary of 50+ cities (SK + international) |
| **Hard skills** | 55+ canonical skills with aliases (e.g., `node.js` ← `node`, `nodejs`). Includes Slovak aliases |
| **Soft skills** | 30+ skills in EN + SK (e.g., `komunikácia`, `teamwork`) |
| **Languages** | 12 language patterns (SK/EN names) with CEFR level detection from surrounding context |
| **Education level** | Regex for `PhD`, `Mgr.`, `Bc.`, `gymnázium`, etc. |
| **Education field** | 11 field categories via keyword matching |
| **School name** | Regex for Slovak university names and abbreviations |
| **Experience years** | Date range extraction from experience sections (merged intervals, capped at 15) |

### Section Detection
The fallback parser splits the CV into sections by detecting headers:
- `education`, `experience`, `skills`, `languages`, `projects`, `certificates`, `interests`, `about`, `contact`
- Headers detected by regex on short lines (< 60 chars)

### Skill Alias System
55+ canonical skills, each with multiple aliases including Slovak translations:
```
'javascript' ← ['js', 'javascript', 'ecmascript']
'node.js'    ← ['node', 'nodejs', 'node.js']
'sql'        ← ['sql', 'databases', 'databázy']
'zákaznícky servis' ← ['zákaznícky servis', 'customer service', 'customer support']
```

### Contextual Skill Extraction
Beyond global text scanning, the fallback also does **section-aware extraction** — re-scanning the `skills`, `experience`, `projects`, and `certificates` sections specifically for any missed skill aliases.

---

## 6. Stage 4 — Profile Builder

**File:** `lib/ai-profile-builder.js`  
**Used by:** Fallback path (when GPT unavailable) and `POST /api/ai-profile/generate`

Generates:
- **Headline** — Skill-based role detection (e.g., "Junior Web Developer | Bratislava")
- **Summary** — Template-based paragraph from education + skills + experience + languages
- **Portfolio intro** — Level-appropriate intro paragraph
- **Strengths** — Auto-detected from data signals (e.g., "Multilingual", "Broad technical expertise")
- **Development areas** — Gaps identified (e.g., "Building practical work experience")
- **Suggested roles** — Mapped from skills (e.g., React → "Frontend Developer")
- **Suggested categories** — Mapped from skills (e.g., Figma → "Design & Creative")
- **Missing fields** — Lists unfilled profile fields
- **Quality notes** — Actionable tips for profile improvement

---

## 7. Stage 5 — Normalization & DB Storage

### Normalization (`normalizeApiResult` in ai-cv-parser.js)

GPT returns nested JSON. This function flattens it to a DB-compatible row:

| GPT Path | DB Column | Transform |
|----------|-----------|-----------|
| `candidate_identity.full_name` | `full_name` | Direct |
| `skills.normalized_skills` + `technical_skills` + `tools` | `hard_skills` | Deduplicated, lowercase set |
| `skills.soft_skills` | `soft_skills` | Deduplicated, lowercase set |
| `languages[].language` + `level` | `languages` | `[{lang, level}]` JSONB |
| `education[0]` (current preferred) | `education_level`, `education_field`, `education_school` | Validated against enum |
| `work_experience[]` date ranges | `experience_years` | Computed from month differences |
| `candidate_classification.experience_level` | `experience_level` | Validated: `no_experience\|beginner\|junior\|experienced\|unknown` |
| `candidate_classification.likely_job_categories` | `preferred_categories` | Lowercase, deduplicated |
| `ai_profile.headline` | `ai_headline` | Bilingual JSON string `{"sk":"...","en":"..."}` |
| `ai_profile.employer_summary` | `ai_summary` | Bilingual JSON string |
| `ai_profile.strengths[]` | `ai_strengths` | Array of bilingual JSON strings |
| `ai_profile.development_areas[]` | `ai_development_areas` | Array of bilingual JSON strings |

### Database Table: `ai_profiles`

**Primary key:** `user_id` (one profile per student)

Core identity fields, parsed data fields, AI-generated content fields, matching feature fields, and metadata fields (parse_status, confidence_score, extraction_source, profile_version, etc.)

### Profile Completion Score
Calculated via `matching-config.js` PROFILE_COMPLETION_FIELDS — 14 fields with individual weights totaling 100:

| Field | Weight |
|-------|--------|
| hard_skills | 15 |
| location | 10 |
| education_level | 10 |
| languages | 10 |
| preferred_job_types | 10 |
| full_name | 5 |
| education_field | 5 |
| education_school | 5 |
| experience_level | 5 |
| availability_hours | 5 |
| preferred_categories | 5 |
| work_mode_preference | 5 |
| email | 5 |
| phone | 5 |

---

## 8. Stage 6 — Matching Engine

**File:** `lib/matching-engine.js`  
**Algorithm:** Deterministic, multi-dimensional weighted scoring. No ML/embeddings — pure rule-based.

### 10 Scoring Dimensions

Each dimension produces a **raw score from 0.0 to 1.0**, then multiplied by its weight.

| # | Dimension | Weight | Max Points | What It Measures |
|---|-----------|--------|------------|------------------|
| 1 | **Skills** | 30 | 30 | Exact + transferable skill overlap |
| 2 | **Location** | 15 | 15 | City match or remote compatibility |
| 3 | **Job Type** | 10 | 10 | Part-time/internship/full-time preference alignment |
| 4 | **Category** | 8 | 8 | Industry/category semantic match |
| 5 | **Availability** | 7 | 7 | Hours/week compatibility |
| 6 | **Education** | 10 | 10 | Level + field of study match |
| 7 | **Experience Level** | 10 | 10 | Seniority alignment |
| 8 | **Language** | 5 | 5 | Required language + CEFR level |
| 9 | **Salary** | 3 | 3 | Expectation vs. offered range |
| 10 | **Work Mode** | 2 | 2 | Remote/hybrid/on-site preference |
| | **Total** | **100** | **100** | |

### Final Score Calculation
```
matchScore = Σ (dimensionRawScore × dimensionWeight)
```
- Capped at 100
- If job has **no criteria AND no description** → capped at 50
- If job has **no criteria but has description** (skills mined) → capped at 85

---

## 9. Stage 7 — Score Storage & Recalculation

### Database Table: `match_scores`

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | UUID | Candidate |
| `job_id` | UUID | Job |
| `eligible` | boolean | No missing required skills/langs |
| `overall_score` | integer | 0–100 weighted score |
| `breakdown` | JSONB | Points per dimension |
| `match_reasons` | text[] | Why score is high |
| `gaps` | text[] | Why score is lower |
| `missing_required` | text[] | Hard blockers |
| `calculated_at` | timestamp | When computed |

**Unique constraint:** `(user_id, job_id)` — upserted on recalc.

### Recalculation Triggers
1. **Student uploads CV** → `recalculateForStudent(userId)` — scores against ALL active jobs
2. **Employer saves job criteria** → `recalculateForJob(jobId)` — scores ALL candidate profiles against that job
3. **Student edits AI profile** → `recalculateForStudent(userId)`
4. **Manual trigger** → `POST /api/match/recalculate`

---

## 10. All Fields Reference

### ai_profiles Table — Complete Column List

**Identity:** `user_id`, `full_name`, `email`, `phone`, `location`

**Education:** `education_level` (high_school|bachelors|masters|phd), `education_field`, `education_school`

**Skills:** `hard_skills` (text[]), `soft_skills` (text[]), `ai_normalized_skills` (text[])

**Experience:** `experience_years` (int), `experience_level` (no_experience|beginner|junior|experienced|unknown), `work_experience` (JSONB array)

**Languages:** `languages` (JSONB array of `{lang, level}`)

**Preferences:** `preferred_job_types` (text[]), `preferred_work_models` (text[]), `preferred_locations` (text[]), `preferred_categories` (text[]), `work_mode_preference` (text), `availability_hours` (int), `salary_expectation` (numeric), `min_salary` (numeric)

**AI Content (bilingual JSON):** `ai_headline`, `ai_summary`, `ai_portfolio_intro`, `ai_strengths` (text[]), `ai_development_areas` (text[]), `ai_suggested_roles` (text[]), `ai_suggested_categories` (text[]), `ai_missing_fields` (text[]), `ai_profile_quality_notes` (text[])

**Metadata:** `parse_status`, `confidence_score`, `extraction_source`, `extraction_version`, `ai_profile_approved`, `ai_generated_at`, `profile_completion_score`, `profile_version`, `raw_cv_text`, `certifications`, `portfolio_links`

### job_match_criteria Table

Set by employers per job:

| Field | Type | Used In |
|-------|------|---------|
| `required_skills` | text[] | Skills dimension (exact + family match) |
| `preferred_skills` | text[] | Skills dimension (bonus points) |
| `min_education_level` | text | Education dimension |
| `preferred_fields` | text[] | Education dimension (field match) |
| `required_experience_level` | text | Experience dimension |
| `required_languages` | JSONB | Language dimension `[{lang, min_level}]` |
| `hours_per_week` | int | Availability dimension |
| `salary_min` / `salary_max` | numeric | Salary dimension |
| `work_model` | text | Work mode + location dimensions |
| `location_strict` | boolean | Location dimension (harsh penalty if no match) |
| `category` | text | Category dimension |
| `industry` | text | Category dimension |
| `student_friendly` / `no_experience_required` | boolean | Experience (auto-pass beginners) |

---

## 11. Matching Dimensions Deep Dive

### 11.1 Skills (Weight: 30)

**Exact matching:** Candidate skill normalized via alias dictionary → compared to required/preferred skills.

**Transferable skill families** (partial credit when exact skill missing):

| Family | Skills | Transfer Credit |
|--------|--------|-----------------|
| frontend | react, vue, angular, svelte, html, css, js, ts, next.js, nuxt, tailwind, bootstrap, sass | 35% |
| backend | node.js, python, java, php, c#, go, rust, ruby, django, flask, express, spring | 30% |
| data | sql, postgresql, mysql, mongodb, redis, data analysis, power bi, tableau, excel, google analytics | 35% |
| devops | docker, kubernetes, aws, azure, terraform, linux, devops, ci/cd | 30% |
| design | figma, photoshop, illustrator, canva, ui/ux, grafický dizajn | 40% |
| marketing | marketing, seo, social media, google ads, facebook ads, content marketing, copywriting, email marketing, branding | 35% |
| office | excel, word, powerpoint, g-suite, office 365, sap, administratíva | 40% |
| ml | machine learning, python, data analysis, sql, tensorflow, pytorch | 25% |
| mobile | swift, kotlin, flutter, dart, react native, react | 30% |
| pm | projektový manažment, scrum, jira, project management | 40% |
| customer | zákaznícky servis, predaj, customer service, communication, komunikácia | 35% |

**Formula:** Required skills worth 70% of skill score, preferred worth 30%. Transfer credit for preferred skills is further reduced to 70% of base.

**Implicit skill mining:** If job has NO explicit criteria skills, the engine mines the job `description`, `requirements`, and `tags` fields using 30+ regex patterns to find implicit skills. These are treated as preferred (not required).

### 11.2 Location (Weight: 15)

- Remote job → **1.0** (auto-pass)
- No job location → **1.0**
- Direct city match (candidate location or preferred locations contain job city) → **1.0**
- Hybrid + candidate flexible → **0.7**
- `location_strict` + no match → **0.1**
- Soft mismatch → **0.3**

### 11.3 Job Type (Weight: 10)

Normalized via alias map (e.g., `brigáda` → `part_time`, `stáž` → `internship`).

- Exact match → **1.0**
- Related type match → **0.5** (e.g., `part_time` ↔ `internship`, `full_time` ↔ `graduate_role`)
- No match → **0.0**

### 11.4 Category (Weight: 8)

Uses a **category taxonomy** with 15 categories, each having keyword lists and associated skills:
`IT & Development`, `Design & Creative`, `Marketing & PR`, `Admin & Office`, `Gastro`, `Retail`, `Warehouse`, `Sales & Support`, `Data & Analytics`, `Legal`, `Healthcare`, `Education`, etc.

- Direct category match → **1.0**
- Tag-based matching (job tags vs candidate categories/skills) → proportional
- Skill-category cross-reference → up to **0.8**
- Minimum baseline → **0.3**

### 11.5 Availability (Weight: 7)

- No data either side → **1.0**
- Candidate hours ≥ job hours → **1.0**
- ≥80% of required → **0.7**
- Below → `ratio × 0.5`

### 11.6 Education (Weight: 10)

Split 50/50 between **level** and **field**:

**Level:** `high_school(1) < bachelors(2) < masters(3) < phd(4)`
- Meets/exceeds → 0.5 points
- Below → `(candidateRank / requiredRank) × 0.3`

**Field:** Compared against `preferred_fields`
- Match → 0.5 points
- No match → 0.1 points
- No requirement → 0.5 points

### 11.7 Experience Level (Weight: 10)

Ranks: `no_experience(0) < beginner(1) < junior(2) < experienced(3)` (unknown=1)

- `student_friendly` or `no_experience_required` flag → **1.0** for all
- Meets/exceeds → **1.0**
- One level below → **0.6**
- Two+ levels below → **0.2**

### 11.8 Language (Weight: 5)

Language names normalized across Slovak↔English (e.g., `Angličtina` → `english`).  
CEFR levels compared numerically: `A1(1)..C2(6)`.

- Meets level → full credit
- Below level → `(candidateLevel / requiredLevel) × 0.6`
- Missing language → 0 + gap recorded

### 11.9 Salary (Weight: 3)

- No data → **1.0**
- Within range → **1.0**
- ≤15% above max → **0.6**
- Far above → **0.2**

### 11.10 Work Mode (Weight: 2)

- Exact match or candidate says "any" → **1.0**
- Hybrid job → **0.7**
- Mismatch → **0.0**

---

## 12. API Endpoints

### Student-Facing
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/cvs/upload` | Upload CV, triggers full pipeline |
| GET | `/api/ai-profile` | Get own AI profile |
| PATCH | `/api/ai-profile` | Edit AI profile fields |
| POST | `/api/ai-profile/parse` | Re-parse existing CV |
| POST | `/api/ai-profile/generate` | Generate rule-based profile summary |
| POST | `/api/ai-profile/approve` | Approve AI-generated content |
| DELETE | `/api/ai-profile/ai-content` | Clear AI content |
| GET | `/api/ai-profile/completion` | Profile completion score |
| GET | `/api/match-scores` | Own match scores for all jobs |
| GET | `/api/jobs/for-you` | Jobs sorted by match score |
| POST | `/api/match/recalculate` | Trigger score recalculation |

### Employer-Facing
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/job-criteria` | Set/update match criteria for a job |
| GET | `/api/job-criteria/:jobId` | Get criteria for a job |
| GET | `/api/employer/match-scores/:jobId` | Candidate scores for a job |
| POST | `/api/employer/match-scores-bulk` | Bulk fetch scores |
| GET | `/api/employer/candidate-card/:userId/:jobId` | Full candidate card with match data |
| POST | `/api/employer/ai-profiles` | Bulk fetch AI profiles |

### Admin
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/ai-budget` | View API usage & costs |

---

## 13. Cost Controls & Rate Limiting

| Control | Default | Env Var |
|---------|---------|---------|
| Daily budget | $1.00 | `OPENAI_DAILY_BUDGET_USD` |
| Per-user daily limit | 10 calls | `OPENAI_PER_USER_LIMIT` |
| Global daily limit | 200 calls | `OPENAI_GLOBAL_DAILY_LIMIT` |
| Max input chars | 8,000 | Hardcoded |
| Max output tokens | 2,500 | Hardcoded |
| Model | gpt-4o-mini | Hardcoded |

**Pricing tracked:** Input @ $0.15/1M tokens, Output @ $0.60/1M tokens.  
**Daily reset:** Automatic at midnight (server time).  
**Fallback:** When ANY limit is hit → automatic switch to free rule-based parsing.

---

## 14. Security Model

1. **API key server-side only** — never exposed to client
2. **Prompt injection defense** — 10 regex patterns strip malicious instructions
3. **Input sanitization** — control chars removed, whitespace collapsed
4. **Rate limiting** — per-user, global, and budget caps
5. **RLS bypass** — server uses Supabase service role key; clients go through Express endpoints
6. **AI content approval** — employer only sees AI-generated headline/summary AFTER student approves
7. **Protected characteristics** — system prompt explicitly forbids extracting race, religion, health, politics, sexual orientation, family status
8. **Token auth** — all endpoints verify Bearer token via `supabase.auth.getUser()`

---

## Pipeline Execution Summary

```
Student uploads CV (PDF/DOCX)
  │
  ├─▶ Text extracted (pdf-parse / mammoth)
  │
  ├─▶ Text sanitized (injection patterns removed, 8K char cap)
  │
  ├─▶ Rate/budget check
  │     ├─ PASS ──▶ GPT-4o-mini structured extraction (full schema)
  │     └─ FAIL ──▶ Rule-based regex extraction + profile builder
  │
  ├─▶ Normalize GPT output → flat DB columns (bilingual JSON for text)
  │
  ├─▶ Calculate confidence score (0.0–1.0)
  │
  ├─▶ Calculate profile completion score (0–100)
  │
  ├─▶ Upsert to ai_profiles table
  │
  ├─▶ Flag profiles.ai_profile_ready = true
  │
  └─▶ recalculateForStudent(userId)
        │
        ├─▶ Fetch all active jobs
        ├─▶ Fetch job_match_criteria for each
        ├─▶ For each job:
        │     ├─▶ Score 10 dimensions (0.0–1.0 each)
        │     ├─▶ Apply weights (total = 100)
        │     ├─▶ Generate reasons, gaps, insights
        │     ├─▶ Calculate confidence metric
        │     ├─▶ Generate executive summary
        │     └─▶ Upsert to match_scores
        └─▶ Done. Scores visible in both portals.
```
