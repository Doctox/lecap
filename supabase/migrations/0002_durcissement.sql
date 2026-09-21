-- Le Cap — durcissement d'après les alertes du linter Supabase
--
-- Deux corrections :
--
-- 1. En Postgres, EXECUTE sur une fonction est accordé à PUBLIC par défaut.
--    « revoke ... from anon » ne retire donc rien : anon hérite de PUBLIC.
--    Il faut révoquer de PUBLIC, puis accorder nommément à authenticated.
--
-- 2. Les trois fonctions d'appartenance n'ont pas à exister dans le schéma
--    exposé : PostgREST en faisait des points d'entrée /rest/v1/rpc/. Elles
--    déménagent dans un schéma « private » que l'API ne sert pas. Elles restent
--    exécutables par authenticated, parce qu'une politique de ligne est évaluée
--    avec les droits de l'appelant.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.is_player(p uuid) returns boolean
  language sql stable security definer set search_path = '' as $fn$
  select exists (select 1 from public.pacts where id = p and player_id = auth.uid());
$fn$;

create function private.is_partner(p uuid) returns boolean
  language sql stable security definer set search_path = '' as $fn$
  select exists (select 1 from public.pacts where id = p and partner_id = auth.uid());
$fn$;

create function private.is_member(p uuid) returns boolean
  language sql stable security definer set search_path = '' as $fn$
  select exists (select 1 from public.pacts
                 where id = p and auth.uid() in (player_id, partner_id));
$fn$;

revoke all on function private.is_player(uuid)  from public;
revoke all on function private.is_partner(uuid) from public;
revoke all on function private.is_member(uuid)  from public;
grant execute on function private.is_player(uuid)  to authenticated;
grant execute on function private.is_partner(uuid) to authenticated;
grant execute on function private.is_member(uuid)  to authenticated;

-- Les politiques repointent vers private.*
drop policy tiers_read  on public.tiers;
drop policy tiers_write on public.tiers;
create policy tiers_read on public.tiers for select to authenticated
  using (private.is_member(pact_id));
create policy tiers_write on public.tiers for all to authenticated
  using (private.is_partner(pact_id)) with check (private.is_partner(pact_id));

drop policy days_read           on public.days;
drop policy days_insert         on public.days;
drop policy days_update_player  on public.days;
drop policy days_update_partner on public.days;
create policy days_read on public.days for select to authenticated
  using (private.is_member(pact_id));
create policy days_insert on public.days for insert to authenticated
  with check (
    private.is_player(pact_id)
    and day >= (current_date - 7) and day <= current_date
  );
create policy days_update_player on public.days for update to authenticated
  using (private.is_player(pact_id) and validated_at is null)
  with check (private.is_player(pact_id));
create policy days_update_partner on public.days for update to authenticated
  using (private.is_partner(pact_id)) with check (private.is_partner(pact_id));

drop policy bonuses_read_partner on public.bonuses;
drop policy bonuses_read_player  on public.bonuses;
drop policy bonuses_write        on public.bonuses;
create policy bonuses_read_partner on public.bonuses for select to authenticated
  using (private.is_partner(pact_id));
create policy bonuses_read_player on public.bonuses for select to authenticated
  using (private.is_player(pact_id) and revealed_at is not null);
create policy bonuses_write on public.bonuses for all to authenticated
  using (private.is_partner(pact_id)) with check (private.is_partner(pact_id));

drop policy tier_events_read  on public.tier_events;
drop policy tier_events_write on public.tier_events;
create policy tier_events_read on public.tier_events for select to authenticated
  using (private.is_member(pact_id));
create policy tier_events_write on public.tier_events for all to authenticated
  using (private.is_partner(pact_id)) with check (private.is_partner(pact_id));

-- Toujours une seule politique sur rewards, toujours pour elle seule.
drop policy rewards_partner_only on public.rewards;
create policy rewards_partner_only on public.rewards for all to authenticated
  using (private.is_partner(pact_id)) with check (private.is_partner(pact_id));

-- delete_pact utilisait public.is_member : on la recrée avant de supprimer l'ancienne.
create or replace function public.delete_pact(p uuid) returns void
language plpgsql security definer set search_path = '' as $fn$
begin
  if not private.is_member(p) then
    raise exception 'non autorisé';
  end if;
  delete from public.pacts where id = p;
end;
$fn$;

drop function public.is_player(uuid);
drop function public.is_partner(uuid);
drop function public.is_member(uuid);

-- Les deux seules fonctions qui doivent rester appelables depuis l'application,
-- et seulement par un compte connecté.
revoke all on function public.delete_pact(uuid) from public;
revoke all on function public.join_pact(text)   from public;
revoke all on function public.progress(uuid)    from public;
grant execute on function public.delete_pact(uuid) to authenticated;
grant execute on function public.join_pact(text)   to authenticated;
grant execute on function public.progress(uuid)    to authenticated;

-- Fonction de déclenchement créée par l'option « Enable automatic RLS » du projet.
-- Elle sert au déclencheur d'événement, pas à l'API : personne n'a à l'appeler.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
