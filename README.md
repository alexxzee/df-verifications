# df-verifications

Vérificateurs des exercices de la formation « Développeurs : boostez vos performances grâce à l’IA ». Fichiers de la formation : ne pas modifier.

Ils vivent hors du dossier `df-commandes` ouvert dans VS Code, pour que l’assistant n’y lise pas les cas attendus. On ne les lance pas directement : `df-commandes` les appelle par ses commandes npm.

## Installation

1. Créez votre dépôt `df-commandes` depuis le modèle : ouvrez https://github.com/alexxzee/df-commandes, bouton **Use this template**, **Create a new repository**, propriétaire votre compte, nom `df-commandes`, **Private**, **Create repository**. Ajoutez le formateur comme collaborateur (**Settings**, **Collaborators**).
2. Clonez **votre** dépôt et ce dépôt-ci **côte à côte**, dans le même dossier parent :

```bash
git clone <adresse de votre dépôt df-commandes>
git clone https://github.com/alexxzee/df-verifications
```

Résultat attendu :

```text
formation/
  df-commandes/
  df-verifications/
```

## Commandes, depuis le dossier df-commandes

| Commande | Ce qu’elle teste |
|---|---|
| `npm run arrondi` | `arrondirAuCentime`, dans `src/utils/arrondi.js` |
| `npm run arrondi:appli` | `arrondir`, dans `src/devis/calcul.js` |
| `npm run prix` | `formaterPrix`, dans `src/utils/format.js` |
| `npm run reference` | la fonction exportée par `src/validation/reference.js` |
| `npm run reference -- src/validation/essai.js` | la fonction exportée par un autre fichier |
| `npm run tva` | les tests de `exercices/tva/tva.js` : au vert sur le code, en échec sur des copies du calcul de la TVA et du port faussées (micro-exercice du ch02) |
| `npm run devis-du-jour` | la page `GET /devis/du-jour`, sur une base de test |
| `npm run recette` | la durée de validité des devis, contre les décisions du métier |
| `npm run reprise -- ch07` | repartir de l’état prêt d’une étape (remplace le travail en cours de `df-commandes`) |
| `npm run intersession` | le travail intersession : comportement de `src/legacy/fidelite.js`, tests de `exercices/intersession/`, `docs/ecarts-a-trancher.md` |
| `npm run fusion` | la grille de décision de `docs/decision-fusion.md` : le portique des dépendances prouvé sur les deux paquets, et un verdict qui suit la grille (micro-exercice du ch04) |
| `npm run anonymat` | le ticket anonymisé de `exercices/confidentialite/ticket-anonymise.txt` (micro-exercice du ch05) |
| `npm run hook` | le hook de `.claude/settings.json`, `.github/hooks/` ou `.codex/hooks.json`, sur trois actions simulées au format de l’outil (micro-exercice du ch07) |
| `npm run failles` | la grille de `docs/failles.md` sur `exercices/failles/import-clients.js` : failles trouvées sur cinq et catégories manquantes, sans citer de ligne (micro-exercice du ch04) |
| `npm run consigne` | la consigne de délégation de `docs/consigne-delegation.md` : cinq rubriques, un fichier qui existe, une commande du `package.json`, aucun renvoi à la conversation (micro-exercice du ch08) |

Si votre dossier `df-verifications` a été cloné avant une séance, mettez-le à jour : `git pull` dans ce dossier.
