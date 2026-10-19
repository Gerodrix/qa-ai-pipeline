import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { checkEvent, checkRepository, forbiddenPath, manifestProblems, subjectProblem } from './check-repository.mjs';

test('descriptive English and Spanish subjects pass; vague or malformed subjects fail', () => {
  for (const message of ['fix(api): validar productos sin precio', 'docs: explain local setup and limitations', 'feat(ui)!: replace the legacy navigation', 'Merge branch feature/login', 'Revert "fix(api): validar productos sin precio"']) assert.equal(subjectProblem(message), null, message);
  for (const message of ['worflows', 'dashboard', 'arreglé lo que rompió la otra cosa', 'fix: fix bugs', 'chore: final final', 'docs: update', 'fix: ' + 'x'.repeat(101)]) assert.ok(subjectProblem(message), message);
});
test('generated Git subjects are excluded from PR title exceptions', () => {
  assert.ok(subjectProblem('Merge branch feature/login', false));
  assert.equal(subjectProblem('fix: preserve line breaks\n\nDetailed explanation.'), null);
});
test('local credentials and generated files fail; templates and project sources pass', () => {
  for (const path of ['.env', 'runner/.env.production', '.dev.vars', 'client/node_modules/x.js', 'server/dist/index.js', '.vs/workspace', 'test-results/result.json']) assert.equal(forbiddenPath(path), true, path);
  for (const path of ['generator/.env.example', '.dev.vars.example', 'src/App.tsx', 'public/projects/cover.webp', 'drizzle/0000_initial.sql']) assert.equal(forbiddenPath(path), false, path);
});
test('exact dependencies require matching lockfile metadata and resolutions', () => {
  const manifest = { dependencies: { demo: '1.2.3' } };
  const lock = { packages: { '': { dependencies: { demo: '1.2.3' } }, 'node_modules/demo': { version: '1.2.3' } } };
  assert.deepEqual(manifestProblems(manifest, lock), []);
  assert.ok(manifestProblems({ dependencies: { demo: '^1.2.3' } }, lock).length);
  assert.ok(manifestProblems(manifest, null).length);
  assert.ok(manifestProblems(manifest, { packages: { ...lock.packages, 'node_modules/demo': { version: '2.0.0' } } }).length);
});
test('real hooks reject bad messages and staged credentials without overwriting existing hooks', () => {
  const root = mkdtempSync(join(tmpdir(), 'repository-policy-'));
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const run = (command, args) => spawnSync(command, args, { cwd: root, encoding: 'utf8' });
  try {
    git(['init', '--initial-branch=main']);
    git(['config', 'user.name', 'Policy Test']);
    git(['config', 'user.email', 'policy@example.invalid']);
    git(['config', 'commit.gpgsign', 'false']);
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, '.githooks'));
    for (const name of ['check-repository.mjs', 'install-git-hooks.mjs']) copyFileSync(new URL(name, import.meta.url), join(root, 'scripts', name));
    for (const name of ['commit-msg', 'pre-commit']) {
      copyFileSync(new URL('../.githooks/' + name, import.meta.url), join(root, '.githooks', name));
      chmodSync(join(root, '.githooks', name), 0o755);
    }
    git(['config', 'core.hooksPath', 'existing-hooks']);
    assert.notEqual(run(process.execPath, ['scripts/install-git-hooks.mjs']).status, 0);
    assert.equal(git(['config', 'core.hooksPath']), 'existing-hooks');
    git(['config', '--unset', 'core.hooksPath']);
    assert.equal(run(process.execPath, ['scripts/install-git-hooks.mjs']).status, 0);
    assert.equal(run(process.execPath, ['scripts/install-git-hooks.mjs']).status, 0);
    writeFileSync(join(root, 'source.txt'), 'source\n');
    git(['add', 'source.txt']);
    assert.notEqual(run('git', ['commit', '-m', 'cosas']).status, 0);
    assert.equal(run('git', ['commit', '-m', 'test: verify repository policy hooks']).status, 0);
    const head = git(['rev-parse', 'HEAD']);
    assert.ok(checkEvent({ pull_request: { title: 'dashboard', base: { sha: head }, head: { sha: head } } }, root).length);
    assert.deepEqual(checkEvent({ pull_request: { title: 'docs: explain the setup steps', base: { sha: head }, head: { sha: head } } }, root), []);
    assert.ok(checkEvent({ after: '--bad-ref' }, root).length);
    git(['-c', 'core.hooksPath=disabled-hooks', 'commit', '--allow-empty', '-m', 'dashboard']);
    const invalidHead = git(['rev-parse', 'HEAD']);
    assert.ok(checkEvent({ before: head, after: invalidHead }, root).length, 'CI catches a new vague commit even if a local hook was bypassed');
    writeFileSync(join(root, '.env'), 'LOCAL_TEST_VALUE=placeholder\n');
    git(['add', '-f', '.env']);
    assert.notEqual(run('git', ['commit', '-m', 'chore: include local configuration']).status, 0);
    git(['reset', '--', '.env']);
    const manifest = { dependencies: { demo: '1.2.3' } };
    writeFileSync(join(root, 'package.json'), JSON.stringify(manifest));
    git(['add', 'package.json']);
    writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ packages: { '': manifest, 'node_modules/demo': { version: '1.2.3' } } }));
    assert.ok(checkRepository(root, true).length, 'unstaged lockfile must not hide a bad staged manifest');
    git(['add', 'package-lock.json']);
    assert.deepEqual(checkRepository(root, true), []);
  } finally {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(basename(root).startsWith('repository-policy-'));
    rmSync(root, { recursive: true, force: true });
  }
});
