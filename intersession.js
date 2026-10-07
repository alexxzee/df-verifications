// Fichier de la formation : ne pas modifier.
'use strict';

// Vérifie le travail intersession sur les points de fidélité, en quatre parties :
//   1. la refactorisation garde le comportement d'origine (cas tirés au hasard) ;
//   2. les tests de caractérisation passent sur le code d'origine et détectent
//      des modifications du calcul ;
//   3. les tests écrits depuis la spec passent sur une version conforme à la spec
//      et révèlent les écarts du code ;
//   4. docs/ecarts-a-trancher.md contient une ligne par écart.
// La sortie ne décrit ni les modifications essayées ni les écarts : elle ne
// révèle pas la réponse à l'assistant qui lancerait la commande.
//   npm run intersession

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const RACINE = process.cwd();
const MODULE = 'src/legacy/fidelite.js';
const CARACTERISATION = 'exercices/intersession/fidelite-caracterisation.js';
const SPEC = 'exercices/intersession/fidelite-spec.js';
const ECARTS = 'docs/ecarts-a-trancher.md';

// Le module tel que livré dans le modèle df-commandes : la référence du comportement.
const ORIGINE = `'use strict';
const MAX = 5000;
const x2 = 2;

function calculerFidelite(commandes, client, dateCalcul) {
  let d = new Date();
  if (dateCalcul) d = new Date(dateCalcul);
  const debut = new Date(d.getTime() - 365 * 24 * 60 * 60 * 1000);
  let pts = 0;
  for (let i = 0; i < commandes.length; i++) {
    const c = commandes[i];
    if (c.statut === 'annulee') {
      continue;
    }
    const dc = new Date(c.date);
    if (dc > debut) {
      if (dc <= d) {
        if (client.grandCompte === true || client.grand_compte === 1) {
          pts = pts + Math.floor(c.totalHt / 10) * x2;
        } else {
          pts = pts + Math.floor(c.totalHt / 10);
        }
      }
    }
  }
  pts = Math.min(pts, MAX);
  let palier = 'Bronze';
  if (pts >= 2000) {
    palier = 'Or';
  } else {
    if (pts > 500) {
      palier = 'Argent';
    }
  }
  return { points: pts, palier: palier };
}

module.exports = { calculerFidelite };
`;

// Remplacements appliqués à ORIGINE. Les deux premiers rendent le code conforme
// à docs/programme-fidelite.md ; les autres changent le calcul ailleurs.
const STATUT = ["c.statut === 'annulee'", "c.statut !== 'livree'"];
const ARGENT = ['pts > 500', 'pts >= 500'];
const MODIFICATIONS = [
  { aspect: 'le statut des commandes', remplacements: [STATUT] },
  { aspect: 'les paliers', remplacements: [ARGENT] },
  { aspect: 'les paliers', remplacements: [['pts >= 2000', 'pts > 2000']] },
  { aspect: 'le plafond', remplacements: [['MAX = 5000', 'MAX = 6000']] },
  { aspect: 'le bonus grand compte', remplacements: [['x2 = 2', 'x2 = 3']] },
  { aspect: 'la période prise en compte', remplacements: [['dc > debut', 'dc >= debut']] },
  { aspect: 'la période prise en compte', remplacements: [['dc <= d)', 'dc < d)']] },
  { aspect: 'le barème', remplacements: [['Math.floor(c.totalHt / 10) * x2', 'Math.round(c.totalHt / 10) * x2'],
    ['Math.floor(c.totalHt / 10);', 'Math.round(c.totalHt / 10);']] },
];

function variante(remplacements) {
  let source = ORIGINE;
  for (const [avant, apres] of remplacements) {
    if (!source.includes(avant)) throw new Error(`remplacement introuvable : ${avant}`);
    source = source.split(avant).join(apres);
  }
  return source;
}

const CONFORME = variante([STATUT, ARGENT]);
const ECART_STATUT_SEUL = variante([ARGENT]);
const ECART_ARGENT_SEUL = variante([STATUT]);

let problemes = 0;
function dire(ligne) {
  console.log(ligne);
}
function probleme(lignes) {
  problemes += 1;
  for (const ligne of lignes) console.log(`  ${ligne}`);
}

// Générateur pseudo-aléatoire à graine fixe : les mêmes cas à chaque lancement.
function generateur(graine) {
  let etat = graine >>> 0;
  return () => {
    etat = (etat * 1664525 + 1013904223) >>> 0;
    return etat / 2 ** 32;
  };
}

function jourDecale(base, n) {
  const date = new Date(`${base}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

function casAuHasard(nombre) {
  const hasard = generateur(20261006);
  const entier = (min, max) => min + Math.floor(hasard() * (max - min + 1));
  const statuts = ['livree', 'expediee', 'en_preparation', 'annulee'];
  const decalages = [0, -1, -364, -365, -366, 1];
  const montants = [0, 9.99, 10, 49.9, 59.9, 100, 1000, 4990, 5000, 9999.99];
  const cas = [];
  for (let k = 0; k < nombre; k++) {
    const dateCalcul = jourDecale('2026-06-15', entier(-200, 200));
    const commandes = [];
    for (let n = entier(0, 8); n > 0; n--) {
      const decalage = hasard() < 0.4 ? decalages[entier(0, decalages.length - 1)] : entier(-420, 5);
      const totalHt = hasard() < 0.4 ? montants[entier(0, montants.length - 1)]
        : Math.round(hasard() * 600000) / 100;
      commandes.push({ date: jourDecale(dateCalcul, decalage), statut: statuts[entier(0, 3)], totalHt });
    }
    cas.push({ commandes, client: { grandCompte: hasard() < 0.3 }, dateCalcul });
  }
  // Cas construits autour des seuils de palier et du plafond.
  for (const total of [4990, 5000, 5010, 19990, 20000, 20010, 49990, 50000, 50010]) {
    for (const grandCompte of [false, true]) {
      cas.push({ commandes: [{ date: '2026-03-01', statut: 'livree', totalHt: total }],
        client: { grandCompte }, dateCalcul: '2026-06-15' });
    }
  }
  return cas;
}

function chargerModule(source) {
  const m = { exports: {} };
  new Function('module', 'exports', 'require', source)(m, m.exports, require);
  return m.exports.calculerFidelite;
}

// 1. La refactorisation garde le comportement d'origine.
function verifierComportement() {
  const chemin = path.join(RACINE, MODULE);
  let fonction;
  try {
    delete require.cache[chemin];
    fonction = require(chemin).calculerFidelite;
  } catch (erreur) {
    dire(`1. Comportement : ${MODULE} ne se charge pas : ${erreur.message.split('\n')[0]}`);
    probleme(['Annulez la dernière modification (git restore src/legacy), puis relancez.']);
    return;
  }
  if (typeof fonction !== 'function') {
    dire(`1. Comportement : ${MODULE} n'exporte plus calculerFidelite.`);
    probleme(['Gardez la signature calculerFidelite(commandes, client, dateCalcul) et son export.']);
    return;
  }
  const reference = chargerModule(ORIGINE);
  const cas = casAuHasard(2000);
  const differents = [];
  for (const c of cas) {
    const attendu = JSON.stringify(reference(c.commandes, c.client, c.dateCalcul));
    let obtenu;
    try {
      obtenu = JSON.stringify(fonction(c.commandes, c.client, c.dateCalcul));
    } catch (erreur) {
      obtenu = `erreur ${erreur.message}`;
    }
    if (attendu !== obtenu) differents.push({ c, attendu, obtenu });
  }
  if (differents.length === 0) {
    dire(`1. Comportement : identique à la version d'origine sur ${cas.length} cas.`);
    return;
  }
  const { c, attendu, obtenu } = differents[0];
  dire(`1. Comportement : DIFFÉRENT de la version d'origine sur ${differents.length} cas sur ${cas.length}.`);
  probleme([
    `Premier cas : calculerFidelite(${JSON.stringify(c.commandes)}, ${JSON.stringify(c.client)}, '${c.dateCalcul}')`,
    `attendu ${attendu}, obtenu ${obtenu}.`,
    'Une refactorisation ne change pas le résultat : annulez la dernière modification.',
  ]);
}

// Un fichier de test est encore vide s'il ne déclare aucun test.
function contientDesTests(fichier) {
  const chemin = path.join(RACINE, fichier);
  if (!fs.existsSync(chemin)) return null;
  return /\b(test|it)\s*\(/.test(fs.readFileSync(chemin, 'utf8'));
}

// Lance un fichier de test du participant contre une version du module, dans une
// copie temporaire de src/ : renvoie le nombre de tests, d'échecs et de todo.
function lancer(fichier, source) {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'df-intersession-'));
  try {
    fs.cpSync(path.join(RACINE, 'src'), path.join(dossier, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dossier, MODULE), source);
    const cible = path.join(dossier, fichier);
    fs.mkdirSync(path.dirname(cible), { recursive: true });
    fs.copyFileSync(path.join(RACINE, fichier), cible);
    const modules = path.join(RACINE, 'node_modules');
    if (fs.existsSync(modules)) fs.symlinkSync(modules, path.join(dossier, 'node_modules'), 'dir');
    const r = spawnSync(process.execPath,
      ['--disable-warning=ExperimentalWarning', '--test', '--test-reporter=tap', cible],
      { cwd: dossier, encoding: 'utf8', timeout: 30000 });
    const sortie = r.stdout || '';
    const nombre = (cle) => Number((sortie.match(new RegExp(`^# ${cle} (\\d+)`, 'm')) || [0, 0])[1]);
    const lignes = sortie.split('\n').filter((l) => /^\s*not ok \d+ /.test(l) && !/^\s*not ok \d+ - .*\.test\.js/.test(l));
    return {
      tests: nombre('tests'),
      echecs: nombre('fail'),
      todo: nombre('todo'),
      rouges: lignes.length,
      rougesHorsTodo: lignes.filter((l) => !/# TODO/.test(l)).length,
    };
  } finally {
    fs.rmSync(dossier, { recursive: true, force: true });
  }
}

// 2. Le filet de caractérisation.
function verifierFilet() {
  const etat = contientDesTests(CARACTERISATION);
  if (etat === null) {
    dire(`2. Filet : ${CARACTERISATION} introuvable.`);
    probleme(['Récupérez les fichiers de l\'exercice (début de la fiche), puis relancez.']);
    return;
  }
  if (!etat) {
    dire(`2. Filet : ${CARACTERISATION} ne contient encore aucun test (étape 1).`);
    problemes += 1;
    return;
  }
  const origine = lancer(CARACTERISATION, ORIGINE);
  if (origine.tests === 0) {
    dire('2. Filet : aucun test ne s\'exécute. Lancez npm run test:intersession pour voir l\'erreur.');
    problemes += 1;
    return;
  }
  if (origine.rouges > 0) {
    dire(`2. Filet : ${origine.rouges} test(s) sur ${origine.tests} échouent sur le code d'origine.`);
    probleme([
      'Un test de caractérisation décrit ce que le code FAIT, pas ce qu\'il devrait faire :',
      'remplacez sa valeur attendue par la valeur obtenue, sans toucher au code.',
    ]);
    return;
  }
  const manques = MODIFICATIONS.filter((m) => lancer(CARACTERISATION, variante(m.remplacements)).rouges === 0);
  const detectees = MODIFICATIONS.length - manques.length;
  dire(`2. Filet : ${origine.tests} tests au vert sur le code d'origine ; ils détectent ${detectees} `
    + `des ${MODIFICATIONS.length} modifications du calcul essayées.`);
  if (manques.length > 0) {
    const aspects = [...new Set(manques.map((m) => m.aspect))];
    probleme([
      `Non détectée : une modification qui touche ${aspects.join(', ')}.`,
      'Ajoutez des cas de part et d\'autre de chaque condition du code concernée, puis relancez.',
    ]);
  }
}

// 3. Les tests écrits depuis la spec.
function verifierSpec() {
  const etat = contientDesTests(SPEC);
  if (etat === null) {
    dire(`3. Spec : ${SPEC} introuvable.`);
    probleme(['Récupérez les fichiers de l\'exercice (début de la fiche), puis relancez.']);
    return 0;
  }
  if (!etat) {
    dire(`3. Spec : ${SPEC} ne contient encore aucun test (étape 3).`);
    problemes += 1;
    return 0;
  }
  const conforme = lancer(SPEC, CONFORME);
  if (conforme.tests === 0) {
    dire('3. Spec : aucun test ne s\'exécute. Lancez npm run test:intersession pour voir l\'erreur.');
    problemes += 1;
    return 0;
  }
  if (conforme.rouges > 0) {
    dire(`3. Spec : ${conforme.rouges} test(s) échouent sur une version conforme à la spec.`);
    probleme([
      'Leur valeur attendue ne vient pas de docs/programme-fidelite.md :',
      'recalculez-la à la main depuis la règle citée, puis relancez.',
    ]);
    return 0;
  }
  const actuel = lancer(SPEC, ORIGINE);
  const reveles = [ECART_STATUT_SEUL, ECART_ARGENT_SEUL].filter((s) => lancer(SPEC, s).rouges > 0).length;
  dire(`3. Spec : ${conforme.tests} tests justes au regard de la spec ; ${actuel.rouges} échouent `
    + `sur le code actuel, dont ${actuel.todo} marqué(s) todo.`);
  if (reveles < 2) {
    probleme([
      'Au moins un écart entre le code et la spec n\'est révélé par aucun de vos tests :',
      'reprenez la spec règle par règle, avec un cas juste avant, sur et juste après chaque limite.',
    ]);
  }
  if (actuel.rougesHorsTodo > 0) {
    probleme([
      `${actuel.rougesHorsTodo} test(s) au rouge sans todo : notez chaque écart dans ${ECARTS},`,
      'puis marquez le test { todo: \'écart à trancher\' }. Ne corrigez pas le code.',
    ]);
  }
  return actuel.rouges;
}

// 4. Une ligne par écart dans docs/ecarts-a-trancher.md.
function verifierEcarts(rouges) {
  const chemin = path.join(RACINE, ECARTS);
  if (!fs.existsSync(chemin)) {
    dire(`4. Écarts : ${ECARTS} introuvable.`);
    probleme(['Récupérez les fichiers de l\'exercice (début de la fiche), puis relancez.']);
    return;
  }
  const lignes = fs.readFileSync(chemin, 'utf8').split('\n')
    .filter((l) => /^\s*\|/.test(l))
    .filter((l) => !/^\s*\|[\s|:-]*$/.test(l))
    .filter((l) => !/Règle de la spec|Constat/i.test(l))
    .filter((l) => l.split('|').slice(1, -1).some((cellule) => cellule.trim() !== ''));
  dire(`4. Écarts : ${lignes.length} ligne(s) remplie(s) dans ${ECARTS}.`);
  if (rouges > 0 && lignes.length === 0) {
    probleme(['Vos tests depuis la spec révèlent des écarts : une ligne par écart, constat et question au métier.']);
  }
}

console.log('Travail intersession : points de fidélité');
verifierComportement();
verifierFilet();
const rouges = verifierSpec();
verifierEcarts(rouges);
console.log(problemes === 0
  ? 'Bilan : tout est en ordre. Poussez votre travail.'
  : `Bilan : ${problemes} point(s) à reprendre, détaillés ci-dessus.`);
process.exit(problemes === 0 ? 0 : 1);
