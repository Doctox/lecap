-- Le Cap — un pseudo d'au moins deux caractères
--
-- La règle d'origine acceptait un seul caractère : « a » passait, et un appui
-- de touche accidenté devenait un pseudo. Deux, c'est le minimum qui laisse
-- encore passer des initiales — « JM », « PJ » — sans accepter n'importe quoi.
--
-- Pas d'unicité, volontairement : il n'y a ni annuaire ni profil public, deux
-- duos différents peuvent très bien avoir chacun leur « Chat ».

alter table public.profiles drop constraint profiles_pseudo_check;

alter table public.profiles
  add constraint profiles_pseudo_check
  check (length(btrim(pseudo)) between 2 and 24);
