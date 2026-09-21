-- Le Cap — la remise des coffres
--
-- Le coffre tombait tout seul, mais rien ne permettait de dire qu'il avait été
-- remis : `delivered_at` existait depuis le premier jour sans que rien ne
-- l'écrive. Le joueur restait avec « une surprise t'attend » indéfiniment.
--
-- ⚠️ Le point qui ne se négocie pas, et la raison de ce choix :
-- pour que le joueur garde un souvenir de ce qu'il a reçu, on NE touche PAS à
-- la politique de `rewards`. Elle garde son unique règle, pour le binôme seul.
-- Au moment de la remise, le contenu est RECOPIÉ dans `tier_events`, que le
-- joueur a déjà le droit de lire. Rien n'est lisible une seconde avant que le
-- binôme ne décide de le remettre, et la table interdite le reste pour toujours.

alter table public.tier_events
  add column contenu_revele text check (length(contenu_revele) <= 1000);

comment on column public.tier_events.contenu_revele is
  'Copie du contenu du coffre, écrite par le binôme au moment de la remise. '
  'Ne JAMAIS remplacer par une lecture de public.rewards côté joueur.';
