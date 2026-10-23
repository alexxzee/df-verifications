// Fichier de la formation : ne pas modifier.
'use strict';

// Vérifie le ticket anonymisé du micro-exercice du ch05 : plus aucune donnée
// personnelle du ticket d'origine, la clé d'API du journal masquée (début
// gardé, valeur cachée), et toutes les informations utiles au diagnostic
// encore présentes.
//   npm run anonymat                       (exercices/confidentialite/ticket-anonymise.txt)
//   npm run anonymat -- <autre fichier>

const fs = require('node:fs');
const path = require('node:path');

const FICHIER = process.argv[2] || 'exercices/confidentialite/ticket-anonymise.txt';

// Chaque donnée personnelle du ticket d'origine, avec ses fragments reconnaissables.
const PERSONNELLES = [
  ['Nadia', 'Ferrand'],
  ['n.ferrand', 'renov-alpes-12.example'],
  ['Rénov Alpes', 'Renov Alpes'],
  ['Tanneurs', '73000'],
  ['C-00412', '00412'],
];

// Valeur de la clé d'API fictive collée dans le journal : deux fragments
// suffisent à la reconnaître, même tronquée.
const SECRET = ['9Tq4Wm2X', 'Lb5Rz8Kd'];

// Informations dont le diagnostic a besoin, et comment les nommer si elles manquent.
const UTILES = [
  ['D-2026-0412', 'le numéro du devis (D-2026-0412)'],
  ['VIS-INOX-6X60', 'la référence du produit (VIS-INOX-6X60)'],
  ['10 boîtes', 'la quantité commandée (10 boîtes)'],
  ['18,90', 'le prix unitaire (18,90 € HT)'],
  ['5 %', 'la remise attendue (5 %)'],
  ['401', 'le code d’erreur du journal (401)'],
  ['dfc_live_', 'le début de la clé (dfc_live_)'],
];

const chemin = path.resolve(process.cwd(), FICHIER);
if (!fs.existsSync(chemin)) {
  console.log(`Fichier ${FICHIER} introuvable : vérifiez son nom et son dossier, puis relancez.`);
  process.exit(1);
}
const lignes = fs.readFileSync(chemin, 'utf8').replace(/[  ]/g, ' ').split(/\r?\n/);
const texte = lignes.join('\n');
const minuscules = texte.toLowerCase();

const presentes = PERSONNELLES.filter((fragments) =>
  fragments.some((f) => minuscules.includes(f.toLowerCase())));
const numeros = new Set();
lignes.forEach((ligne, i) => {
  const l = ligne.toLowerCase();
  if (PERSONNELLES.some((fragments) => fragments.some((f) => l.includes(f.toLowerCase())))) numeros.add(i + 1);
});
const lignesSecret = [];
lignes.forEach((ligne, i) => {
  if (SECRET.some((f) => ligne.includes(f))) lignesSecret.push(i + 1);
});
const manquantes = UTILES.filter(([marque]) => !texte.includes(marque));

console.log(`Ticket vérifié : ${FICHIER}`);
if (presentes.length === 0 && lignesSecret.length === 0 && manquantes.length === UTILES.length) {
  console.log('Le fichier ne contient pas encore le ticket : collez-y le texte de ticket-brut.txt,');
  console.log('enregistrez (Ctrl+S), puis relancez.');
  process.exit(1);
}

console.log(`1. Données personnelles encore présentes : ${presentes.length}`);
if (presentes.length > 0) {
  console.log(`   Lignes à revoir : ${[...numeros].join(', ')}`);
}
console.log(`2. Clé d’API encore lisible : ${lignesSecret.length > 0 ? `oui, ligne ${lignesSecret.join(', ')}` : 'non'}`);
console.log(`3. Informations utiles au diagnostic : ${UTILES.length - manquantes.length} sur ${UTILES.length}`);
for (const [, nom] of manquantes) console.log(`   Information perdue : ${nom}. Remettez-la : le diagnostic en a besoin.`);

if (presentes.length === 0 && lignesSecret.length === 0 && manquantes.length === 0) {
  console.log('Bilan : prêt à envoyer. Plus aucune donnée personnelle ni clé lisible, rien d’utile perdu.');
  process.exit(0);
}
if (presentes.length > 0) {
  console.log('Bilan : ne l’envoyez pas encore. Remplacez chaque donnée personnelle par une étiquette.');
} else if (lignesSecret.length > 0) {
  console.log('Bilan : ne l’envoyez pas encore. Masquez la valeur de la clé, gardez son début.');
} else {
  console.log('Bilan : ne l’envoyez pas encore. L’anonymisation a effacé une information utile.');
}
process.exit(1);
