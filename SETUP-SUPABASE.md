# Le Cap — ce qui reste à faire dans le tableau de bord

Projet **`lecap`** — `nzrdjsquhrdetfgbycbb`, organisation Doctox, région `eu-central-1`.
Séparé du projet des jeux : ces données ne côtoient pas MotMan.

## Déjà fait

- Schéma, politiques de sécurité au niveau des lignes, fonctions de calcul.
- Durcissement : 12 alertes du linter ramenées à 2, les deux restantes étant les
  fonctions faites pour être appelées (`create_pact`, `join_pact`, `delete_pact`).
- Duos, pseudos, paliers par défaut, ouverture automatique des coffres.
- `.env.local` écrit avec l'URL et la clé publiable. Ignoré par git.
- Test du joueur curieux passé : avec son jeton à lui, `rewards` renvoie **0 ligne**.

## Ce qui te reste, et qui bloque la connexion

L'application n'ouvre qu'avec **Google ou Discord**, sans compte invité.
Il faut donc déclarer les deux fournisseurs. Ces réglages demandent des
identifiants : c'est à toi de les coller, je ne les manipule pas.

Chacun suit le même principe — tu crées une application chez le fournisseur, tu y
colles l'URI de redirection que Supabase affiche sur sa page, et tu rapportes le
*Client ID* et le *Client Secret* dans Supabase.

### 1. URL de l'application

**Authentication → URL Configuration**

- Site URL : `https://doctox.fr/lecap/`
- Redirect URLs — ajouter ces deux lignes, la seconde pour le développement :

```
https://doctox.fr/lecap/**
http://localhost:5173/lecap/**
```

Sans la seconde, la connexion échouera sur ta machine avant même la mise en ligne.

### 2. Google

Gratuit. Compter dix à quinze minutes la première fois.

**Crée un projet Google Cloud à part**, ne réutilise pas celui de MotMan :
l'écran de consentement affiche le nom du projet, et on ne veut pas que « MotMan »
apparaisse quand quelqu'un se connecte à Le Cap.

#### a. Le projet et l'écran de consentement

[console.cloud.google.com](https://console.cloud.google.com) → nouveau projet `Le Cap`.

Puis **APIs & Services → OAuth consent screen** :

| Champ | Valeur |
|---|---|
| User type | External |
| App name | `Le Cap` |
| User support email | `contact@doctox.fr` |
| Authorized domain | `doctox.fr` |
| Privacy policy | `https://doctox.fr/lecap/legal/confidentialite.html` |
| Terms of service | `https://doctox.fr/lecap/legal/mentions-legales.html` |
| Developer contact | `contact@doctox.fr` |

Scopes : laisser `email`, `profile`, `openid`. Rien d'autre, surtout rien de
« sensible » — c'est ce qui évite une procédure de vérification.

**Passe ensuite l'application en production** (bouton *Publish app*). Avec ces
scopes-là, aucune revue n'est nécessaire, et ça évite deux pièges du mode test :
la limite de cent comptes, et surtout les jetons qui expirent au bout de sept
jours — vos joueurs seraient déconnectés toutes les semaines.

#### b. L'identifiant OAuth

**APIs & Services → Credentials → Create credentials → OAuth client ID**,
type **Web application**, nom `Le Cap — web`.

*Authorized JavaScript origins* :

```
https://doctox.fr
http://localhost:5173
```

*Authorized redirect URI* — une seule, celle de Supabase :

```
https://nzrdjsquhrdetfgbycbb.supabase.co/auth/v1/callback
```

#### c. Le raccord

Retour dans Supabase, **Authentication → Sign In / Providers → Google** :
active le fournisseur, colle le *Client ID* et le *Client Secret*, enregistre.

### 3. Discord

**Authentication → Sign In / Providers → Discord**

Sur le portail développeurs Discord : *New Application*, onglet **OAuth2**, tu
ajoutes l'URI de redirection de Supabase, et tu récupères les deux identifiants.
Gratuit, cinq minutes, aucune validation à attendre.

**Apple** n'est pas nécessaire : la règle qui l'impose ne vaut que pour l'App
Store, et Le Cap est servi depuis `doctox.fr`. Ça économise 99 $ par an.

### 4. Le jour où ça part en ligne

**Authentication → Providers → Email** : laisser désactivé. Aucune inscription par
mot de passe, aucun compte invité.

## Ce qu'il ne faut jamais faire

- Coller la clé `service_role` dans `.env.local` ou ailleurs dans le dépôt : elle
  contourne toutes les politiques. Elle reste dans le tableau de bord.
- Ajouter une politique de lecture sur `rewards` pour le rôle joueur, même « le
  temps d'un test ». C'est tout l'intérêt du jeu qui tombe.
