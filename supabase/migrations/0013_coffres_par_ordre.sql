-- Le Cap — les coffres cessent de s'appeler « Niveau »
--
-- Les libellés par défaut étaient « Niveau 1 », « Niveau 2 »… alors que le mot
-- niveau désigne déjà la progression d'XP. Sur la route, on lisait donc
-- « niv. 5 » sous un coffre appelé « Niveau 3 » : personne ne s'y retrouvait.
--
-- Les coffres se nomment désormais par leur rang : première surprise, deuxième
-- surprise, et ainsi de suite. Le mot « niveau » redevient celui de l'XP, et
-- rien d'autre.
--
-- On ne renomme QUE les libellés restés à leur valeur d'origine : un duo qui a
-- baptisé ses coffres garde ses noms.

update public.tiers set label = case label
  when 'Niveau 1' then 'Deuxième surprise'
  when 'Niveau 2' then 'Troisième surprise'
  when 'Niveau 3' then 'Quatrième surprise'
  when 'Niveau 4' then 'Cinquième surprise'
  when 'Niveau 5' then 'Sixième surprise'
  else label
end
where label in ('Niveau 1', 'Niveau 2', 'Niveau 3', 'Niveau 4', 'Niveau 5');

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
    (p.id, 3, 'Deuxième surprise'),
    (p.id, 4, 'Troisième surprise'),
    (p.id, 5, 'Quatrième surprise'),
    (p.id, 6, 'Cinquième surprise'),
    (p.id, 7, 'Sixième surprise'),
    (p.id, 8, 'Boss final');

  return p;
end;
$fn$;
