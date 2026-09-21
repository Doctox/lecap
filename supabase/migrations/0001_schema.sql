-- Le Cap — schéma initial
-- Règle qui commande tout : le rôle joueur ne peut PAS lire la table rewards.
-- Ce n'est pas un masquage d'interface, c'est une absence de politique de lecture.

-- ---------------------------------------------------------------- 1. Le pacte

create table public.pacts (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  join_code          text not null unique check (join_code ~ '^[A-Z0-9]{6}$'),
  player_id          uuid references auth.users(id) on delete set null,
  partner_id         uuid references auth.users(id) on delete set null,
  player_consent_at  timestamptz,
  partner_consent_at timestamptz,
  timezone           text not null default 'Europe/Paris',
  -- la journée bascule à 4h, pour qu'une soirée déclarée à 1h compte sur le bon jour
  day_rollover_hour  int not null default 4 check (day_rollover_hour between 0 and 12),
  constraint distinct_members
    check (player_id is null or partner_id is null or player_id <> partner_id)
);

-- Fonctions d'appartenance. security definer pour éviter la récursion de politique :
-- une politique sur days ne doit pas relancer les politiques de pacts.
create function public.is_player(p uuid) returns boolean
  language sql stable security definer set search_path = '' as $fn$
  select exists (select 1 from public.pacts where id = p and player_id = auth.uid());
$fn$;

create function public.is_partner(p uuid) returns boolean
  language sql stable security definer set search_path = '' as $fn$
  select exists (select 1 from public.pacts where id = p and partner_id = auth.uid());
$fn$;

create function public.is_member(p uuid) returns boolean
  language sql stable security definer set search_path = '' as $fn$
  select exists (select 1 from public.pacts
                 where id = p and auth.uid() in (player_id, partner_id));
$fn$;

-- ------------------------------------------- 2. Le barème, tel qu'il l'a écrit

create table public.situation_scale (
  key    text primary key,
  label  text not null,
  points int  not null check (points between 1 and 5),
  rank   int  not null
);

insert into public.situation_scale (key, label, points, rank) values
  ('verre_propose', 'On m''a proposé un verre',              1, 1),
  ('apero',         'Apéro où les autres boivent',           2, 2),
  ('restaurant',    'Restaurant avec alcool à table',        2, 3),
  ('barbecue',      'Barbecue ou soirée entre amis',         3, 4),
  ('famille',       'Repas de famille, fête, anniversaire',  5, 5),
  ('soiree_dure',   'Une soirée où j''avais vraiment envie', 5, 6);

-- Les paliers vivent en base : en ajouter après 100 ne demandera pas une ligne de code.
create table public.tiers (
  pact_id uuid not null references public.pacts(id) on delete cascade,
  points  int  not null check (points > 0),
  label   text not null,
  primary key (pact_id, points)
);

-- ------------------------------------------------------------ 3. Les journées

create table public.days (
  id           uuid primary key default gen_random_uuid(),
  pact_id      uuid not null references public.pacts(id) on delete cascade,
  day          date not null,
  -- 'zero' = journée à zéro (+1) · 'ecart' = il a bu (0 point ; la série repart, pas les points)
  status       text not null check (status in ('zero', 'ecart')),
  situations   text[] not null default '{}',
  note         text check (length(note) <= 500),
  declared_at  timestamptz not null default now(),
  -- le +1 compte tout de suite ; la validation ne sert qu'à arbitrer les bonus
  validated_at timestamptz,
  unique (pact_id, day)
);

create index days_pact_day_idx on public.days (pact_id, day desc);

-- ------------------------------------------------------------- 4. Les bonus
-- revealed_at null = invisible pour le joueur. C'est le cas d'un bonus surprise
-- tant qu'elle n'a pas décidé de le montrer.

create table public.bonuses (
  id          uuid primary key default gen_random_uuid(),
  pact_id     uuid not null references public.pacts(id) on delete cascade,
  day_id      uuid references public.days(id) on delete cascade,
  kind        text not null check (kind in ('situation', 'surprise')),
  points      int  not null check (points between 1 and 5),
  label       text,
  message     text check (length(message) <= 500),
  created_at  timestamptz not null default now(),
  revealed_at timestamptz,
  -- un bonus de situation est révélé au moment où elle valide la journée
  constraint situation_needs_day check (kind <> 'situation' or day_id is not null)
);

create index bonuses_pact_idx on public.bonuses (pact_id);

-- ------------------------------------------------- 5. Les paliers franchis
-- Aucune récompense ici : seulement le fait qu'un palier est tombé.
-- C'est cette table qui alimente « une surprise t'attend », sans rien dévoiler.

create table public.tier_events (
  id            uuid primary key default gen_random_uuid(),
  pact_id       uuid not null references public.pacts(id) on delete cascade,
  tier_points   int  not null,
  reached_at    timestamptz not null default now(),
  celebrated_at timestamptz,
  delivered_at  timestamptz,
  unique (pact_id, tier_points)
);

-- ------------------------------------- 6. Les récompenses — la table interdite
-- Elle a une politique. Il n'en a aucune. Pas de vue dessus, pas de fonction qui
-- la lit pour le joueur, pas de jointure. Une requête de sa part renvoie vide.

create table public.rewards (
  id          uuid primary key default gen_random_uuid(),
  pact_id     uuid not null references public.pacts(id) on delete cascade,
  tier_points int  not null,
  content     text not null check (length(content) <= 1000),
  updated_at  timestamptz not null default now(),
  unique (pact_id, tier_points)
);

-- ========================================================= SÉCURITÉ DES LIGNES

alter table public.pacts           enable row level security;
alter table public.situation_scale enable row level security;
alter table public.tiers           enable row level security;
alter table public.days            enable row level security;
alter table public.bonuses         enable row level security;
alter table public.tier_events     enable row level security;
alter table public.rewards         enable row level security;

-- Le pacte : ses deux membres, personne d'autre.
create policy pacts_read on public.pacts for select to authenticated
  using (auth.uid() in (player_id, partner_id));
create policy pacts_create on public.pacts for insert to authenticated
  with check (auth.uid() in (player_id, partner_id));
create policy pacts_update on public.pacts for update to authenticated
  using (auth.uid() in (player_id, partner_id))
  with check (auth.uid() in (player_id, partner_id));
create policy pacts_delete on public.pacts for delete to authenticated
  using (auth.uid() in (player_id, partner_id));

-- Le barème et les paliers : il les connaît, c'est le principe.
create policy scale_read on public.situation_scale for select to authenticated using (true);
create policy tiers_read on public.tiers for select to authenticated
  using (public.is_member(pact_id));
create policy tiers_write on public.tiers for all to authenticated
  using (public.is_partner(pact_id)) with check (public.is_partner(pact_id));

-- Les journées : il déclare, elle arbitre, les deux lisent.
create policy days_read on public.days for select to authenticated
  using (public.is_member(pact_id));
create policy days_insert on public.days for insert to authenticated
  with check (
    public.is_player(pact_id)
    -- un jour oublié n'est pas un jour bu : jusqu'à 7 jours en arrière
    and day >= (current_date - 7) and day <= current_date
  );
create policy days_update_player on public.days for update to authenticated
  using (public.is_player(pact_id) and validated_at is null)
  with check (public.is_player(pact_id));
create policy days_update_partner on public.days for update to authenticated
  using (public.is_partner(pact_id)) with check (public.is_partner(pact_id));

-- Les bonus : elle écrit tout et voit tout.
-- Lui ne voit que ce qu'elle a décidé de révéler.
create policy bonuses_read_partner on public.bonuses for select to authenticated
  using (public.is_partner(pact_id));
create policy bonuses_read_player on public.bonuses for select to authenticated
  using (public.is_player(pact_id) and revealed_at is not null);
create policy bonuses_write on public.bonuses for all to authenticated
  using (public.is_partner(pact_id)) with check (public.is_partner(pact_id));

-- Les paliers franchis : il doit les voir, c'est sa fête.
create policy tier_events_read on public.tier_events for select to authenticated
  using (public.is_member(pact_id));
create policy tier_events_write on public.tier_events for all to authenticated
  using (public.is_partner(pact_id)) with check (public.is_partner(pact_id));

-- Les récompenses : UNE SEULE politique, pour elle. Aucune pour lui. Volontairement.
-- Ne jamais ajouter de politique de lecture ici, même « le temps d'un test ».
create policy rewards_partner_only on public.rewards for all to authenticated
  using (public.is_partner(pact_id)) with check (public.is_partner(pact_id));

-- =================================================================== CALCULS
-- security invoker : les politiques ci-dessus s'appliquent à l'appelant,
-- donc un bonus non révélé ne compte pas dans SON total à lui.

create function public.progress(p uuid)
returns table (total int, current_streak int, best_streak int,
               zero_days int, next_tier int, next_tier_label text)
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
  nt as (
    select t.points, t.label from public.tiers t, pts
    where t.pact_id = p and t.points > pts.total order by t.points limit 1
  )
  select pts.total,
         coalesce((select len from runs
                   where ends_on >= current_date - 1 order by ends_on desc limit 1), 0),
         coalesce((select max(len) from runs), 0),
         zeros.n,
         (select points from nt), (select label from nt)
  from pts, zeros;
$fn$;

-- Suppression du pacte et de tout son contenu, en un geste, par l'un ou l'autre.
create function public.delete_pact(p uuid) returns void
language plpgsql security definer set search_path = '' as $fn$
begin
  if not public.is_member(p) then
    raise exception 'non autorisé';
  end if;
  delete from public.pacts where id = p;
end;
$fn$;

-- Rejoindre par code : le second ne peut pas lire le pacte avant d'en être membre,
-- donc cette fonction est le seul chemin d'entrée.
create function public.join_pact(code text) returns uuid
language plpgsql security definer set search_path = '' as $fn$
declare target public.pacts;
begin
  select * into target from public.pacts where join_code = upper(code);
  if target.id is null then raise exception 'code inconnu'; end if;
  if auth.uid() in (target.player_id, target.partner_id) then return target.id; end if;
  if target.player_id is null then
    update public.pacts set player_id = auth.uid() where id = target.id;
  elsif target.partner_id is null then
    update public.pacts set partner_id = auth.uid() where id = target.id;
  else
    raise exception 'ce pacte est complet';
  end if;
  return target.id;
end;
$fn$;

-- ============================================= EXPOSITION À L'API DE DONNÉES
-- Le projet est créé avec « Automatically expose new tables » décoché : aucune
-- table n'est servie par l'API tant qu'elle n'est pas nommée ici. Deux verrous
-- indépendants, donc — l'exposition et la politique de ligne.
--
-- rewards est exposée, parce qu'elle la lit depuis son navigateur à elle. Sa
-- protection reste sa politique unique : côté joueur, la réponse est vide.
-- Le rôle anon, lui, n'obtient rien : non connecté, on ne lit rien du tout.

grant usage on schema public to authenticated;

grant select                         on public.situation_scale to authenticated;
grant select, insert, update, delete on public.pacts           to authenticated;
grant select, insert, update, delete on public.tiers           to authenticated;
grant select, insert, update         on public.days            to authenticated;
grant select, insert, update, delete on public.bonuses         to authenticated;
grant select, insert, update, delete on public.tier_events     to authenticated;
grant select, insert, update, delete on public.rewards         to authenticated;

-- Les fonctions d'appartenance sont évaluées dans les politiques avec les droits
-- de l'appelant : sans ce droit d'exécution, toutes les politiques échoueraient.
grant execute on function public.is_player(uuid)   to authenticated;
grant execute on function public.is_partner(uuid)  to authenticated;
grant execute on function public.is_member(uuid)   to authenticated;
grant execute on function public.progress(uuid)    to authenticated;
grant execute on function public.delete_pact(uuid) to authenticated;
grant execute on function public.join_pact(text)   to authenticated;

revoke all on all tables in schema public from anon;
revoke all on function public.delete_pact(uuid) from anon;
revoke all on function public.join_pact(text) from anon;
