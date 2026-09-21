-- Le Cap — les coffres passent des XP aux niveaux
--
-- Pourquoi : l'XP monte vite dès qu'une quête tombe — un repas de famille vaut
-- +5, et une soirée difficile +5 aussi. Des paliers exprimés en XP étaient donc
-- franchis en quelques semaines. La courbe des niveaux, elle, est quadratique :
-- y accrocher les coffres les étale sans toucher au barème.
--
-- ⚠️ La courbe est écrite DEUX FOIS : ici en SQL, et dans src/lib/levels.ts.
-- Les deux doivent donner le même résultat. Si l'une change, changer l'autre —
-- un décalage se verrait par un coffre annoncé à l'écran mais jamais ouvert.

create function public.xp_pour_niveau(n int) returns int
  language sql immutable set search_path = '' as $fn$
  select case when n <= 1 then 0 else round(1.4 * (n * (n - 1)) / 2.0)::int end;
$fn$;

create function public.niveau_pour_xp(xp int) returns int
language plpgsql immutable set search_path = '' as $fn$
declare n int := 1;
begin
  while public.xp_pour_niveau(n + 1) <= greatest(xp, 0) loop
    n := n + 1;
  end loop;
  return n;
end;
$fn$;

-- ------------------------------------------------------- les paliers

alter table public.tiers add column level int;

update public.tiers set level = public.niveau_pour_xp(points);

-- Deux anciens paliers peuvent retomber sur le même niveau : on ne garde que le
-- premier, sinon la clé primaire refuserait la ligne.
delete from public.tiers t
 where exists (
   select 1 from public.tiers autre
    where autre.pact_id = t.pact_id
      and autre.level = t.level
      and autre.points < t.points
 );

alter table public.tiers drop constraint tiers_pkey;
alter table public.tiers drop column points;
alter table public.tiers alter column level set not null;
alter table public.tiers add constraint tiers_level_positif check (level > 0);
alter table public.tiers add primary key (pact_id, level);

-- ------------------------------------------------- les coffres franchis

alter table public.tier_events rename column tier_points to tier_level;

update public.tier_events e
   set tier_level = public.niveau_pour_xp(e.tier_level);

-- ------------------------------------------- le déclencheur suit les niveaux

create or replace function private.sync_tier_events(p uuid) returns void
language plpgsql security definer set search_path = '' as $fn$
declare
  visible int;
  niveau  int;
begin
  -- Toujours le total VISIBLE par le joueur : un bonus surprise encore caché ne
  -- doit pas ouvrir un coffre, sinon le coffre trahirait son existence.
  select (select count(*) from public.days where pact_id = p and status = 'zero')
       + coalesce((select sum(points) from public.bonuses
                   where pact_id = p and revealed_at is not null), 0)
    into visible;

  niveau := public.niveau_pour_xp(visible);

  insert into public.tier_events (pact_id, tier_level)
  select p, t.level
    from public.tiers t
   where t.pact_id = p
     and t.level <= niveau
  on conflict (pact_id, tier_level) do nothing;
end;
$fn$;

-- --------------------------------------------- les récompenses suivent aussi

alter table public.rewards rename column tier_points to tier_level;

update public.rewards r
   set tier_level = public.niveau_pour_xp(r.tier_level);

-- ------------------------------------------- le calcul rendu à l'application

drop function public.progress(uuid);

create function public.progress(p uuid)
returns table (total int, current_streak int, best_streak int,
               zero_days int, level int,
               next_tier_level int, next_tier_label text, next_tier_xp int)
language sql stable security invoker set search_path = public, pg_temp as $fn$
  with d as (
    select day, day - (row_number() over (order by day))::int as grp
    from public.days where pact_id = p and status = 'zero'
  ),
  runs as (select count(*)::int as len, max(day) as ends_on from d group by grp),
  zeros as (
    select count(*)::int as n from public.days where pact_id = p and status = 'zero'
  ),
  pts as (
    select zeros.n + coalesce(
      (select sum(points) from public.bonuses where pact_id = p), 0)::int as total
    from zeros
  ),
  niv as (select public.niveau_pour_xp(pts.total) as n from pts),
  nt as (
    select t.level, t.label from public.tiers t, niv
    where t.pact_id = p and t.level > niv.n order by t.level limit 1
  )
  select pts.total,
         coalesce((select len from runs
                   where ends_on >= current_date - 1 order by ends_on desc limit 1), 0),
         coalesce((select max(len) from runs), 0),
         zeros.n,
         niv.n,
         (select level from nt),
         (select label from nt),
         (select public.xp_pour_niveau(level) from nt)
  from pts, zeros, niv;
$fn$;

-- ------------------------------------- les paliers posés à la création d'un duo

create or replace function public.create_pact(as_role text) returns public.pacts
language plpgsql security definer set search_path = '' as $fn$
declare
  code text;
  p    public.pacts;
begin
  if as_role not in ('player', 'partner') then
    raise exception 'rôle inconnu : %', as_role;
  end if;

  loop
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.pacts where join_code = code);
  end loop;

  insert into public.pacts
    (join_code, player_id, partner_id, player_consent_at, partner_consent_at)
  values
    (code,
     case when as_role = 'player'  then auth.uid() end,
     case when as_role = 'partner' then auth.uid() end,
     case when as_role = 'player'  then now() end,
     case when as_role = 'partner' then now() end)
  returning * into p;

  -- Sept coffres, du troisième jour à la première année.
  insert into public.tiers (pact_id, level, label) values
    (p.id,  3, 'Première surprise'),
    (p.id,  5, 'Niveau 1'),
    (p.id,  8, 'Niveau 2'),
    (p.id, 11, 'Niveau 3'),
    (p.id, 15, 'Niveau 4'),
    (p.id, 20, 'Niveau 5'),
    (p.id, 28, 'Boss final');

  return p;
end;
$fn$;

grant execute on function public.xp_pour_niveau(int)  to authenticated;
grant execute on function public.niveau_pour_xp(int)  to authenticated;
revoke all on function public.xp_pour_niveau(int) from public;
revoke all on function public.niveau_pour_xp(int) from public;
revoke all on function public.progress(uuid)     from public;
grant execute on function public.progress(uuid)  to authenticated;
