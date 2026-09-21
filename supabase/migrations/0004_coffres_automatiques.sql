-- Le Cap — ouverture automatique des coffres
--
-- Un palier peut tomber sans que le binôme touche à quoi que ce soit : il
-- déclare une journée à zéro, et le voilà à 15. Comme seul le binôme a le droit
-- d'écrire dans tier_events, il faut un déclencheur côté base.
--
-- Le total qui fait tomber un coffre est le total VISIBLE par le joueur :
-- ses journées à zéro, plus les bonus déjà révélés. Un bonus surprise encore
-- caché ne doit pas déclencher un coffre — sinon le coffre trahirait l'existence
-- de points qu'il ne peut pas voir, et la surprise serait éventée.

create function private.sync_tier_events(p uuid) returns void
language plpgsql security definer set search_path = '' as $fn$
declare visible int;
begin
  select (select count(*) from public.days where pact_id = p and status = 'zero')
       + coalesce((select sum(points) from public.bonuses
                   where pact_id = p and revealed_at is not null), 0)
    into visible;

  insert into public.tier_events (pact_id, tier_points)
  select p, t.points
    from public.tiers t
   where t.pact_id = p
     and t.points <= visible
  on conflict (pact_id, tier_points) do nothing;
end;
$fn$;

create function private.tg_sync_tier_events() returns trigger
language plpgsql security definer set search_path = '' as $fn$
begin
  if tg_op = 'DELETE' then
    perform private.sync_tier_events(old.pact_id);
  else
    perform private.sync_tier_events(new.pact_id);
  end if;
  return null;
end;
$fn$;

create trigger days_coffres
  after insert or update or delete on public.days
  for each row execute function private.tg_sync_tier_events();

create trigger bonuses_coffres
  after insert or update or delete on public.bonuses
  for each row execute function private.tg_sync_tier_events();

revoke all on function private.sync_tier_events(uuid) from public;
revoke all on function private.tg_sync_tier_events() from public;
