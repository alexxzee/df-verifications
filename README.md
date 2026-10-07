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
| `npm run recherche` | la recherche de produits, `GET /produits?q=` |
| `npm run devis-du-jour` | la page `GET /devis/du-jour`, sur une base de test |
| `npm run recette` | la durée de validité des devis, contre les décisions du métier |
| `npm run intersession` | le travail intersession : comportement de `src/legacy/fidelite.js`, tests de `exercices/intersession/`, `docs/ecarts-a-trancher.md` |

Un seul vérificateur se lance hors de `df-commandes` : `node ../df-verifications/livraison.js`, depuis le dossier `frais-livraison` de l’application créée en Autopilot, vérifie l’estimateur de frais de livraison.

Si votre dossier `df-verifications` a été cloné avant une séance, mettez-le à jour : `git pull` dans ce dossier.
