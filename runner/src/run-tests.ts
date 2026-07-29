// runner/src/run-tests.ts
//
// Runs every TestCase for real. Invalid cases (bad selectors) are skipped
// and reported as-is — they never reach the browser. Valid cases run their
// steps in order; a failed step captures a screenshot and stops that case,
// the rest of the suite keeps going.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';
import type { CaseResult, RunResult, TestCase, TestStep } from '../../shared/types.js';
import { BASE_URL, validateCases } from './validate-cases.js';

const DATA_DIR = fileURLToPath(new URL('../../data/', import.meta.url));
const CASES_FILE = process.env.CASES_FILE ?? 'cases.json';
const CASES_PATH = `${DATA_DIR}${CASES_FILE}`;
const RESULTS_PATH = `${DATA_DIR}results.json`;
const SCREENSHOTS_DIR = `${DATA_DIR}screenshots/`;

async function executeStep(step: TestStep, page: Page): Promise<void> {
  switch (step.action) {
    case 'goto':
      await page.goto(new URL(step.url, BASE_URL).toString());
      return;
    case 'fill':
      await page.fill(step.selector, step.value);
      return;
    case 'click':
      await page.click(step.selector);
      return;
    case 'check':
      await page.check(step.selector);
      return;
    case 'assertVisible':
      await page.locator(step.selector).waitFor({ state: 'visible', timeout: 5000 });
      return;
    case 'assertText': {
      const locator = page.locator(step.selector);
      await locator.waitFor({ state: 'visible', timeout: 5000 });
      const actualText = (await locator.textContent())?.trim() ?? '';
      if (actualText !== step.value) {
        throw new Error(
          `Texto esperado "${step.value}" pero se encontró "${actualText}" en ${step.selector}`,
        );
      }
      return;
    }
  }
}

async function runCase(testCase: TestCase, page: Page): Promise<CaseResult> {
  try {
    for (const step of testCase.steps) {
      await executeStep(step, page);
    }
    return { id: testCase.id, description: testCase.description, status: 'passed' };
  } catch (error) {
    const screenshotPath = `${SCREENSHOTS_DIR}${testCase.id}.png`;
    await page.screenshot({ path: screenshotPath });
    return {
      id: testCase.id,
      description: testCase.description,
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
      screenshotPath,
    };
  }
}

function saveResult(runResult: RunResult): void {
  const history: RunResult[] = existsSync(RESULTS_PATH)
    ? JSON.parse(readFileSync(RESULTS_PATH, 'utf-8'))
    : [];
  history.push(runResult);
  writeFileSync(RESULTS_PATH, JSON.stringify(history, null, 2));
}

function printSummary(runResult: RunResult): void {
  const labels = { passed: 'PASÓ', failed: 'FALLÓ', invalid: 'INVÁLIDO' } as const;

  console.log(`\nRun ${runResult.runId}`);
  for (const caseResult of runResult.cases) {
    console.log(`[${labels[caseResult.status]}] ${caseResult.id} — ${caseResult.description}`);
    if (caseResult.status === 'failed') console.log(`  error: ${caseResult.errorMessage}`);
    if (caseResult.status === 'invalid') console.log(`  motivo: ${caseResult.invalidReason}`);
  }

  console.log(
    `\n${runResult.passed} pasaron, ${runResult.failed} fallaron, ` +
      `${runResult.invalid} inválidos (total ${runResult.total})`,
  );
}

async function main() {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const cases: TestCase[] = JSON.parse(readFileSync(CASES_PATH, 'utf-8'));

  const browser = await chromium.launch();
  const validationPage = await browser.newPage();
  const validations = await validateCases(cases, validationPage);
  await validationPage.close();

  const results: CaseResult[] = [];

  for (const validation of validations) {
    if (!validation.valid) {
      results.push({
        id: validation.case.id,
        description: validation.case.description,
        status: 'invalid',
        invalidReason: validation.reason,
      });
      continue;
    }

    const page = await browser.newPage();
    results.push(await runCase(validation.case, page));
    await page.close();
  }

  await browser.close();

  const runResult: RunResult = {
    runId: new Date().toISOString().replace(/[:.]/g, '-'),
    timestamp: new Date().toISOString(),
    total: results.length,
    passed: results.filter((r) => r.status === 'passed').length,
    failed: results.filter((r) => r.status === 'failed').length,
    invalid: results.filter((r) => r.status === 'invalid').length,
    cases: results,
  };

  saveResult(runResult);
  printSummary(runResult);

  if (runResult.failed > 0) process.exitCode = 1;
}

main();
