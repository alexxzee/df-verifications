// Fichier de la formation : ne pas modifier.
'use strict';

// Repart de l'état prêt d'une étape, dans le dossier courant (df-commandes).
//   npm run reprise -- ch07
// Les fichiers du dossier deviennent ceux de l'état prêt (travail en cours
// remplacé, c'est voulu) ; l'historique ne bouge pas : git diff montre l'écart
// avec le dernier commit, comme si l'étape avait été faite à la main.

const { spawnSync } = require('node:child_process');

const DEPOT = 'https://github.com/alexxzee/df-commandes-reprises.git';
const ETAPES = ['tp2', 'ch03', 'tp3', 'ch06', 'ch07', 'ch08', 'ch09'];

function commandes(etape) {
  if (!ETAPES.includes(etape)) {
    throw new Error(`Étape inconnue : ${etape}. Étapes : ${ETAPES.join(', ')}`);
  }
  return [
    ['git', ['fetch', '--depth=1', DEPOT, `reprise/${etape}`]],
    ['git', ['read-tree', '-u', '--reset', 'FETCH_HEAD']],
    ['git', ['clean', '-fdq']],
    ['git', ['reset', '-q']],
  ];
}

if (require.main === module) {
  let liste;
  try {
    liste = commandes(process.argv[2]);
  } catch (erreur) {
    console.log(erreur.message);
    process.exit(1);
  }
  for (const [programme, args] of liste) {
    const resultat = spawnSync(programme, args, { stdio: 'inherit' });
    if (resultat.status !== 0) process.exit(resultat.status ?? 1);
  }
  console.log(`Reprise ${process.argv[2]} posée. Lancez npm install puis npm test.`);
}

module.exports = { commandes, ETAPES };
