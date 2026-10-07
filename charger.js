// Fichier de la formation : ne pas modifier.
'use strict';

// Charge le fichier du participant et en extrait une fonction, avec un message
// clair si le fichier manque, ne se charge pas ou n'exporte rien.

const path = require('node:path');

function quitter(lignes) {
  for (const ligne of lignes) console.log(ligne);
  process.exit(1);
}

// fichier : chemin relatif à la racine de df-commandes (dossier courant de npm).
// nom : nom de fonction attendu, ou null pour prendre la première fonction exportée.
function chargerFonction(fichier, nom) {
  const chemin = path.resolve(process.cwd(), fichier);
  let module;
  try {
    delete require.cache[chemin];
    module = require(chemin);
  } catch (erreur) {
    if (erreur.code === 'MODULE_NOT_FOUND' && erreur.message.includes(chemin)) {
      quitter([`Fichier ${fichier} introuvable : vérifiez son nom et son dossier, puis relancez.`]);
    }
    quitter([
      `${fichier} ne se charge pas : ${erreur.message.split('\n')[0]}`,
      'Vérifiez que le fichier contient du JavaScript complet (CommonJS, avec require et module.exports),',
      'enregistrez-le (Ctrl+S), puis relancez.',
    ]);
  }
  const fonctions = Object.keys(module).filter((cle) => typeof module[cle] === 'function');
  if (nom === null && fonctions.length > 0) return { nom: fonctions[0], fonction: module[fonctions[0]] };
  if (nom !== null && typeof module[nom] === 'function') return { nom, fonction: module[nom] };
  const attendu = nom === null ? 'nomDeVotreFonction' : nom;
  quitter([
    fonctions.length === 0 && Object.keys(module).length === 0
      ? `${fichier} est vide ou n'exporte rien. Collez-y votre fonction, puis ajoutez à la fin du fichier :`
      : `${fichier} n'exporte pas ${attendu} : ajoutez à la fin du fichier`,
    `module.exports = { ${attendu} };`,
  ]);
  return null;
}

module.exports = { chargerFonction };
