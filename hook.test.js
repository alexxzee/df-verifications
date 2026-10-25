// Teste le vérificateur hook.js (npm run hook), micro-exercice du ch07 : le
// participant branche un hook qui empêche l'agent de modifier les tests de
// caractérisation (dossier test/caracterisation), dans la configuration de son
// outil : .claude/settings.json (Claude Code), .github/hooks/proteger.json
// (Copilot) ou .codex/hooks.json (Codex). hook.js lit chaque configuration,
// lance la commande déclarée avec une action simulée (édition du fichier
// protégé, commande sed dans le terminal, édition d'un autre fichier) et dit
// si elle est refusée ou acceptée.
// La plupart des tests utilisent un script de refus minimal (STUB) dans un faux
// projet temporaire et ne demandent pas df-commandes. Les trois derniers
// utilisent le vrai scripts/hooks/proteger.js de df-commandes et sont sautés
// s'il n'est pas cloné à côté de df-verifications.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { verifier, selectionne, decisionJson } = require('./hook.js');

// Script de refus minimal : refuse (code 2) toute action dont le JSON cite le chemin reçu.
// Il lit l'action sur l'entrée standard (descripteur 0) et le chemin protégé en premier argument.
const STUB = [
  "const t = require('node:fs').readFileSync(0, 'utf8');",
  "if (process.argv[2] && t.includes(process.argv[2])) { process.stderr.write('protégé\\n'); process.exit(2); }",
].join('\n');

// Faux df-commandes : scripts/stub.js, plus les fichiers donnés ({ chemin: contenu }) ;
// un contenu qui n'est pas une chaîne est écrit en JSON.
function projet(fichiers) {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-'));
  fs.mkdirSync(path.join(racine, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(racine, 'scripts', 'stub.js'), STUB);
  for (const [nom, contenu] of Object.entries(fichiers)) {
    fs.mkdirSync(path.dirname(path.join(racine, nom)), { recursive: true });
    fs.writeFileSync(path.join(racine, nom), typeof contenu === 'string' ? contenu : JSON.stringify(contenu)); // chaîne : écrite telle quelle (sert au JSON invalide)
  }
  return racine;
}

// Configurations minimales, au format de chaque outil :
// claude : un hook PreToolUse, avec son matcher (outils visés) et sa commande (format partagé par Codex) ;
// copilot : un hook preToolUse, sans matcher, avec sa commande et un délai de 10 s.
const claude = (matcher, command) => ({ hooks: { PreToolUse: [{ matcher, hooks: [{ type: 'command', command }] }] } });
const copilot = (command) => ({ version: 1, hooks: { preToolUse: [{ type: 'command', command, timeoutSec: 10 }] } });

// Les trois fichiers de configuration présents, mais sans aucun hook.
// Attendu : ok false, « Aucun hook branché » (avec la consigne de collage).
// Pourquoi : c'est l'état de départ ; le vérificateur dit quoi coller et où.
test('aucun hook déclaré : échec, avec la consigne de collage', () => {
  const r = verifier(projet({ '.claude/settings.json': { hooks: {} }, '.github/hooks/proteger.json': { version: 1, hooks: {} }, '.codex/hooks.json': { hooks: {} } }));
  assert.equal(r.ok, false);
  assert.match(r.lignes.join('\n'), /Aucun hook branché/);
});

// Claude Code, matcher Edit|Write|Bash, commande qui protège test/caracterisation
// (chemin du script donné par $CLAUDE_PROJECT_DIR, comme dans la fiche).
// Attendu : ok true, et exactement 2 actions refusées : l'édition du test protégé
// et la commande sed qui le vise dans le terminal (l'autre fichier passe).
// Pourquoi : c'est la configuration attendue pour Claude Code.
test('Claude Code : hook qui protège test/caracterisation, réussite', () => {
  const r = verifier(projet({ '.claude/settings.json': claude('Edit|Write|Bash', 'node "$CLAUDE_PROJECT_DIR/scripts/stub.js" test/caracterisation') }));
  assert.equal(r.ok, true, r.lignes.join('\n')); // en cas d'échec, la sortie du vérificateur sert de message
  assert.equal(r.lignes.filter((l) => l.includes(': refusé.')).length, 2); // édition + terminal
});

// Claude Code, matcher Edit|Write seulement.
// Attendu : ok false ; l'action par le terminal (outil Bash) est acceptée, le hook ne se déclenche pas.
// Pourquoi : sans Bash dans le matcher, l'agent contourne la protection par une
// commande shell ; c'est l'oubli que l'exercice veut faire voir.
test('Claude Code : matcher sans Bash, le terminal passe et la vérification échoue', () => {
  const r = verifier(projet({ '.claude/settings.json': claude('Edit|Write', 'node scripts/stub.js test/caracterisation') }));
  assert.equal(r.ok, false);
  assert.match(r.lignes.join('\n'), /outil Bash\) : accepté, le hook ne se déclenche pas/);
});

// Copilot, hook qui protège src/confg.js (chemin faux, avec faute de frappe) au lieu du dossier des tests.
// Attendu : ok false.
// Pourquoi : un hook qui tourne mais protège le mauvais chemin ne protège rien ;
// l'édition du test de caractérisation passe.
test('Copilot : mauvais chemin protégé, échec', () => {
  const r = verifier(projet({ '.github/hooks/proteger.json': copilot('node scripts/stub.js src/confg.js') }));
  assert.equal(r.ok, false);
});

// Copilot, commande qui appelle un script inexistant (scripts/absent.js).
// Attendu : ok false, « le hook plante ».
// Pourquoi : node sort en erreur sans refuser explicitement ; le vérificateur doit
// distinguer ce plantage d'un refus voulu.
test('Copilot : script introuvable, le hook plante', () => {
  const r = verifier(projet({ '.github/hooks/proteger.json': copilot('node scripts/absent.js test/caracterisation') }));
  assert.equal(r.ok, false);
  assert.match(r.lignes.join('\n'), /le hook plante/);
});

// Codex, fichier .codex/hooks.json au JSON cassé (crochet non fermé).
// Attendu : ok false, « pas du JSON valide ».
// Pourquoi : une erreur de collage est fréquente ; elle doit être nommée, pas
// confondue avec un hook absent.
test('Codex : JSON invalide signalé', () => {
  const r = verifier(projet({ '.codex/hooks.json': '{ "hooks": { "PreToolUse": [ } }' })); // JSON volontairement invalide
  assert.equal(r.ok, false);
  assert.match(r.lignes.join('\n'), /pas du JSON valide/);
});

// Codex, matcher apply_patch|Bash (outils d'édition et de terminal de Codex), commande qui protège le dossier.
// Attendu : ok true, et la sortie rappelle /hooks.
// Pourquoi : Codex demande d'approuver un hook nouveau par la commande /hooks
// avant de l'appliquer ; le vérificateur le rappelle même quand tout est juste.
test('Codex : rappel de l’approbation par /hooks', () => {
  const r = verifier(projet({ '.codex/hooks.json': claude('apply_patch|Bash', 'node scripts/stub.js test/caracterisation') }));
  assert.equal(r.ok, true, r.lignes.join('\n'));
  assert.match(r.lignes.join('\n'), /\/hooks/);
});

// selectionne(matcher, outil) : le matcher est une expression régulière qui doit
// couvrir le nom entier de l'outil ; absent ou « * », il vise tous les outils.
// Attendu : Edit|Write vise Edit ; Edit ne vise pas NotebookEdit (correspondance
// partielle refusée) ; undefined et « * » visent Bash.
test('matcher : expression régulière sur le nom entier, vide ou * pour tout', () => {
  assert.equal(selectionne('Edit|Write', 'Edit'), true);
  assert.equal(selectionne('Edit', 'NotebookEdit'), false); // « Edit » est contenu dans le nom, mais ne le couvre pas en entier
  assert.equal(selectionne(undefined, 'Bash'), true); // pas de matcher : tous les outils
  assert.equal(selectionne('*', 'Bash'), true);
});

// decisionJson(sortie) : lit une décision écrite en JSON sur la sortie du hook.
// Attendu : « deny » au premier niveau (format Copilot) ou sous hookSpecificOutput
// (format Claude Code) donne un refus ; une sortie vide laisse passer.
// Pourquoi : un hook peut refuser par sa sortie JSON au lieu du code 2.
test('refus par sortie JSON, au format Copilot ou Claude Code', () => {
  assert.equal(decisionJson('{"permissionDecision":"deny","permissionDecisionReason":"non"}').issue, 'refus'); // format Copilot
  assert.equal(decisionJson('{"hookSpecificOutput":{"permissionDecision":"deny"}}').issue, 'refus'); // format Claude Code
  assert.equal(decisionJson('').issue, 'passage'); // rien sur la sortie : l'action passe
});

// Le script réel de df-commandes, s'il est cloné à côté, avec les blocs de la fiche.
const DF = path.resolve(__dirname, '..', 'df-commandes', 'scripts', 'hooks', 'proteger.js');

// Les trois blocs de configuration donnés par la fiche, chacun seul dans un faux
// projet avec une copie du vrai scripts/hooks/proteger.js.
// Attendu : ok true pour chacun des trois outils.
// Pourquoi : les blocs que le participant colle depuis la fiche doivent marcher
// tels quels avec le script fourni dans df-commandes.
test('blocs de la fiche avec le script réel de df-commandes', { skip: !fs.existsSync(DF) && 'df-commandes absent' }, () => {
  const blocs = {
    '.claude/settings.json': claude('Edit|Write|Bash', 'node "$CLAUDE_PROJECT_DIR/scripts/hooks/proteger.js" test/caracterisation'),
    '.github/hooks/proteger.json': copilot('node scripts/hooks/proteger.js test/caracterisation'),
    '.codex/hooks.json': { hooks: { PreToolUse: [{ matcher: 'apply_patch|Bash', hooks: [{ type: 'command', command: 'node scripts/hooks/proteger.js test/caracterisation', timeout: 10 }] }] } },
  };
  for (const [fichier, contenu] of Object.entries(blocs)) {
    const racine = projet({ [fichier]: contenu, 'scripts/hooks/proteger.js': fs.readFileSync(DF, 'utf8') });
    const r = verifier(racine);
    assert.equal(r.ok, true, `${fichier}\n${r.lignes.join('\n')}`); // le message nomme l'outil en échec
  }
});

// Le vrai proteger.js lancé directement : action en JSON sur l'entrée standard,
// chemin protégé en argument ; seul le code de sortie est lu.
// Attendu : code 0 pour une lecture (Read) du fichier protégé, pour l'édition d'un
// fichier voisin (src/config.json), pour une entrée qui n'est pas du JSON, pour une
// entrée vide et pour une édition sans chemin protégé en argument ; code 2 pour
// l'édition de src/config.js quand ce chemin est protégé.
// Pourquoi : le hook ne doit bloquer que la modification du chemin protégé, et
// ne jamais bloquer l'agent sur une entrée qu'il ne comprend pas.
test('script réel : lecture, autre fichier et entrée illisible passent (code 0)', { skip: !fs.existsSync(DF) && 'df-commandes absent' }, () => {
  const { spawnSync } = require('node:child_process');
  const code = (entree, ...args) => spawnSync(process.execPath, [DF, ...args], { input: entree }).status; // code de sortie de proteger.js
  const lecture = JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'src/config.js' } });
  const voisin = JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: 'src/config.json' } }); // nom qui commence comme le chemin protégé
  const edition = JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: 'src/config.js' } });
  assert.equal(code(lecture, 'src/config.js'), 0); // lire n'est pas modifier
  assert.equal(code(voisin, 'src/config.js'), 0); // src/config.json n'est pas src/config.js
  assert.equal(code('pas du JSON', 'src/config.js'), 0);
  assert.equal(code('', 'src/config.js'), 0);
  assert.equal(code(edition), 0); // aucun chemin protégé en argument
  assert.equal(code(edition, 'src/config.js'), 2); // 2 : refus
});

// Le vrai proteger.js, chemin protégé test/caracterisation (un dossier).
// Attendu : code 2 pour deux fichiers de ce dossier ; code 0 pour un fichier du
// dossier voisin test/caracterisation-bis et pour un test d'un autre dossier.
// Pourquoi : protéger un dossier couvre tout son contenu, mais pas un dossier dont
// le nom commence pareil.
test('script réel : un dossier protégé couvre ses fichiers, pas un dossier voisin', { skip: !fs.existsSync(DF) && 'df-commandes absent' }, () => {
  const { spawnSync } = require('node:child_process');
  const code = (fichier) => spawnSync(process.execPath, [DF, 'test/caracterisation'], {
    input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: fichier } }),
  }).status;
  assert.equal(code('test/caracterisation/export-commandes.test.js'), 2);
  assert.equal(code('test/caracterisation/export-attendu.csv'), 2);
  assert.equal(code('test/caracterisation-bis/a.test.js'), 0); // même début de nom, autre dossier
  assert.equal(code('test/devis/calcul.test.js'), 0);
});
