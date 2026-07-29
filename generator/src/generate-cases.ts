// generator/src/generate-cases.ts
//
// Asks an LLM to propose TestCases for target-app, based only on the
// hand-written spec (not the real DOM — see target-app-spec.ts). Two
// things can go wrong with what comes back, and this file only handles
// the first one:
//
//   1. The JSON doesn't even have the right SHAPE (missing fields, wrong
//      step actions, etc.) — checked here, before anything is written.
//   2. The selectors inside a well-formed case don't actually EXIST on
//      the page — that's a different kind of hallucination, checked
//      later by validate-cases.ts, against the real DOM.
//
// Keeping these separate matches the two different things that can be
// wrong: one is "is this valid JSON shaped like a TestCase", the other
// is "does this test case correspond to reality".

import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import type { TestCase } from '../../shared/types.js';
import { TARGET_APP_SPEC } from './target-app-spec.js';

const OUTPUT_PATH = fileURLToPath(new URL('../../data/generated-cases.json', import.meta.url));
const MODEL = process.env.GENERATOR_MODEL ?? 'claude-sonnet-5';

const VALID_ACTIONS = ['goto', 'fill', 'click', 'check', 'assertVisible', 'assertText'] as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function describeStepError(step: unknown, index: number): string | null {
  if (typeof step !== 'object' || step === null) {
    return `step ${index}: no es un objeto`;
  }
  const s = step as Record<string, unknown>;

  if (!VALID_ACTIONS.includes(s.action as (typeof VALID_ACTIONS)[number])) {
    return `step ${index}: acción desconocida "${String(s.action)}"`;
  }

  switch (s.action) {
    case 'goto':
      if (!isNonEmptyString(s.url)) return `step ${index} (goto): falta "url"`;
      return null;
    case 'fill':
      if (!isNonEmptyString(s.selector)) return `step ${index} (fill): falta "selector"`;
      if (typeof s.value !== 'string') return `step ${index} (fill): falta "value"`;
      return null;
    case 'click':
    case 'check':
    case 'assertVisible':
      if (!isNonEmptyString(s.selector)) return `step ${index} (${s.action}): falta "selector"`;
      return null;
    case 'assertText':
      if (!isNonEmptyString(s.selector)) return `step ${index} (assertText): falta "selector"`;
      if (typeof s.value !== 'string') return `step ${index} (assertText): falta "value"`;
      return null;
    default:
      return null;
  }
}

function validateCaseShape(
  raw: unknown,
  index: number,
): { case: TestCase } | { reason: string } {
  if (typeof raw !== 'object' || raw === null) {
    return { reason: `caso ${index}: no es un objeto` };
  }
  const c = raw as Record<string, unknown>;

  if (!isNonEmptyString(c.id)) return { reason: `caso ${index}: falta "id"` };
  if (!isNonEmptyString(c.description)) {
    return { reason: `caso ${index} (${c.id}): falta "description"` };
  }
  if (!isNonEmptyString(c.expected)) {
    return { reason: `caso ${index} (${c.id}): falta "expected"` };
  }
  if (!Array.isArray(c.steps) || c.steps.length === 0) {
    return { reason: `caso ${index} (${c.id}): "steps" vacío o inválido` };
  }

  for (let i = 0; i < c.steps.length; i++) {
    const stepError = describeStepError(c.steps[i], i);
    if (stepError) return { reason: `caso ${index} (${c.id}): ${stepError}` };
  }

  return { case: raw as TestCase };
}

function buildPrompt(): string {
  return `
Sos un ingeniero de QA. A partir de esta especificación de un formulario,
proponé casos de prueba en formato JSON.

${TARGET_APP_SPEC}

Generá una MEZCLA de:
- Casos obvios: campo vacío, formato inválido, checkbox sin tildar.
- Casos LÍMITE (boundary cases), que son los más valiosos porque su
  resultado no está garantizado solo por leer la regla — por ejemplo:
  nombre de exactamente 2 caracteres (el mínimo exacto), contraseña de
  exactamente 8 caracteres, nombre con solo espacios en blanco, email
  con dos arrobas ("a@@b.com"), espacios al principio/final de un campo.

Cada caso debe tener esta forma exacta (TypeScript, para referencia):

interface TestCase {
  id: string;             // usá el prefijo "TC-GEN-" (ej "TC-GEN-01")
  description: string;
  steps: TestStep[];
  expected: string;
}

type TestStep =
  | { action: "goto"; url: string }
  | { action: "fill"; selector: string; value: string }
  | { action: "click"; selector: string }
  | { action: "check"; selector: string }
  | { action: "assertVisible"; selector: string }
  | { action: "assertText"; selector: string; value: string };

Reglas:
- El primer step de cada caso SIEMPRE es { "action": "goto", "url": "/" }.
- Usá SOLO los selectores mencionados en la especificación de arriba —
  nunca inventes uno nuevo.
- El último step debe ser un "assertVisible" o "assertText" que confirme
  el resultado esperado.
- Generá entre 6 y 10 casos.

Respondé ÚNICAMENTE con un array JSON de TestCase. Sin texto antes ni
después, sin bloques de markdown (nada de \`\`\`json).
`.trim();
}

function parseJsonArray(text: string): unknown[] {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) {
    throw new Error('La respuesta del modelo no es un array JSON.');
  }
  return parsed;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'Falta ANTHROPIC_API_KEY. Copiá generator/.env.example a .env y completá tu API key real.',
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  console.log(`Generando casos con ${MODEL}...`);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: buildPrompt() }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  const rawCases = parseJsonArray(text);

  const validCases: TestCase[] = [];
  const rejectedReasons: string[] = [];

  rawCases.forEach((raw, index) => {
    const result = validateCaseShape(raw, index);
    if ('case' in result) validCases.push(result.case);
    else rejectedReasons.push(result.reason);
  });

  writeFileSync(OUTPUT_PATH, JSON.stringify(validCases, null, 2));

  console.log(
    `\n${validCases.length} caso(s) con forma válida, guardado(s) en data/generated-cases.json`,
  );

  if (rejectedReasons.length > 0) {
    console.log(`${rejectedReasons.length} caso(s) descartado(s) por forma inválida:`);
    for (const reason of rejectedReasons) console.log(`  - ${reason}`);
  }

  console.log(
    '\nEstos casos todavía NO fueron validados contra el DOM real — ' +
      'corré "CASES_FILE=generated-cases.json npm run validate" en runner/ antes de ejecutarlos.',
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
