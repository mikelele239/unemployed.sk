# Notifications Model (`notifications` table)

The `notifications` table stores real-time updates and push alerts sent to candidates or employers when critical application state changes occur (e.g. scheduling interviews, offering jobs, or rejecting candidates).

## Table Schema

| Column | Data Type | Constraints / Default | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Unique notification ID. |
| `user_id` | `UUID` | `NOT NULL`, `REFERENCES auth.users(id) ON DELETE CASCADE` | Recipient user reference. |
| `type` | `TEXT` | `NOT NULL`, `CHECK (type IN (...))` | Notification type (see [Notification Types](#notification-types)). |
| `title` | `TEXT` | `NOT NULL` | Alert title displayed to user. |
| `message` | `TEXT` | | Alert details body text. |
| `read` | `BOOLEAN` | `DEFAULT false` | Read status flag. |
| `related_entity_id` | `UUID` | | Optional UUID pointing to the related `applications.id` or matching entity. |
| `created_at` | `TIMESTAMPTZ`| `DEFAULT NOW()` | Creation timestamp. |

## Notification Types
- **`application_received`**: Alerts employer when a new application is submitted.
- **`interview_scheduled`**: Alerts student when an employer proposes interview times.
- **`interview_confirmed`**: Alerts employer when a student selects an interview slot.
- **`counter_offer`**: Alerts either party of negotiation proposals.
- **`hired`**: Alerts candidate of job offer extension.
- **`rejected`**: Alerts candidate of rejection.
- **`general`**: Custom administrative message alerts.

## Row-Level Security (RLS) Policies
- **`Users read own notifications`**: Users can query their own notification list if `auth.uid() = user_id`.
- **`Users update own notifications`**: Users can mark notifications as read if `auth.uid() = user_id`.
- **`Service can insert notifications`**: Bypassed for internal server creation using `service_role`.
