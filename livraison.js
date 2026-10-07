// Fichier de la formation : ne pas modifier.
'use strict';

// Vérifie l'estimateur de frais de livraison créé par l'agent, contre le cahier
// des charges, sans rien savoir de son code : il lance « npm start » dans le
// dossier courant, sur un port libre, puis interroge l'application.
//   node ../df-verifications/livraison.js      (depuis le dossier frais-livraison)

const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const FRAIS = [
  { titre: 'Zone proche, 5 kg', poids: '5', cp: '69003', attendu: 8 },
  { titre: 'Zone proche, 10 kg tout rond', poids: '10', cp: '69003', attendu: 8 },
  { titre: 'Zone proche, 10,2 kg', poids: '10.2', cp: '69003', attendu: 8.5 },
  { titre: 'Zone proche, 12 kg', poids: '12', cp: '38000', attendu: 9 },
  { titre: 'Autre zone, 5 kg', poids: '5', cp: '75011', attendu: 15 },
  { titre: 'Autre zone, 25,5 kg', poids: '25.5', cp: '13001', attendu: 29.4 },
  { titre: 'Zone proche, 1000 kg', poids: '1000', cp: '74000', attendu: 503 },
];

const REFUS = [
  { titre: 'Poids nul', requete: 'poids=0&cp=69003' },
  { titre: 'Poids négatif', requete: 'poids=-3&cp=69003' },
  { titre: 'Poids qui n\'est pas un nombre', requete: 'poids=abc&cp=69003' },
  { titre: 'Poids au-delà de 1000 kg', requete: 'poids=1001&cp=69003' },
  { titre: 'Poids absent', requete: 'cp=69003' },
  { titre: 'Code postal de 4 chiffres', requete: 'poids=5&cp=6900' },
  { titre: 'Code postal en lettres', requete: 'poids=5&cp=ABCDE' },
];

function portLibre() {
  return new Promise((ok) => {
    const s = net.createServer().listen(0, () => {
      const { port } = s.address();
      s.close(() => ok(port));
    });
  });
}

function arreter(enfant) {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(enfant.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try { process.kill(-enfant.pid, 'SIGTERM'); } catch { /* déjà arrêté */ }
  }
}

async function attendre(base, enfant) {
  for (let i = 0; i < 60; i++) {
    if (enfant.exitCode !== null) return false;
    try {
      await fetch(base + '/');
      return true;
    } catch {
      await new Promise((ok) => setTimeout(ok, 250));
    }
  }
  return false;
}

function lirePackage() {
  const chemin = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(chemin)) return null;
  try {
    return JSON.parse(fs.readFileSync(chemin, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const pkg = lirePackage();
  if (!pkg) {
    console.log('Pas de package.json lisible ici : lancez cette commande depuis le dossier');
    console.log('de l\'application (frais-livraison), une fois l\'agent arrivé au bout.');
    process.exit(1);
  }
  console.log(`Vérification de l'application du dossier ${path.basename(process.cwd())}`);
  let fautes = 0;

  const dependances = Object.keys(pkg.dependencies || {});
  const juste = dependances.length === 0;
  if (!juste) fautes += 1;
  console.log(`  ${juste ? 'juste' : 'FAUX '}  Aucune dépendance externe : `
    + (juste ? 'aucune' : dependances.join(', ')));

  const port = await portLibre();
  const base = `http://127.0.0.1:${port}`;
  const win = process.platform === 'win32';
  const enfant = spawn(win ? 'npm.cmd' : 'npm', ['start'], {
    env: { ...process.env, PORT: String(port) }, shell: win, detached: !win, stdio: 'ignore',
  });
  const demarre = await attendre(base, enfant);
  console.log(`  ${demarre ? 'juste' : 'FAUX '}  npm start répond sur le port de la variable PORT`);
  if (!demarre) {
    arreter(enfant);
    console.log('Bilan : l\'application ne démarre pas, ou pas sur le port demandé.');
    console.log('Lancez npm start vous-même pour lire le message d\'erreur.');
    process.exit(1);
  }

  try {
    const page = await fetch(base + '/');
    const html = await page.text();
    const ok = page.status === 200 && /<form/i.test(html);
    if (!ok) fautes += 1;
    console.log(`  ${ok ? 'juste' : 'FAUX '}  Page d'accueil avec un formulaire`);

    for (const cas of FRAIS) {
      const r = await fetch(`${base}/api/frais?poids=${cas.poids}&cp=${cas.cp}`);
      let lu;
      try { lu = (await r.json()).frais; } catch { lu = undefined; }
      const bon = r.status === 200 && typeof lu === 'number' && Math.abs(lu - cas.attendu) < 0.001;
      if (!bon) fautes += 1;
      console.log(`  ${bon ? 'juste' : 'FAUX '}  ${cas.titre} (cp ${cas.cp})`);
      if (!bon) console.log(`         obtenu ${r.status} ${JSON.stringify(lu)}, attendu 200 ${cas.attendu}`);
    }

    for (const cas of REFUS) {
      const r = await fetch(`${base}/api/frais?${cas.requete}`);
      let corps;
      try { corps = await r.json(); } catch { corps = {}; }
      const bon = r.status === 400 && typeof corps.erreur === 'string';
      if (!bon) fautes += 1;
      console.log(`  ${bon ? 'juste' : 'FAUX '}  Refus : ${cas.titre}`);
      if (!bon) console.log(`         obtenu statut ${r.status}, attendu 400 et un champ erreur`);
    }
  } finally {
    arreter(enfant);
  }

  const total = 3 + FRAIS.length + REFUS.length;
  console.log(fautes === 0
    ? `Bilan : les ${total} contrôles sont justes.`
    : `Bilan : ${fautes} contrôles faux sur ${total}.`);
  process.exit(fautes === 0 ? 0 : 1);
}

main();
