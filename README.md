# <img src="https://img.shields.io/badge/un-employed.sk-FF5C00?style=for-the-badge&labelColor=0D0D0D" alt="unemployed.sk" />

> **Od prvej práce až po tvoj dream job**
> *From your first job to your dream job*

A Tinder-style career platform built for Gen Z in Slovakia — connecting students with employers through interactive swiping, AI-driven matching, and a mobile-first philosophy.

🌐 **Live**: [unemployed.sk](https://unemployed.sk) &nbsp;|&nbsp; 📍 **HQ**: Bratislava, Slovakia

---

## 🏗 Architecture

```
Unemployed.sk/
├── server.js                # Express server — serves everything
├── apps/
│   ├── landing/             # Static landing page (HTML/CSS/JS)
│   │   └── index.html       # Full marketing site, demo overlays
│   ├── student/             # React + Vite — student-facing portal
│   │   ├── src/             #   Components, pages, i18n context
│   │   └── dist/            #   Production build (served at /app)
│   └── employer/            # React + Vite — employer dashboard
│       ├── src/             #   Components, pages, i18n, contexts
│       └── dist/            #   Production build (served at /employer)
├── database/
│   └── scripts/             # Supabase SQL migration scripts
├── docs/
│   ├── DESIGN_SYSTEM.md     # Full design token reference
│   ├── FONTS.md             # Typography architecture & CSP notes
│   └── PROJECT_OVERVIEW.md  # Feature roadmap & vision
├── .env                     # Supabase credentials (not committed)
├── netlify.toml             # Netlify deployment config
└── package.json             # Root scripts & server dependencies
```

### How It Works

| Route | Served From | Technology |
|-------|-------------|------------|
| `/` | `apps/landing/index.html` | Vanilla HTML/CSS/JS |
| `/app` | `apps/student/dist/` | React 19 + Vite 8 + Framer Motion |
| `/employer` | `apps/employer/dist/` | React 19 + Vite 8 + Leaflet |

The Express server (`server.js`) handles:
- Static file serving for all three portals
- SPA fallback routing (HTML5 history API)
- REST API endpoints (`/api/jobs`, `/api/signup`, `/api/applications`)
- Supabase integration for persistent data
- CSP headers, rate limiting, and security

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥ 18.0.0
- **npm** ≥ 9
- **Supabase project** with credentials

### Setup

```bash
# 1. Clone
git clone https://github.com/mikelele239/unemployed.sk.git
cd unemployed.sk

# 2. Install root dependencies
npm install

# 3. Install sub-app dependencies
cd apps/student && npm install && cd ../employer && npm install && cd ../..

# 4. Create .env file
echo "SUPABASE_URL=your_supabase_url" > .env
echo "SUPABASE_KEY=your_supabase_anon_key" >> .env

# 5. Start the server
npm start
```

Visit **http://localhost:3000**.

### Build Sub-Apps

```bash
npm run build:student    # Rebuild student portal
npm run build:employer   # Rebuild employer portal
npm run build:all        # Rebuild both
```

> **Note:** The `dist/` folders are committed to the repo so the server can serve them immediately. After modifying React source, rebuild and commit.

---

## 🌍 Internationalization (i18n)

Both portals support **Slovak (SK)** and **English (EN)** with full bilateral sync:

| Component | Mechanism |
|-----------|-----------|
| Landing page | `setLang()` toggles all text, sends `postMessage` to iframes |
| Student app | `I18nContext.jsx` — custom provider with `useTranslation()` hook |
| Employer app | `contexts.jsx` — `I18nProvider` with `useI18n()` hook |
| Sync | Parent → iframe via `window.postMessage({ type: 'lang', lang })` |
| Persistence | `localStorage` keys: `student_lang`, `employer_lang` |

Switching the language toggle on the landing page automatically propagates to whichever demo iframe is open.

---

## 📱 Features

### Student Portal (`/app`)
- **CV Upload & AI Scanner** — Extracts name from filename, simulates AI parsing with progress animation
- **Onboarding Flow** — 5-phase wizard: Welcome → Upload/Manual → Parsing → Review → Climax matching animation
- **Tinder Swipe Interface** — Gesture-based job discovery with spring physics
- **Job Detail View** — Salary transparency, Leaflet map, "Why it fits" AI reasoning
- **For You Feed** — Personalized job recommendations
- **Applications Tracker** — Status tracking with accept/reject breakdown

### Employer Portal (`/employer`)
- **Performance Dashboard** — Animated stat cards, weekly activity charts
- **Smart Listing Management** — Create, delete with confirmation, spring-based reorganization
- **AI Candidate Pipeline** — Match scoring, invite/accept workflow with fade animations
- **Job Creation Wizard** — Interactive map (Leaflet) for location, reverse geocoding
- **Company Profile** — Minimalist brand page with contact CTA

### Landing Page (`/`)
- **High-Conversion Marketing** — Modern Gen Z aesthetic, parallax scroll, animated demos
- **Interactive Demos** — Embedded student/employer portals in iframe overlays
- **Lead Capture** — Email signup with duplicate detection and rate limiting
- **Light/Dark Mode** — Full theme toggle with smooth transitions

---

## 🗄 Database Schema (Supabase)

| Table | Purpose |
|-------|---------|
| `jobs` | Job listings with title, salary, location, coordinates, requirements |
| `submissions` | Early-access email signups (hashed IP for dedup) |
| `applications` | Student ↔ Job interactions (likes, applications, AI reasoning) |

SQL migration scripts are in `database/scripts/`.

---

## 📂 Key Files Reference

| File | Purpose |
|------|---------|
| `server.js` | Express server, API routes, CSP, rate limiting |
| `apps/landing/index.html` | Full landing page (3000+ lines, self-contained) |
| `apps/student/src/I18nContext.jsx` | Student i18n provider with SK/EN translation dictionaries |
| `apps/student/src/pages/Onboarding.jsx` | 5-phase onboarding wizard with CV scanner |
| `apps/student/src/pages/ForYou.jsx` | Tinder swipe interface |
| `apps/employer/src/contexts.jsx` | Employer i18n, theme, and app state providers |
| `apps/employer/src/i18n.js` | Employer translation dictionaries |
| `apps/employer/src/mockData.js` | Demo data for candidates, listings, AI matches |
| `apps/employer/src/pages/Dashboard.jsx` | Analytics dashboard with animated charts |

---

## 🎨 Design System

Full design token reference: [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md)

| Token | Dark | Light |
|-------|------|-------|
| `--bg` | `#0D0D0D` | `#FFFFFF` |
| `--accent` | `#FF5C00` | `#FF5C00` |
| `--font-display` | Instrument Serif | — |
| `--font-body` | DM Sans | — |

---

## 🚧 Roadmap

See [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md) for the full feature roadmap. Key upcoming items:

- [ ] **Authentication** — Supabase Auth (email, Google, LinkedIn)
- [ ] **Real-time Chat** — In-app messaging between employers and candidates
- [ ] **LLM-based AI Screening** — Replace mock scoring with real GPT evaluation
- [ ] **Stripe Subscriptions** — Paid job postings and featured listings
- [ ] **Admin Dashboard** — Content moderation and platform analytics

---

## 📄 License

**UNLICENSED** — All rights reserved. This is a private project.

---

<p align="center">
  <strong>Built with 🧡 in Bratislava</strong><br/>
  <sub>React · Vite · Express · Supabase · Framer Motion · Leaflet</sub>
</p>
