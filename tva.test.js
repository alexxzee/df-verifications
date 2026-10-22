'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { verifier } = require('./tva.js');

// Le code et le fichier d'exercice réels de df-commandes, s'il est cloné à côté.
const DF = path.resolve(__dirname, '..', 'df-commandes');
const CALCUL = path.join(DF, 'src', 'devis', 'calcul.js');
const EXERCICE = path.join(DF, 'exercices', 'tva', 'tva.js');
const absent = !(fs.existsSync(CALCUL) && fs.existsSync(EXERCICE)) && 'df-commandes absent';

// Valeurs du corrigé, calculées à la main depuis la règle : total HT et TVA.
const VALEURS = [[35, 7], [36.25, 7.25], [500, 100]];

function remplir(valeurs) {
  let rang = 0;
  return fs.readFileSync(EXERCICE, 'utf8').replace(/ {2}assert\.ok\(devis\);\n/g, (ligne) => {
    const [ht, tva] = valeurs[rang++];
    return `${ligne}  assert.equal(devis.totalHT, ${ht});\n  assert.equal(devis.tva, ${tva});\n`;
  });
}

function projet(tests, calcul = fs.readFileSync(CALCUL, 'utf8')) {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'tva-'));
  fs.mkdirSync(path.join(racine, 'src', 'devis'), { recursive: true });
  fs.writeFileSync(path.join(racine, 'src', 'devis', 'calcul.js'), calcul);
  if (tests !== null) {
    fs.mkdirSync(path.join(racine, 'exercices', 'tva'), { recursive: true });
    fs.writeFileSync(path.join(racine, 'exercices', 'tva', 'tva.js'), tests);
  }
  return racine;
}

test('fichier de départ : tests au vert, aucune erreur détectée', { skip: absent }, () => {
  const r = verifier(projet(fs.readFileSync(EXERCICE, 'utf8')));
  assert.equal(r.ok, false);
  assert.match(r.lignes.join('\n'), /3 tests, 0 en échec\.\n.*en détectent 0 sur 3\./);
});

test('valeurs calculées à la main : les trois erreurs détectées', { skip: absent }, () => {
  const r = verifier(projet(remplir(VALEURS)));
  assert.equal(r.ok, true, r.lignes.join('\n'));
  assert.match(r.lignes.join('\n'), /en détectent 3 sur 3\.\nBilan : vos tests vérifient la règle/);
});

test('total HT seul : une erreur de TVA passe inaperçue', { skip: absent }, () => {
  const tests = remplir(VALEURS).replace(/ {2}assert\.equal\(devis\.tva, [\d.]+\);\n/g, '');
  const r = verifier(projet(tests));
  assert.equal(r.ok, false);
  assert.match(r.lignes.join('\n'), /en détectent 2 sur 3\./);
});

test('valeur attendue fausse : le test est nommé, la valeur obtenue n’est pas affichée', { skip: absent }, () => {
  const r = verifier(projet(remplir([[35, 7], [36.25, 7.25], [525, 105]])));
  const texte = r.lignes.join('\n');
  assert.equal(r.ok, false);
  assert.match(texte, /en échec : deux pompes à 250 €/);
  assert.doesNotMatch(texte, /\b(500|100)\b/);
});

test('fichier qui ne se charge pas', { skip: absent }, () => {
  const r = verifier(projet(remplir(VALEURS).replace('devis.tva, 7);', 'devis.tva, 7;')));
  assert.equal(r.ok, false);
  assert.match(r.lignes.join('\n'), /ne se charge pas : SyntaxError/);
});

test('fichier absent', { skip: absent }, () => {
  const r = verifier(projet(null));
  assert.equal(r.ok, false);
  assert.match(r.lignes[0], /introuvable/);
});

test('calcul de la TVA et du port réécrit : aucune erreur essayée', { skip: absent }, () => {
  const calcul = fs.readFileSync(CALCUL, 'utf8')
    .replace('const totalHT = arrondir(totalNet + port);', 'const totalHT = arrondir(port + totalNet);')
    .replace('const tva = arrondir(totalHT * TAUX_TVA);', 'const tva = arrondir(TAUX_TVA * totalHT);')
    .replace('totalNet >= SEUIL_PORT_GRATUIT', 'SEUIL_PORT_GRATUIT <= totalNet');
  const r = verifier(projet(remplir(VALEURS), calcul));
  assert.equal(r.ok, false);
  assert.match(r.lignes.join('\n'), /aucune erreur n'a pu être essayée/);
});
