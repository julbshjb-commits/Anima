-- Suppression de compte sans faire disparaître les souvenirs des autres.
--
-- Quand quelqu'un supprime son compte :
--   * son journal intime et ses journaux sans autre membre disparaissent ;
--   * un journal partagé qu'il avait créé est transmis au membre le plus ancien ;
--   * ses propres entrées sont supprimées (cascade sur author_id).
-- Cette fonction prépare la transmission ; la suppression elle-même
-- (auth.admin.deleteUser) est faite côté serveur avec la clé secrète.

create or replace function public.journals_freeze_keys()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind <> old.kind then
    raise exception 'immutable_columns' using errcode = '42501';
  end if;
  -- Seule la transmission préparée par prepare_account_deletion peut changer de propriétaire.
  if new.owner_id <> old.owner_id
     and coalesce(current_setting('anima.transfert_proprietaire', true), '') <> 'oui' then
    raise exception 'immutable_columns' using errcode = '42501';
  end if;
  return new;
end;
$$;

create function public.prepare_account_deletion()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  r record;
  v_heir uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  perform set_config('anima.transfert_proprietaire', 'oui', true);

  for r in select j.id from public.journals j where j.owner_id = v_me and j.kind <> 'intime' loop
    select m.user_id into v_heir
    from public.journal_members m
    where m.journal_id = r.id and m.user_id <> v_me
    order by (m.role = 'reader'), m.joined_at
    limit 1;

    if v_heir is not null then
      update public.journals set owner_id = v_heir where id = r.id;
      update public.journal_members set role = 'owner' where journal_id = r.id and user_id = v_heir;
    end if;
  end loop;

  perform set_config('anima.transfert_proprietaire', '', true);
end;
$$;

revoke all on function public.prepare_account_deletion() from public, anon;
grant execute on function public.prepare_account_deletion() to authenticated;
