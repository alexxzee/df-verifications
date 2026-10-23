'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// La grille réelle de df-commandes, s'il est cloné à côté.
const GRILLE = path.resolve(__dirname, '..', 'df-commandes', 'docs', 'decision-fusion.md');
const absent = !fs.existsSync(GRILLE) && 'df-commandes absent';

const VIDE_4 = '| 4. Dépendances vérifiées, licences ? | | |';
const PREUVE_404 = '`npm view slugify-fr-safe` : `npm error 404 Not Found`';
const PREUVE_MIT = '`npm view slugify license` : `MIT`, compatible';
const VERDICT = 'corriger. On fusionne sans la dépendance.';

function lancer(reponse, preuve, verdict) {
  let grille = fs.readFileSync(GRILLE, 'utf8')
    .replace(VIDE_4, `| 4. Dépendances vérifiées, licences ? | ${reponse} | ${preuve} |`);
  grille = grille.replace(/^(Verdict[^:]*:).*$/m, `$1 ${verdict}`);
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-'));
  fs.mkdirSync(path.join(racine, 'docs'));
  fs.writeFileSync(path.join(racine, 'docs', 'decision-fusion.md'), grille);
  const r = spawnSync(process.execPath, [path.join(__dirname, 'fusion.js')], { cwd: racine, encoding: 'utf8' });
  return { code: r.status, sortie: r.stdout };
}

test('la grille vierge laisse le portique 4 à remplir', { skip: absent }, () => {
  assert.ok(fs.readFileSync(GRILLE, 'utf8').includes(VIDE_4));
});

test('les deux preuves et un verdict « corriger » : grille cohérente', { skip: absent }, () => {
  const r = lancer('non', `${PREUVE_404} ; ${PREUVE_MIT}`, VERDICT);
  assert.equal(r.code, 0, r.sortie);
  assert.match(r.sortie, /Bilan : grille cohérente/);
});

test('sans le paquet réel, la preuve est incomplète', { skip: absent }, () => {
  const r = lancer('non', PREUVE_404, VERDICT);
  assert.equal(r.code, 1);
  assert.match(r.sortie, /paquet réel/);
});

test('le nom recommandé ne compte pas pour le paquet réel', { skip: absent }, () => {
  const r = lancer('non', `${PREUVE_404}, MIT d’après l’assistant pour slugify-fr-safe`, VERDICT);
  assert.equal(r.code, 1);
  assert.match(r.sortie, /paquet réel/);
});

test('sans le code d’erreur, la preuve du paquet recommandé manque', { skip: absent }, () => {
  const r = lancer('non', PREUVE_MIT, VERDICT);
  assert.equal(r.code, 1);
  assert.match(r.sortie, /paquet recommandé/);
});

test('portique 4 à oui : refusé', { skip: absent }, () => {
  const r = lancer('oui', `${PREUVE_404} ; ${PREUVE_MIT}`, VERDICT);
  assert.equal(r.code, 1);
  assert.match(r.sortie, /dans le registre/);
});

test('« on fusionne » malgré un non : refusé', { skip: absent }, () => {
  const r = lancer('non', `${PREUVE_404} ; ${PREUVE_MIT}`, 'on fusionne');
  assert.equal(r.code, 1);
  assert.match(r.sortie, /Un seul non suffit/);
});
