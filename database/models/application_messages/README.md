# Application Messages Table (`application_messages`)

This table stores all direct chat messages exchanged between candidates and employers for specific job applications. It supports text messages, interactive scheduling invitations, and automated system update logs.

## Schema Definition

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Unique message identifier. |
| `application_id` | `uuid` | `FOREIGN KEY REFERENCES applications(id)`, `NOT NULL` | The application thread context this chat belongs to. |
| `sender_id` | `uuid` | `FOREIGN KEY REFERENCES auth.users(id)`, `NULL` | The user who sent the message. Set to `NULL` for system-generated messages. |
| `message_type` | `text` | `NOT NULL`, `DEFAULT 'text'` | Type of message: `'text'` or `'system'`. |
| `body` | `text` | `NOT NULL` | Content of the message. |
| `created_at` | `timestamptz` | `DEFAULT now()`, `NOT NULL` | Timestamp when the message was sent. |

## Relationships

* **`applications`**: Multiple messages map to a single application ID (`application_id` -> `applications.id`).
* **`auth.users`**: Message sender maps to the authentication table (`sender_id` -> `auth.users.id`).

## Realtime Replication

The `application_messages` table is registered in the `supabase_realtime` publication. This allows both the Student and Employer portals to receive new chat bubbles dynamically without polling.

## Row Level Security (RLS)

* **Access Bypass**: express server writes use the service role key and bypass RLS constraints.
* **Select Policy**: Authenticated users can read messages if they are the candidate for the application, or if they are members of the employer team that posted the job.
