# Mélo

Application de musique gratuite, inspirée d'Apple Music, qui marche sur **iPhone, Android et ordinateur** depuis le navigateur. On peut l'installer sur l'écran d'accueil comme une vraie application. Pas de compte, pas d'abonnement, pas de publicité, pas de serveur à payer : elle se publie sur GitHub Pages.

## Ce qu'elle fait

- **Accueil, Nouveautés, Radio, Bibliothèque, Recherche** : les mêmes onglets et la même logique qu'Apple Music.
- **Morceaux complets** grâce au catalogue ouvert [Audius](https://audius.co) (artistes indépendants : électro, rap, lo-fi, pop…).
- **Tout le catalogue Apple Music** dans la recherche (onglet « Apple · extraits ») : n'importe quel artiste, album ou titre, en **extraits de 30 secondes**, avec un lien pour l'écouter en entier sur Apple Music.
- **Des milliers de radios en direct** ([Radio Browser](https://www.radio-browser.info)).
- **Lecteur plein écran** : fond animé aux couleurs de la pochette, pochette qui rétrécit en pause, barre de progression, volume, paroles, file d'attente.
- **Paroles synchronisées** quand elles existent ([LRCLIB](https://lrclib.net)), sinon non synchronisées ([lyrics.ovh](https://lyrics.ovh)). Toucher une ligne fait sauter à ce moment du morceau.
- **File « À suivre »** : aléatoire, répétition (tout / un), lecture automatique ∞ de morceaux similaires, glisser pour réordonner, balayer vers la gauche pour retirer, historique.
- **Bibliothèque** : morceaux, artistes, albums, favoris ⭐, radios, historique, playlists (création, modification, réordonnancement, suppression). Export et import en JSON.
- Menus **« Lire ensuite », « Lire en dernier », « Créer une station »**, partage, minuteur de veille, raccourcis clavier sur ordinateur.

## Session partagée par QR code (comme SharePlay en voiture)

1. Sur le téléphone qui joue la musique : bouton 👥 dans le lecteur, puis **Démarrer une session**.
2. Un **QR code** et un code à 5 lettres s'affichent.
3. Les passagers le scannent avec l'appareil photo, **iPhone ou Android**, sans rien installer ni créer de compte.
4. Ils peuvent **tout faire** : chercher, lancer, ajouter à la file, réordonner, retirer, passer, mettre en pause, avancer. Le nom de la personne s'affiche à côté de chaque titre qu'elle a ajouté.

Le **mode voiture** affiche de grosses commandes et garde le QR code toujours visible. L'écran reste allumé.

La synchronisation passe par des serveurs MQTT publics et gratuits (EMQX, HiveMQ, Mosquitto, avec bascule automatique de l'un à l'autre). Il n'y a donc aucun serveur à nous.

## En voiture (CarPlay / Android Auto)

Branchez ou connectez le téléphone (câble ou Bluetooth), puis lancez la musique dans Mélo. Le titre, la pochette et les boutons précédent / lecture / suivant apparaissent dans le lecteur **« À l'écoute »** de CarPlay, sur l'écran de verrouillage et sur les commandes au volant. Sur Android, ils apparaissent dans la notification multimédia, sur l'écran de verrouillage et en Bluetooth.

**Limites honnêtes :**

- Une application web ne peut pas avoir sa propre icône dans CarPlay ou Android Auto : il faudrait une application native validée par Apple ou Google. Le **QR code s'affiche donc sur le téléphone**, par exemple en mode voiture, pas sur l'écran de la voiture.
- Sur Android Auto, la musique d'un navigateur passe par le Bluetooth ou le son du téléphone, pas par l'interface Android Auto.
- Les titres du catalogue Apple sont des **extraits de 30 s**. Les morceaux complets gratuits viennent d'Audius.
- Sur iPhone, touchez ▶︎ une première fois sur le téléphone hôte : iOS exige un geste avant de jouer du son. Ensuite, les passagers peuvent tout piloter.
- Pendant une session, laissez Mélo **au premier plan sur le téléphone hôte** (le mode voiture garde l'écran allumé) : écran verrouillé, la musique continue, mais iOS et Android peuvent couper la connexion qui reçoit les demandes des passagers.

## Installer sur le téléphone

- **iPhone** : ouvrir le site dans Safari → Partager → **Sur l'écran d'accueil**.
- **Android** : menu ⋮ de Chrome → **Installer l'application**.

## Publier sur GitHub Pages

1. Sur GitHub : **Settings → General → Danger Zone → Change visibility → Public**. GitHub Pages gratuit exige un dépôt public.
2. **Settings → Pages → Build and deployment → Source : Deploy from a branch → Branch : `main` / `(root)` → Save**.
3. Après une minute, le site est en ligne sur `https://etu-informatique.github.io/melo/`.

## Développement local

```bash
python -m http.server 8765
```

Puis ouvrir http://localhost:8765. Aucune dépendance et aucune compilation. Pour régénérer les icônes : `node tools/make-icons.mjs`.

## Structure

| Fichier | Rôle |
|---|---|
| `index.html` | Squelette de l'interface |
| `css/app.css` | Tout le style (clair / sombre, mobile / ordinateur) |
| `js/app.js` | Navigation, lecteur plein écran, file, paroles, menus, session, mode voiture |
| `js/player.js` | Moteur de lecture et Media Session (CarPlay, écran verrouillé) |
| `js/jam.js` | Session partagée (hôte et passagers) |
| `js/views.js` | Les pages |
| `js/api.js` | Sources musicales gratuites |
| `js/store.js` | Bibliothèque locale |
| `sw.js` | Cache hors ligne de l'interface |
