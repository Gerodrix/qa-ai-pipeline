// runner/src/validate-cases.ts
//
// Checks every selector a TestCase relies on actually exists in the DOM
// before any test is executed. This is the core safeguard against AI
// hallucination: if the generator invents a selector that doesn't exist
// on the page, we catch it here with a clear reason instead of getting a
// confusing Playwright timeout later, deep inside a real test run.

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { chromium, type Page } from 'playwright';
import {
  hasSelector,
  type TestCase,
  type CaseValidation,
} from '../../shared/types.js';

const CASES_PATH = new URL('../../data/cases.json', import.meta.url);
export const BASE_URL = process.env.TARGET_APP_URL ?? 'http://localhost:5173';

export async function validateCase(
  testCase: TestCase,
  page: Page,
): Promise<CaseValidation> {
  const gotoStep = testCase.steps.find((step) => step.action === 'goto');
  if (gotoStep) {
    await page.goto(new URL(gotoStep.url, BASE_URL).toString());
  }

  const missingSelectors: string[] = [];

  for (const step of testCase.steps) {
    if (!hasSelector(step)) continue;
    const matchCount = await page.locator(step.selector).count();
    if (matchCount === 0) missingSelectors.push(step.selector);
  }

  if (missingSelectors.length > 0) {
    return {
      case: testCase,
      valid: false,
      reason: `Selector(es) no encontrados: ${missingSelectors.join(', ')}`,
    };
  }

  return { case: testCase, valid: true };
}

export async function validateCases(
  cases: TestCase[],
  page: Page,
): Promise<CaseValidation[]> {
  const results: CaseValidation[] = [];
  for (const testCase of cases) {
    results.push(await validateCase(testCase, page));
  }
  return results;
}

async function main() {
  const cases: TestCase[] = JSON.parse(readFileSync(CASES_PATH, 'utf-8'));

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const results = await validateCases(cases, page);

  await browser.close();

  for (const result of results) {
    const status = result.valid ? 'VÁLIDO' : 'INVÁLIDO';
    console.log(`[${status}] ${result.case.id} — ${result.case.description}`);
    if (!result.valid) console.log(`  motivo: ${result.reason}`);
  }

  const invalidCount = results.filter((result) => !result.valid).length;
  if (invalidCount > 0) {
    console.error(`\n${invalidCount} caso(s) inválido(s) detectado(s).`);
    process.exitCode = 1;
  }
}

// Only run the CLI when this file is executed directly — not when
// run-tests.ts imports validateCases() to reuse this same check.
// pathToFileURL (instead of a manual `file://${...}` string) is what
// makes this comparison work on Windows too — it normalizes backslashes,
// drive letters, and spaces the same way import.meta.url already does.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
