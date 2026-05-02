# Unemployed.sk - Live Production Context

This document provides a comprehensive summary of the architecture, authentication, and logic implemented to move the Unemployed.sk platform from a prototype to a fully operational live system.

## 🏗️ System Architecture
The platform is built as a modular multi-app system served by a single centralized Node.js core.

- **Root Server (`server.js`)**: Express backend handling API routes, authentication, and static serving.
- **Portals**:
  - `apps/landing`: The public-facing marketing page (served at `/`).
  - `apps/student`: The "Swipe" interface for candidates (served at `/app`).
  - `apps/employer`: The management dashboard for firms (served at `/employer`).
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS) enforcement.

## 🔐 Authentication & Session Management
A critical "Portal Isolation" strategy is used to prevent session conflicts between Students and Employers.

- **Storage Isolation**: 
  - Student app uses `unemployed-student-auth` storage key.
  - Employer app uses `unemployed-employer-auth` storage key.
- **Admin Registration API**: User registration (student/employer) is handled via a backend Admin API (`supabaseAdmin`) to bypass email rate limits and ensure automatic user confirmation.
- **Role Verification**: A `user_roles` table in the database strictly enforces access. Roles are assigned at the moment of registration via `raw_user_meta_data`.

## 📈 Real-Time Analytics Engine
The platform has moved entirely away from mock data to a live tracking system.

- **Engagement Tracking**: 
  - Every time a student "views" a job card in the stack, a record is inserted into the `job_views` table.
  - Employers see these live "impressions" on their dashboard.
- **Analytics API**: The `/api/employer/analytics` endpoint aggregates total views, applications, and active postings for the authenticated firm.
- **Skill-Based Matching**: The "AI Matches" feature uses a SQL-based matching engine that calculates overlap between student skills/location and the employer's active requirements.

## 🛠️ Key Logic Refinements
The following features ensure a seamless user experience:

- **Self-Healing Membership**: When an employer posts a job, the server automatically checks if they are officially linked to their company record. if the link is missing, the server "self-heals" by creating the link on the fly, preventing the post from failing.
- **Pure Dashboard Flow**: Mandatory onboarding barriers (like the `/setup` quiz) have been bypassed for the MVP, allowing new employers to access the dashboard immediately upon registration.
- **Auto-Login Sync**: After registration, the system performs a hard session sync using `supabase.auth.setSession` followed by a `window.location.href` redirect to ensure the browser and server are perfectly aligned.

## 📂 Configuration
- **Supabase**: Managed via central `supabase.js` files in each portal with dedicated storage keys.
- **Server**: Uses `POST /api/cvs/upload` with Multer and `supabase.storage` for secure resume management.
