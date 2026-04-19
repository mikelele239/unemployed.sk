# Unemployed.sk - Project Overview & Roadmap

This document provides a comprehensive overview of the **unemployed.sk** ecosystem, its architectural components, current feature set, and the strategic vision for upcoming development.

---

## 🚀 Mission Statement
**Unemployed.sk** is the Tinder-style career platform designed specifically for Gen Z in Slovakia. We remove the friction from job hunting through interactive swiping, AI-driven matching, and a "mobile-first" philosophy.

---

## 🛠 Technical Architecture
*   **Monorepo-style Structure**: Three distinct React/Vite applications served via a unified Node.js/Express root server.
*   **Database (Supabase)**: PostgreSQL back-end for real-time job synchronization and lead management.
*   **Animations**: Built with `Framer Motion` for a high-end, responsive feel (spring physics, layout transitions).
*   **Infrastructure**: 
    *   **SPA Support**: Server-side fallback for direct URL access across all sub-portals.
    *   **Security**: Content Security Policy (CSP) optimized for external assets (Leaflet maps) and inline animations.
    *   **Localization**: Full Slovak (SK) and English (EN) support across the employer interface.

---

## 📱 Current Functionalities

### 1. Student Portal (`/app`)
*   **Tinder Swipe Interface**: Interactive job discovery matching students with employers.
*   **Instant Location Context**: Job cards now display locations prominently with map-pin icons before opening details.
*   **Deep-Dive Detail View**: Integrated **Leaflet Maps** for office locations, salary transparency, and "Why it fits" AI reasoning.
*   **Lead Capture**: Integrated student registration system linked to cloud storage.

### 2. Employer Portal (`/employer`)
*   **Performance Dashboard**: Analytics charts tracking candidate views, application rates, and match success.
*   **Smart Listing Management**:
    *   **Deletion with Confirmation**: Premium inline UI to safely remove listings.
    *   **Smooth Reorganization**: Spring-based layout animations to prevent "shaking" when managing multiple jobs.
*   **Candidate Pipeline**: 
    *   **Fade-away Evaluations**: Candidates smoothly transition out of view as they are accepted or rejected.
    *   **AI Pre-screening**: Simulated AI scores evaluating candidate fit for specific roles.
*   **AI Listing Wizard**: Step-by-step creation flow for generating job descriptions and requirements.
*   **Minimalist Profile**: Clean, focused brand presence showing only the essentials and a "Contact Us" trigger.

### 3. Public Website (`/`)
*   **High-Conversion Landing Page**: Modern Gen Z aesthetic with clear CTAs for both students and companies.
*   **Lead Management**: Submissions are automatically hashed and checked for duplicates in the cloud.

---

## 📂 Data Schema (Supabase)
*   **`jobs`**: Core repository for position details, salary, and requirements.
*   **`submissions`**: Centralized lead capture for early-access registrations.
*   **`applications`**: Persistent record of student applications with AI-generated reasoning.

---

## 🚧 Future Roadmap: Missing Features
The following features are identified as high-priority additions to move the project from MVP to a production-ready platform:

1.  **Authentication & User Accounts**:
    *   Replace simulated names with **Supabase Auth** (email, Google, LinkedIn).
    *   Separate login flows for students (OTP/Social) and employers (Work email).
2.  **Messaging & Real-time Chat**:
    *   In-app messaging system allowing employers to "Contact" accepted matches directly.
    *   Push notifications for new messages and application status updates.
3.  **Advanced Student Profiles**:
    *   CV/Resume parser to automatically populate student data.
    *   Portfolio uploads and skill verification tags.
4.  **Employer Subscription Model**:
    *   **Stripe Integration** for paid job postings and "featured" listing boosts.
    *   Tiered access to premium candidate filtering.
5.  **Enhanced AI Evaluation**:
    *   Transition from simulated scoring to real **LLM-based evaluation** (e.g., GPT-4o) of resumes against job requirements.
6.  **Admin Dashboard**:
    *   Master control panel for site administrators to moderate listings and manage platform-wide analytics.
