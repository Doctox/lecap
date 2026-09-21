-- Le Cap — ajouter et retirer des coffres
--
-- La version précédente exigeait le même nombre de coffres et les appariait par
-- rang. Retirer le troisième aurait donc décalé les récompenses de tous les
-- suivants : la surprise du niveau 5 serait passée au niveau 4.
--
-- Chaque ligne porte donc désormais son ancien niveau — ou 0 si le coffre est
-- neuf. La correspondance est explicite, plus jamais déduite d'un rang.
--
-- Une règle qu'on ne négocie pas non plus : **un coffre déjà franchi ne se
-- retire pas**. Ce serait effacer un moment qui a eu lieu, et le joueur en
-- garde la trace dans son journal.

drop function public.definir_paliers(uuid, int[]);

create function public.definir_paliers(
  p        uuid,
  anciens  int[],
  niveaux  int[],
  libelles text[]
) returns void
language plpgsql security definer set search_path = '' as $fn$
declare combien int;
begin
  if not private.is_partner(p) then
    raise exception 'seul le binôme règle la répartition';
  end if;

  combien := array_length(niveaux, 1);
  if combien is null or combien < 1 or combien > 12 then
    raise exception 'il faut entre 1 et 12 coffres';
  end if;
  if array_length(anciens, 1) <> combien or array_length(libelles, 1) <> combien then
    raise exception 'listes de tailles différentes';
  end if;
  if exists (select 1 from unnest(niveaux) x where x < 2) then
    raise exception 'un coffre commence au niveau 2';
  end if;
  if exists (
    select 1
      from unnest(niveaux) with ordinality as t(v, i)
      join unnest(niveaux) with ordinality as u(w, j) on j = i + 1
     where w <= v
  ) then
    raise exception 'les niveaux doivent aller en montant, sans doublon';
  end if;

  create temporary table plan on commit drop as
  select t.v as nouveau, a.v as ancien, l.v as libelle
    from unnest(niveaux)  with ordinality as t(v, i)
    join unnest(anciens)  with ordinality as a(v, i) using (i)
    join unnest(libelles) with ordinality as l(v, i) using (i);

  if exists (
    select 1 from public.tier_events e
     where e.pact_id = p
       and e.tier_level not in (select ancien from plan where ancien > 0)
  ) then
    raise exception 'un coffre déjà franchi ne peut pas être retiré';
  end if;

  -- Ce qui partait avec un coffre retiré s'en va avec lui.
  delete from public.rewards r
   where r.pact_id = p
     and r.tier_level not in (select ancien from plan where ancien > 0);

  delete from public.tiers where pact_id = p;

  insert into public.tiers (pact_id, level, label)
  select p, nouveau, libelle from plan;

  -- Détour par les négatifs : sans lui, déplacer 2 → 3 alors que 3 existe
  -- encore violerait l'unicité en cours de route.
  update public.rewards set tier_level = -tier_level where pact_id = p;
  update public.rewards r set tier_level = pl.nouveau
    from plan pl
   where r.pact_id = p and pl.ancien > 0 and r.tier_level = -pl.ancien;

  update public.tier_events set tier_level = -tier_level where pact_id = p;
  update public.tier_events e set tier_level = pl.nouveau
    from plan pl
   where e.pact_id = p and pl.ancien > 0 and e.tier_level = -pl.ancien;

  perform private.sync_tier_events(p);
end;
$fn$;

revoke all on function public.definir_paliers(uuid, int[], int[], text[]) from public;
grant execute on function public.definir_paliers(uuid, int[], int[], text[]) to authenticated;
