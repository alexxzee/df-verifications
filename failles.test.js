// Teste le vérificateur failles.js (npm run failles), micro-exercice du ch04
// « la grille des cinq failles » : le participant note dans docs/failles.md de
// df-commandes la ligne et la catégorie de chaque faille du fichier
// exercices/failles/import-clients.js. failles.js retrouve chaque faille dans
// le fichier par un motif, compare avec la grille, et ne cite jamais de numéro
// de ligne dans sa sortie.
// Chaque test fabrique un faux projet temporaire (fichier d'exercice réel ou
// modifié, grille remplie ou non) et appelle verifier().
// Sans df-commandes cloné à côté de df-verifications, tous les tests sont sautés.
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
const absent = !(fs.existsSync(FICHIER) && fs.existsSync(GRILLE)) && 'df-commandes absent'; // false, ou la raison du saut affichée par node --test

// Grille du corrigé : ligne et catégorie de chaque faille.
const CORRIGE = [
  [8, 'Secret en dur'],
  [39, 'Requête construite à la main'],
  [41, 'Exécution de donnée'],
  [15, 'Vérification désactivée'],
  [33, 'Journal trop bavard'],
];

// Remplit la grille distribuée : sa rangée vide « | | | | » est remplacée par
// une rangée « | ligne | catégorie | (constat) | » par entrée.
function remplir(rangees) {
  const lignes = rangees.map(([ligne, cat]) => `| ${ligne} | ${cat} | (constat) |`).join('\n'); // (constat) : texte libre, non contrôlé
  return fs.readFileSync(GRILLE, 'utf8').replace('| | | |', lignes);
}

// Faux df-commandes : docs/failles.md (si grille n'est pas null) et
// exercices/failles/import-clients.js (réel par défaut, ou le texte fourni, ou absent si null).
function projet(grille, fichier = fs.readFileSync(FICHIER, 'utf8')) {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'failles-'));
  fs.mkdirSync(path.join(racine, 'exercices', 'failles'), { recursive: true });
  fs.mkdirSync(path.join(racine, 'docs'));
  if (fichier !== null) fs.writeFileSync(path.join(racine, 'exercices', 'failles', 'import-clients.js'), fichier);
  if (grille !== null) fs.writeFileSync(path.join(racine, 'docs', 'failles.md'), grille);
  return racine;
}

// Lit le fichier d'exercice réel et regarde les lignes 8, 15, 33, 39 et 41.
// Attendu : chacune porte la faille que le corrigé lui attribue.
// Pourquoi : si le fichier d'exercice est modifié dans df-commandes, les numéros
// du corrigé (ici, dans la fiche et dans le corrigé PDF) doivent suivre ; ce test le signale.
test('les lignes du corrigé sont celles du fichier réel', { skip: absent }, () => {
  const lignes = fs.readFileSync(FICHIER, 'utf8').split('\n');
  assert.match(lignes[7], /MOT_DE_PASSE = '/); // ligne 8 (indices à partir de 0)
  assert.match(lignes[14], /rejectUnauthorized: false/); // ligne 15
  assert.match(lignes[32], /console\.log\(.*MOT_DE_PASSE/); // ligne 33
  assert.match(lignes[38], /SELECT .*\$\{client\.nom\}/); // ligne 39
  assert.match(lignes[40], /eval\(/); // ligne 41
});

// La grille distribuée, vide.
// Attendu : ok false ; 0 ligne notée, 0 faille sur 5.
// Pourquoi : c'est le point de départ de l'exercice.
test('grille de départ : aucune ligne notée', { skip: absent }, () => {
  const r = verifier(projet(fs.readFileSync(GRILLE, 'utf8')));
  assert.equal(r.ok, false);
  assert.match(r.lignes.join('\n'), /Lignes notées dans la grille : 0\.[\s\S]*0 sur 5\./); // [\s\S]* : n'importe quel texte, retours à la ligne compris
});

// La grille du corrigé, cinq rangées.
// Attendu : ok true, « 5 sur 5 », bilan « grille complète ».
// Pourquoi : c'est la réponse attendue ; elle doit être acceptée.
test('grille du corrigé : cinq sur cinq', { skip: absent }, () => {
  const r = verifier(projet(remplir(CORRIGE)));
  assert.equal(r.ok, true, r.lignes.join('\n')); // en cas d'échec, la sortie du vérificateur sert de message
  assert.match(r.lignes.join('\n'), /Failles trouvées : 5 sur 5\.\nBilan : grille complète/);
});

// Une seule rangée : la requête SQL de la ligne 39, ce que trouve une lecture
// centrée sur « est-ce que ça marche ? ».
// Attendu : ok false ; 1 sur 5 ; les quatre catégories manquantes nommées ;
// aucun des numéros 8, 15, 33, 41 dans la sortie.
// Pourquoi : le vérificateur oriente par catégorie sans donner les lignes à trouver.
test('lecture « est-ce que ça marche ? » : la requête seule, quatre catégories manquantes, sans ligne citée', { skip: absent }, () => {
  const r = verifier(projet(remplir([[39, 'Requête construite à la main']])));
  const texte = r.lignes.join('\n');
  assert.equal(r.ok, false);
  assert.match(texte, /1 sur 5\.\nCatégories manquantes : Secret en dur, Exécution de donnée, Vérification désactivée, Journal trop bavard\./);
  assert.doesNotMatch(texte, /\b(8|15|33|41)\b/); // les lignes des failles manquantes ne fuient pas
});

// Deux rangées : la ligne 33 (le journal) classée « Secret en dur », et la ligne 15 bien classée.
// Attendu : ok false ; 1 sur 5 (seule la 15 compte) ; 1 rangée signalée comme ne
// portant pas la faille de sa catégorie ; le numéro 33 n'est pas cité.
// Pourquoi : la ligne et la catégorie doivent concorder ; le message aide sans
// dire quelle rangée est fausse.
test('bonne ligne, mauvaise catégorie : non comptée, signalée sans la citer', { skip: absent }, () => {
  const r = verifier(projet(remplir([[33, 'Secret en dur'], [15, 'Vérification désactivée']])));
  const texte = r.lignes.join('\n');
  assert.equal(r.ok, false);
  assert.match(texte, /1 sur 5\./);
  assert.match(texte, /ne portent pas la faille de leur catégorie : 1\./);
  assert.doesNotMatch(texte, /\b33\b/);
});

// Les cinq failles, avec des catégories écrites librement : minuscules, sans
// accents, synonymes (« injection SQL », « TLS coupé », « journal »), et la ligne 8 en double.
// Attendu : ok true.
// Pourquoi : la catégorie est reconnue par mots-clés ; le participant n'a pas à
// recopier les libellés exacts, et un doublon ne pénalise pas.
test('catégorie libre, accents absents, doublon : tolérés', { skip: absent }, () => {
  const rangees = [[8, 'secret en dur'], [8, 'Secret en dur'], [39, 'injection SQL'], [41, 'execution de donnee'],
    [15, 'TLS coupé'], [33, 'journal']];
  const r = verifier(projet(remplir(rangees)));
  assert.equal(r.ok, true, r.lignes.join('\n'));
});

// Deux rangées dont la catégorie ne se rattache pas à une seule faille :
// « mot de passe dans le journal » (mots de deux catégories) et « faille » (aucun mot-clé).
// Attendu : ok false, « Catégorie non reconnue sur 2 ligne(s) ».
// Pourquoi : une catégorie ambiguë ne peut pas être comptée ; le participant doit trancher.
test('catégorie ambiguë ou inconnue', { skip: absent }, () => {
  const r = verifier(projet(remplir([[33, 'mot de passe dans le journal'], [12, 'faille']]))); // 12 : ligne sans faille
  assert.equal(r.ok, false);
  assert.match(r.lignes.join('\n'), /Catégorie non reconnue sur 2 ligne\(s\)/);
});

// Grille du corrigé, mais fichier d'exercice où la ligne « rejectUnauthorized: false, » a été supprimée.
// Attendu : ok false, « a été modifié ».
// Pourquoi : l'exercice demande de trouver les failles, pas de corriger le fichier ;
// le vérificateur ne peut plus situer une faille dont le motif a disparu.
test('fichier d’exercice modifié', { skip: absent }, () => {
  const corrige = fs.readFileSync(FICHIER, 'utf8').replace('rejectUnauthorized: false,\n', ''); // faille « Vérification désactivée » retirée
  const r = verifier(projet(remplir(CORRIGE), corrige));
  assert.equal(r.ok, false);
  assert.match(r.lignes.join('\n'), /a été modifié/);
});

// Deux cas : grille absente (fichier présent), puis fichier d'exercice absent (grille vide présente).
// Attendu : première ligne « docs/failles.md introuvable », puis « import-clients.js introuvable ».
// Pourquoi : chaque fichier manquant est nommé, pour que le participant le restaure.
test('grille absente, fichier absent', { skip: absent }, () => {
  assert.match(verifier(projet(null)).lignes[0], /docs\/failles\.md introuvable/);
  assert.match(verifier(projet('', null)).lignes[0], /import-clients\.js introuvable/); // '' : grille présente mais vide
});
