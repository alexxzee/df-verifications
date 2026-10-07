// Fichier de la formation : ne pas modifier.
'use strict';

// Vérifie la page des devis du jour, GET /devis/du-jour, sur une base de test.
//   npm run devis-du-jour

const path = require('node:path');

// Le module SQLite de Node affiche un avertissement « expérimental » : on le tait.
process.removeAllListeners('warning');

function quitter(lignes) {
  for (const ligne of lignes) console.log(ligne);
  process.exit(1);
}

function charger(fichier) {
  const chemin = path.resolve(process.cwd(), fichier);
  try {
    return require(chemin);
  } catch (erreur) {
    return quitter([
      `${fichier} ne se charge pas : ${erreur.message.split('\n')[0]}`,
      'Corrigez l’erreur signalée, enregistrez (Ctrl+S), puis relancez.',
    ]);
  }
}

const { ouvrirBase, peupler } = charger('src/db.js');
const { creerApp } = charger('src/app.js');

const AUJOURDHUI = new Date().toISOString().slice(0, 10);
const HIER = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const CLIENT_SPECIAL = 'Dupont & Fils <Rénovation>';

// Base de test : les données fictives du projet, plus trois devis connus.
function baseAvecDevis() {
  const db = peupler(ouvrirBase(), { commandes: 10 });
  const { lastInsertRowid } = db
    .prepare('INSERT INTO clients (nom, ville, grand_compte) VALUES (?, ?, 0)')
    .run(CLIENT_SPECIAL, 'Lyon');
  const insDevis = db.prepare(
    'INSERT INTO devis (client_id, date, total_ht, total_ttc, detail) VALUES (?, ?, ?, ?, ?)');
  const devis = [
    [3, AUJOURDHUI, 1028.75, 1234.5],
    [Number(lastInsertRowid), AUJOURDHUI, 50, 60],
    [7, HIER, 400, 480],
  ];
  for (const [client, date, ht, ttc] of devis) {
    insDevis.run(client, date, ht, ttc, JSON.stringify({ totalHT: ht, totalTTC: ttc, lignes: [] }));
  }
  return db;
}

async function lirePage(db) {
  const serveur = creerApp(db).listen(0);
  await new Promise((resolve) => serveur.once('listening', resolve));
  try {
    const reponse = await fetch(`http://127.0.0.1:${serveur.address().port}/devis/du-jour`);
    return { statut: reponse.status, type: reponse.headers.get('content-type') || '', corps: await reponse.text() };
  } finally {
    serveur.close();
  }
}

function nomClient(db, id) {
  return db.prepare('SELECT nom FROM clients WHERE id = ?').get(id).nom;
}

async function main() {
  const db = baseAvecDevis();
  const page = await lirePage(db);
  const vide = await lirePage(peupler(ouvrirBase(), { commandes: 10 }));
  const html = page.type.includes('text/html');

  const cas = [
    {
      regle: 'GET /devis/du-jour répond 200, en HTML',
      juste: page.statut === 200 && html,
      detail: `statut ${page.statut}, type « ${page.type || 'aucun'} »`,
    },
    {
      regle: 'les clients des devis du jour sont listés',
      juste: html && page.corps.includes(nomClient(db, 3)),
      detail: `« ${nomClient(db, 3)} » attendu dans la page`,
    },
    {
      regle: 'un devis d’un autre jour n’apparaît pas',
      juste: html && !page.corps.includes(nomClient(db, 7)),
      detail: `« ${nomClient(db, 7)} » (devis de la veille) ne doit pas figurer`,
    },
    {
      regle: 'le total TTC est affiché',
      juste: html && /1[\s  .]?234[,.]50?\b/.test(page.corps),
      detail: 'un total TTC de 1234.5 attendu, sous la forme 1234,50 ou 1 234,50',
    },
    {
      regle: 'un nom de client avec < > & s’affiche tel quel',
      juste: html && page.corps.includes('&lt;Rénovation&gt;') && !page.corps.includes('<Rénovation>'),
      detail: `« ${CLIENT_SPECIAL} » doit être échappé dans le HTML, pas interprété`,
    },
    {
      regle: 'sans devis du jour, la page le dit',
      juste: vide.type.includes('text/html') && /Aucun devis aujourd['’]hui/i.test(vide.corps),
      detail: 'le texte « Aucun devis aujourd’hui » attendu sur une base sans devis',
    },
  ];

  console.log('Test de GET /devis/du-jour');
  let erreurs = 0;
  for (const { regle, juste, detail } of cas) {
    if (!juste) erreurs += 1;
    console.log(`  ${regle} : ${juste ? 'juste' : `FAUX (${detail})`}`);
  }
  console.log(erreurs === 0
    ? `Bilan : les ${cas.length} cas sont justes.`
    : `Bilan : ${erreurs} cas faux sur ${cas.length}.`);
  process.exit(erreurs === 0 ? 0 : 1);
}

main().catch((erreur) => quitter([`Erreur pendant la vérification : ${erreur.message}`]));
