# User Roles Model (`user_roles` table)

The `user_roles` table acts as the multi-portal gatekeeper. It maps each Supabase authentication ID to a specific authorization role (candidate, employer, or administrator), preventing unauthorized crossing between portals.

## Table Schema

| Column | Data Type | Constraints / Default | Description |
|---|---|---|---|
| `user_id` | `UUID` | `PRIMARY KEY`, `REFERENCES auth.users(id) ON DELETE CASCADE` | Link to core auth account. |
| `role` | `TEXT` | `NOT NULL`, `CHECK (role IN ('candidate', 'employer', 'admin'))` | App authorization level. |
| `created_at` | `TIMESTAMPTZ`| `DEFAULT NOW()` | Role assignment timestamp. |

## Automated Role Assignment Trigger
When a user signs up via Supabase, a Postgres trigger automatically assigns their role to prevent manual override vulnerabilities:
- **Function**: `public.handle_new_user_role()`
- **Trigger**: `on_auth_user_created`
  - Runs `AFTER INSERT` on `auth.users`.
  - Captures the role from `raw_user_meta_data->>'role'` (defaults to `candidate` if empty) and inserts it into `user_roles`.

## RPC Helpers
- **`get_user_role()`**: A `SECURITY DEFINER` stable SQL helper function exposed to client queries to retrieve their active role token.
  ```sql
  SELECT role::text FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
  ```

## Row-Level Security (RLS) Policies
- **`Users read own role`**: Users can select (`SELECT`) their own roles using `auth.uid() = user_id`.
- Mutating roles via the frontend is strictly forbidden. Any change requires database admin access or direct `service_role` query execution.
