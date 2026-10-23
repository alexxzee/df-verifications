'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { verifier, selectionne, decisionJson } = require('./hook.js');

// Script de refus minimal : refuse (code 2) toute action dont le JSON cite le chemin reçu.
const STUB = [
  "const t = require('node:fs').readFileSync(0, 'utf8');",
  "if (process.argv[2] && t.includes(process.argv[2])) { process.stderr.write('protégé\\n'); process.exit(2); }",
].join('\n');

function projet(fichiers) {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-'));
  fs.mkdirSync(path.join(racine, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(racine, 'scripts', 'stub.js'), STUB);
  for (const [nom, contenu] of Object.entries(fichiers)) {
    fs.mkdirSync(path.dirname(path.join(racine, nom)), { recursive: true });
    fs.writeFileSync(path.join(racine, nom), typeof contenu === 'string' ? contenu : JSON.stringify(contenu));
  }
  return racine;
}

const claude = (matcher, command) => ({ hooks: { PreToolUse: [{ matcher, hooks: [{ type: 'command', command }] }] } });
const copilot = (command) => ({ version: 1, hooks: { preToolUse: [{ type: 'command', command, timeoutSec: 10 }] } });

test('aucun hook déclaré : échec, avec la consigne de collage', () => {
  const r = verifier(projet({ '.claude/settings.json': { hooks: {} }, '.github/hooks/proteger.json': { version: 1, hooks: {} }, '.codex/hooks.json': { hooks: {} } }));
  assert.equal(r.ok, false);
  assert.match(r.lignes.join('\n'), /Aucun hook branché/);
});

test('Claude Code : hook qui protège test/caracterisation, réussite', () => {
  const r = verifier(projet({ '.claude/settings.json': claude('Edit|Write|Bash', 'node "$CLAUDE_PROJECT_DIR/scripts/stub.js" test/caracterisation') }));
  assert.equal(r.ok, true, r.lignes.join('\n'));
  assert.equal(r.lignes.filter((l) => l.includes(': refusé.')).length, 2);
});

test('Claude Code : matcher sans Bash, le terminal passe et la vérification échoue', () => {
  const r = verifier(projet({ '.claude/settings.json': claude('Edit|Write', 'node scripts/stub.js test/caracterisation') }));
  assert.equal(r.ok, false);
  assert.match(r.lignes.join('\n'), /outil Bash\) : accepté, le hook ne se déclenche pas/);
});

test('Copilot : mauvais chemin protégé, échec', () => {
  const r = verifier(projet({ '.github/hooks/proteger.json': copilot('node scripts/stub.js src/confg.js') }));
  assert.equal(r.ok, false);
});

test('Copilot : script introuvable, le hook plante', () => {
  const r = verifier(projet({ '.github/hooks/proteger.json': copilot('node scripts/absent.js test/caracterisation') }));
  assert.equal(r.ok, false);
  assert.match(r.lignes.join('\n'), /le hook plante/);
});

test('Codex : JSON invalide signalé', () => {
  const r = verifier(projet({ '.codex/hooks.json': '{ "hooks": { "PreToolUse": [ } }' }));
  assert.equal(r.ok, false);
  assert.match(r.lignes.join('\n'), /pas du JSON valide/);
});

test('Codex : rappel de l’approbation par /hooks', () => {
  const r = verifier(projet({ '.codex/hooks.json': claude('apply_patch|Bash', 'node scripts/stub.js test/caracterisation') }));
  assert.equal(r.ok, true, r.lignes.join('\n'));
  assert.match(r.lignes.join('\n'), /\/hooks/);
});

test('matcher : expression régulière sur le nom entier, vide ou * pour tout', () => {
  assert.equal(selectionne('Edit|Write', 'Edit'), true);
  assert.equal(selectionne('Edit', 'NotebookEdit'), false);
  assert.equal(selectionne(undefined, 'Bash'), true);
  assert.equal(selectionne('*', 'Bash'), true);
});

test('refus par sortie JSON, au format Copilot ou Claude Code', () => {
  assert.equal(decisionJson('{"permissionDecision":"deny","permissionDecisionReason":"non"}').issue, 'refus');
  assert.equal(decisionJson('{"hookSpecificOutput":{"permissionDecision":"deny"}}').issue, 'refus');
  assert.equal(decisionJson('').issue, 'passage');
});

// Le script réel de df-commandes, s'il est cloné à côté, avec les blocs de la fiche.
const DF = path.resolve(__dirname, '..', 'df-commandes', 'scripts', 'hooks', 'proteger.js');
test('blocs de la fiche avec le script réel de df-commandes', { skip: !fs.existsSync(DF) && 'df-commandes absent' }, () => {
  const blocs = {
    '.claude/settings.json': claude('Edit|Write|Bash', 'node "$CLAUDE_PROJECT_DIR/scripts/hooks/proteger.js" test/caracterisation'),
    '.github/hooks/proteger.json': copilot('node scripts/hooks/proteger.js test/caracterisation'),
    '.codex/hooks.json': { hooks: { PreToolUse: [{ matcher: 'apply_patch|Bash', hooks: [{ type: 'command', command: 'node scripts/hooks/proteger.js test/caracterisation', timeout: 10 }] }] } },
  };
  for (const [fichier, contenu] of Object.entries(blocs)) {
    const racine = projet({ [fichier]: contenu, 'scripts/hooks/proteger.js': fs.readFileSync(DF, 'utf8') });
    const r = verifier(racine);
    assert.equal(r.ok, true, `${fichier}\n${r.lignes.join('\n')}`);
  }
});

test('script réel : lecture, autre fichier et entrée illisible passent (code 0)', { skip: !fs.existsSync(DF) && 'df-commandes absent' }, () => {
  const { spawnSync } = require('node:child_process');
  const code = (entree, ...args) => spawnSync(process.execPath, [DF, ...args], { input: entree }).status;
  const lecture = JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'src/config.js' } });
  const voisin = JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: 'src/config.json' } });
  const edition = JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: 'src/config.js' } });
  assert.equal(code(lecture, 'src/config.js'), 0);
  assert.equal(code(voisin, 'src/config.js'), 0);
  assert.equal(code('pas du JSON', 'src/config.js'), 0);
  assert.equal(code('', 'src/config.js'), 0);
  assert.equal(code(edition), 0);
  assert.equal(code(edition, 'src/config.js'), 2);
});

test('script réel : un dossier protégé couvre ses fichiers, pas un dossier voisin', { skip: !fs.existsSync(DF) && 'df-commandes absent' }, () => {
  const { spawnSync } = require('node:child_process');
  const code = (fichier) => spawnSync(process.execPath, [DF, 'test/caracterisation'], {
    input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: fichier } }),
  }).status;
  assert.equal(code('test/caracterisation/export-commandes.test.js'), 2);
  assert.equal(code('test/caracterisation/export-attendu.csv'), 2);
  assert.equal(code('test/caracterisation-bis/a.test.js'), 0);
  assert.equal(code('test/devis/calcul.test.js'), 0);
});
