-- Le Cap — un seul code, dans un seul sens
--
-- Avant, les deux rôles pouvaient ouvrir un duo et repartir avec un code : deux
-- codes circulaient pour une seule partie, et on pouvait se retrouver à deux
-- duos vides qui s'attendent.
--
-- Désormais : **celui qui garde le cap ouvre la partie** et reçoit le code.
-- **Celui qui tient la barre ne peut que rejoindre.** La règle est dans la base,
-- pas seulement dans l'écran : create_pact ne prend plus de rôle en argument.

drop function public.create_pact(text);

create function public.create_pact() returns public.pacts
language plpgsql security definer set search_path = '' as $fn$
declare
  code text;
  p    public.pacts;
begin
  loop
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.pacts where join_code = code);
  end loop;

  -- Le créateur garde le cap. La place de la barre reste ouverte.
  insert into public.pacts
    (join_code, player_id, player_consent_at)
  values (code, auth.uid(), now())
  returning * into p;

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

-- Rejoindre, c'est prendre la barre — jamais la place du joueur.
create or replace function public.join_pact(code text) returns uuid
language plpgsql security definer set search_path = '' as $fn$
declare target public.pacts;
begin
  select * into target from public.pacts where join_code = upper(btrim(code));

  if target.id is null then
    raise exception 'code inconnu';
  end if;
  if auth.uid() = target.player_id then
    raise exception 'ce code est le tien';
  end if;
  if auth.uid() = target.partner_id then
    return target.id;
  end if;
  if target.partner_id is not null then
    raise exception 'ce duo est déjà complet';
  end if;

  update public.pacts
     set partner_id = auth.uid(), partner_consent_at = now()
   where id = target.id;

  return target.id;
end;
$fn$;

revoke all on function public.create_pact() from public;
grant execute on function public.create_pact() to authenticated;
