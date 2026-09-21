-- Le Cap — passage à une application publique, en duos
--
-- Le schéma était déjà multi-duos : `pacts` est une table à plusieurs lignes et
-- l'isolation se fait par appartenance. Il manquait trois choses pour ouvrir :
-- un pseudo, une création de duo qui choisit son rôle, et les paliers par défaut.

-- ------------------------------------------------------------- Les pseudos
-- Un pseudo, rien d'autre. Pas de nom, pas de photo, pas de profil public :
-- seul le binôme d'un duo peut lire le pseudo de l'autre.

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  pseudo     text not null check (length(btrim(pseudo)) between 1 and 24),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create function private.shares_pact(other uuid) returns boolean
  language sql stable security definer set search_path = '' as $fn$
  select exists (
    select 1 from public.pacts
    where (player_id = auth.uid() and partner_id = other)
       or (partner_id = auth.uid() and player_id = other)
  );
$fn$;

revoke all on function private.shares_pact(uuid) from public;
grant execute on function private.shares_pact(uuid) to authenticated;

create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or private.shares_pact(id));
create policy profiles_write on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

grant select, insert, update on public.profiles to authenticated;

-- ------------------------------------------------ Créer un duo, choisir son rôle
-- Le créateur choisit s'il tient le rôle joueur ou celui du binôme, consent
-- par le fait même, et repart avec un code à six caractères à transmettre.
-- Les sept paliers du brief sont posés par défaut, modifiables ensuite.

create function public.create_pact(as_role text) returns public.pacts
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

  insert into public.tiers (pact_id, points, label) values
    (p.id,   3, 'Première surprise'),
    (p.id,   7, 'Niveau 1'),
    (p.id,  15, 'Niveau 2'),
    (p.id,  30, 'Niveau 3'),
    (p.id,  50, 'Niveau 4'),
    (p.id,  75, 'Niveau 5'),
    (p.id, 100, 'Boss final');

  return p;
end;
$fn$;

-- Rejoindre : on consent en rejoignant, et le duo se ferme à deux.
create or replace function public.join_pact(code text) returns uuid
language plpgsql security definer set search_path = '' as $fn$
declare target public.pacts;
begin
  select * into target from public.pacts where join_code = upper(btrim(code));
  if target.id is null then
    raise exception 'code inconnu';
  end if;
  if auth.uid() in (target.player_id, target.partner_id) then
    return target.id;
  end if;
  if target.player_id is null then
    update public.pacts
      set player_id = auth.uid(), player_consent_at = now()
      where id = target.id;
  elsif target.partner_id is null then
    update public.pacts
      set partner_id = auth.uid(), partner_consent_at = now()
      where id = target.id;
  else
    raise exception 'ce duo est déjà complet';
  end if;
  return target.id;
end;
$fn$;

revoke all on function public.create_pact(text) from public;
grant execute on function public.create_pact(text) to authenticated;
