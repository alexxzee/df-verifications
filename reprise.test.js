'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { commandes, ETAPES } = require('./reprise.js');

test('une étape connue pose les fichiers de la reprise sans toucher à l’historique', () => {
  assert.deepEqual(commandes('ch07'), [
    ['git', ['fetch', '--depth=1', 'https://github.com/alexxzee/df-commandes-reprises.git', 'reprise/ch07']],
    ['git', ['read-tree', '-u', '--reset', 'FETCH_HEAD']],
    ['git', ['clean', '-fdq']],
    ['git', ['reset', '-q']],
  ]);
});

test('les étapes sont celles des branches de reprise', () => {
  assert.deepEqual(ETAPES, ['tp2', 'ch03', 'tp3', 'ch06', 'ch07', 'ch08', 'ch09']);
});

test('une étape inconnue est refusée avec la liste des étapes', () => {
  assert.throws(() => commandes('ch42'), /Étape inconnue : ch42\. Étapes : tp2, ch03, tp3, ch06, ch07, ch08, ch09/);
});
