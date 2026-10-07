// Fichier de la formation : ne pas modifier.
'use strict';

// Teste la recherche de produits du catalogue : GET /produits?q=<texte>.
//   npm run recherche
// Démarre l'application de df-commandes en mémoire, sur un port libre, et
// interroge l'API comme le ferait le navigateur. Ne dépend d'aucun nom de
// fonction : seul compte ce que renvoie l'adresse.

const path = require('node:path');

// SQLite est encore expérimental dans Node : on masque l'avertissement.
process.removeAllListeners('warning');

const CAS = [
  { titre: 'Catalogue complet, sans recherche', url: '/produits', attendu: 16 },
  { titre: 'Filtre par catégorie, inchangé', url: '/produits?categorie=plomberie',
    attendu: ['RACC-LAI-16', 'TUBE-PER-16'] },
  { titre: 'Recherche simple', url: '/produits?q=vis', attendu: ['VIS-INOX-6X60'] },
  { titre: 'Majuscules', url: '/produits?q=VIS', attendu: ['VIS-INOX-6X60'] },
  { titre: 'Accents : cable trouve Câble', url: '/produits?q=cable', attendu: ['CABLE-R2V-3G25'] },
  { titre: 'Accents : platre trouve plâtre', url: '/produits?q=platre', attendu: ['PLAQ-BA13'] },
  { titre: 'Recherche et catégorie ensemble', url: '/produits?q=ciment&categorie=ma%C3%A7onnerie',
    attendu: ['CIM-35'] },
  { titre: 'Catégorie respectée par la recherche', url: '/produits?q=enduit&categorie=ma%C3%A7onnerie',
    attendu: [] },
  { titre: 'Aucun résultat : liste vide', url: '/produits?q=zzz', attendu: [] },
];

function charger(fichier) {
  const chemin = path.resolve(process.cwd(), fichier);
  try {
    return require(chemin);
  } catch (erreur) {
    console.log(`${fichier} ne se charge pas : ${erreur.message.split('\n')[0]}`);
    console.log('Lancez cette commande depuis le dossier df-commandes, après npm install.');
    process.exit(1);
  }
  return null;
}

function decrire(valeur) {
  if (typeof valeur === 'number') return `${valeur} produits`;
  if (valeur.length === 0) return 'liste vide';
  return valeur.length > 4 ? `${valeur.length} produits` : valeur.join(', ');
}

async function interroger(base, url) {
  const reponse = await fetch(base + url);
  const texte = await reponse.text();
  let corps;
  try {
    corps = JSON.parse(texte);
  } catch {
    return { erreur: `réponse ${reponse.status} qui n'est pas du JSON` };
  }
  if (reponse.status !== 200) return { erreur: `statut ${reponse.status}` };
  if (!Array.isArray(corps)) return { erreur: 'la réponse n\'est pas une liste de produits' };
  return { references: corps.map((p) => p && p.reference).sort() };
}

async function main() {
  const { ouvrirBase, peupler } = charger('src/db.js');
  const { creerApp } = charger('src/app.js');
  const serveur = creerApp(peupler(ouvrirBase(), { commandes: 10 })).listen(0);
  await new Promise((ok) => serveur.once('listening', ok));
  const base = `http://127.0.0.1:${serveur.address().port}`;

  console.log('Test de la recherche de produits (GET /produits?q=...)');
  let fausses = 0;
  for (const cas of CAS) {
    const obtenu = await interroger(base, cas.url);
    let juste = false;
    let lu;
    if (obtenu.erreur) {
      lu = obtenu.erreur;
    } else if (typeof cas.attendu === 'number') {
      juste = obtenu.references.length === cas.attendu;
      lu = `${obtenu.references.length} produits`;
    } else {
      juste = obtenu.references.join(',') === [...cas.attendu].sort().join(',');
      lu = decrire(obtenu.references);
    }
    if (!juste) fausses += 1;
    console.log(`  ${juste ? 'juste' : 'FAUX '}  ${cas.titre} : ${cas.url}`);
    if (!juste) console.log(`         obtenu ${lu}, attendu ${decrire(cas.attendu)}`);
  }
  serveur.close();
  console.log(fausses === 0
    ? `Bilan : les ${CAS.length} cas sont justes.`
    : `Bilan : ${fausses} cas faux sur ${CAS.length}.`);
  process.exit(fausses === 0 ? 0 : 1);
}

main();
