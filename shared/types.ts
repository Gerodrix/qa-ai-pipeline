// shared/types.ts
// Single source of truth for the shapes generator, runner, notifier and
// dashboard all agree on. Nothing in this file talks to Playwright, the LLM
// API, or n8n — it's pure data shape.

// --- Test steps -------------------------------------------------------
// One interface per action, joined into a discriminated union. This means
// a step can't be built with the wrong fields (e.g. a "click" carrying a
// "value") — the compiler rejects it, and the validator can switch on
// `action` and know exactly what to check for each case.

export interface GotoStep {
  action: 'goto';
  url: string;
}

export interface FillStep {
  action: 'fill';
  selector: string;
  value: string;
}

export interface ClickStep {
  action: 'click';
  selector: string;
}

export interface CheckStep {
  action: 'check';
  selector: string;
}

export interface AssertVisibleStep {
  action: 'assertVisible';
  selector: string;
}

export interface AssertTextStep {
  action: 'assertText';
  selector: string;
  value: string;
}

export type TestStep =
  | GotoStep
  | FillStep
  | ClickStep
  | CheckStep
  | AssertVisibleStep
  | AssertTextStep;

// Steps that carry a selector (every step except "goto"). Used by the
// validator to know which steps need a DOM check.
export type SelectorStep = Exclude<TestStep, GotoStep>;

export function hasSelector(step: TestStep): step is SelectorStep {
  return step.action !== 'goto';
}

// --- Test case ----------------------------------------------------------

export interface TestCase {
  id: string;            // e.g. "TC01"
  description: string;   // human-readable summary
  steps: TestStep[];
  expected: string;      // human-readable expected outcome — for reporting only,
                          // the real assertion lives in the steps themselves
}

// --- Validation (generator output -> runner input) -----------------------

export interface CaseValidation {
  case: TestCase;
  valid: boolean;
  reason?: string;        // set when valid === false, e.g. "selector '#foo' not found"
}

// --- Run results (runner output -> notifier + dashboard input) -----------

export type CaseStatus = 'passed' | 'failed' | 'invalid';

export interface CaseResult {
  id: string;
  description: string;
  status: CaseStatus;
  invalidReason?: string;   // set when status === 'invalid'
  errorMessage?: string;    // set when status === 'failed'
  screenshotPath?: string;  // set when status === 'failed'
}

export interface RunResult {
  runId: string;         // e.g. "2026-07-27-01"
  timestamp: string;     // ISO 8601
  total: number;
  passed: number;
  failed: number;
  invalid: number;
  cases: CaseResult[];
}
