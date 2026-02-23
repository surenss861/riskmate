# Email Notifications – Infrastructure & Templates

This document describes the **Email Notifications** scope: backend email infrastructure, queue worker, send utilities, notification service integration, and email templates.

## Scope Summary

- **Backend email infrastructure**: Provider abstraction (Resend / SMTP), send helpers, retries.
- **Queue worker**: In-memory email queue processed every 5s; logs to `email_logs`.
- **Notification service integration**: Task/job/mention/report flows queue email jobs; preferences gate delivery.
- **Email templates**: Task (assigned, completed, reminder), job assigned, deadline reminder, weekly digest, welcome, team invite, mention, signature request, report ready.
- **Database**: `email_logs` (and `queue_id`), `notification_preferences` (including `task_completed`, `email_deadline_reminder`).

## Backend Email Infrastructure

| Component | Location | Purpose |
|-----------|----------|---------|
| Send utilities | `apps/backend/src/utils/email.ts` | `sendEmail()`, Resend/SMTP provider, `send*Email()` helpers (task assigned/completed/reminder, job assigned, deadline, digest, welcome, invite, mention, signature, report ready). All respect `getNotificationPreferences()`. |
| Queue worker | `apps/backend/src/workers/emailQueue.ts` | `queueEmail()`, `startEmailQueueWorker()`. Processes jobs every 5s; logs to `email_logs` (job_id, queue_id, type, recipient, user_id, status). Retries with backoff (3 attempts). |
| Notification integration | `apps/backend/src/services/notifications.ts` | `getNotificationPreferences()`, push delivery. Route handlers and workers call `queueEmail()` for email delivery. |
| Worker startup | `apps/backend/src/index.ts` | Calls `startEmailQueueWorker()` on boot. |

## Email Templates

Templates live in `apps/backend/src/emails/` and use `base.ts` (`layout()`, `e()`, `formatDate()`, `truncate()`).

| Template | File | Used for |
|----------|------|----------|
| TaskAssignedEmail | `TaskAssignedEmail.ts` | Task assigned notification |
| TaskCompletedEmail | `TaskCompletedEmail.ts` | Task completed notification |
| TaskReminderEmail | `TaskReminderEmail.ts` | Task due soon / overdue |
| DeadlineReminderEmail | `DeadlineReminderEmail.ts` | Job deadline approaching |
| JobAssignedEmail | `JobAssignedEmail.ts` | Job assigned |
| WeeklyDigestEmail | `WeeklyDigestEmail.ts` | Weekly digest |
| WelcomeEmail | `WelcomeEmail.ts` | Welcome after signup |
| TeamInviteEmail | `TeamInviteEmail.ts` | Team invite |
| MentionEmail | `MentionEmail.ts` | Comment mention |
| SignatureRequestEmail | `SignatureRequestEmail.ts` | Report signature request |
| ReportReadyEmail | `ReportReadyEmail.ts` | Report ready |

## Where Emails Are Queued

- **Task assigned**: `apps/backend/src/routes/notifications.ts` → `POST /task-assigned` (push + `queueEmail(EmailJobType.task_assigned)`).
- **Task completed**: `apps/backend/src/routes/notifications.ts` → `POST /task-completed` (push + `queueEmail(EmailJobType.task_completed)`).
- **Task reminder (due soon/overdue)**: `apps/backend/src/workers/taskReminders.ts` (push + `queueEmail(EmailJobType.task_reminder)`); also triggered by `POST /schedule-task-reminder`.
- **Job assigned**: `routes/notifications.ts` (job-assigned), `routes/jobs.ts` (assign).
- **Deadline reminder (jobs)**: `apps/backend/src/workers/deadlineReminders.ts`.
- **Weekly digest**: `apps/backend/src/workers/weeklyDigest.ts`.
- **Welcome / team invite**: `apps/backend/src/routes/team.ts`, `apps/backend/src/routes/account.ts`.
- **Mention**: `apps/backend/src/routes/notifications.ts` → `POST /mention`.
- **Signature request / report ready**: `apps/backend/src/routes/reports.ts`.

## Environment Variables

Configure at least one of:

- **Resend**: `RESEND_API_KEY`, `EMAIL_FROM` or `RESEND_FROM_EMAIL` (optional: `EMAIL_REPLY_TO`).
- **SMTP**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` or `SMTP_FROM` (optional: `SMTP_SECURE`, `EMAIL_REPLY_TO`).

See `.env.example` for placeholders.

## Database Migrations

- **email_logs**: `supabase/migrations/20260230100022_email_logs.sql` – table for sent/failed/bounced events.
- **email_logs.queue_id**: `supabase/migrations/20260230100023_email_logs_queue_id.sql` – queue job UUID.
- **notification_preferences**: `task_completed` (e.g. `20260230100027_notification_preferences_task_completed.sql`), `email_deadline_reminder` default (e.g. `20260230100025_notification_preferences_email_deadline_reminder_default_true.sql`), plus earlier preference columns.

These migrations are part of the Email Notifications – Infrastructure & Templates scope and should not be altered by unrelated changes (e.g. tasks FK migrations).
