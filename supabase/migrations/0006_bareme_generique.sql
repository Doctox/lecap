-- Le Cap — le barème cesse de parler d'alcool
--
-- L'application s'adresse à toutes les addictions : un barème qui parle de
-- verres, d'apéros et de restaurants ne convenait qu'à une seule.
--
-- Deux quêtes disparaissent pour cette raison : « Apéro où les autres boivent »
-- et « Restaurant avec alcool à table ». Les quatre qui restent décrivent une
-- SITUATION, pas une substance : on peut les lire en pensant au tabac, aux jeux
-- d'argent ou à autre chose, et elles gardent le même sens.
--
-- Le barème d'origine, écrit par un joueur pour l'alcool, reste utilisable :
-- les quêtes sont une table, un duo pourra un jour avoir la sienne.

delete from public.situation_scale;

insert into public.situation_scale (key, label, points, rank) values
  ('propose',     'On m''a proposé',                        2, 1),
  ('soiree_amis', 'Soirée entre amis',                      3, 2),
  ('famille',     'Réunion de famille, fête, anniversaire', 4, 3),
  ('envie',       'Une soirée où j''avais vraiment envie',  5, 4);
