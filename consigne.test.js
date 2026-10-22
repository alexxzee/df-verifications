'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { verifier } = require('./consigne.js');

// La consigne fournie et le package.json réels de df-commandes, s'il est cloné à côté.
const DF = path.resolve(__dirname, '..', 'df-commandes');
const CONSIGNE = path.join(DF, 'docs', 'consigne-delegation.md');
const PAQUET = path.join(DF, 'package.json');
const absent = !(fs.existsSync(CONSIGNE) && fs.existsSync(PAQUET)) && 'df-commandes absent';

const FAUTIVE = 'Comme convenu plus haut, fais la fiche client et vérifie que ça marche.';

// Consigne du corrigé.
const BONNE = [
  'Objectif : ajouter la route GET /clients/:id/fiche, qui renvoie en JSON le client et ses cinq devis les plus récents (id, date, total_ttc), du plus récent au plus ancien.',
  '',
  'Fichiers autorisés : src/routes/clients.js, et un nouveau fichier de tests, test/routes/fiche-client.test.js, à créer. Aucun autre fichier, aucune nouvelle dépendance.',
  '',
  'Critères : un client inconnu renvoie 404 avec {"erreur": "Client introuvable"} ; un client sans devis renvoie une liste de devis vide ; GET /clients et GET /clients/:id ne changent pas.',
  '',
  'Vérification : npm test se termine par ℹ fail 0, et npm run lint n’ajoute aucune alerte dans src/routes/clients.js.',
  '',
  'À rendre : la liste des fichiers modifiés ou créés, la sortie de npm test, et les questions restées ouvertes.',
].join('\n');

function projet(consigne, fichiers = ['src/routes/clients.js']) {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'consigne-'));
  fs.copyFileSync(PAQUET, path.join(racine, 'package.json'));
  for (const f of fichiers) {
    fs.mkdirSync(path.dirname(path.join(racine, f)), { recursive: true });
    fs.writeFileSync(path.join(racine, f), '');
  }
  if (consigne !== null) {
    fs.mkdirSync(path.join(racine, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(racine, 'docs', 'consigne-delegation.md'), consigne);
  }
  return racine;
}

function remplacer(consigne) {
  return fs.readFileSync(CONSIGNE, 'utf8').replace(FAUTIVE, consigne);
}

test('la consigne fournie contient la phrase fautive', { skip: absent }, () => {
  assert.ok(fs.readFileSync(CONSIGNE, 'utf8').includes(FAUTIVE));
});

test('consigne fournie : quatre points à reprendre', { skip: absent }, () => {
  const r = verifier(projet(fs.readFileSync(CONSIGNE, 'utf8')));
  const texte = r.lignes.join('\n');
  assert.equal(r.ok, false);
  assert.match(texte, /Rubriques remplies : 0 sur 5\.\n {3}Manquantes : Objectif, Fichiers autorisés, Critères, Vérification, À rendre\./);
  assert.match(texte, /Renvoi à la conversation : « plus haut », « comme convenu »\./);
  assert.match(texte, /Bilan : pas encore\. 4 point\(s\)/);
});

test('consigne du corrigé : elle se suffit', { skip: absent }, () => {
  const r = verifier(projet(remplacer(BONNE)));
  const texte = r.lignes.join('\n');
  assert.equal(r.ok, true, texte);
  assert.match(texte, /Rubriques remplies : 5 sur 5\./);
  assert.match(texte, /Absents du dépôt : test\/routes\/fiche-client\.test\.js\./);
  assert.match(texte, /Commandes du projet dans « Vérification » : 2\./);
});

test('formes de libellé : titres, gras, tirets, accents absents', { skip: absent }, () => {
  const consigne = [
    '## Objectif', 'Ajouter la route de la fiche client, en JSON.',
    '**Fichiers autorises :** `src/routes/clients.js` seulement.',
    '- **Criteres d’acceptation** : 404 si le client est inconnu.',
    '### Validation', '`npm test` doit passer sans échec.',
    '__Rendu__ : liste des fichiers modifiés et sortie des tests.',
  ].join('\n');
  const r = verifier(projet(remplacer(consigne)));
  assert.equal(r.ok, true, r.lignes.join('\n'));
});

test('rubrique vide et commande inconnue', { skip: absent }, () => {
  const consigne = BONNE.replace(/À rendre : .*/, 'À rendre :').replace('npm test se termine par ℹ fail 0, et npm run lint', 'npm run verifier-tout');
  const r = verifier(projet(remplacer(consigne)));
  const texte = r.lignes.join('\n');
  assert.equal(r.ok, false);
  assert.match(texte, /Trop courtes \(moins de 2 mots\) : À rendre\./);
  assert.match(texte, /Commandes du projet dans « Vérification » : 0\.\n.*\n {3}Absentes du package\.json : verifier-tout\./);
});

test('renvoi caché dans une rubrique', { skip: absent }, () => {
  const r = verifier(projet(remplacer(BONNE.replace('Critères : un client', 'Critères : les mêmes que ci-dessus, et un client'))));
  assert.equal(r.ok, false);
  assert.match(r.lignes.join('\n'), /Renvoi à la conversation : « ci-dessus »\./);
});

test('fichier autorisé qui n’existe pas seulement', { skip: absent }, () => {
  const r = verifier(projet(remplacer(BONNE.replace('src/routes/clients.js, et', 'src/routes/client.js, et')), []));
  const texte = r.lignes.join('\n');
  assert.equal(r.ok, false);
  assert.match(texte, /Fichiers du dépôt nommés dans « Fichiers autorisés » : 0\./);
  assert.match(texte, /Absents du dépôt : src\/routes\/client\.js, test\/routes\/fiche-client\.test\.js\./);
});

test('exemple de la fiche recopié (autre tâche) : refusé', { skip: absent }, () => {
  const exemple = [
    'Objectif : ajouter à GET /produits un paramètre facultatif categorie, qui ne renvoie que les produits de cette catégorie ; sans paramètre, la liste reste complète.',
    'Fichiers autorisés : src/routes/produits.js seulement. Aucune nouvelle dépendance.',
    'Critères : une catégorie inconnue renvoie une liste vide, sans erreur ; l’ordre de la liste ne change pas.',
    'Vérification : npm test se termine par ℹ fail 0.',
    'À rendre : le diff de src/routes/produits.js et la sortie de npm test.',
  ].join('\n\n');
  const r = verifier(projet(remplacer(exemple), ['src/routes/produits.js']));
  assert.equal(r.ok, false);
  assert.match(r.lignes.join('\n'), /L’objectif ne parle pas du client/);
});

test('fichier absent', { skip: absent }, () => {
  const r = verifier(projet(null));
  assert.equal(r.ok, false);
  assert.match(r.lignes[0], /introuvable/);
});
