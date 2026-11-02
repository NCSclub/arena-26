# ARENA 26

## Fond ASCII shadcn intégré

Ouvrir `/` sur le serveur local pour voir le fond sur le site complet ; `/previews/drift-contour.html` conserve une démonstration isolée du même moteur. Le fond a été reconstruit à partir de l’observation du hero et de son rendu public sur [shadcn.io/background](https://www.shadcn.io/background). Il utilise le même type de bruit déformé à quatre octaves, une trame de Bayer, des cellules de 11 px et les caractères espace / point / deux-points / plus, puis les lettres de « BACKGROUNDS » dans les zones denses. Les formations ne sont plus découpées en ellipses indépendantes : le champ reste continu derrière la page. Un halo sombre à bords progressifs, placé en CSS sous le contenu du hero, protège le logo, le titre, le texte et les boutons sans découper la simulation. Les caractères sont gris neutre sur noir pur. La vitesse de dérive est naturelle, sans accélération 2,2× ; la boucle fonctionne à 30 images/s au repos et à 60 pendant l’interaction, puis se suspend dans les onglets masqués. Le pointeur alimente un véritable champ de vitesse et de densité : advection, rotation locale, quatre passes de pression et projection reproduisent le sillage fluide de la référence. La largeur et la force dépendent de la vitesse du geste ; le mouvement continue après le relâchement puis se dissipe, sans remettre la dérive à zéro. La grille, l’injection, l’amortissement et le confinement suivent le rendu public de shadcn ; le rayon du sillage a été réduit d’environ 25 % pour garder une interaction plus précise. Le solveur WebGL2 est dans `dist/fluid-wake.js` et nécessite les cibles flottantes `EXT_color_buffer_float`. Le logo reste transparent et le bouton Pause permet de suspendre et reprendre le même état. Le moteur local est `dist/ascii-background.js`, sans dépendance réseau. Un seul canvas fixe, placé directement dans le body, est partagé par la page d’accueil et la vue d’inscription. `dist/visuals.js` initialise ce moteur et le relie au bouton global Pause / Reprendre ; les changements de langue, de route et le défilement ne recréent pas la simulation. Le hero couvre au minimum toute la hauteur visible (`100svh`) et centre son contenu, avec un espacement réduit sur les écrans bas pour conserver les boutons dans la première vue. Les sections blanches conservent leur surface et leurs transitions. En cas d’absence de WebGL2 ou de cibles flottantes, le contenu et le formulaire restent utilisables sur fond noir.

Le site conserve les contributions de `Moufdi-branch` et le correctif de centrage du symbole du programme. Les références au bouton de pause de sculpture absent sont facultatives pour permettre l’initialisation des contrôles.

Projet indépendant du site d’inscription de l’édition précédente. HTML, CSS et JavaScript natifs ; aucune installation de dépendances nécessaire.

## Démarrage

Depuis ce dossier :

```sh
npm run dev
```

Ouvrir http://127.0.0.1:4173. Vérifications : `npm test`.

## Contenu

- Landing page responsive inspirée des frames Figma ARENA 26.
- Anglais par défaut à la première visite, avec sélecteur EN / FR visible sur ordinateur et mobile. Le choix est mémorisé sur cet appareil ; le changement de langue conserve les réponses, l’étape du formulaire et l’état des animations.
- Fond ASCII animé, sensible au pointeur et aux clics.
- Logo ARENA original en sculpture ASCII sans cadre, avec rotation, perspective et transition vers des balises de code. Le point de vue revient automatiquement à sa position initiale après quelques secondes d'inactivité.
- Animations automatiques au chargement avec interaction au pointeur et aux clics. Le bouton de pause mémorise le choix pour la session. Les canvas hors écran et les onglets masqués suspendent leur boucle.
- Programme prévisionnel et FAQ dépliables.
- Formulaire en trois étapes : profil, équipe/transport, vérification et export JSON.
- Champs de l’ancien formulaire conservés, notamment trois coéquipiers facultatifs et l’adresse de transport conditionnelle.

## À configurer avant ouverture des inscriptions

La date, le lieu, les horaires définitifs et les modalités du transport doivent être confirmés par l’organisation. Le compte à rebours du hero attend la date officielle : renseigner un horodatage ISO avec fuseau dans `data-event-start` de `dist/index.html`. Sans date, il affiche des tirets et un état explicite, sans échéance inventée.

Le formulaire est un aperçu fonctionnel : il valide les réponses et permet un export local. Aucun endpoint d’inscription n’est configuré et aucune donnée n’est transmise ou enregistrée durablement. Brancher le service de réception, la validation côté serveur et la gestion des erreurs avant d’activer de véritables inscriptions.

Les polices Google Fonts nécessitent une connexion ; les polices système servent de repli. Les fichiers du logo sont téléchargés depuis Figma et inclus dans `dist/assets`. Le fond ASCII est une implémentation originale inspirée visuellement de la référence shadcn.io.

La seconde direction reprend la composition Figma : logo centré, slogan sur une ligne sur grand écran, accents teal/bleu/jaune et sections blanches se dissolvant en pixels vers le noir. Références visuelles consultées : [shadcn.io](https://www.shadcn.io/background), [Asciify](https://asciify.org/) et [Pulsewidth / Motus](https://www.motus.art/pulsewidth/). Les moteurs de mouvement sont dans `dist/visuals.js` ; le formulaire reste dans `dist/app.js`.

## Hébergement

Le dossier `dist` est statique et peut être hébergé indépendamment. Le code source est conservé dans le dépôt GitHub privé `NCSclub/arena-26`. Le déploiement Vercel utilise `vercel.json` pour publier uniquement le dossier `dist`, sans serveur Node ni étape de compilation. Le projet Vercel est relié au dépôt privé et à sa branche `main`.

Le fond ASCII et sa simulation fluide sont partagés entre les sections sombres ; les anciens tracés de circuits et ondes circulaires ont été retirés du rendu. La section de présentation utilise une grille à deux colonnes, un corps de texte de 19 à 21 px sur grand écran et de 17 px sur mobile. Les transitions de la présentation et du pied de page occupent une zone large et sont redessinées en continu sur canvas. Leurs pixels restent carrés, avec une dissolution animée sans étirement. Les lignes du programme se décalent de 10 px au survol ou au focus clavier, avec ombre et accent lumineux.

La sculpture accepte un glisser à la souris ou au toucher, avec inertie au relâchement. Après cinq secondes sans action, un ressort amorti la ramène progressivement à son orientation de repos, sans saut et par le chemin angulaire le plus court. Les flèches permettent la rotation au clavier ; Début ou un double-clic déclenche le même retour progressif. Le clic et le glisser ne donnent plus le focus au canvas, afin de supprimer le cadre bleu à la souris ; le repère de focus reste disponible au clavier. La sculpture alterne entre le logo ARENA et le symbole `</>` : chaque forme reste lisible pendant quatre secondes, puis les points se transforment pendant deux secondes. La rotation et le morphing gardent leur état pendant le glisser. Les fonctions de retour et de morphing sont dans `dist/sculpture-motion.js` et leurs tests couvrent le retour progressif à plusieurs cadences et la continuité du cycle. Le pointeur et les gestes de glisser alimentent le même champ fluide sans remettre son horloge à zéro. La grille du contenu réserve une zone distincte au décor animé. Une vérification de non-régression garantit que le motif évolue sans interaction et maintient le côté du texte en blanc.

Les textes anglais et français sont centralisés dans `dist/translations.js`. `dist/i18n.js` met à jour les nœuds de texte et les attributs accessibles sans recréer les champs ni les canvas. Les messages de validation, le récapitulatif, les contrôles d’animation et le titre de la page suivent la langue sélectionnée. Le HTML initial est en anglais, y compris sans JavaScript ; la préférence explicite est enregistrée sous `arena-language` dans `localStorage`, avec repli sur l’anglais si le stockage est indisponible.

La FAQ conserve sa typographie, sa grille et ses espacements d’origine. Un dégradé noir discret derrière la section protège la lisibilité du texte sans ajouter de carte ni de nouvelle bordure.

Le hero utilise `dist/countdown.js` pour afficher les jours, heures, minutes et secondes en caractères ASCII sur une surface claire. Les chiffres se décodent progressivement à chaque changement. Le calcul utilise l’échéance absolue et se resynchronise après le retour sur l’onglet ; les animations respectent le bouton de pause et la visibilité. Les libellés suivent la langue choisie et le compteur possède une description accessible sans annonces vocales répétées chaque seconde. Les tests couvrent les unités, le fuseau, une échéance passée et une date manquante ou invalide.
