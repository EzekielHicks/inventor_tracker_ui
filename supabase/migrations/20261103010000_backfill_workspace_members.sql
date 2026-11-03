do $$
begin
  perform pg_advisory_xact_lock(81724031);

  insert into public.workspace_members (user_id, display_name, role)
  select
    users.id,
    coalesce(
      nullif(trim(users.raw_user_meta_data ->> 'display_name'), ''),
      split_part(users.email, '@', 1)
    ),
    'pending'
  from auth.users as users
  on conflict (user_id) do nothing;

  if not exists (
    select 1 from public.workspace_members where role = 'admin'
  ) then
    update public.workspace_members
    set role = 'admin'
    where user_id = (
      select id
      from auth.users
      order by created_at, id
      limit 1
    );
  end if;
end;
$$;
