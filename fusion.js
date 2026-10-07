// Fichier de la formation : ne pas modifier.
'use strict';

// Vérifie la grille de décision du micro-exercice du ch04, docs/decision-fusion.md :
// les portiques 2 et 4 remplis avec leur preuve, et un verdict cohérent.
//   npm run fusion

const fs = require('node:fs');
const path = require('node:path');

const FICHIER = 'docs/decision-fusion.md';
const chemin = path.resolve(process.cwd(), FICHIER);
if (!fs.existsSync(chemin)) {
  console.log(`Fichier ${FICHIER} introuvable : vérifiez que vous êtes dans df-commandes.`);
  process.exit(1);
}
const lignes = fs.readFileSync(chemin, 'utf8').split(/\r?\n/);

let problemes = 0;
function probleme(...textes) {
  problemes += 1;
  for (const texte of textes) console.log(`   ${texte}`);
}

// Cellules d'une ligne de tableau « | 2. … | oui | preuve | ».
function portique(numero) {
  const ligne = lignes.find((l) => l.trim().startsWith(`| ${numero}.`));
  if (!ligne) return null;
  const cellules = ligne.split('|').slice(1, -1).map((c) => c.trim());
  return { reponse: (cellules[1] || '').toLowerCase(), preuve: cellules[2] || '' };
}

console.log(`Décision de fusion : ${FICHIER}`);

const p2 = portique(2);
console.log(`2. Lint et tests : ${p2 && p2.reponse ? p2.reponse : 'à remplir'}`);
if (!p2) probleme('La ligne du portique 2 a disparu : recollez la grille d’origine.');
else if (!p2.reponse) probleme('Répondez oui ou non, d’après ce qu’affiche npm run proposition.');
else if (p2.reponse !== 'oui') probleme('Relancez npm run proposition : relisez les lignes ℹ fail et les alertes d’ESLint.');
else if (!p2.preuve) probleme('Ajoutez la preuve : la ligne de sortie qui le montre.');

const p4 = portique(4);
console.log(`4. Dépendances : ${p4 && p4.reponse ? p4.reponse : 'à remplir'}`);
if (!p4) probleme('La ligne du portique 4 a disparu : recollez la grille d’origine.');
else if (!p4.reponse) probleme('Répondez oui ou non, après avoir cherché chaque paquet proposé avec npm view.');
else if (p4.reponse !== 'non') {
  probleme('Chaque paquet que recommande le message de l’assistant est-il dans le registre ?',
    'Lancez npm view sur son nom et lisez la première ligne de la réponse.');
} else if (!/404|introuvable|n.existe|not found/i.test(p4.preuve)) {
  probleme('Ajoutez la preuve : ce qu’a répondu npm view (le code d’erreur suffit).');
}

const indice = lignes.findIndex((l) => l.startsWith('Verdict'));
const verdict = indice === -1 ? '' : lignes.slice(indice).join(' ').replace(/^Verdict[^:]*:/, '').trim();
console.log(`Verdict : ${verdict || 'à remplir'}`);
if (indice === -1) probleme('La ligne « Verdict » a disparu : recollez la grille d’origine.');
else if (!verdict) probleme('Écrivez votre verdict après les deux-points.');
else if (!/corrig|refus/i.test(verdict)) probleme('Un seul non suffit : relisez les réponses de la grille avant de conclure.');

console.log(problemes === 0
  ? 'Bilan : grille cohérente. Comparez votre verdict au corrigé après l’exercice.'
  : `Bilan : ${problemes} point(s) à reprendre, détaillés ci-dessus.`);
process.exit(problemes === 0 ? 0 : 1);
