# Landing Page Portal (`apps/landing/`)

This directory contains the public marketing website for **unemployed.sk**. It serves as the primary acquisition entry point for Slovak students and employers.

## Tech Stack & Assets
- **HTML5 / CSS3**: Vanilla setup for visual speed and optimal SEO performance.
- **JavaScript (Vanilla)**: Handles UI interactions, language toggling, and AJAX signup integration.
- **Styling**: Structured in `landing.css` with responsive layout grids, animations, and dark/light matching themes.

## Structure
- `index.html`: Main Slovak & English bilingual marketing page with pricing, features, and lead forms.
- `landing.css`: Standard styles, typography definitions, mobile layouts, and keyframe animations.
- `landing.js`: Client-side logic for navigation, modal dialogues, bilingual state, and submission requests.
- `login.html`: Simplified auth routing page for student/employer login selection.
- `logo.svg`: Main branding asset.
- `robots.txt` & `sitemap.xml`: SEO crawl instructions and indexing map.

## Lead Capture & API Integration
The primary business function of the landing page is capturing leads via the registration forms. It sends payloads to:
- **`POST /api/submit`**: Student and Employer inquiries.
- Enforces data processing consent (`consented`) and marketing communications choice (`marketingConsent`).
- Rate-limited server-side to prevent automated spam signups.

## Localization (i18n)
- A simple key-value localization map built into `landing.js`.
- Switches text nodes dynamically depending on user preference (`SK` or `EN`).
