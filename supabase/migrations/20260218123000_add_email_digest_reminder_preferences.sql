alter table if exists notification_preferences
  add column if not exists email_weekly_digest boolean default true;

alter table if exists notification_preferences
  add column if not exists email_deadline_reminder boolean default true;
