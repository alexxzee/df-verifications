// Fichier de la formation : ne pas modifier.
'use strict';

// Teste une fonction d'arrondi au centime sur trois montants délicats.
//   npm run arrondi         -> arrondirAuCentime, dans src/utils/arrondi.js
//   npm run arrondi:appli   -> arrondir, la fonction de l'application (src/devis/calcul.js)

const { chargerFonction } = require('./charger');

const CAS = [
  { montant: 1.005, attendu: 1.01 },
  { montant: 1.255, attendu: 1.26 },
  { montant: 10.075, attendu: 10.08 },
];

function euros(valeur) {
  return `${String(valeur).replace('.', ',')} €`;
}

const appli = process.argv[2] === 'appli';
const fichier = appli ? 'src/devis/calcul.js' : 'src/utils/arrondi.js';
const { nom, fonction } = chargerFonction(fichier, appli ? 'arrondir' : 'arrondirAuCentime');

console.log(`Test de ${nom} (${fichier})`);
let erreurs = 0;
for (const { montant, attendu } of CAS) {
  let obtenu;
  try {
    obtenu = fonction(montant);
  } catch (erreur) {
    obtenu = `erreur « ${erreur.message} »`;
  }
  const juste = obtenu === attendu;
  if (!juste) erreurs += 1;
  console.log(`  ${euros(montant)} -> ${euros(obtenu)}, attendu ${euros(attendu)} : ${juste ? 'juste' : 'FAUX'}`);
}
console.log(erreurs === 0 ? 'Bilan : les 3 arrondis sont justes.' : `Bilan : ${erreurs} arrondi(s) faux sur 3.`);
