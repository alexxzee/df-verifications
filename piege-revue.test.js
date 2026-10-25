// Teste piege-revue.js (node scripts/verifier.js piege-revue), exercice de
// revue IA du ch06 : poser() ajoute à src/devis/calcul.js une fonction (repérée
// par MARQUE) et crée le fichier de test TEST, pour que le participant relise
// la modification comme une pull request. Comme piege-revue.js, ce fichier ne
// décrit pas le contenu posé.
// Les tests travaillent sur un faux df-commandes minimal, dans un dossier
// temporaire : ils ne demandent pas df-commandes et ne sont jamais sautés.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { poser, MARQUE, TEST } = require('./piege-revue.js');

// Faux df-commandes : un src/devis/calcul.js réduit à un module vide.
function projet() {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'piege-revue-'));
  fs.mkdirSync(path.join(racine, 'src', 'devis'), { recursive: true });
  fs.writeFileSync(path.join(racine, 'src', 'devis', 'calcul.js'), "'use strict';\nmodule.exports = {};\n");
  return racine;
}

// Pose sur un faux projet, puis pose une seconde fois.
// Attendu : la première pose réussit, la fonction apparaît une seule fois dans
// calcul.js et le fichier de test existe ; la seconde réussit aussi, répond
// « déjà posée » et laisse calcul.js identique.
// Pourquoi : le participant peut relancer la commande sans dupliquer la modification.
test('pose la fonction et le test, une seule fois', () => {
  const racine = projet();
  assert.equal(poser(racine).ok, true);
  const calcul = fs.readFileSync(path.join(racine, 'src', 'devis', 'calcul.js'), 'utf8');
  assert.equal(calcul.split(MARQUE).length, 2); // 2 morceaux = la marque présente exactement une fois
  assert.ok(fs.existsSync(path.join(racine, TEST)));
  const second = poser(racine); // seconde pose, sur le même projet
  assert.equal(second.ok, true);
  assert.match(second.lignes[0], /déjà posée/);
  assert.equal(fs.readFileSync(path.join(racine, 'src', 'devis', 'calcul.js'), 'utf8'), calcul); // calcul.js inchangé par la seconde pose
});

// Pose dans un dossier vide, sans src/devis/calcul.js.
// Attendu : ok false, première ligne « … introuvable ».
// Pourquoi : lancée hors de df-commandes, la commande doit le dire au lieu de créer des fichiers.
test('hors de df-commandes, échoue avec un message', () => {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'piege-revue-')); // dossier vide
  const resultat = poser(racine);
  assert.equal(resultat.ok, false);
  assert.match(resultat.lignes[0], /introuvable/);
});
