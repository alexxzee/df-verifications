// Fichier de la formation : ne pas modifier.
'use strict';

// Vérifie la consigne de délégation du micro-exercice du ch08,
// docs/consigne-delegation.md : elle doit se lire sans la conversation.
//   1. cinq rubriques, chacune remplie ;
//   2. dans « Fichiers autorisés », au moins un fichier qui existe dans le dépôt ;
//   3. dans « Vérification », une commande npm du package.json ;
//   4. aucun renvoi à la conversation (« plus haut », « comme convenu »…).
//   npm run consigne

const fs = require('node:fs');
const path = require('node:path');

const FICHIER = 'docs/consigne-delegation.md';

// Nom affiché, et motif du libellé (texte sans accents, en minuscules).
const RUBRIQUES = [
  { nom: 'Objectif', motif: /^objectif/ },
  { nom: 'Fichiers autorisés', motif: /^fichiers?( autorises?)?$/ },
  { nom: 'Critères', motif: /^criteres?( d.acceptation| de reussite)?$/ },
  { nom: 'Vérification', motif: /^(verification|validation)$/ },
  { nom: 'À rendre', motif: /^(a rendre|rendu|livrable)$/ },
];

const RENVOIS = ['plus haut', 'comme convenu', 'ci-dessus', 'comme d\'habitude', 'comme avant',
  'comme discute', 'comme on a dit', 'precedemment', 'la conversation precedente'];

const MOTS_MINIMUM = 2;

function normaliser(texte) {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’`]/g, '\'');
}

// Libellé de rubrique en début de ligne : « ## Objectif », « **Objectif :** », « - Objectif : … ».
// Renvoie { indice, reste } ou null.
function libelle(ligne) {
  const m = ligne.match(/^\s*(?:#{1,6}\s*|[-*]\s+)?(?:\*\*|__)?([^:*_#]{3,40}?)\s*(?::\s*(?:\*\*|__)?|(?:\*\*|__)\s*:?|$)(.*)$/);
  if (!m) return null;
  const titre = normaliser(m[1].trim());
  const indice = RUBRIQUES.findIndex((r) => r.motif.test(titre));
  if (indice === -1) return null;
  const aDeuxPoints = /:/.test(ligne.slice(0, ligne.length - m[2].length));
  const estTitre = /^\s*#/.test(ligne);
  if (!aDeuxPoints && !estTitre) return null;
  return { indice, reste: m[2] };
}

// Contenu de chaque rubrique : texte entre son libellé et le libellé suivant.
function decouper(texte) {
  const contenus = RUBRIQUES.map(() => null);
  let courante = -1;
  for (const ligne of texte.split(/\r?\n/)) {
    const l = libelle(ligne);
    if (l) {
      courante = l.indice;
      contenus[courante] = (contenus[courante] || '') + l.reste + '\n';
    } else if (courante !== -1) {
      contenus[courante] += ligne + '\n';
    }
  }
  return contenus;
}

function mots(texte) {
  return (texte || '').split(/\s+/).filter((m) => /\w/.test(m)).length;
}

function chemins(texte) {
  const trouves = (texte || '').replace(/`/g, ' ').match(/[\w.-]+(?:\/[\w.-]+)*\.(?:js|json|md|csv|txt|py)\b/g) || [];
  return [...new Set(trouves)];
}

function commandes(texte) {
  const trouves = [];
  for (const m of (texte || '').matchAll(/\bnpm\s+(?:run\s+([\w:-]+)|(test)\b)/g)) trouves.push(m[1] || m[2]);
  return [...new Set(trouves)];
}

function verifier(racine) {
  const lignes = [];
  const fin = (ok) => ({ ok, lignes });
  const chemin = path.join(racine, FICHIER);
  if (!fs.existsSync(chemin)) {
    lignes.push(`Fichier ${FICHIER} introuvable : il fait partie du dépôt. Récupérez-le avec git restore ${FICHIER}.`);
    return fin(false);
  }
  const texte = fs.readFileSync(chemin, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  let scripts = {};
  try {
    scripts = JSON.parse(fs.readFileSync(path.join(racine, 'package.json'), 'utf8')).scripts || {};
  } catch {
    scripts = {};
  }
  let problemes = 0;
  const contenus = decouper(texte);

  const presentes = RUBRIQUES.filter((_, i) => mots(contenus[i]) >= MOTS_MINIMUM).map((r) => r.nom);
  const absentes = RUBRIQUES.filter((_, i) => contenus[i] === null).map((r) => r.nom);
  const vides = RUBRIQUES.filter((_, i) => contenus[i] !== null && mots(contenus[i]) < MOTS_MINIMUM).map((r) => r.nom);
  lignes.push(`Rubriques remplies : ${presentes.length} sur 5.`);
  if (absentes.length > 0) {
    problemes += 1;
    lignes.push(`   Manquantes : ${absentes.join(', ')}. Une rubrique commence une ligne par son nom suivi de deux-points.`);
  }
  if (vides.length > 0) {
    problemes += 1;
    lignes.push(`   Trop courtes (moins de ${MOTS_MINIMUM} mots) : ${vides.join(', ')}.`);
  }

  // La consigne porte sur la fiche client : une consigne d'une autre tâche
  // (l'exemple de la fiche, recopié) ne passe pas.
  if (contenus[0] !== null && !/client/.test(normaliser(contenus[0]))) {
    problemes += 1;
    lignes.push('   L’objectif ne parle pas du client : la consigne porte sur la fiche client.');
  }

  const normal = normaliser(texte);
  const renvois = RENVOIS.filter((r) => normal.includes(normaliser(r)));
  if (renvois.length > 0) {
    problemes += 1;
    lignes.push(`Renvoi à la conversation : ${renvois.map((r) => `« ${r} »`).join(', ')}.`);
    lignes.push('   Le sous-agent ne voit pas la conversation : écrivez l’information elle-même.');
  } else {
    lignes.push('Renvoi à la conversation : aucun.');
  }

  const fichiers = chemins(contenus[1]);
  const existants = fichiers.filter((f) => fs.existsSync(path.join(racine, f)));
  const nouveaux = fichiers.filter((f) => !existants.includes(f));
  lignes.push(`Fichiers du dépôt nommés dans « Fichiers autorisés » : ${existants.length}.`);
  if (existants.length === 0) {
    problemes += 1;
    lignes.push('   Nommez par son chemin depuis la racine au moins un fichier existant que le sous-agent peut modifier.');
  }
  if (nouveaux.length > 0) {
    lignes.push(`   Absents du dépôt : ${nouveaux.join(', ')}. S’ils sont à créer, vérifiez que la consigne le dit.`);
  }

  const cmds = commandes(contenus[3]);
  const connues = cmds.filter((c) => Object.hasOwn(scripts, c));
  lignes.push(`Commandes du projet dans « Vérification » : ${connues.length}.`);
  if (connues.length === 0) {
    problemes += 1;
    lignes.push('   Donnez une commande npm du package.json (npm test, npm run …) qui prouve le résultat.');
  }
  const inconnues = cmds.filter((c) => !connues.includes(c));
  if (inconnues.length > 0) lignes.push(`   Absentes du package.json : ${inconnues.join(', ')}.`);

  if (problemes > 0) {
    lignes.push(`Bilan : pas encore. ${problemes} point(s) à reprendre, détaillés ci-dessus.`);
    return fin(false);
  }
  lignes.push('Bilan : la consigne se suffit. Un agent qui ne voit qu’elle sait quoi faire, où, et comment le prouver.');
  return fin(true);
}

if (require.main === module) {
  const { lignes, ok } = verifier(process.cwd());
  console.log(`Consigne de délégation : ${FICHIER}`);
  for (const ligne of lignes) console.log(ligne);
  process.exit(ok ? 0 : 1);
}

module.exports = { verifier, RUBRIQUES, RENVOIS };
