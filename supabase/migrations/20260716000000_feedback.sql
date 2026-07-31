-- supabase/migrations/20260716000000_feedback.sql
create table if not exists public.feedback_submissions (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  kind         text not null check (kind in ('idea','problem','love')),
  category     text,
  body         text not null check (char_length(body) between 1 and 4000),
  install_id   uuid not null,
  app_version  text,
  os           text,
  locale       text,
  handled      boolean not null default false
);

create table if not exists public.feedback_changelog (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  published_at  timestamptz,
  status        text not null check (status in ('shipped','planned')),
  title         text not null,
  body          text not null,
  is_published  boolean not null default false
);

create index if not exists feedback_changelog_pub_idx
  on public.feedback_changelog (is_published, published_at desc);

alter table public.feedback_submissions enable row level security;
alter table public.feedback_changelog   enable row level security;

create policy feedback_insert on public.feedback_submissions
  for insert to anon with check (
    char_length(body) between 1 and 4000
    and kind in ('idea','problem','love')
  );

create policy changelog_read on public.feedback_changelog
  for select to anon using (is_published = true);
