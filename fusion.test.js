// Teste le vérificateur fusion.js (npm run fusion), micro-exercice du ch04 sur
// la grille de décision de fusion, df-commandes/docs/decision-fusion.md.
// Le participant remplit le portique 4 (« Dépendances vérifiées, licences ? »)
// avec deux preuves : la réponse de npm view pour le paquet recommandé par
// l'assistant (slugify-fr-safe, inexistant : 404) et pour le paquet réel
// (slugify, licence MIT), puis écrit un verdict cohérent.
// Chaque test copie la grille réelle dans un dossier temporaire, la remplit,
// lance fusion.js dans ce dossier comme un processus séparé et lit son code de
// sortie (0 cohérent, 1 à reprendre) et sa sortie.
// Sans df-commandes cloné à côté de df-verifications, tous les tests sont sautés.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// La grille réelle de df-commandes, s'il est cloné à côté.
const GRILLE = path.resolve(__dirname, '..', 'df-commandes', 'docs', 'decision-fusion.md');
const absent = !fs.existsSync(GRILLE) && 'df-commandes absent'; // false, ou la raison du saut affichée par node --test

const VIDE_4 = '| 4. Dépendances vérifiées, licences ? | | |'; // ligne du portique 4, telle que distribuée (réponse et preuve vides)
const PREUVE_404 = '`npm view slugify-fr-safe` : `npm error 404 Not Found`'; // preuve 1 : le paquet recommandé n'existe pas
const PREUVE_MIT = '`npm view slugify license` : `MIT`, compatible'; // preuve 2 : le paquet réel et sa licence
const VERDICT = 'corriger. On fusionne sans la dépendance.'; // verdict du corrigé

// Remplit le portique 4 (réponse, preuve) et la ligne « Verdict … : », écrit la
// grille dans un dossier temporaire, y lance fusion.js et renvoie code et sortie.
function lancer(reponse, preuve, verdict) {
  let grille = fs.readFileSync(GRILLE, 'utf8')
    .replace(VIDE_4, `| 4. Dépendances vérifiées, licences ? | ${reponse} | ${preuve} |`);
  grille = grille.replace(/^(Verdict[^:]*:).*$/m, `$1 ${verdict}`); // garde le libellé « Verdict … : », remplace la suite
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-'));
  fs.mkdirSync(path.join(racine, 'docs'));
  fs.writeFileSync(path.join(racine, 'docs', 'decision-fusion.md'), grille);
  const r = spawnSync(process.execPath, [path.join(__dirname, 'fusion.js')], { cwd: racine, encoding: 'utf8' }); // fusion.js lit docs/ depuis le dossier courant
  return { code: r.status, sortie: r.stdout };
}

// Vérifie la grille distribuée dans df-commandes.
// Attendu : la ligne du portique 4 est encore vide.
// Pourquoi : si la grille livrée était déjà remplie, l'exercice serait fait d'avance,
// et les remplacements des autres tests ne trouveraient plus la ligne.
test('la grille vierge laisse le portique 4 à remplir', { skip: absent }, () => {
  assert.ok(fs.readFileSync(GRILLE, 'utf8').includes(VIDE_4));
});

// Réponse « non », les deux preuves, verdict « corriger ».
// Attendu : code 0 et « Bilan : grille cohérente ».
// Pourquoi : c'est la réponse du corrigé ; elle doit être acceptée.
test('les deux preuves et un verdict « corriger » : grille cohérente', { skip: absent }, () => {
  const r = lancer('non', `${PREUVE_404} ; ${PREUVE_MIT}`, VERDICT);
  assert.equal(r.code, 0, r.sortie); // en cas d'échec, la sortie de fusion.js sert de message
  assert.match(r.sortie, /Bilan : grille cohérente/);
});

// Réponse « non », seulement la preuve du 404.
// Attendu : code 1, message qui réclame la preuve du « paquet réel ».
// Pourquoi : constater que le paquet n'existe pas ne suffit pas ; il faut aussi
// vérifier le paquet qu'on utilisera à la place et sa licence.
test('sans le paquet réel, la preuve est incomplète', { skip: absent }, () => {
  const r = lancer('non', PREUVE_404, VERDICT);
  assert.equal(r.code, 1);
  assert.match(r.sortie, /paquet réel/);
});

// Réponse « non », le 404, puis une licence MIT attribuée par l'assistant au paquet inventé.
// Attendu : code 1, la preuve du « paquet réel » manque toujours.
// Pourquoi : une licence dite par l'assistant, sur un nom inventé, n'est pas une
// vérification ; seul « slugify » avec la sortie de npm view compte.
test('le nom recommandé ne compte pas pour le paquet réel', { skip: absent }, () => {
  const r = lancer('non', `${PREUVE_404}, MIT d’après l’assistant pour slugify-fr-safe`, VERDICT);
  assert.equal(r.code, 1);
  assert.match(r.sortie, /paquet réel/);
});

// Réponse « non », seulement la preuve de la licence MIT de slugify.
// Attendu : code 1, message qui réclame la preuve du « paquet recommandé ».
// Pourquoi : la grille doit garder la trace de la vérification du nom recommandé (le 404).
test('sans le code d’erreur, la preuve du paquet recommandé manque', { skip: absent }, () => {
  const r = lancer('non', PREUVE_MIT, VERDICT);
  assert.equal(r.code, 1);
  assert.match(r.sortie, /paquet recommandé/);
});

// Réponse « oui » malgré les deux preuves.
// Attendu : code 1, message qui demande si chaque paquet est « dans le registre ».
// Pourquoi : la preuve du 404 contredit un « oui » : le paquet recommandé n'existe pas.
test('portique 4 à oui : refusé', { skip: absent }, () => {
  const r = lancer('oui', `${PREUVE_404} ; ${PREUVE_MIT}`, VERDICT);
  assert.equal(r.code, 1);
  assert.match(r.sortie, /dans le registre/);
});

// Réponse « non », les deux preuves, mais le verdict « on fusionne ».
// Attendu : code 1, message « Un seul non suffit ».
// Pourquoi : un portique à non interdit de fusionner en l'état ; le verdict doit
// dire corriger ou refuser.
test('« on fusionne » malgré un non : refusé', { skip: absent }, () => {
  const r = lancer('non', `${PREUVE_404} ; ${PREUVE_MIT}`, 'on fusionne');
  assert.equal(r.code, 1);
  assert.match(r.sortie, /Un seul non suffit/);
});
