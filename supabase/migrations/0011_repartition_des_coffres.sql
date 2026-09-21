-- Le Cap — le binôme règle la répartition des coffres
--
-- Les sept paliers étaient figés à la création du duo. Ils deviennent réglables :
-- un duo qui vise un mois et un duo qui vise un an n'ont pas le même rythme.
--
-- Déplacer un palier change sa clé primaire, et deux tables s'y accrochent : la
-- récompense préparée et l'évènement « coffre franchi ». Un navigateur qui
-- ferait ça en trois requêtes laisserait des coffres orphelins au premier
-- réseau qui lâche. D'où cette fonction : tout bascule, ou rien.
--
-- Seul le binôme peut appeler — c'est lui qui prépare les coffres.

create function public.definir_paliers(p uuid, niveaux int[]) returns void
language plpgsql security definer set search_path = '' as $fn$
declare
  attendus int;
begin
  if not private.is_partner(p) then
    raise exception 'seul le binôme règle la répartition';
  end if;

  select count(*) into attendus from public.tiers where pact_id = p;
  if array_length(niveaux, 1) is distinct from attendus then
    raise exception 'il faut exactement % niveaux', attendus;
  end if;

  -- Le premier niveau est le point de départ : un coffre posé là serait déjà
  -- ouvert avant la première déclaration.
  if exists (select 1 from unnest(niveaux) n where n < 2) then
    raise exception 'un coffre commence au niveau 2';
  end if;

  -- Strictement croissants : deux coffres au même niveau se marcheraient
  -- dessus, et la clé primaire refuserait la ligne.
  if exists (
    select 1
      from unnest(niveaux) with ordinality as t(n, i)
      join unnest(niveaux) with ordinality as u(m, j) on j = i + 1
     where m <= n
  ) then
    raise exception 'les niveaux doivent aller en montant, sans doublon';
  end if;

  -- La correspondance ancien → nouveau, par rang. Les libellés suivent leur
  -- coffre : « Boss final » reste le dernier, où qu'on le mette.
  create temporary table correspondance on commit drop as
  select t.level as ancien,
         t.label,
         niveaux[row_number() over (order by t.level)::int] as nouveau
    from public.tiers t
   where t.pact_id = p;

  delete from public.tiers where pact_id = p;

  insert into public.tiers (pact_id, level, label)
  select p, nouveau, label from correspondance;

  update public.rewards r
     set tier_level = c.nouveau
    from correspondance c
   where r.pact_id = p and r.tier_level = c.ancien;

  update public.tier_events e
     set tier_level = c.nouveau
    from correspondance c
   where e.pact_id = p and e.tier_level = c.ancien;

  -- Un coffre descendu sous le niveau atteint s'ouvre aussitôt ; un coffre
  -- remonté au-dessus ne se referme PAS — ce qui est acquis reste acquis, et
  -- c'est la règle de tout le jeu.
  perform private.sync_tier_events(p);
end;
$fn$;

revoke all on function public.definir_paliers(uuid, int[]) from public;
grant execute on function public.definir_paliers(uuid, int[]) to authenticated;
