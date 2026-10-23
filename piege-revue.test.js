'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { poser, MARQUE, TEST } = require('./piege-revue.js');

function projet() {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'piege-revue-'));
  fs.mkdirSync(path.join(racine, 'src', 'devis'), { recursive: true });
  fs.writeFileSync(path.join(racine, 'src', 'devis', 'calcul.js'), "'use strict';\nmodule.exports = {};\n");
  return racine;
}

test('pose la fonction et le test, une seule fois', () => {
  const racine = projet();
  assert.equal(poser(racine).ok, true);
  const calcul = fs.readFileSync(path.join(racine, 'src', 'devis', 'calcul.js'), 'utf8');
  assert.equal(calcul.split(MARQUE).length, 2);
  assert.ok(fs.existsSync(path.join(racine, TEST)));
  const second = poser(racine);
  assert.equal(second.ok, true);
  assert.match(second.lignes[0], /déjà posée/);
  assert.equal(fs.readFileSync(path.join(racine, 'src', 'devis', 'calcul.js'), 'utf8'), calcul);
});

test('hors de df-commandes, échoue avec un message', () => {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'piege-revue-'));
  const resultat = poser(racine);
  assert.equal(resultat.ok, false);
  assert.match(resultat.lignes[0], /introuvable/);
});
