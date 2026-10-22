// Fichier de la formation : ne pas modifier.
'use strict';

// Vérifie le hook du micro-exercice du ch07, sans l'agent : lit la configuration
// de chaque outil dans df-commandes, lance la commande déclarée avec une action
// simulée au format de l'outil, et dit si l'action est refusée ou acceptée.
//   npm run hook
// Attendu : modifier src/config.js est refusé, par l'outil d'édition comme par
// le terminal ; modifier un autre fichier est accepté.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PROTEGE = 'src/config.js';
const AUTRE = 'README.md';
const COMMANDE_TERMINAL = "sed -i 's#transporteur-fictif#transporteur-test#' src/config.js";

function patch(fichier) {
  return [
    '*** Begin Patch',
    `*** Update File: ${fichier}`,
    '@@',
    "-    url: 'https://api.transporteur-fictif.example/v2',",
    "+    url: 'https://api.transporteur-test.example/v2',",
    '*** End Patch',
  ].join('\n');
}

// Les trois actions simulées, au format de chaque outil.
function evenementsClaude(racine) {
  const base = { session_id: 'simulation', hook_event_name: 'PreToolUse', cwd: racine };
  const edition = (fichier) => ({
    ...base,
    tool_name: 'Edit',
    tool_input: { file_path: path.join(racine, fichier), old_string: 'transporteur-fictif', new_string: 'transporteur-test' },
  });
  return [
    { action: `modifier ${PROTEGE} (outil Edit)`, attendu: 'refus', evenement: edition(PROTEGE) },
    { action: `écrire ${PROTEGE} par le terminal (outil Bash)`, attendu: 'refus', evenement: { ...base, tool_name: 'Bash', tool_input: { command: COMMANDE_TERMINAL } } },
    { action: `modifier ${AUTRE} (outil Edit)`, attendu: 'passage', evenement: edition(AUTRE) },
  ];
}

function evenementsCodex(racine) {
  const base = { session_id: 'simulation', hook_event_name: 'PreToolUse', cwd: racine };
  const edition = (fichier) => ({ ...base, tool_name: 'apply_patch', tool_input: { command: patch(fichier) } });
  return [
    { action: `modifier ${PROTEGE} (outil apply_patch)`, attendu: 'refus', evenement: edition(PROTEGE) },
    { action: `écrire ${PROTEGE} par le terminal (outil Bash)`, attendu: 'refus', evenement: { ...base, tool_name: 'Bash', tool_input: { command: COMMANDE_TERMINAL } } },
    { action: `modifier ${AUTRE} (outil apply_patch)`, attendu: 'passage', evenement: edition(AUTRE) },
  ];
}

function evenementsCopilot(racine) {
  const base = { timestamp: 0, cwd: racine };
  const edition = (fichier) => ({
    ...base,
    toolName: 'edit',
    toolArgs: JSON.stringify({ path: path.join(racine, fichier), old_str: 'transporteur-fictif', new_str: 'transporteur-test' }),
  });
  return [
    { action: `modifier ${PROTEGE} (outil edit)`, attendu: 'refus', evenement: edition(PROTEGE) },
    { action: `écrire ${PROTEGE} par le terminal (outil bash)`, attendu: 'refus', evenement: { ...base, toolName: 'bash', toolArgs: JSON.stringify({ command: COMMANDE_TERMINAL }) } },
    { action: `modifier ${AUTRE} (outil edit)`, attendu: 'passage', evenement: edition(AUTRE) },
  ];
}

// Hooks « avant l'action » déclarés, avec leur filtre d'outil (matcher).
function hooksAvecMatcher(config) {
  const groupes = config?.hooks?.PreToolUse;
  if (!Array.isArray(groupes)) return [];
  return groupes.flatMap((groupe) => (Array.isArray(groupe?.hooks) ? groupe.hooks : [])
    .filter((h) => typeof h?.command === 'string')
    .map((h) => ({ matcher: groupe.matcher, command: h.command })));
}

function hooksCopilot(config) {
  const liste = config?.hooks?.preToolUse ?? config?.hooks?.PreToolUse;
  if (!Array.isArray(liste)) return [];
  return liste.flatMap((h) => {
    const command = h?.command ?? h?.bash;
    if (typeof command === 'string') return [{ matcher: undefined, command }];
    return Array.isArray(h?.hooks) ? hooksAvecMatcher({ hooks: { PreToolUse: [h] } }) : [];
  });
}

const OUTILS = [
  { nom: 'Claude Code', fichiers: () => ['.claude/settings.json'], hooks: hooksAvecMatcher, evenements: evenementsClaude, matcher: true },
  { nom: 'GitHub Copilot', fichiers: fichiersCopilot, hooks: hooksCopilot, evenements: evenementsCopilot, matcher: false },
  { nom: 'Codex (ChatGPT)', fichiers: () => ['.codex/hooks.json'], hooks: hooksAvecMatcher, evenements: evenementsCodex, matcher: true },
];

function fichiersCopilot(racine) {
  const dossier = path.join(racine, '.github', 'hooks');
  if (!fs.existsSync(dossier)) return [];
  return fs.readdirSync(dossier).filter((f) => f.endsWith('.json')).sort().map((f) => `.github/hooks/${f}`);
}

function selectionne(matcher, outil) {
  if (matcher === undefined || matcher === null || matcher === '' || matcher === '*') return true;
  try {
    return new RegExp(`^(?:${matcher})$`).test(outil);
  } catch {
    return false;
  }
}

function nomOutil(evenement) {
  return evenement.tool_name ?? evenement.toolName;
}

// Lance une commande de hook comme le ferait l'outil : JSON sur l'entrée standard.
function lancer(command, evenement, racine) {
  const commande = command.replace(/\$\{CLAUDE_PROJECT_DIR\}|\$CLAUDE_PROJECT_DIR\b/g, racine);
  const r = spawnSync(commande, {
    shell: true,
    cwd: racine,
    input: JSON.stringify(evenement),
    encoding: 'utf8',
    timeout: 10000,
    env: { ...process.env, CLAUDE_PROJECT_DIR: racine },
  });
  const lignes = (r.stderr || '').trim().split('\n');
  const erreur = (lignes.find((l) => /Error|Cannot|introuvable/.test(l)) ?? lignes[0]).trim();
  if (r.error || r.status === null) return { issue: 'erreur', motif: 'la commande ne répond pas en 10 secondes' };
  if (r.status === 2) return { issue: 'refus', motif: erreur };
  if (r.status !== 0) return { issue: 'erreur', motif: erreur || `code de sortie ${r.status}` };
  return decisionJson(r.stdout);
}

function decisionJson(sortie) {
  let json;
  try {
    json = JSON.parse(sortie);
  } catch {
    return { issue: 'passage', motif: '' };
  }
  const d = json?.hookSpecificOutput ?? json ?? {};
  if (d.permissionDecision === 'deny') return { issue: 'refus', motif: d.permissionDecisionReason ?? '' };
  return { issue: 'passage', motif: '' };
}

function issueDe(hooks, cas, outil, racine) {
  const actifs = hooks.filter((h) => !outil.matcher || selectionne(h.matcher, nomOutil(cas.evenement)));
  if (actifs.length === 0) return { issue: 'passage', motif: '', ignore: true };
  for (const h of actifs) {
    const r = lancer(h.command, cas.evenement, racine);
    if (r.issue !== 'passage') return r;
  }
  return { issue: 'passage', motif: '' };
}

function lireConfig(racine, fichier) {
  const chemin = path.join(racine, fichier);
  if (!fs.existsSync(chemin)) return { absent: true };
  try {
    return { config: JSON.parse(fs.readFileSync(chemin, 'utf8')) };
  } catch (e) {
    return { invalide: e.message.split('\n')[0] };
  }
}

function libelle(cas, r) {
  if (r.issue === 'erreur') return `   ${cas.action} : le hook plante (${r.motif}). Vérifiez le chemin du script dans « command ».`;
  if (r.ignore) return `   ${cas.action} : accepté, le hook ne se déclenche pas pour cet outil (filtre « matcher »).`;
  if (r.issue === 'refus') return `   ${cas.action} : refusé.${r.motif ? ` Motif : ${r.motif}` : ''}`;
  return `   ${cas.action} : accepté.`;
}

function verifierFichier(outil, fichier, racine, sortie) {
  const lu = lireConfig(racine, fichier);
  if (lu.absent) return;
  if (lu.invalide) {
    sortie.trouves += 1;
    sortie.ok = false;
    sortie.lignes.push(`${outil.nom}, ${fichier} : ce n’est pas du JSON valide (${lu.invalide}).`);
    sortie.lignes.push('   Vérifiez les virgules, les guillemets et les accolades, enregistrez (Ctrl+S), puis relancez.');
    return;
  }
  const hooks = outil.hooks(lu.config);
  if (hooks.length === 0) return;
  sortie.trouves += 1;
  sortie.lignes.push(`${outil.nom}, ${fichier} : ${hooks.length} hook « avant l’action » trouvé${hooks.length > 1 ? 's' : ''}.`);
  for (const cas of outil.evenements(racine)) {
    const r = issueDe(hooks, cas, outil, racine);
    sortie.lignes.push(libelle(cas, r));
    if (r.issue !== (cas.attendu === 'refus' ? 'refus' : 'passage')) sortie.ok = false;
  }
  if (outil.nom.startsWith('Codex')) sortie.lignes.push('   Codex n’exécute ce hook qu’après votre approbation : tapez /hooks dans Codex.');
}

function verifier(racine) {
  const sortie = { lignes: [], ok: true, trouves: 0 };
  for (const outil of OUTILS) {
    for (const fichier of outil.fichiers(racine)) verifierFichier(outil, fichier, racine, sortie);
  }
  if (sortie.trouves === 0) {
    sortie.ok = false;
    sortie.lignes.push('Aucun hook branché : ni .claude/settings.json, ni .github/hooks/, ni .codex/hooks.json ne déclare de hook « avant l’action ».');
    sortie.lignes.push('Collez le bloc de la fiche dans le fichier de votre outil, enregistrez (Ctrl+S), puis relancez.');
    return sortie;
  }
  sortie.lignes.push(sortie.ok
    ? `Bilan : ${PROTEGE} est protégé. Toute modification est refusée, le reste passe.`
    : `Bilan : pas encore. Chaque action doit être refusée sur ${PROTEGE} et acceptée ailleurs.`);
  return sortie;
}

if (require.main === module) {
  const { lignes, ok } = verifier(process.cwd());
  for (const ligne of lignes) console.log(ligne);
  process.exit(ok ? 0 : 1);
}

module.exports = { verifier, selectionne, decisionJson };
