// Teste le vérificateur consigne.js (npm run consigne), micro-exercice du ch08 :
// le participant réécrit docs/consigne-delegation.md de df-commandes pour
// qu'un agent puisse l'exécuter sans la conversation. consigne.js contrôle
// cinq rubriques remplies (Objectif, Fichiers autorisés, Critères, Vérification,
// À rendre), au moins un fichier autorisé qui existe dans le dépôt, une commande
// npm du package.json dans « Vérification », et aucun renvoi à la conversation.
// Chaque test fabrique un faux projet temporaire (package.json réel de
// df-commandes, fichiers vides choisis, consigne écrite) et appelle verifier().
// Sans df-commandes cloné à côté de df-verifications, tous les tests sont sautés.
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
const absent = !(fs.existsSync(CONSIGNE) && fs.existsSync(PAQUET)) && 'df-commandes absent'; // false, ou la raison du saut affichée par node --test

// La phrase à remplacer dans la consigne distribuée : vague, et qui renvoie à la conversation.
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

// Faux df-commandes : package.json réel, fichiers listés créés vides (par
// défaut src/routes/clients.js), et docs/consigne-delegation.md si consigne n'est pas null.
function projet(consigne, fichiers = ['src/routes/clients.js']) {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'consigne-'));
  fs.copyFileSync(PAQUET, path.join(racine, 'package.json')); // sert à reconnaître les commandes npm du projet
  for (const f of fichiers) {
    fs.mkdirSync(path.dirname(path.join(racine, f)), { recursive: true });
    fs.writeFileSync(path.join(racine, f), ''); // seule l'existence du fichier compte
  }
  if (consigne !== null) { // null : simule une consigne supprimée
    fs.mkdirSync(path.join(racine, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(racine, 'docs', 'consigne-delegation.md'), consigne);
  }
  return racine;
}

// La consigne distribuée, où la phrase fautive est remplacée par le texte du participant.
function remplacer(consigne) {
  return fs.readFileSync(CONSIGNE, 'utf8').replace(FAUTIVE, consigne);
}

// Vérifie la consigne distribuée dans df-commandes.
// Attendu : elle contient la phrase fautive.
// Pourquoi : remplacer() s'appuie sur cette phrase ; sans elle, les tests suivants
// ne testeraient plus le texte voulu.
test('la consigne fournie contient la phrase fautive', { skip: absent }, () => {
  assert.ok(fs.readFileSync(CONSIGNE, 'utf8').includes(FAUTIVE));
});

// La consigne distribuée, telle quelle.
// Attendu : ok false ; 0 rubrique sur 5, les cinq listées comme manquantes ;
// renvois « plus haut » et « comme convenu » relevés ; bilan de 4 points à reprendre.
// Pourquoi : c'est le point de départ de l'exercice ; tout doit y être signalé.
test('consigne fournie : quatre points à reprendre', { skip: absent }, () => {
  const r = verifier(projet(fs.readFileSync(CONSIGNE, 'utf8')));
  const texte = r.lignes.join('\n');
  assert.equal(r.ok, false);
  assert.match(texte, /Rubriques remplies : 0 sur 5\.\n {3}Manquantes : Objectif, Fichiers autorisés, Critères, Vérification, À rendre\./); // ligne suivante indentée de 3 espaces
  assert.match(texte, /Renvoi à la conversation : « plus haut », « comme convenu »\./);
  assert.match(texte, /Bilan : pas encore\. 4 point\(s\)/);
});

// La consigne du corrigé (BONNE) à la place de la phrase fautive.
// Attendu : ok true ; 5 rubriques sur 5 ; le fichier de tests à créer est signalé
// absent du dépôt sans faire échouer ; 2 commandes du projet (npm test, npm run lint).
// Pourquoi : c'est la réponse attendue ; un fichier à créer est légitime tant
// qu'au moins un fichier autorisé existe.
test('consigne du corrigé : elle se suffit', { skip: absent }, () => {
  const r = verifier(projet(remplacer(BONNE)));
  const texte = r.lignes.join('\n');
  assert.equal(r.ok, true, texte); // en cas d'échec, la sortie du vérificateur sert de message
  assert.match(texte, /Rubriques remplies : 5 sur 5\./);
  assert.match(texte, /Absents du dépôt : test\/routes\/fiche-client\.test\.js\./);
  assert.match(texte, /Commandes du projet dans « Vérification » : 2\./);
});

// Une consigne aux libellés écrits autrement : titres Markdown (##, ###), gras
// (** et __), puce, accents absents (« autorises », « Criteres »), synonymes
// (« Validation » pour Vérification, « Rendu » pour À rendre).
// Attendu : ok true.
// Pourquoi : le vérificateur juge le contenu, pas la mise en forme ; une
// consigne correcte écrite à sa façon doit passer.
test('formes de libellé : titres, gras, tirets, accents absents', { skip: absent }, () => {
  const consigne = [
    '## Objectif', 'Ajouter la route de la fiche client, en JSON.', // titre, contenu sur la ligne suivante
    '**Fichiers autorises :** `src/routes/clients.js` seulement.', // gras, sans accent
    '- **Criteres d’acceptation** : 404 si le client est inconnu.', // puce, gras, variante « d'acceptation »
    '### Validation', '`npm test` doit passer sans échec.', // synonyme de Vérification
    '__Rendu__ : liste des fichiers modifiés et sortie des tests.', // gras par soulignés, synonyme de À rendre
  ].join('\n');
  const r = verifier(projet(remplacer(consigne)));
  assert.equal(r.ok, true, r.lignes.join('\n'));
});

// Consigne du corrigé, avec « À rendre : » vidé et une commande npm qui n'existe pas.
// Attendu : ok false ; « À rendre » signalée trop courte (moins de 2 mots) ;
// 0 commande du projet, et verifier-tout signalée absente du package.json.
// Pourquoi : une rubrique vide ou une commande inventée laisse l'agent sans moyen de vérifier.
test('rubrique vide et commande inconnue', { skip: absent }, () => {
  const consigne = BONNE.replace(/À rendre : .*/, 'À rendre :').replace('npm test se termine par ℹ fail 0, et npm run lint', 'npm run verifier-tout'); // verifier-tout : script absent du package.json
  const r = verifier(projet(remplacer(consigne)));
  const texte = r.lignes.join('\n');
  assert.equal(r.ok, false);
  assert.match(texte, /Trop courtes \(moins de 2 mots\) : À rendre\./);
  assert.match(texte, /Commandes du projet dans « Vérification » : 0\.\n.*\n {3}Absentes du package\.json : verifier-tout\./); // une ligne intermédiaire entre les deux
});

// Consigne du corrigé, où « Critères » commence par « les mêmes que ci-dessus ».
// Attendu : ok false, renvoi « ci-dessus » relevé.
// Pourquoi : un renvoi glissé dans une rubrique bien remplie rend quand même la
// consigne dépendante de la conversation.
test('renvoi caché dans une rubrique', { skip: absent }, () => {
  const r = verifier(projet(remplacer(BONNE.replace('Critères : un client', 'Critères : les mêmes que ci-dessus, et un client'))));
  assert.equal(r.ok, false);
  assert.match(r.lignes.join('\n'), /Renvoi à la conversation : « ci-dessus »\./);
});

// Consigne du corrigé avec une faute de frappe (src/routes/client.js, sans « s »),
// dans un projet où aucun fichier n'est créé.
// Attendu : ok false ; 0 fichier du dépôt nommé ; les deux fichiers signalés absents.
// Pourquoi : si aucun fichier autorisé n'existe, l'agent travaillerait sur un
// fichier inventé ; le fichier à créer ne suffit pas à lui seul.
test('fichier autorisé qui n’existe pas seulement', { skip: absent }, () => {
  const r = verifier(projet(remplacer(BONNE.replace('src/routes/clients.js, et', 'src/routes/client.js, et')), [])); // [] : aucun fichier dans le faux projet
  const texte = r.lignes.join('\n');
  assert.equal(r.ok, false);
  assert.match(texte, /Fichiers du dépôt nommés dans « Fichiers autorisés » : 0\./);
  assert.match(texte, /Absents du dépôt : src\/routes\/client\.js, test\/routes\/fiche-client\.test\.js\./);
});

// Consigne complète et bien formée, mais pour une autre tâche (le filtre par
// catégorie de GET /produits, exemple donné dans la fiche).
// Attendu : ok false, « L'objectif ne parle pas du client ».
// Pourquoi : recopier l'exemple de la fiche ne répond pas à l'exercice, la fiche client.
test('exemple de la fiche recopié (autre tâche) : refusé', { skip: absent }, () => {
  const exemple = [
    'Objectif : ajouter à GET /produits un paramètre facultatif categorie, qui ne renvoie que les produits de cette catégorie ; sans paramètre, la liste reste complète.',
    'Fichiers autorisés : src/routes/produits.js seulement. Aucune nouvelle dépendance.',
    'Critères : une catégorie inconnue renvoie une liste vide, sans erreur ; l’ordre de la liste ne change pas.',
    'Vérification : npm test se termine par ℹ fail 0.',
    'À rendre : le diff de src/routes/produits.js et la sortie de npm test.',
  ].join('\n\n');
  const r = verifier(projet(remplacer(exemple), ['src/routes/produits.js'])); // le fichier nommé existe : seul l'objectif doit faire échouer
  assert.equal(r.ok, false);
  assert.match(r.lignes.join('\n'), /L’objectif ne parle pas du client/);
});

// Faux projet sans docs/consigne-delegation.md.
// Attendu : ok false, première ligne « … introuvable ».
// Pourquoi : un fichier supprimé par erreur doit être signalé clairement.
test('fichier absent', { skip: absent }, () => {
  const r = verifier(projet(null));
  assert.equal(r.ok, false);
  assert.match(r.lignes[0], /introuvable/);
});
