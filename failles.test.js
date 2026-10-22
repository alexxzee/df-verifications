'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { verifier } = require('./failles.js');

// Le fichier d'exercice et la grille réels de df-commandes, s'il est cloné à côté.
const DF = path.resolve(__dirname, '..', 'df-commandes');
const FICHIER = path.join(DF, 'exercices', 'failles', 'import-clients.js');
const GRILLE = path.join(DF, 'docs', 'failles.md');
const absent = !(fs.existsSync(FICHIER) && fs.existsSync(GRILLE)) && 'df-commandes absent';

// Grille du corrigé : ligne et catégorie de chaque faille.
const CORRIGE = [
  [8, 'Secret en dur'],
  [39, 'Requête construite à la main'],
  [41, 'Exécution de donnée'],
  [15, 'Vérification désactivée'],
  [33, 'Journal trop bavard'],
];

function remplir(rangees) {
  const lignes = rangees.map(([ligne, cat]) => `| ${ligne} | ${cat} | (constat) |`).join('\n');
  return fs.readFileSync(GRILLE, 'utf8').replace('| | | |', lignes);
}

function projet(grille, fichier = fs.readFileSync(FICHIER, 'utf8')) {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'failles-'));
  fs.mkdirSync(path.join(racine, 'exercices', 'failles'), { recursive: true });
  fs.mkdirSync(path.join(racine, 'docs'));
  if (fichier !== null) fs.writeFileSync(path.join(racine, 'exercices', 'failles', 'import-clients.js'), fichier);
  if (grille !== null) fs.writeFileSync(path.join(racine, 'docs', 'failles.md'), grille);
  return racine;
}

test('les lignes du corrigé sont celles du fichier réel', { skip: absent }, () => {
  const lignes = fs.readFileSync(FICHIER, 'utf8').split('\n');
  assert.match(lignes[7], /MOT_DE_PASSE = '/);
  assert.match(lignes[14], /rejectUnauthorized: false/);
  assert.match(lignes[32], /console\.log\(.*MOT_DE_PASSE/);
  assert.match(lignes[38], /SELECT .*\$\{client\.nom\}/);
  assert.match(lignes[40], /eval\(/);
});

test('grille de départ : aucune ligne notée', { skip: absent }, () => {
  const r = verifier(projet(fs.readFileSync(GRILLE, 'utf8')));
  assert.equal(r.ok, false);
  assert.match(r.lignes.join('\n'), /Lignes notées dans la grille : 0\.[\s\S]*0 sur 5\./);
});

test('grille du corrigé : cinq sur cinq', { skip: absent }, () => {
  const r = verifier(projet(remplir(CORRIGE)));
  assert.equal(r.ok, true, r.lignes.join('\n'));
  assert.match(r.lignes.join('\n'), /Failles trouvées : 5 sur 5\.\nBilan : grille complète/);
});

test('lecture « est-ce que ça marche ? » : la requête seule, quatre catégories manquantes, sans ligne citée', { skip: absent }, () => {
  const r = verifier(projet(remplir([[39, 'Requête construite à la main']])));
  const texte = r.lignes.join('\n');
  assert.equal(r.ok, false);
  assert.match(texte, /1 sur 5\.\nCatégories manquantes : Secret en dur, Exécution de donnée, Vérification désactivée, Journal trop bavard\./);
  assert.doesNotMatch(texte, /\b(8|15|33|41)\b/);
});

test('bonne ligne, mauvaise catégorie : non comptée, signalée sans la citer', { skip: absent }, () => {
  const r = verifier(projet(remplir([[33, 'Secret en dur'], [15, 'Vérification désactivée']])));
  const texte = r.lignes.join('\n');
  assert.equal(r.ok, false);
  assert.match(texte, /1 sur 5\./);
  assert.match(texte, /ne portent pas la faille de leur catégorie : 1\./);
  assert.doesNotMatch(texte, /\b33\b/);
});

test('catégorie libre, accents absents, doublon : tolérés', { skip: absent }, () => {
  const rangees = [[8, 'secret en dur'], [8, 'Secret en dur'], [39, 'injection SQL'], [41, 'execution de donnee'],
    [15, 'TLS coupé'], [33, 'journal']];
  const r = verifier(projet(remplir(rangees)));
  assert.equal(r.ok, true, r.lignes.join('\n'));
});

test('catégorie ambiguë ou inconnue', { skip: absent }, () => {
  const r = verifier(projet(remplir([[33, 'mot de passe dans le journal'], [12, 'faille']])));
  assert.equal(r.ok, false);
  assert.match(r.lignes.join('\n'), /Catégorie non reconnue sur 2 ligne\(s\)/);
});

test('fichier d’exercice modifié', { skip: absent }, () => {
  const corrige = fs.readFileSync(FICHIER, 'utf8').replace('rejectUnauthorized: false,\n', '');
  const r = verifier(projet(remplir(CORRIGE), corrige));
  assert.equal(r.ok, false);
  assert.match(r.lignes.join('\n'), /a été modifié/);
});

test('grille absente, fichier absent', { skip: absent }, () => {
  assert.match(verifier(projet(null)).lignes[0], /docs\/failles\.md introuvable/);
  assert.match(verifier(projet('', null)).lignes[0], /import-clients\.js introuvable/);
});
