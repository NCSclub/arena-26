# ARENA — NCS

Site de l’événement ARENA, en anglais. Projet indépendant du formulaire de l’édition précédente.

- Site : https://arena-26.vercel.app/
- Administration : https://arena-26.vercel.app/admin
- Dépôt privé : https://github.com/NCSclub/arena-26
- Clôture des inscriptions : **9 novembre 2026 à 17 h, heure algérienne** (`2026-11-09T17:00:00+01:00`).

## Architecture

HTML, CSS et JavaScript natifs, avec quatre fonctions Node.js 24 sur Vercel. Aucune nouvelle dépendance serveur. Le plan gratuit Upstash Redis conserve les inscriptions ; l’éviction et le passage automatique à un plan payant sont désactivés.

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
| `dist/admin.html`, `admin.css`, `admin.js` | Connexion, liste paginée, recherche dans la page et fiches détaillées |
| `api/registrations.js` | Enregistrement public, validé et limité en fréquence |
| `api/admin/session.js` | Connexion, vérification de session et déconnexion |
| `api/admin/registrations.js` | Liste privée de 50 inscriptions par page et compteurs globaux |
| `api/admin/export.js` | Export CSV privé de toutes les inscriptions |
| `lib/http.js`, `security.js`, `store.js`, `validation.js` | Contrôles HTTP, authentification, stockage atomique et validation |
| `server.mjs` | Serveur local avec les mêmes routes API |

## Inscription et données

Le formulaire envoie les coordonnées, les informations étudiantes, l’équipe facultative, le transport et les attentes. Le serveur valide les types, les longueurs, les choix conditionnels et l’échéance. Un identifiant de requête permet de reprendre un envoi interrompu sans créer de doublon ; l’email normalisé est unique. Un script Redis enregistre atomiquement la fiche, les index et les compteurs. Le navigateur affiche une confirmation uniquement après réception de la réponse du stockage.

Les données sont dans le hash privé `arena:registrations`. Un index trié les classe par date, et des index HMAC assurent la déduplication sans exposer les emails dans les clés. Aucun jeton Redis ni secret d’administration n’est envoyé au navigateur. Le formulaire contient un champ piège contre les soumissions automatisées et une information sur l’utilisation des données par NCS.

Les inscriptions sont conservées sans expiration automatique. Après l’événement, l’organisation doit décider de la durée de conservation et supprimer les données devenues inutiles via le stockage. Aucun email de confirmation n’est envoyé.

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

Le serveur local écoute sur `127.0.0.1:4173` ; `PORT` permet de choisir un autre port. Pour les essais locaux de l’API, utiliser une base de test, fournir les variables serveur et définir `ARENA_LOCAL_DEV=true` avec `PORT=4175`. Ce mode accepte uniquement l’origine locale explicitement prévue et ne s’active pas sur Vercel.

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
