// Fichier de la formation : ne pas modifier.
'use strict';

// Tests de recette de la durée de validité des devis, écrits depuis les
// décisions du métier, sans regarder le code. Lancent l'application en mémoire
// et l'interrogent par HTTP, comme un client.
// La sortie ne cite que les numéros des décisions (fiche de l'exercice) : elle
// ne révèle pas les règles à l'assistant qui lancerait la commande.
//   npm run recette

const path = require('node:path');

// Masque l'avertissement « SQLite is an experimental feature » de Node.
process.removeAllListeners('warning');

const RACINE = process.cwd();
function quitter(lignes) {
  for (const ligne of lignes) console.log(ligne);
  process.exit(1);
}

function charger(fichier) {
  try {
    return require(path.join(RACINE, fichier));
  } catch (erreur) {
    return quitter([
      `${fichier} ne se charge pas : ${erreur.message.split('\n')[0]}`,
      'Lancez npm test pour voir l\'erreur en détail, corrigez, puis relancez.',
    ]);
  }
}

// Date du jour décalée de n jours, au format AAAA-MM-JJ (UTC, comme les devis).
function jour(decalage) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + decalage);
  return date.toISOString().slice(0, 10);
}

async function main() {
  const { ouvrirBase, peupler } = charger('src/db.js');
  const { creerApp } = charger('src/app.js');
  const db = peupler(ouvrirBase(), { clients: 10, commandes: 20 });
  const ordinaire = db.prepare('SELECT id FROM clients WHERE grand_compte = 0 LIMIT 1').get().id;
  const grandCompte = db.prepare('SELECT id FROM clients WHERE grand_compte = 1 LIMIT 1').get().id;

  const serveur = creerApp(db).listen(0);
  await new Promise((resolve) => serveur.once('listening', resolve));
  const base = `http://127.0.0.1:${serveur.address().port}`;

  async function appeler(methode, chemin, corps) {
    const reponse = await fetch(base + chemin, {
      method: methode,
      headers: { 'Content-Type': 'application/json' },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
    let json = null;
    try {
      json = await reponse.json();
    } catch {
      json = null;
    }
    return { statut: reponse.status, json };
  }

  async function creerDevis(clientId, date) {
    const r = await appeler('POST', '/devis', { clientId, lignes: [{ reference: 'PARP-20', quantite: 4 }] });
    if (r.statut !== 201 || !r.json) {
      quitter([`POST /devis répond ${r.statut} au lieu de 201 : la création de devis est cassée.`,
        'Lancez npm test, corrigez, puis relancez.']);
    }
    if (date) db.prepare('UPDATE devis SET date = ? WHERE id = ?').run(date, r.json.id);
    return r;
  }

  function nbCommandes() {
    return db.prepare('SELECT COUNT(*) AS n FROM commandes').get().n;
  }

  const resultats = [];
  function noter(decisions, juste, obtenu) {
    resultats.push({ decisions, juste, obtenu });
  }
  const date = (valeur) => (valeur === undefined || valeur === null ? 'aucune date de fin de validité' : valeur);

  // 1. Création, client ordinaire : fin de validité à J+30.
  const cree = await creerDevis(ordinaire);
  noter('1 et 3', cree.json.dateFinValidite === jour(30), date(cree.json.dateFinValidite));

  // 2. Consultation du même devis.
  const lu = await appeler('GET', `/devis/${cree.json.id}`);
  noter('3', Boolean(lu.json) && lu.json.dateFinValidite === jour(30), date(lu.json && lu.json.dateFinValidite));

  // 3. Création, client grand compte : J+60.
  const gc = await creerDevis(grandCompte);
  noter('2', gc.json.dateFinValidite === jour(60), date(gc.json.dateFinValidite));

  // 4. Devis ordinaire émis il y a 30 jours : dernier jour de validité, accepté.
  const d30 = await creerDevis(ordinaire, jour(-30));
  const c30 = await appeler('POST', '/commandes', { devisId: d30.json.id });
  noter('1', c30.statut === 201, `code ${c30.statut}`);

  // 5. Devis ordinaire émis il y a 31 jours : refusé, 409, aucune commande créée.
  const d31 = await creerDevis(ordinaire, jour(-31));
  const avant = nbCommandes();
  const c31 = await appeler('POST', '/commandes', { devisId: d31.json.id });
  const message = c31.json && c31.json.erreur;
  noter('1 et 4', c31.statut === 409 && message === 'Devis expiré' && nbCommandes() === avant,
    `code ${c31.statut}, erreur ${message === undefined ? 'absente' : JSON.stringify(message)}, `
    + `${nbCommandes() - avant} commande créée`);

  // 6. Devis grand compte émis il y a 45 jours : accepté.
  const g45 = await creerDevis(grandCompte, jour(-45));
  const c45 = await appeler('POST', '/commandes', { devisId: g45.json.id });
  noter('2', c45.statut === 201, `code ${c45.statut}`);

  // 7. Devis grand compte émis il y a 61 jours : refusé.
  const g61 = await creerDevis(grandCompte, jour(-61));
  const c61 = await appeler('POST', '/commandes', { devisId: g61.json.id });
  noter('2 et 4', c61.statut === 409, `code ${c61.statut}`);

  serveur.close();

  console.log('Recette : durée de validité des devis');
  resultats.forEach((r, i) => {
    const verdict = r.juste ? 'juste' : `FAUX, obtenu : ${r.obtenu}`;
    console.log(`  Scénario ${i + 1} (décision${r.decisions.includes(' et ') ? 's' : ''} ${r.decisions}) : ${verdict}`);
  });
  const faux = resultats.filter((r) => !r.juste).length;
  console.log(faux === 0
    ? `Bilan : les ${resultats.length} scénarios sont justes.`
    : `Bilan : ${faux} scénario(s) FAUX sur ${resultats.length}. Relisez les décisions citées dans votre fiche.`);
  process.exit(faux === 0 ? 0 : 1);
}

main().catch((erreur) => quitter([`Recette interrompue : ${erreur.message}`]));
