// Fichier de la formation : ne pas modifier.
'use strict';

// Vérifie les tests de exercices/tva/tva.js (micro-exercice du ch02) :
//   1. ils passent sur le code actuel de src/devis/calcul.js ;
//   2. ils échouent sur des copies de ce code où le calcul de la TVA ou du port
//      a été faussé.
// La sortie ne décrit pas les erreurs essayées : elle ne révèle pas la réponse
// à l'assistant qui lancerait la commande.
//   npm run tva

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TESTS = 'exercices/tva/tva.js';
const MODULE = 'src/devis/calcul.js';

// Chaque erreur remplace une ligne du calcul de la TVA ou du port.
const ERREURS = [
  ['const totalHT = arrondir(totalNet + port);', 'const totalHT = arrondir(totalNet);'],
  ['const tva = arrondir(totalHT * TAUX_TVA);', 'const tva = Math.round(totalHT * TAUX_TVA);'],
  ['totalNet >= SEUIL_PORT_GRATUIT', 'totalNet > SEUIL_PORT_GRATUIT'],
];

// Lance les tests du participant dans une copie de src/, où MODULE a reçu le
// contenu source : renvoie le nombre de tests, d'échecs et les noms en échec.
function lancer(racine, source) {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'df-tva-'));
  try {
    fs.cpSync(path.join(racine, 'src'), path.join(dossier, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dossier, MODULE), source);
    const cible = path.join(dossier, TESTS);
    fs.mkdirSync(path.dirname(cible), { recursive: true });
    fs.copyFileSync(path.join(racine, TESTS), cible);
    const modules = path.join(racine, 'node_modules');
    if (fs.existsSync(modules)) fs.symlinkSync(modules, path.join(dossier, 'node_modules'), 'dir');
    // Sans NODE_TEST_CONTEXT : lancé depuis un test, node --test répondrait au
    // lanceur parent au lieu d'écrire sa sortie TAP.
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const r = spawnSync(process.execPath,
      ['--disable-warning=ExperimentalWarning', '--test', '--test-reporter=tap', cible],
      { cwd: dossier, encoding: 'utf8', timeout: 30000, env });
    const sortie = r.stdout || '';
    const nombre = (cle) => Number((sortie.match(new RegExp(`^# ${cle} (\\d+)`, 'm')) || [0, 0])[1]);
    const enEchec = sortie.split('\n')
      .map((l) => l.match(/^not ok \d+ - (.*?)(?: # .*)?$/))
      .filter(Boolean)
      .map((m) => m[1]);
    // Fichier qui ne se charge pas : node signale le fichier lui-même en échec.
    const chargement = enEchec.some((nom) => nom.endsWith('tva.js'))
      ? (sortie.match(/^# (\w*Error: .*)$/m) || [null, 'erreur au chargement'])[1]
      : null;
    return { tests: nombre('tests'), echecs: nombre('fail'), enEchec, chargement };
  } finally {
    fs.rmSync(dossier, { recursive: true, force: true });
  }
}

function verifier(racine) {
  const lignes = [];
  const fin = (ok) => ({ ok, lignes });
  if (!fs.existsSync(path.join(racine, TESTS))) {
    lignes.push(`Fichier ${TESTS} introuvable : il fait partie du dépôt. Récupérez-le avec git restore ${TESTS}.`);
    return fin(false);
  }
  const code = fs.readFileSync(path.join(racine, MODULE), 'utf8');
  const actuel = lancer(racine, code);
  if (actuel.chargement || actuel.tests === 0) {
    lignes.push(`${TESTS} ne se charge pas : ${actuel.chargement || 'aucun test trouvé'}.`);
    lignes.push('Vérifiez les parenthèses et les points-virgules des lignes ajoutées, enregistrez (Ctrl+S), puis relancez.');
    lignes.push('Bilan : pas encore. Le fichier doit se charger.');
    return fin(false);
  }
  if (actuel.echecs > 0) {
    lignes.push(`Sur le code actuel : ${actuel.tests} tests, ${actuel.echecs} en échec.`);
    for (const nom of actuel.enEchec) lignes.push(`   en échec : ${nom}`);
    lignes.push('La TVA et le port de ce code sont justes : la valeur attendue du test en échec est fausse.');
    lignes.push('Refaites le calcul à la main, depuis la règle de la fiche, étape par étape.');
    lignes.push('Bilan : pas encore. Chaque test doit passer sur le code actuel.');
    return fin(false);
  }
  lignes.push(`Sur le code actuel : ${actuel.tests} tests, 0 en échec.`);
  let essayees = 0;
  let detectees = 0;
  for (const [avant, apres] of ERREURS) {
    if (!code.includes(avant)) continue;
    essayees += 1;
    if (lancer(racine, code.split(avant).join(apres)).echecs > 0) detectees += 1;
  }
  if (essayees === 0) {
    lignes.push(`Le calcul de la TVA et du port de ${MODULE} a été modifié : aucune erreur n'a pu être essayée.`);
    lignes.push(`Remettez le fichier dans son état de départ (git restore ${MODULE}), puis relancez.`);
    return fin(false);
  }
  lignes.push(`Erreurs de calcul glissées dans une copie du code : vos tests en détectent ${detectees} sur ${essayees}.`);
  if (detectees < essayees) {
    lignes.push('Au moins une erreur passe inaperçue : vos tests exécutent le calcul sans comparer la valeur qu\'elle fausse.');
    lignes.push('Bilan : pas encore. Dans chaque test, comparez le total HT et la TVA à vos valeurs calculées à la main.');
    return fin(false);
  }
  lignes.push('Bilan : vos tests vérifient la règle. Chaque erreur de calcul essayée fait échouer au moins un test.');
  return fin(true);
}

if (require.main === module) {
  const { lignes, ok } = verifier(process.cwd());
  console.log('Tests de exercices/tva/tva.js');
  for (const ligne of lignes) console.log(ligne);
  process.exit(ok ? 0 : 1);
}

module.exports = { verifier, ERREURS };
