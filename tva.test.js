// Teste le vérificateur tva.js (npm run tva), micro-exercice du ch02
// « la TVA, calculée à la main » : le participant complète les trois tests de
// df-commandes/exercices/tva/tva.js avec les valeurs attendues ; tva.js lance
// ces tests sur le vrai calcul, puis sur trois copies faussées du calcul
// (port oublié, TVA arrondie à l'euro, seuil du port gratuit décalé), et
// compte combien de copies faussées les tests font échouer.
// Chaque test fabrique un faux projet dans un dossier temporaire (calcul.js
// réel de df-commandes, fichier d'exercice rempli ou non) et appelle verifier().
// Sans df-commandes cloné à côté de df-verifications, tous les tests sont sautés.
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
const absent = !(fs.existsSync(CALCUL) && fs.existsSync(EXERCICE)) && 'df-commandes absent'; // false, ou la raison du saut affichée par node --test

// Valeurs du corrigé, calculées à la main depuis la règle : total HT et TVA.
// [35, 7]       une vis à 10 € + 25 € de port (sous le seuil de 500 €), TVA 20 % = 7
// [36.25, 7.25] trois raccords à 3,75 € = 11,25 € + 25 € de port, TVA = 7,25
// [500, 100]    deux pompes à 250 € = 500 €, seuil atteint donc port offert, TVA = 100
const VALEURS = [[35, 7], [36.25, 7.25], [500, 100]];

// Remplit le fichier d'exercice comme le ferait le participant : après chaque
// « assert.ok(devis); », ajoute les deux assertions du total HT et de la TVA,
// dans l'ordre des tests (vis, raccords, pompes).
function remplir(valeurs) {
  let rang = 0;
  return fs.readFileSync(EXERCICE, 'utf8').replace(/ {2}assert\.ok\(devis\);\n/g, (ligne) => {
    const [ht, tva] = valeurs[rang++];
    return `${ligne}  assert.equal(devis.totalHT, ${ht});\n  assert.equal(devis.tva, ${tva});\n`;
  });
}

// Fabrique un faux df-commandes : src/devis/calcul.js (réel par défaut, ou le
// texte fourni) et, si tests n'est pas null, exercices/tva/tva.js.
function projet(tests, calcul = fs.readFileSync(CALCUL, 'utf8')) {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'tva-'));
  fs.mkdirSync(path.join(racine, 'src', 'devis'), { recursive: true });
  fs.writeFileSync(path.join(racine, 'src', 'devis', 'calcul.js'), calcul);
  if (tests !== null) { // null : simule un fichier d'exercice supprimé
    fs.mkdirSync(path.join(racine, 'exercices', 'tva'), { recursive: true });
    fs.writeFileSync(path.join(racine, 'exercices', 'tva', 'tva.js'), tests);
  }
  return racine;
}

// Fichier d'exercice tel que distribué (seulement assert.ok(devis)).
// Attendu : ok false ; 3 tests au vert sur le vrai code, mais aucune des 3
// erreurs détectée, puisque assert.ok(devis) passe quel que soit le calcul.
// Pourquoi : un test qui passe toujours ne vérifie rien ; c'est le point de départ de l'exercice.
test('fichier de départ : tests au vert, aucune erreur détectée', { skip: absent }, () => {
  const r = verifier(projet(fs.readFileSync(EXERCICE, 'utf8')));
  assert.equal(r.ok, false);
  assert.match(r.lignes.join('\n'), /3 tests, 0 en échec\.\n.*en détectent 0 sur 3\./); // sortie sur le code actuel, puis bilan des erreurs essayées
});

// Fichier rempli avec les valeurs du corrigé (total HT et TVA des trois devis).
// Attendu : ok true, les 3 erreurs détectées, bilan « vos tests vérifient la règle ».
// Pourquoi : c'est la réponse attendue ; le vérificateur doit l'accepter.
test('valeurs calculées à la main : les trois erreurs détectées', { skip: absent }, () => {
  const r = verifier(projet(remplir(VALEURS)));
  assert.equal(r.ok, true, r.lignes.join('\n')); // en cas d'échec, la sortie du vérificateur sert de message
  assert.match(r.lignes.join('\n'), /en détectent 3 sur 3\.\nBilan : vos tests vérifient la règle/);
});

// Fichier rempli, puis les trois assertions de TVA retirées (total HT seul).
// Attendu : ok false, 2 erreurs sur 3 détectées.
// Pourquoi : l'erreur « TVA arrondie à l'euro » ne change pas le total HT ;
// seule une assertion sur la TVA la voit (7,25 devient 7 sur les raccords).
test('total HT seul : une erreur de TVA passe inaperçue', { skip: absent }, () => {
  const tests = remplir(VALEURS).replace(/ {2}assert\.equal\(devis\.tva, [\d.]+\);\n/g, ''); // supprime les lignes « assert.equal(devis.tva, …) »
  const r = verifier(projet(tests));
  assert.equal(r.ok, false);
  assert.match(r.lignes.join('\n'), /en détectent 2 sur 3\./);
});

// Fichier rempli avec une valeur fausse pour les pompes : 525 et 105, comme si
// le port de 25 € avait été compté alors que le seuil de 500 € est atteint.
// Attendu : ok false ; le test « deux pompes à 250 € » est nommé en échec, mais
// ni 500 ni 100 (les vraies valeurs) n'apparaissent dans la sortie.
// Pourquoi : la sortie ne doit pas donner la réponse au participant ni à son assistant.
test('valeur attendue fausse : le test est nommé, la valeur obtenue n’est pas affichée', { skip: absent }, () => {
  const r = verifier(projet(remplir([[35, 7], [36.25, 7.25], [525, 105]]))); // seules les valeurs des pompes sont fausses
  const texte = r.lignes.join('\n');
  assert.equal(r.ok, false);
  assert.match(texte, /en échec : deux pompes à 250 €/);
  assert.doesNotMatch(texte, /\b(500|100)\b/); // les valeurs justes ne fuient pas
});

// Fichier rempli, puis une parenthèse fermante retirée : erreur de syntaxe.
// Attendu : ok false, message « ne se charge pas : SyntaxError ».
// Pourquoi : le participant doit comprendre que son fichier ne se charge pas,
// et non croire que ses valeurs sont fausses.
test('fichier qui ne se charge pas', { skip: absent }, () => {
  const r = verifier(projet(remplir(VALEURS).replace('devis.tva, 7);', 'devis.tva, 7;'))); // « ) » manquante
  assert.equal(r.ok, false);
  assert.match(r.lignes.join('\n'), /ne se charge pas : SyntaxError/);
});

// Faux projet sans exercices/tva/tva.js.
// Attendu : ok false, première ligne « … introuvable » (avec la commande git restore).
// Pourquoi : un fichier supprimé par erreur doit être signalé clairement.
test('fichier absent', { skip: absent }, () => {
  const r = verifier(projet(null));
  assert.equal(r.ok, false);
  assert.match(r.lignes[0], /introuvable/);
});

// calcul.js réécrit sans changer le résultat (opérandes inversés), avec les
// valeurs du corrigé.
// Attendu : ok false, message « aucune erreur n'a pu être essayée ».
// Pourquoi : tva.js fausse le calcul en remplaçant des lignes exactes ; si ces
// lignes ont changé, il ne peut rien essayer et ne doit pas conclure au succès.
test('calcul de la TVA et du port réécrit : aucune erreur essayée', { skip: absent }, () => {
  const calcul = fs.readFileSync(CALCUL, 'utf8')
    .replace('const totalHT = arrondir(totalNet + port);', 'const totalHT = arrondir(port + totalNet);') // même total, autre écriture
    .replace('const tva = arrondir(totalHT * TAUX_TVA);', 'const tva = arrondir(TAUX_TVA * totalHT);') // même TVA, autre écriture
    .replace('totalNet >= SEUIL_PORT_GRATUIT', 'SEUIL_PORT_GRATUIT <= totalNet'); // même seuil, autre écriture
  const r = verifier(projet(remplir(VALEURS), calcul));
  assert.equal(r.ok, false);
  assert.match(r.lignes.join('\n'), /aucune erreur n'a pu être essayée/);
});
