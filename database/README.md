# Database Schema & Security (`database/`)

This directory contains the SQL schema definitions, migrations, and Row Level Security (RLS) policies for the Supabase (PostgreSQL) database.

## Directory Structure
- `scripts/`: Chronological schema upgrades (02 to 18) and initial setup files.
- `models/`: Contextual documentation files for each database model/table (see [Models](#database-models)).
- Root `.sql` files: Custom patches for RLS corrections, realtime views, and storage bucket permissions.

## Security & Row Level Security (RLS)
The database enforces strict RLS policies on all tables. 
- **Server Bypass**: All mutations from the Express server (`server.js`) bypass RLS via the Supabase Service Role Key (`SUPABASE_SERVICE_ROLE_KEY`).
- **Client Direct Reads**: Client applications can query tables directly, governed by candidate or employer credentials.
- **Storage Buckets**: The private `cvs` storage bucket restricts direct access, requiring temporary signed URLs.

## Database Models

Each database table (or conceptual model) has a corresponding README containing detailed definitions, data types, and security rules. Explore them here:

- [Profiles](file:///c:/Users/Zephyrus/Desktop/Unemployed.sk/database/models/profiles/README.md): Student profiles.
- [Employers](file:///c:/Users/Zephyrus/Desktop/Unemployed.sk/database/models/employers/README.md): Company profile data.
- [Jobs](file:///c:/Users/Zephyrus/Desktop/Unemployed.sk/database/models/jobs/README.md): Job listings.
- [Applications](file:///c:/Users/Zephyrus/Desktop/Unemployed.sk/database/models/applications/README.md): Application lifecycle management.
- [AI Profiles](file:///c:/Users/Zephyrus/Desktop/Unemployed.sk/database/models/ai_profiles/README.md): Structured CV parsed outcomes.
- [Match Scores](file:///c:/Users/Zephyrus/Desktop/Unemployed.sk/database/models/match_scores/README.md): Pre-calculated scoring outputs.
- [Job Match Criteria](file:///c:/Users/Zephyrus/Desktop/Unemployed.sk/database/models/job_match_criteria/README.md): Employer matching definitions.
- [Notifications](file:///c:/Users/Zephyrus/Desktop/Unemployed.sk/database/models/notifications/README.md): User messaging system.
- [Submissions](file:///c:/Users/Zephyrus/Desktop/Unemployed.sk/database/models/submissions/README.md): Marketing leads.
- [User Roles](file:///c:/Users/Zephyrus/Desktop/Unemployed.sk/database/models/user_roles/README.md): Multi-portal role guard map.
