-- One versioned document per account preserves the existing backup format.
-- Atomic compare-and-swap prevents offline devices from silently overwriting each other.
create table public.routine_journals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  document jsonb not null check (
    jsonb_typeof(document) = 'object' and document->>'version' = '1'
    and jsonb_typeof(document->'routines') = 'array'
    and jsonb_typeof(document->'days') = 'object'
    and jsonb_typeof(document->'weeks') = 'object'
    and octet_length(document::text) <= 5242880
  ),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.routine_journals enable row level security;
revoke all on public.routine_journals from public, anon, authenticated;
grant select on public.routine_journals to authenticated;
create policy "Read own journal" on public.routine_journals
  for select to authenticated using ((select auth.uid()) = user_id);

create function public.put_routine_journal(expected_account_id uuid, expected_revision integer, document jsonb)
returns setof public.routine_journals
language plpgsql security definer set search_path = ''
as $$
declare account_id uuid := auth.uid();
begin
  if account_id is null or account_id is distinct from expected_account_id then raise exception 'Account mismatch' using errcode = '42501'; end if;
  if expected_revision is null or expected_revision < 0 or document is null then
    raise exception 'Invalid journal write' using errcode = '22023';
  end if;
  if expected_revision = 0 then
    return query insert into public.routine_journals as j (user_id, document)
      values (account_id, document) on conflict (user_id) do nothing returning j.*;
  else
    return query update public.routine_journals as j
      set document = put_routine_journal.document, revision = j.revision + 1, updated_at = now()
      where j.user_id = account_id and j.revision = expected_revision returning j.*;
  end if;
  if not found then raise exception 'Journal revision conflict' using errcode = '40001'; end if;
end;
$$;
revoke all on function public.put_routine_journal(uuid, integer, jsonb) from public, anon;
grant execute on function public.put_routine_journal(uuid, integer, jsonb) to authenticated;
