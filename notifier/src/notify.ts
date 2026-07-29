// notifier/src/notify.ts
//
// Reads the most recent run from data/results.json and POSTs a summary to
// n8n. This script doesn't decide what's "alert-worthy" — it always sends
// the full picture (counts + which cases failed or were invalid, and why)
// and lets the n8n workflow branch on that (e.g. only ping Slack when
// something actually failed). Keeping that decision in n8n, not here, is
// the point: it's the piece meant to demonstrate orchestration.

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { RunResult } from '../../shared/types.js';

const RESULTS_PATH = fileURLToPath(new URL('../../data/results.json', import.meta.url));
const WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

function getLatestRun(): RunResult {
  const history: RunResult[] = JSON.parse(readFileSync(RESULTS_PATH, 'utf-8'));
  if (history.length === 0) {
    throw new Error('data/results.json está vacío — corré "npm run test" en runner/ primero.');
  }
  return history[history.length - 1];
}

function buildPayload(run: RunResult) {
  const failedCases = run.cases.filter((c) => c.status === 'failed');
  const invalidCases = run.cases.filter((c) => c.status === 'invalid');

  return {
    runId: run.runId,
    timestamp: run.timestamp,
    total: run.total,
    passed: run.passed,
    failed: run.failed,
    invalid: run.invalid,
    failedCases: failedCases.map((c) => ({
      id: c.id,
      description: c.description,
      errorMessage: c.errorMessage,
    })),
    invalidCases: invalidCases.map((c) => ({
      id: c.id,
      description: c.description,
      reason: c.invalidReason,
    })),
  };
}

async function main() {
  if (!WEBHOOK_URL) {
    throw new Error(
      'Falta N8N_WEBHOOK_URL. Copiá notifier/.env.example a .env y completá la URL real del webhook.',
    );
  }

  const run = getLatestRun();
  const payload = buildPayload(run);

  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`n8n respondió ${response.status}: ${await response.text()}`);
  }

  console.log(`Notificación enviada para el run ${run.runId} (${run.passed}/${run.total} pasaron).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
