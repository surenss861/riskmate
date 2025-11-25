create table if not exists refresh_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  user_agent text,
  ip inet,
  created_at timestamptz default now()
);

create index if not exists refresh_tokens_user_idx on refresh_tokens(user_id, organization_id);
create index if not exists refresh_tokens_exp_idx on refresh_tokens(expires_at);
