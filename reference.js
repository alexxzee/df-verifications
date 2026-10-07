// Fichier de la formation : ne pas modifier.
'use strict';

// Teste la fonction de validation de référence produit, quel que soit son nom.
//   npm run reference                              -> src/validation/reference.js
//   npm run reference -- src/validation/essai.js   -> un autre fichier

const { chargerFonction } = require('./charger');

const FICHIER = process.argv[2] || 'src/validation/reference.js';

const CAS = [
  { reference: 'VIS-INOX-6X60', attendu: true, regle: 'trois segments valides' },
  { reference: 'PARP-20', attendu: true, regle: 'deux segments valides' },
  { reference: 'A-B', attendu: true, regle: 'deux segments, le minimum' },
  { reference: 'ABCDEFGHIJ-ABCDEFGHI', attendu: true, regle: '20 caractères, la limite' },
  { reference: 'VIS', attendu: false, regle: 'un seul segment' },
  { reference: 'A-B-C-D-E', attendu: false, regle: 'cinq segments' },
  { reference: 'vis-inox', attendu: false, regle: 'minuscules' },
  { reference: 'VIS--60', attendu: false, regle: 'segment vide' },
  { reference: 'ABCDEFGHIJ-ABCDEFGHIJ', attendu: false, regle: '21 caractères' },
];

const { nom, fonction } = chargerFonction(FICHIER, null);

console.log(`Test de ${nom} (${FICHIER})`);
let erreurs = 0;
for (const { reference, attendu, regle } of CAS) {
  let obtenu;
  try {
    obtenu = fonction(reference);
  } catch (erreur) {
    obtenu = `erreur « ${erreur.message} »`;
  }
  const juste = obtenu === attendu;
  if (!juste) erreurs += 1;
  console.log(`  ${reference} (${regle}) -> ${obtenu}, attendu ${attendu} : ${juste ? 'juste' : 'FAUX'}`);
}
console.log(erreurs === 0
  ? `Bilan : les ${CAS.length} cas sont justes.`
  : `Bilan : ${erreurs} cas faux sur ${CAS.length}.`);
