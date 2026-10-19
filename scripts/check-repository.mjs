import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function subjectProblem(message, allowGenerated = true) {
  const subject = String(message).split(/\r?\n/, 1)[0];
  if (allowGenerated && /^Merge (?:branch |remote-tracking branch |pull request #)\S.+/.test(subject)) return null;
  if (allowGenerated && subject.startsWith('Revert "') && subject.endsWith('"')) return subjectProblem(subject.slice(8, -1), false);
  const match = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(?:\([a-z0-9][a-z0-9._/-]*\))?!?: (.+)$/u.exec(subject);
  if (!match) return 'Usá tipo(área opcional): descripción. Ejemplo: fix(api): validar productos sin precio';
  if (subject.length > 100) return 'El título debe tener hasta 100 caracteres; el detalle va en el cuerpo.';
  const description = match[2].trim();
  if (description.length < 10 || description.split(/\s+/u).length < 2) return 'Describí una acción concreta con al menos dos palabras y diez caracteres.';
  const normalized = description.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[.!]+$/u, '');
  if (/^(?:update|updates|fix|fixes|changes|test|wip|final|final final|fix bugs?|varios cambios|cambios varios|prueba prueba)$/u.test(normalized)) return 'Reemplazá el mensaje genérico por una acción y su resultado.';
  return null;
}

export function forbiddenPath(path) {
  const parts = path.replaceAll('\\', '/').split('/');
  const filename = parts.at(-1);
  if (['.env.example', '.dev.vars.example'].includes(filename)) return false;
  return parts.some(part => ['node_modules', 'dist', '.vs', '.wrangler', 'coverage', 'playwright-report', 'test-results'].includes(part)) ||
    /^(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?|\.DS_Store|Thumbs\.db)$/u.test(filename);
}

export function manifestProblems(manifest, lock) {
  const errors = [];
  for (const group of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const [name, version] of Object.entries(manifest[group] ?? {})) {
      if (!/^\d+\.\d+\.\d+(?:-[\da-zA-Z.-]+)?(?:\+[\da-zA-Z.-]+)?$/u.test(version)) errors.push(`${name}: fijá una versión exacta.`);
      if (lock?.packages?.['']?.[group]?.[name] !== version) errors.push(`${name}: el manifiesto y el lockfile no coinciden.`);
      if (lock?.packages?.[`node_modules/${name}`]?.version !== version) errors.push(`${name}: la versión instalada del lockfile no coincide.`);
    }
  }
  return errors;
}

export function checkRepository(cwd, staged = false) {
  const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const paths = git(['ls-files', '-z']).split('\0').filter(Boolean);
  const changed = staged ? git(['diff', '--cached', '--name-only', '--diff-filter=ACM', '-z']).split('\0').filter(Boolean) : paths;
  const errors = changed.filter(forbiddenPath).map(path => `No versionés archivos locales o generados: ${path}`);
  const read = path => JSON.parse(git(['show', `:${path}`]));
  // Read the index, including for pre-commit: unstaged lockfile edits cannot hide a bad staged manifest.
  for (const path of paths.filter(path => path === 'package.json' || path.endsWith('/package.json'))) {
    try {
      const lockPath = path.replace(/package\.json$/u, 'package-lock.json');
      const manifest = read(path);
      const lock = paths.includes(lockPath) ? read(lockPath) : null;
      errors.push(...manifestProblems(manifest, lock).map(error => `${path}: ${error}`));
    } catch {
      errors.push(`${path}: no se pudo validar el JSON del manifiesto o del lockfile.`);
    }
  }
  return errors;
}

export function checkEvent(event, cwd) {
  const errors = [];
  const pr = event.pull_request;
  if (pr) {
    const problem = subjectProblem(pr.title, false);
    if (problem) errors.push(`Título del PR: ${problem}`);
  }
  const base = pr?.base?.sha ?? event.before;
  const head = pr?.head?.sha ?? event.after;
  if (head) {
    const isSha = value => typeof value === 'string' && /^[a-f\d]{40,64}$/u.test(value);
    if (!isSha(head) || (base && !isSha(base))) return [...errors, 'Referencias Git del evento inválidas.'];
    const range = base && !/^0+$/u.test(base) ? `${base}..${head}` : `${head}^!`;
    const subjects = execFileSync('git', ['log', '--no-merges', '--format=%s', range], { cwd, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    for (const subject of subjects) {
      const problem = subjectProblem(subject);
      if (problem) errors.push(`Commit nuevo: ${problem}`);
    }
  }
  return errors;
}

function main() {
  const [mode, file] = process.argv.slice(2);
  let errors;
  if (mode === '--message') {
    if (!file) throw new Error('Falta la ruta del mensaje de commit.');
    const problem = subjectProblem(readFileSync(file, 'utf8'));
    errors = problem ? [problem] : [];
  } else if (['--staged', '--repository', '--ci'].includes(mode)) {
    errors = checkRepository(process.cwd(), mode === '--staged');
    if (mode === '--ci' && process.env.GITHUB_EVENT_PATH) errors.push(...checkEvent(JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')), process.cwd()));
  } else throw new Error('Uso: node scripts/check-repository.mjs --message <archivo> | --staged | --repository | --ci');
  if (errors.length) {
    console.error(errors.map(error => `- ${error}`).join('\n'));
    process.exitCode = 1;
  } else console.log('Repository policy: OK');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
