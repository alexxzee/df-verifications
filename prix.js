// Fichier de la formation : ne pas modifier.
'use strict';

// Teste formaterPrix (src/utils/format.js) : trois montants, puis un montant invalide.
//   npm run prix

const { chargerFonction } = require('./charger');

const FICHIER = 'src/utils/format.js';

const CAS = [
  { montant: 12.5, attendu: '12,50 €' },
  { montant: 0, attendu: '0,00 €' },
  { montant: 1234.5, attendu: '1 234,50 €' },
];

// Intl.NumberFormat place des espaces insécables : on les compare comme des espaces ordinaires.
function espacesOrdinaires(texte) {
  return String(texte).replace(/[  ]/g, ' ');
}

const { fonction: formaterPrix } = chargerFonction(FICHIER, 'formaterPrix');

console.log(`Test de formaterPrix (${FICHIER})`);
let erreurs = 0;
for (const { montant, attendu } of CAS) {
  let obtenu;
  try {
    obtenu = espacesOrdinaires(formaterPrix(montant));
  } catch (erreur) {
    obtenu = `erreur « ${erreur.message} »`;
  }
  const juste = obtenu === attendu;
  if (!juste) erreurs += 1;
  console.log(`  ${montant} -> ${obtenu}, attendu ${attendu} : ${juste ? 'juste' : 'FAUX'}`);
}
console.log(erreurs === 0 ? 'Bilan : les 3 prix sont justes.' : `Bilan : ${erreurs} prix faux sur 3.`);

let refuse = false;
let renvoye;
try {
  renvoye = formaterPrix('abc');
} catch {
  refuse = true;
}
console.log(refuse
  ? "Montant invalide 'abc' : refusé par une erreur. Étape 3 faite."
  : `Montant invalide 'abc' : renvoie ${espacesOrdinaires(renvoye)}, pas encore refusé (étape 3).`);
