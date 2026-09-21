-- Le Cap — les sept coffres tiennent dans un mois
--
-- Le joueur l'a demandé, et ça fait foi : les sept coffres doivent pouvoir
-- s'ouvrir en un mois. Ils descendent donc aux niveaux 2 à 8 — la courbe d'XP
-- ne bouge pas, ce sont les coffres qui se rapprochent.
--
-- Avec +1 XP par jour déclaré, le boss final tombe au 39e jour sans la moindre
-- quête, et vers le 26e avec une vie sociale ordinaire. Le premier coffre tombe
-- dès le premier soir : c'est voulu, une victoire immédiate vaut mieux qu'une
-- promesse.
--
-- Les duos existants gardent leurs récompenses : on ne recrée pas les paliers,
-- on les fait glisser en conservant l'ordre, et tout ce qui y était accroché
-- suit.

create temporary table glissement on commit drop as
select t.pact_id,
       t.level as ancien,
       t.label,
       (array[2, 3, 4, 5, 6, 7, 8])[
         least(row_number() over (partition by t.pact_id order by t.level), 7)::int
       ] as nouveau
  from public.tiers t;

-- Les paliers repartent sur la nouvelle échelle, libellés intacts.
delete from public.tiers;

insert into public.tiers (pact_id, level, label)
select pact_id, nouveau, label from glissement
on conflict (pact_id, level) do nothing;

-- Les coffres déjà remplis suivent leur palier. Sans ça, une récompense
-- préparée pour le niveau 15 pointerait vers un palier qui n'existe plus.
update public.rewards r
   set tier_level = g.nouveau
  from glissement g
 where g.pact_id = r.pact_id
   and g.ancien = r.tier_level;

update public.tier_events e
   set tier_level = g.nouveau
  from glissement g
 where g.pact_id = e.pact_id
   and g.ancien = e.tier_level;

-- Les nouveaux duos naissent directement sur cette échelle.
create or replace function public.create_pact() returns public.pacts
language plpgsql security definer set search_path = '' as $fn$
declare
  code text;
  p    public.pacts;
begin
  loop
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.pacts where join_code = code);
  end loop;

  insert into public.pacts
    (join_code, player_id, player_consent_at)
  values (code, auth.uid(), now())
  returning * into p;

  -- Sept coffres, du premier soir à la fin du mois.
  insert into public.tiers (pact_id, level, label) values
    (p.id, 2, 'Première surprise'),
    (p.id, 3, 'Niveau 1'),
    (p.id, 4, 'Niveau 2'),
    (p.id, 5, 'Niveau 3'),
    (p.id, 6, 'Niveau 4'),
    (p.id, 7, 'Niveau 5'),
    (p.id, 8, 'Boss final');

  return p;
end;
$fn$;

-- Les coffres déjà franchis sont recalculés : le glissement en ouvre
-- mécaniquement de nouveaux, puisque les paliers sont descendus.
select private.sync_tier_events(id) from public.pacts;
