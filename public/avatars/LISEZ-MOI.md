# Les portraits de rang

Douze images, une par rang nommé de `src/lib/levels.ts`, de Mousse à Grand Cap.
Au-delà du douzième niveau, le rang reste « Grand Cap » avec des étoiles et
réutilise le portrait 12.

| Fichier | Rang | Niveau |
|---|---|---|
| `rang-01.png` | Mousse | 1 |
| `rang-02.png` | Matelot | 2 |
| `rang-03.png` | Gabier | 3 |
| `rang-04.png` | Timonier | 4 |
| `rang-05.png` | Navigateur | 5 |
| `rang-06.png` | Quartier-maître | 6 |
| `rang-07.png` | Second | 7 |
| `rang-08.png` | Capitaine | 8 |
| `rang-09.png` | Cap-hornier | 9 |
| `rang-10.png` | Doubleur de caps | 10 |
| `rang-11.png` | Maître à bord | 11 |
| `rang-12.png` | Grand Cap | 12 et au-delà |

## Ce que doit être une image

- **Carrée**, 512×512, PNG.
- **Cadrée sur le buste** : l'anneau est un disque de 92 px, les pieds ne se
  verront jamais.
- **Aucun texte incrusté** — ni niveau, ni nom de rang. L'application les écrit
  elle-même, proprement, et un texte gravé dans l'image serait illisible à
  cette taille.
- **Fond simple ou transparent** : le disque est rogné en rond.
- Même style d'un rang à l'autre, et une progression visible du mousse à
  l'amiral — c'est tout l'intérêt.

Un fichier manquant n'est pas une erreur : le blason retombe sur la boussole.
On peut donc les ajouter un par un.
