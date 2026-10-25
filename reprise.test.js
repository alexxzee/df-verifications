// Teste reprise.js (npm run reprise -- <étape>), qui pose dans df-commandes
// l'état prêt d'une étape, pris dans la branche reprise/<étape> du dépôt
// df-commandes-reprises, sans toucher à l'historique du participant.
// Les tests n'exécutent aucune commande git : ils vérifient la liste des
// commandes que commandes() prépare, et la liste des étapes.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { commandes, ETAPES } = require('./reprise.js');

// Commandes préparées pour l'étape ch07.
// Attendu, dans cet ordre :
//   git fetch --depth=1 <df-commandes-reprises> reprise/ch07 : récupère le dernier commit de la branche, sans historique ;
//   git read-tree -u --reset FETCH_HEAD : remplace les fichiers du dossier et l'index par cet état ;
//   git clean -fdq : supprime les fichiers non suivis qui n'existent pas dans l'état prêt ;
//   git reset -q : remet l'index sur le dernier commit du participant.
// Pourquoi : aucun commit n'est créé ni déplacé ; git diff montre ensuite l'écart
// avec le dernier commit, comme si l'étape avait été faite à la main.
test('une étape connue pose les fichiers de la reprise sans toucher à l’historique', () => {
  assert.deepEqual(commandes('ch07'), [
    ['git', ['fetch', '--depth=1', 'https://github.com/alexxzee/df-commandes-reprises.git', 'reprise/ch07']],
    ['git', ['read-tree', '-u', '--reset', 'FETCH_HEAD']],
    ['git', ['clean', '-fdq']],
    ['git', ['reset', '-q']],
  ]);
});

// Liste des étapes acceptées.
// Attendu : exactement tp2, ch03, tp3, ch06, ch07, ch08, ch09, dans cet ordre.
// Pourquoi : chaque étape doit correspondre à une branche reprise/* existante ;
// ce test casse si une étape est ajoutée ou retirée sans qu'on le mette à jour.
test('les étapes sont celles des branches de reprise', () => {
  assert.deepEqual(ETAPES, ['tp2', 'ch03', 'tp3', 'ch06', 'ch07', 'ch08', 'ch09']);
});

// Étape inexistante « ch42 ».
// Attendu : une erreur dont le message cite l'étape refusée et la liste des étapes valides.
// Pourquoi : une faute de frappe ne doit lancer aucune commande git et doit dire quoi taper.
test('une étape inconnue est refusée avec la liste des étapes', () => {
  assert.throws(() => commandes('ch42'), /Étape inconnue : ch42\. Étapes : tp2, ch03, tp3, ch06, ch07, ch08, ch09/); // message complet, liste comprise
});
