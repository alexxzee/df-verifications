// Fichier de la formation : ne pas modifier.
'use strict';

// Vérifie la grille des cinq failles du micro-exercice du ch04, docs/failles.md,
// sur le fichier exercices/failles/import-clients.js.
// Chaque faille est retrouvée dans le fichier par son motif : les numéros de
// ligne ne sont écrits nulle part. La sortie donne le nombre de failles
// trouvées et les catégories manquantes, jamais une ligne.
//   npm run failles

const fs = require('node:fs');
const path = require('node:path');

const GRILLE = 'docs/failles.md';
const FICHIER = 'exercices/failles/import-clients.js';

// Catégorie, mots qui la reconnaissent dans la grille (sans accents, en
// minuscules), motif de la ligne fautive dans le fichier.
const FAILLES = [
  { nom: 'Secret en dur', mots: /secret|mot de passe|en dur/, motif: /^const MOT_DE_PASSE = '/ },
  { nom: 'Requête construite à la main', mots: /requete|injection|sql/, motif: /db\.prepare\(`SELECT/ },
  { nom: 'Exécution de donnée', mots: /execution|eval/, motif: /\beval\(/ },
  { nom: 'Vérification désactivée', mots: /verification|tls|certificat/, motif: /rejectUnauthorized: false/ },
  { nom: 'Journal trop bavard', mots: /journal|log/, motif: /console\.log\(.*MOT_DE_PASSE/ },
];

function normaliser(texte) {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Numéro de ligne (à partir de 1) de chaque faille, ou null si son motif manque.
function lignesFautives(source) {
  const lignes = source.split(/\r?\n/);
  return FAILLES.map((faille) => {
    const indice = lignes.findIndex((ligne) => faille.motif.test(ligne.trim()));
    return indice === -1 ? null : indice + 1;
  });
}

// Lignes du tableau dont la première cellule est un nombre : { ligne, categorie }.
function lireGrille(texte) {
  return texte.split(/\r?\n/)
    .filter((l) => l.trim().startsWith('|'))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim().replace(/`/g, '')))
    .filter((cellules) => /^\d+$/.test(cellules[0] || ''))
    .map((cellules) => ({ ligne: Number(cellules[0]), categorie: cellules[1] || '' }));
}

// Indice de la catégorie reconnue, -1 si aucune ou plusieurs.
function categorie(texte) {
  const t = normaliser(texte);
  const trouvees = FAILLES.map((f, i) => (f.mots.test(t) ? i : -1)).filter((i) => i !== -1);
  return trouvees.length === 1 ? trouvees[0] : -1;
}

function verifier(racine) {
  const lignes = [];
  const fin = (ok) => ({ ok, lignes });
  const cheminFichier = path.join(racine, FICHIER);
  const cheminGrille = path.join(racine, GRILLE);
  if (!fs.existsSync(cheminFichier)) {
    lignes.push(`Fichier ${FICHIER} introuvable : il fait partie du dépôt. Récupérez-le avec git restore ${FICHIER}.`);
    return fin(false);
  }
  if (!fs.existsSync(cheminGrille)) {
    lignes.push(`Fichier ${GRILLE} introuvable : il fait partie du dépôt. Récupérez-le avec git restore ${GRILLE}.`);
    return fin(false);
  }
  const fautives = lignesFautives(fs.readFileSync(cheminFichier, 'utf8'));
  if (fautives.includes(null)) {
    lignes.push(`${FICHIER} a été modifié : la grille se pose sur le fichier d'origine.`);
    lignes.push(`Remettez-le dans son état de départ (git restore ${FICHIER}), puis relancez.`);
    return fin(false);
  }
  const notees = lireGrille(fs.readFileSync(cheminGrille, 'utf8'));
  lignes.push(`Lignes notées dans la grille : ${notees.length}.`);
  if (notees.length === 0) {
    lignes.push('Écrivez une ligne du tableau par faille : le numéro de ligne, puis la catégorie.');
    lignes.push('Bilan : pas encore. Failles trouvées : 0 sur 5.');
    return fin(false);
  }
  const trouvees = new Set();
  let inconnues = 0;
  let sansFaille = 0;
  for (const { ligne, categorie: texte } of notees) {
    const indice = categorie(texte);
    if (indice === -1) inconnues += 1;
    else if (fautives[indice] === ligne) trouvees.add(indice);
    else sansFaille += 1;
  }
  lignes.push(`Failles trouvées : ${trouvees.size} sur 5.`);
  const manquantes = FAILLES.filter((_, i) => !trouvees.has(i)).map((f) => f.nom);
  if (manquantes.length > 0) lignes.push(`Catégories manquantes : ${manquantes.join(', ')}.`);
  if (inconnues > 0) {
    lignes.push(`Catégorie non reconnue sur ${inconnues} ligne(s) de la grille : recopiez l'une des cinq telle quelle.`);
  }
  if (sansFaille > 0) {
    lignes.push(`Lignes notées qui ne portent pas la faille de leur catégorie : ${sansFaille}. Relisez-les, la grille sous les yeux.`);
  }
  if (trouvees.size < 5) {
    lignes.push('Bilan : pas encore. Relisez le fichier en cherchant les catégories manquantes.');
    return fin(false);
  }
  lignes.push('Bilan : grille complète. Les cinq failles sont trouvées, chacune à sa ligne et dans sa catégorie.');
  return fin(true);
}

if (require.main === module) {
  const { lignes, ok } = verifier(process.cwd());
  console.log(`Grille des cinq failles : ${GRILLE}`);
  for (const ligne of lignes) console.log(ligne);
  process.exit(ok ? 0 : 1);
}

module.exports = { verifier, FAILLES };
