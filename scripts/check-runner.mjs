import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const reservation = createServer();
await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const url = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root + 'target-app', stdio: 'pipe' });
let serverOutput = '';
server.stdout.on('data', data => { serverOutput += data; });
server.stderr.on('data', data => { serverOutput += data; });
const regressionFile = 'ci-invalid-selector.json';
const fixturePath = new URL('../data/' + regressionFile, import.meta.url);

async function run(script, casesFile, expectedCode = 0) {
  const child = spawn(process.execPath, ['runner/node_modules/tsx/dist/cli.mjs', 'runner/src/' + script], {
    cwd: root,
    env: { ...process.env, TARGET_APP_URL: url, CASES_FILE: casesFile },
    stdio: 'inherit',
  });
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
  assert.equal(code, expectedCode, `${script} (${casesFile}) exit code`);
}

try {
  const deadline = Date.now() + 15000;
  while (true) {
    if (server.exitCode !== null) throw new Error('Preview exited: ' + serverOutput);
    try { if ((await fetch(url)).ok) break; } catch {}
    if (Date.now() > deadline) throw new Error('Preview did not start: ' + serverOutput);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await run('validate-cases.ts', 'cases.json');
  await run('run-tests.ts', 'cases.json');
  const controlHistory = JSON.parse(await readFile(new URL('../data/results.json', import.meta.url), 'utf8'));
  const control = controlHistory.at(-1);
  const cases = JSON.parse(await readFile(new URL('../data/cases.json', import.meta.url), 'utf8'));
  assert.equal(control.total, cases.length);
  assert.ok(control.total > 0);
  assert.equal(control.passed, control.total);
  assert.equal(control.failed, 0);
  assert.equal(control.invalid, 0);
  await writeFile(fixturePath, JSON.stringify([{ id: 'TC-CI-INVALID', description: 'Reject invented selector', expected: 'invalid', steps: [{ action: 'goto', url: '/' }, { action: 'assertVisible', selector: '#ci-selector-does-not-exist' }] }]));
  await run('validate-cases.ts', regressionFile, 1);
  await run('run-tests.ts', regressionFile, 1);
  const history = JSON.parse(await readFile(new URL('../data/results.json', import.meta.url), 'utf8'));
  assert.equal(history.at(-1).invalid, 1);
  assert.equal(history.at(-1).cases[0].status, 'invalid');
  console.log('Control cases passed; invented selector rejected with a failing exit code.');
} finally {
  server.kill();
  await unlink(fixturePath).catch(error => { if (error.code !== 'ENOENT') throw error; });
}
