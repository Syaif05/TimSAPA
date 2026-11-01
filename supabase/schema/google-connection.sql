-- Additive: existing PICs, templates, and legacy application data are preserved.
begin;
create table if not exists public.sapa_admin_sessions (
  token_hash text primary key check (length(token_hash) = 64),
  email text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sapa_admin_sessions_expiry on public.sapa_admin_sessions(expires_at);
create table if not exists public.sapa_oauth_states (
  state_hash text primary key check (length(state_hash) = 64),
  expires_at timestamptz not null
);
create index if not exists sapa_oauth_states_expiry on public.sapa_oauth_states(expires_at);
create table if not exists public.sapa_google_connection (
  id text primary key check (id = 'main'),
  email text not null,
  encrypted_tokens text not null check (length(encrypted_tokens) <= 20000),
  updated_at timestamptz not null default now()
);
create table if not exists public.sapa_source_settings (
  id text primary key check (id = 'main'),
  allow_pic_edits boolean not null default true,
  contacts_spreadsheet_id text check (contacts_spreadsheet_id is null or contacts_spreadsheet_id ~ '^[A-Za-z0-9_-]{20,120}$'),
  contacts_sheet text not null default 'KONTAK TOKO BARU' check (length(contacts_sheet) between 1 and 150),
  updated_at timestamptz not null default now()
);
insert into public.sapa_source_settings(id) values ('main') on conflict do nothing;
create table if not exists public.sapa_source_cache (
  cache_key text primary key,
  snapshot jsonb not null check (octet_length(snapshot::text) <= 20000000),
  expires_at timestamptz not null
);
create table if not exists public.sapa_sheet_audit (
  id bigint generated always as identity primary key,
  actor text not null check (length(actor) <= 100),
  source text not null check (source in ('DS','REG')),
  sheet_date date not null,
  shipment text not null,
  sheet_row integer not null check (sheet_row > 0),
  before_value jsonb not null,
  after_value jsonb not null,
  outcome text not null check (outcome in ('pending','completed','uncertain')),
  created_at timestamptz not null default now()
);
create index if not exists sapa_sheet_audit_created on public.sapa_sheet_audit(created_at desc);
alter table public.sapa_admin_sessions enable row level security;
alter table public.sapa_oauth_states enable row level security;
alter table public.sapa_google_connection enable row level security;
alter table public.sapa_source_settings enable row level security;
alter table public.sapa_source_cache enable row level security;
alter table public.sapa_sheet_audit enable row level security;
-- No direct browser access. The Node API checks admin sessions and source settings.
revoke all on public.sapa_admin_sessions, public.sapa_oauth_states, public.sapa_google_connection,
  public.sapa_source_settings, public.sapa_source_cache, public.sapa_sheet_audit from public, anon, authenticated;
grant select, insert, delete on public.sapa_admin_sessions, public.sapa_oauth_states to service_role;
grant select, insert, update on public.sapa_google_connection, public.sapa_source_settings to service_role;
grant select, insert, update, delete on public.sapa_source_cache to service_role;
grant select, insert, update on public.sapa_sheet_audit to service_role;
grant usage, select on sequence public.sapa_sheet_audit_id_seq to service_role;
comment on table public.sapa_sheet_audit is 'actor is the selected shared PIC, not a verified personal identity. Only admin sessions use verified Google identities.';
notify pgrst, 'reload schema';
commit;
