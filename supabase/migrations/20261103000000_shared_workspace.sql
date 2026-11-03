create table if not exists public.workspace_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('admin', 'manager', 'team_member', 'pending')),
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_data (
  data_key text primary key,
  data jsonb not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.workspace_members enable row level security;
alter table public.workspace_data enable row level security;

create or replace function public.is_active_workspace_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
    where user_id = auth.uid()
      and role in ('admin', 'manager', 'team_member')
      and coalesce(auth.jwt() -> 'user_metadata' ->> 'must_change_password', 'false') <> 'true'
  );
$$;

create policy "Members can view workspace members"
  on public.workspace_members for select
  to authenticated
  using (public.is_active_workspace_member());

create policy "Active members can read workspace data"
  on public.workspace_data for select
  to authenticated
  using (
    data_key in ('inventory', 'suppliers', 'settings')
    and public.is_active_workspace_member()
  );

create or replace function public.bootstrap_workspace_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned_role text;
  profile_name text;
begin
  perform pg_advisory_xact_lock(81724031);
  select case when exists (
    select 1 from public.workspace_members where role = 'admin'
  ) then 'pending' else 'admin' end into assigned_role;
  profile_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(new.email, '@', 1)
  );
  insert into public.workspace_members (user_id, display_name, role)
  values (new.id, profile_name, assigned_role);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_workspace_member on auth.users;
create trigger on_auth_user_created_workspace_member
  after insert on auth.users
  for each row execute function public.bootstrap_workspace_member();

grant select on public.workspace_members, public.workspace_data to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.workspace_data;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;
