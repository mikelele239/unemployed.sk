# Unemployed.sk - Comprehensive Project Overview

This document provides a full overview of the **unemployed.sk** project, its features, target audience, and current implementation details.

---

## 🚀 Mission Statement
**Unemployed.sk** aims to be the #1 career platform for Gen Z in Slovakia. We transform the job search from a stressful chore into a seamless, interactive experience, while providing employers with high-quality, pre-screened young talent.

---

## 🌐 Website Content & Topics (Public Facing)

### 1. Hero Section
*   **Rotating Hook**: Find your [first / dream / perfect / high-paying / flexible] job.
*   **Value Proposition**: Helping students become *employed* through intelligent pairing and verified listings.
*   **CTA**: Direct registration for the waitlist.

### 2. Student Segments
*   **High School Students**: Focus on first jobs, no-experience-needed roles, and quick application flows.
*   **University Students**: Focus on field-specific internships, transparent pay, and flexible part-time roles.
*   **Graduates**: Focus on high-starting-salary junior positions, reference building, and skipping the "5 years experience" trap.

### 3. Core Features (Marketing)
*   **AI Pairing**: Algorithms that match candidates to jobs they actually fit.
*   **Transparent Pay**: Hourly/monthly rates visible upfront.
*   **Verified Employers**: Strict screening to ensure safety for young workers.
*   **Interactive Demos**: Live, clickable previews of the mobile app and employer portal directly on the landing page.

---

## 📱 Employee Mobile Experience (`/app`)

The student experience is built for mobile-first usage:
*   **Onboarding Quiz**: A 6-step gamified flow (School -> Field -> Interests -> Availability -> Goals).
*   **Job Discovery (Search)**: Map-based or list-style browsing of open positions.
*   **AI Feed (For You)**: Swiping interface. Like = Add to applications; Skip = Move to next.
*   **Application Tracking**: Status updates for every "Like" that turned into a match.
*   **Profile Management**: Digital CV generation and preference settings.

---

## 💼 Employer Experience (`/employer`)

A professional desktop-first dashboard for hiring managers:
*   **Analytics Hub**: Metrics for job post performance (Views vs. Applications vs. Matches).
*   **AI Job Crafting**: Generate full job descriptions, requirements, and tags just from a position title.
*   **Candidate Pool**: Browse verified student profiles with "AI Match Score".
*   **Direct Outreach**: One-click "Invite" or "Contact" for matched candidates.
*   **Localization**: Full Slovak and English interface.

---

## ⚙️ Project Context for Development

### Technical Stack
*   **Frontends**: Three distinct React/Vite applications (`website`, `employee`, `employer`).
*   **Backend**: Express.js server (`server.js`) handling serving and lead capture.
*   **Design**: Custom dark-mode UI with HSL-based tokens, glassmorphism, and Framer Motion.

### Current Implementation State (v1.0.0 Prototype)
- **Live Server**: Active local server on port 3000.
- **Dynamic Routing**: `/` (Landing), `/app` (Employee), `/employer` (Employer).
- **Lead Capture**: Functional `/api/submit` endpoint with rate limiting.
- **Mock Data**: Pre-populated with realistic job listings (Tatra banka, ESET, Slovnaft, etc.) for demonstration.
