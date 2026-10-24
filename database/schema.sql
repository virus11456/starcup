-- Star Grail server-only storage. No browser can query rooms directly.
-- Replace SERVER_KEY_SHA256 with SHA-256(GRAIL_SERVER_SECRET) when provisioning.
create table public.grail_rooms (
 code text primary key check (code ~ '^[A-Z2-9]{8}$'),
 revision bigint not null default 0,
 state jsonb not null,
 summary jsonb not null,
 creator_hash text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index grail_rooms_updated_idx on public.grail_rooms (updated_at desc);
create index grail_rooms_creator_idx on public.grail_rooms (creator_hash, created_at desc);
alter table public.grail_rooms enable row level security;
alter table public.grail_rooms force row level security;
revoke all on public.grail_rooms from public, anon, authenticated;
grant select, insert, update on public.grail_rooms to anon;
create policy backend_only on public.grail_rooms for all to anon
using (
 encode(sha256(convert_to(coalesce(current_setting('request.headers', true)::jsonb ->> 'x-grail-key', ''), 'UTF8')), 'hex') = 'SERVER_KEY_SHA256'
)
with check (
 encode(sha256(convert_to(coalesce(current_setting('request.headers', true)::jsonb ->> 'x-grail-key', ''), 'UTF8')), 'hex') = 'SERVER_KEY_SHA256'
);
