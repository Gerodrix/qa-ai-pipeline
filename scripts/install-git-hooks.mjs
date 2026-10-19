import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const existing = spawnSync('git', ['config', '--get', 'core.hooksPath'], { cwd: root, encoding: 'utf8' });
if (![0, 1].includes(existing.status)) throw new Error('No se pudo consultar la configuración local de Git.');
const configured = existing.stdout.trim();
if (configured && configured !== '.githooks') throw new Error('Ya existe core.hooksPath. Revisá esa configuración antes de instalar estos hooks; no se modificó.');
const update = spawnSync('git', ['config', '--local', 'core.hooksPath', '.githooks'], { cwd: root, encoding: 'utf8' });
if (update.status !== 0) throw new Error('No se pudieron instalar los hooks locales.');
console.log('Hooks activos para este clon. Los controles de GitHub se ejecutan por separado.');
