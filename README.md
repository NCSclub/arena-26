# ARENA 26

Projet indépendant du site d’inscription de l’édition précédente. HTML, CSS et JavaScript natifs ; aucune installation de dépendances nécessaire.

## Démarrage

Depuis ce dossier :

```sh
npm run dev
```

Ouvrir http://127.0.0.1:4173. Vérifications : `npm test`.

## Contenu

- Landing page responsive inspirée des frames Figma ARENA 26.
- Fond ASCII animé, sensible au pointeur et aux clics.
- Logo ARENA original en sculpture ASCII sans cadre, avec rotation, perspective et transitions vers des balises de code et un cube de logique.
- Animations automatiques au chargement avec interaction au pointeur et aux clics. Le bouton de pause mémorise le choix pour la session. Les canvas hors écran et les onglets masqués suspendent leur boucle.
- Programme prévisionnel et FAQ dépliables.
- Formulaire en trois étapes : profil, équipe/transport, vérification et export JSON.
- Champs de l’ancien formulaire conservés, notamment trois coéquipiers facultatifs et l’adresse de transport conditionnelle.

## À configurer avant ouverture des inscriptions

La date, le lieu, les horaires définitifs et les modalités du transport doivent être confirmés par l’organisation. Aucun compte à rebours artificiel n’est affiché.

Le formulaire est un aperçu fonctionnel : il valide les réponses et permet un export local. Aucun endpoint d’inscription n’est configuré et aucune donnée n’est transmise ou enregistrée durablement. Brancher le service de réception, la validation côté serveur et la gestion des erreurs avant d’activer de véritables inscriptions.

Les polices Google Fonts nécessitent une connexion ; les polices système servent de repli. Les fichiers du logo sont téléchargés depuis Figma et inclus dans `dist/assets`. Le fond ASCII est une implémentation originale inspirée visuellement de la référence shadcn.io.

La seconde direction reprend la composition Figma : logo centré, slogan sur une ligne sur grand écran, accents teal/bleu/jaune et sections blanches se dissolvant en pixels vers le noir. Références visuelles consultées : [shadcn.io](https://www.shadcn.io/background), [Asciify](https://asciify.org/) et [Pulsewidth / Motus](https://www.motus.art/pulsewidth/). Les moteurs de mouvement sont dans `dist/visuals.js` ; le formulaire reste dans `dist/app.js`.

## Hébergement

Le dossier `dist` est statique et peut être hébergé indépendamment. Aucun déploiement et aucun push ne sont effectués dans ce projet.

Le fond technique est partagé entre les sections sombres (ASCII plus contrasté, tracés de circuits et signaux mobiles). La section de présentation utilise une grille à deux colonnes, un corps de texte de 19 à 21 px sur grand écran et de 17 px sur mobile. Le décor de pixels est limité au bord droit et conserve sa géométrie ; seuls quelques pixels changent brièvement d’opacité. Les lignes du programme se décalent de 10 px au survol ou au focus clavier, avec ombre et accent lumineux.

La sculpture accepte un glisser à la souris ou au toucher, avec inertie au relâchement. Les flèches permettent la rotation au clavier ; Début ou un double-clic réinitialise l’orientation. Les clics du fond créent des ondes indépendantes, limitées à huit, sans relancer les précédentes ; ce comportement est couvert par le test de régression dans `tests.mjs`. Les transformations d’étirement des pixels et les frises dentelées ont été supprimées pour privilégier la lecture et la hiérarchie de la section.
