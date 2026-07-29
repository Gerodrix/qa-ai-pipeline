// dashboard/main.js
//
// Reads the run history the runner produces (data/results.json) and
// renders it as a list of cards, newest run first. No framework, no
// build step — this is a read-only view over a static JSON file, so
// plain DOM calls are simpler than any tooling would be.

const RESULTS_PATH = '../data/results.json';

const STATUS_LABELS = {
  passed: 'PASÓ',
  failed: 'FALLÓ',
  invalid: 'INVÁLIDO',
};

function createCaseRow(caseResult) {
  const row = document.createElement('tr');

  const idCell = document.createElement('td');
  idCell.textContent = caseResult.id;

  const descriptionCell = document.createElement('td');
  descriptionCell.textContent = caseResult.description;

  const statusCell = document.createElement('td');
  const badge = document.createElement('span');
  badge.className = `status-badge status-${caseResult.status}`;
  badge.textContent = STATUS_LABELS[caseResult.status];
  statusCell.appendChild(badge);

  const detailCell = document.createElement('td');
  detailCell.className = 'case-detail';
  detailCell.textContent = caseResult.errorMessage ?? caseResult.invalidReason ?? '';

  row.append(idCell, descriptionCell, statusCell, detailCell);
  return row;
}

function createRunCard(run) {
  const card = document.createElement('section');
  card.className = 'run-card';

  const header = document.createElement('div');
  header.className = 'run-header';

  const runId = document.createElement('span');
  runId.className = 'run-id';
  runId.textContent = run.runId;

  const timestamp = document.createElement('span');
  timestamp.className = 'run-timestamp';
  timestamp.textContent = new Date(run.timestamp).toLocaleString('es-AR');

  header.append(runId, timestamp);

  const summary = document.createElement('p');
  summary.className = 'run-summary';
  summary.textContent = `${run.passed} pasaron, ${run.failed} fallaron, ${run.invalid} inválidos (total ${run.total})`;

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Caso</th><th>Descripción</th><th>Estado</th><th>Detalle</th></tr>';
  const tbody = document.createElement('tbody');
  for (const caseResult of run.cases) {
    tbody.appendChild(createCaseRow(caseResult));
  }
  table.append(thead, tbody);

  card.append(header, summary, table);
  return card;
}

async function loadResults() {
  const container = document.getElementById('runs-container');
  const emptyState = document.getElementById('empty-state');

  let runs;
  try {
    const response = await fetch(RESULTS_PATH);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    runs = await response.json();
  } catch (error) {
    emptyState.textContent =
      'No se pudo cargar data/results.json. Si abriste este archivo con doble-click, ' +
      'los navegadores bloquean fetch() a archivos locales — serví esta carpeta con ' +
      'un servidor local (por ejemplo "npx serve") y volvé a intentar.';
    return;
  }

  if (runs.length === 0) {
    emptyState.textContent = 'Todavía no hay corridas registradas — corré "npm run test" en runner/.';
    return;
  }

  emptyState.remove();

  // Newest run first — results.json is append-only, so the last entry
  // is the most recent.
  for (const run of [...runs].reverse()) {
    container.appendChild(createRunCard(run));
  }
}

loadResults();
