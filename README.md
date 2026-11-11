# ARENA — NCS

Site de l’événement ARENA, en anglais. Projet indépendant du formulaire de l’édition précédente.

- Site : https://arena-26.vercel.app/
- Administration : https://arena-26.vercel.app/admin
- Soumission du code : https://arena-26.vercel.app/submit
- Dépôt privé : https://github.com/NCSclub/arena-26
- Clôture des inscriptions : **12 novembre 2026 à 17 h, heure algérienne** (`2026-11-12T17:00:00+01:00`).

## Architecture

HTML, CSS et JavaScript natifs, avec sept fonctions Node.js 24 sur Vercel. Aucune nouvelle dépendance serveur. Le plan gratuit Upstash Redis conserve les inscriptions ; l’éviction et le passage automatique à un plan payant sont désactivés.

| Fichier | Rôle |
| --- | --- |
| `dist/index.html`, `dist/style.css` | Page d’accueil et formulaire en trois étapes |
| `dist/app.js` | Validation du formulaire, récapitulatif, envoi et confirmation |
| `dist/translations.js`, `dist/i18n.js` | Textes anglais ; aucune sélection de langue ni version française |
| `dist/event-config.js` | Échéance partagée par le client et le serveur |
| `dist/countdown.js` | Chiffres pixelisés avec transition de décodage ASCII |
| `dist/assets/arena-brand.png` | Logo original transparent fourni par Fadi |
| `dist/assets/arena-brand.svg`, `arena-symbol.svg` | Cadrages SVG du logo fourni, sans retouche de ses pixels |
| `dist/ascii-background.js`, `dist/fluid-wake.js` | Fond ASCII WebGL2 et interaction au pointeur |
| `dist/visuals.js`, `dist/sculpture-motion.js` | Morphing ARENA ↔ `</>`, rotation et retour progressif |
| `dist/admin.html`, `admin.css`, `admin.js` | Connexion et tableau de bord en deux pages : Registrations (membres, équipes, check-in) et Submissions (épreuves du formulaire, réponses reçues) |
| `api/registrations.js` | Enregistrement public, validé et limité en fréquence |
| `api/admin/session.js` | Connexion, vérification de session et déconnexion |
| `api/admin/registrations.js` | Liste privée de 50 inscriptions par page et compteurs globaux |
| `api/admin/export.js` | Export CSV privé de toutes les inscriptions |
| `dist/submit.html`, `submit.css`, `submit.js` | Page `/submit` : nom d’équipe et une carte par épreuve (réponse texte ou fichier) |
| `dist/submission-rules.js` | Réglages par défaut du formulaire de soumission, types d’épreuve, plafonds et extensions binaires interdites |
| `api/submissions.js` | Réglages publics du formulaire (GET) et réception des soumissions (POST), validée et limitée en fréquence |
| `api/admin/submissions.js` | Liste privée des soumissions, lecture et téléchargement des fichiers, suppression |
| `api/admin/settings.js` | Lecture et enregistrement privés des réglages du formulaire de soumission |
| `lib/http.js`, `security.js`, `store.js`, `validation.js` | Contrôles HTTP, authentification, stockage atomique et validation |
| `server.mjs` | Serveur local avec les mêmes routes API |

## Inscription et données

Le formulaire envoie les coordonnées, les informations étudiantes, l’équipe facultative, le transport et les attentes. Le serveur valide les types, les longueurs, les choix conditionnels et l’échéance. Un identifiant de requête permet de reprendre un envoi interrompu sans créer de doublon ; l’email normalisé est unique. Un script Redis enregistre atomiquement la fiche, les index et les compteurs. Le navigateur affiche une confirmation uniquement après réception de la réponse du stockage.

Les données sont dans le hash privé `arena:registrations`. Un index trié les classe par date, et des index HMAC assurent la déduplication sans exposer les emails dans les clés. Aucun jeton Redis ni secret d’administration n’est envoyé au navigateur. Le formulaire contient un champ piège contre les soumissions automatisées et une information sur l’utilisation des données par NCS.

Les inscriptions sont conservées sans expiration automatique. Après l’événement, l’organisation doit décider de la durée de conservation et supprimer les données devenues inutiles via le stockage. Aucun email de confirmation n’est envoyé.

## Soumission des réponses

L’événement compte deux sessions, **Morning** et **Afternoon** (après le déjeuner). La page `/submit` affiche d’abord une carte par session, avec ses épreuves, son état et, si une heure de clôture est fixée, un compte à rebours ; seule une session ouverte peut être choisie. Le formulaire de la session demande uniquement le nom de l’équipe, puis affiche une carte par épreuve : des **cases texte numérotées** (Part 1, Part 2…, 500 caractères au plus chacune) ou un **fichier** (un seul fichier de code ou de texte). Un seul bouton envoie toutes les réponses remplies ; une équipe peut n’envoyer que les épreuves résolues, laisser des cases vides et revenir plus tard pour le reste. La page vérifie toutes les 30 secondes si une session a été ouverte ou fermée. Aucun email n’est demandé et aucune inscription préalable n’est vérifiée. Le navigateur lit les fichiers comme du texte (UTF-8, UTF-16 avec BOM ou Windows-1252) et refuse les fichiers binaires ; le serveur revérifie chaque règle avec les réglages en vigueur.

Pour limiter les abus, le formulaire n’est ouvert que lorsque les organisateurs l’activent, les envois sont limités en fréquence et un champ piège bloque les robots. Chaque envoi est conservé avec son heure ; un identifiant de requête évite les doublons lors d’une nouvelle tentative. Les fiches (équipe, session, réponses texte, noms de fichiers, nom de l’épreuve au moment de l’envoi) sont dans le hash `arena:submissions` et le contenu des fichiers dans `arena:submission-files`, pour que la liste d’administration ne charge jamais le code.

### Réglages depuis le tableau de bord

La page Submissions de l’administration (`/admin#submissions`) contient le bloc Form settings :

- Un panneau par session (**Morning Session**, **Afternoon Session**) :
  - **Accept submissions** ouvre ou ferme la session. Fermée, elle apparaît verrouillée sur `/submit` et le serveur refuse tout envoi (410). Une session ne peut pas être ouverte sans au moins une épreuve.
  - **Closes at (Algeria time)**, facultatif : les équipes voient un compte à rebours et la session se ferme d’elle-même à cette heure. **Clear** retire l’heure de clôture.
  - **Challenges** : nom, type **Text boxes** (avec le nombre de cases, de 1 à 10) ou **File upload** ; l’ordre de la liste est celui des cartes. Chaque épreuve garde un identifiant interne : un renommage reste lié aux réponses existantes, et une épreuve retirée apparaît avec « (removed) » tant qu’elle a des réponses.
  - Les deux sessions sont préremplies avec le programme : le matin Hard Puzzle (2 cases), Medium Puzzle (3 cases), Hard Reverse, Easy Coding et Hard Coding (fichiers) ; l’après-midi Easy Puzzle (3 cases), Medium Puzzle (2 cases), Medium Reverse, Easy Reverse et Medium Coding (fichiers). Les deux sessions sont fermées par défaut.
- **File challenges** : extensions acceptées (séparées par des espaces ou des virgules ; les formats binaires comme `zip`, `exe`, `pdf` ou les images sont refusés), taille maximale par fichier (1024 Ko au plus) et total par envoi (2048 Ko au plus, pour rester sous la limite de 4,5 Mo par requête de Vercel).

Les réglages sont enregistrés dans la clé `arena:submission-settings` ; tant qu’aucun réglage n’a été enregistré, les valeurs par défaut de `dist/submission-rules.js` s’appliquent (deux sessions préremplies et fermées). Le champ d’heure de clôture utilise l’heure algérienne (UTC+1 toute l’année). Un numéro de révision empêche deux organisateurs d’écraser mutuellement leurs modifications. Les réglages publics sont mis en cache 10 secondes par Vercel ; l’envoi vérifie toujours les réglages à jour.

### Lecture des réponses

**Latest answers by team** affiche, pour la session choisie, une ligne par équipe et une colonne par épreuve, avec la réponse la plus récente de l’équipe pour chaque épreuve (cases texte numérotées ou fichier) et son heure d’envoi ; un clic sur un fichier ouvre le code. **Submission history** liste tous les envois des deux sessions, du plus récent au plus ancien, avec lecture, téléchargement des fichiers (toujours servis en `text/plain`, en pièce jointe, nommés `équipe_session_épreuve_fichier`) et suppression. La page Registrations (`/admin#registrations`) regroupe les membres, les équipes, le check-in et l’export CSV.

## Administration

Le mot de passe est stocké uniquement sous forme de hash scrypt dans Vercel. La connexion crée un jeton opaque aléatoire, dont le hash est conservé dans Redis pendant huit heures. Le cookie est `HttpOnly`, `Secure`, `SameSite=Strict` et limité au chemin `/api/admin`. La déconnexion invalide la session côté serveur. Modifier le hash du mot de passe invalide aussi les anciennes sessions.

Les accès à la liste et au CSV sont vérifiés côté serveur à chaque requête. Les écritures exigent une origine autorisée. Les connexions et inscriptions sont limitées en fréquence dans Redis ; les réponses privées ne sont pas mises en cache. L’export CSV protège les cellules contre l’interprétation comme formules dans un tableur.

Le mot de passe initial est remis séparément dans un fichier local privé, jamais dans Git. Pour le changer : générer un nouveau sel et un hash scrypt au format `scrypt:sel_hex_32:hash_hex_128`, remplacer `ADMIN_PASSWORD_HASH` dans Vercel, puis redéployer.

## Configuration et développement

Les noms de variables figurent dans `.env.example`. Configurer `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` et `SITE_URL` côté serveur. L’intégration Upstash injecte ses variables uniquement dans l’environnement Production. Les secrets et fichiers `.vercel/` sont exclus de Git et du déploiement.

```sh
npm test
npm run dev
```

Le serveur local écoute sur `127.0.0.1:4173`. `PORT` permet de choisir un autre port. Pour les essais locaux de l’API, utiliser une base de test et fournir les variables serveur dans `.env` ou dans l’environnement. `npm run dev` active le mode local, qui autorise `127.0.0.1` et `localhost` sur le port choisi. Ce mode ne s’active pas sur Vercel.

Le fond ASCII démarre automatiquement et reste animé et interactif, indépendamment des anciens contrôles de pause et de la préférence système de réduction des animations, conformément à la demande de Fadi. Les boutons Pause restent retirés. Les autres animations conservent leur comportement de réduction des mouvements. Les onglets masqués suspendent les boucles, et les canvas hors écran interrompent leur rendu. Le fond réduit progressivement la densité dans la bande centrale pour éviter les grandes masses claires derrière le texte.

## Déploiement

Le projet Vercel est `arena-26` dans `strongholdfadi-1798s-projects`. Le plan Hobby bloque le déploiement Git automatique d’un dépôt privé d’organisation ; publier avec le CLI après les vérifications :

```sh
npx vercel@50.28.0 deploy --prod --skip-domain --scope team_4RJFOPhu7qwUTVZXv8Hp2ISV
npx vercel@50.28.0 promote URL_DU_DEPLOIEMENT --scope team_4RJFOPhu7qwUTVZXv8Hp2ISV
```

Ne pousser sur GitHub que sur instruction de Fadi. Les tests couvrent les animations, les libellés anglais, le formulaire conditionnel, le compte à rebours, la validation serveur, l’échéance, les limites HTTP, les sessions, la déconnexion, les origines, le contrôle des accès et la protection CSV. Les essais de bout en bout utilisent uniquement des inscriptions fictives supprimées après vérification.

## Programme confirmé

Horaires algériens, d’après la capture transmise par Fadi le 3 novembre 2026 :

| Heure | Activité |
| --- | --- |
| 08:30 | CHECK-IN |
| 08:45 | OPENING CEREMONY AND REVEALING FIRST CHALLENGE |
| 09:00 | CODING |
| 12:00 | LUNCH BREAK |
| 12:45 | REVEALING SECOND CHALLENGE |
| 13:00 | CODING |
| 15:30 | FUN ACTIVITIES |
| 18:00 | CLOSING CEREMONY AND WINNERS ANNOUNCEMENT |

La vue d’inscription atténue le fond ASCII derrière le contenu avec un voile sombre progressif. Le panneau du formulaire est opaque ; les textes secondaires, libellés, espaces réservés et réponses du récapitulatif sont plus contrastés et plus grands, sans changer les polices ni la grille.

### Navigation — cascade de pixels

La transition validée dure environ 1,22 seconde, soit encore 9 % de moins que le dernier aperçu. À l’entrée et à la sortie de l’inscription, des carrés blancs descendent en colonnes irrégulières, couvrent l’écran pendant le changement de vue, puis découvrent la destination. Les liens vers l’accueil, les sections du site, le lien de retour après inscription et les boutons Précédent/Suivant du navigateur déclenchent le même effet. La vue change uniquement lorsque les pixels couvrent l’écran. L’accès direct à `#inscription` reste immédiat ; les réponses déjà saisies sont conservées. Le canvas temporaire est retiré à la fin ou lors d’une navigation interrompue. Publication en production autorisée par Fadi le 3 novembre 2026.
