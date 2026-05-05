# Feature: Security & Production Hardening
**Status**: 🛡️ Active

## Purpose
Ensures that the application is secure against common vulnerabilities and that production credentials are never leaked.

## Client-Side Security
- **Env Var Protection**: The apps use `import.meta.env` for Supabase keys.
- **Service Role Isolation**: No Service Role keys are allowed in the React source code.
- **Sensitive Logic**: Any logic that requires bypassing Row Level Security (RLS) is moved to the Node.js `server.js`.

## Server-Side Security
- **File Access Control**: Middleware in `server.js` blocks access to `.env`, `package.json`, and database files.
- **Token Validation**: The `getUserFromToken` helper validates the JWT with Supabase on every protected request.
- **CSP Headers**: Content Security Policy is configured to only allow connections to your Supabase instance.
- **Rate Limiting**: Basic rate limiting implemented on API endpoints to prevent brute force attacks.

## Environment Management
- **Local Dev**: Uses `.env` file in the root.
- **Production (Netlify)**: Uses Dashboard-defined environment variables.

## Deployment Checklist
- [ ] Verify `VITE_SUPABASE_ANON_KEY` is the ANON key, not SERVICE_ROLE.
- [ ] Ensure `SUPABASE_KEY` on the server is the SERVICE_ROLE key.
- [ ] Confirm all `dist` builds are up to date.
