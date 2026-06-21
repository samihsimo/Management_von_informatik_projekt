// ═══════════════════════════════════════════════════════════════════════════
// RASE Rule Formalization Tool — app.js
// ═══════════════════════════════════════════════════════════════════════════

// ── Example text ─────────────────────────────────────────────────────────────
const EXAMPLE_TEXT = `Aufenthaltsräume müssen eine lichte Raumhöhe von mindestens 2,40 m haben.

Aufenthaltsräume im Dachraum müssen eine lichte Raumhöhe von mindestens 2,20 m über mindestens der Hälfte ihrer Netto-Raumfläche haben; Raumteile mit einer lichten Raumhöhe bis zu 1,50 m bleiben außer Betracht.

Die Sätze 1 und 2 gelten nicht für Aufenthaltsräume in Wohngebäuden der Gebäudeklassen 1 und 2.`;

// ── Application state ─────────────────────────────────────────────────────────
let currentRules    = [];   // rules from latest single-analysis
let benchmarkResults = null; // { v1: {...}, v2: {...}, v3: {...} }
let currentFilter   = 'All';

// ── Human-reference feature definitions ──────────────────────────────────────
// Each entry: { label, check(rules[]) → boolean }
const FEATURES = [
  { label: '2.40 m Height Requirement',
    check: r => ruleIncludes(r, '2.40') || ruleIncludes(r, '2,40') },
  { label: '2.20 m Attic Requirement',
    check: r => ruleIncludes(r, '2.20') || ruleIncludes(r, '2,20') },
  { label: 'Habitable Rooms Scope (Applicability)',
    check: r => ruleIncludes(r, 'Aufenthaltsräume') },
  { label: 'Attic Space Rule (Dachraum)',
    check: r => ruleIncludes(r, 'Dachraum') },
  { label: 'GK1 / GK2 Exception',
    check: r => ruleIncludes(r, 'Gebäudeklassen') || ruleIncludes(r, 'GK1') },
  { label: '1.50 m Measurement Logic',
    check: r => r.some(x => x.rase_type === 'MeasurementLogic') },
];

// ── Type → CSS class mapping ──────────────────────────────────────────────────
const TYPE_CLASS = {
  Requirement:      'requirement',
  Applicability:    'applicability',
  Selection:        'selection',
  Exception:        'exception',
  MeasurementLogic: 'measurement',
};

// ── Type → colour (for SVG graph) ────────────────────────────────────────────
const TYPE_COLOR = {
  Requirement:      '#f87171',
  Applicability:    '#34d399',
  Selection:        '#fbbf24',
  Exception:        '#fb923c',
  MeasurementLogic: '#a78bfa',
};

// The order in which RASE types are rendered top-to-bottom in the graph.
const GRAPH_ORDER = ['Applicability', 'Requirement', 'MeasurementLogic', 'Selection', 'Exception'];

// ─────────────────────────────────────────────────────────────────────────────
// INITIALISATION
// ─────────────────────────────────────────────────────────────────────────────
document.getElementById('loadExampleBtn').onclick = () => {
  document.getElementById('inputText').value = EXAMPLE_TEXT;
};

// Show/hide prompt-version selector based on mode
document.getElementById('modeSelect').onchange = function () {
  const isGemini = this.value === 'gemini';
  document.getElementById('promptVersionLabel').style.display = isGemini ? '' : 'none';
};

document.getElementById('analyzeBtn').onclick  = analyze;
document.getElementById('compareBtn').onclick  = benchmark;

// Filter chip clicks
document.querySelectorAll('.chip').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderRules(currentRules);
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// API HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function callAPI(endpoint, body) {
  const res  = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE: single extraction
// ─────────────────────────────────────────────────────────────────────────────
async function analyze() {
  const text           = document.getElementById('inputText').value;
  const mode           = document.getElementById('modeSelect').value;
  const prompt_version = document.getElementById('promptVersionSelect').value;
  if (!text.trim()) { alert('Please paste a regulation text first.'); return; }

  const btn = document.getElementById('analyzeBtn');
  btn.textContent = 'Analyzing…';
  btn.disabled    = true;

  try {
    const data   = await callAPI('/api/extract', { text, mode, prompt_version });
    currentRules = data.rules || [];

    renderMetadata(data);
    renderRules(currentRules);
    renderHeatmap(currentRules);
    renderComparison(benchmarkResults);
    renderGraph(currentRules);
    document.getElementById('rawJson').textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    alert('Error: ' + e.message);
  } finally {
    btn.textContent = 'Analyze RASE';
    btn.disabled    = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 1: Prompt Benchmark — calls /api/benchmark (V1 + V2 + V3 at once)
// ─────────────────────────────────────────────────────────────────────────────
async function benchmark() {
  const text = document.getElementById('inputText').value;
  const mode = document.getElementById('modeSelect').value;
  if (!text.trim()) { alert('Please paste a regulation text first.'); return; }

  const btn = document.getElementById('compareBtn');
  btn.textContent = 'Comparing…';
  btn.disabled    = true;

  try {
    benchmarkResults = await callAPI('/api/benchmark', { text, mode });

    // Show the benchmark section
    document.getElementById('benchmarkSection').style.display = '';

    renderBenchmarkTable(benchmarkResults);   // Feature 1 table
    renderComparison(benchmarkResults);        // Feature 3 — fill V1/V2/V3 columns

    // Update current rules from V3 (the best prompt) if no prior single analysis
    if (!currentRules.length && benchmarkResults.v3) {
      currentRules = benchmarkResults.v3.rules || [];
      renderMetadata(benchmarkResults.v3);
      renderRules(currentRules);
      renderHeatmap(currentRules);
      renderGraph(currentRules);
      document.getElementById('rawJson').textContent =
        JSON.stringify(benchmarkResults, null, 2);
    }
  } catch (e) {
    alert('Error: ' + e.message);
  } finally {
    btn.textContent = 'Compare Prompts';
    btn.disabled    = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER: KPI cards
// ─────────────────────────────────────────────────────────────────────────────
function renderMetadata(data) {
  const rules = data.rules || [];
  document.getElementById('rulesCount').textContent     = rules.length;
  document.getElementById('confidenceScore').textContent =
    Math.round((data.metadata?.ai_confidence_level || 0) * 100) + '%';
  document.getElementById('similarityScore').textContent = calculateSimilarity(rules) + '%';
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER: RASE rule cards
// ─────────────────────────────────────────────────────────────────────────────
function renderRules(rules) {
  const grid     = document.getElementById('resultsGrid');
  const filtered = currentFilter === 'All'
    ? rules
    : rules.filter(r => r.rase_type === currentFilter);

  if (!filtered.length) {
    grid.className = 'results-grid empty';
    grid.innerHTML = '<p>No rules for this filter.</p>';
    return;
  }

  grid.className = 'results-grid';
  grid.innerHTML = '';
  filtered.forEach(rule => {
    const card = document.createElement('div');
    card.className = 'rule-card ' + (TYPE_CLASS[rule.rase_type] || '');
    card.innerHTML = `
      <div class="rule-top">
        <span class="badge">${escapeHtml(rule.rase_type)}</span>
        <span class="confidence">${Math.round((rule.confidence || 0) * 100)}%</span>
      </div>
      <h3>${escapeHtml(rule.id)}${rule.paragraph ? ' · ' + escapeHtml(rule.paragraph) : ''}</h3>
      <p class="source">${escapeHtml(rule.source_text)}</p>
      <code>${escapeHtml(rule.data_metric || '')}</code>
      ${rule.note ? `<p class="note">Why: ${escapeHtml(rule.note)}</p>` : ''}
    `;
    grid.appendChild(card);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 2: Confidence Heatmap
// ─────────────────────────────────────────────────────────────────────────────
function renderHeatmap(rules) {
  const container = document.getElementById('heatmapList');

  if (!rules.length) {
    container.innerHTML = '<p class="empty-msg">Run analysis to see the confidence heatmap.</p>';
    return;
  }

  // Sort highest confidence first
  const sorted = [...rules].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

  container.innerHTML = '';
  sorted.forEach(rule => {
    const pct   = Math.round((rule.confidence || 0) * 100);
    const barCls = pct >= 85 ? 'bar-green' : pct >= 60 ? 'bar-yellow' : 'bar-red';

    const item = document.createElement('div');
    item.className = 'heatmap-item';
    item.innerHTML = `
      <div class="heatmap-meta">
        <span class="heatmap-id">${escapeHtml(rule.id)}</span>
        <span class="heatmap-type ${TYPE_CLASS[rule.rase_type] || ''}-text">
          ${escapeHtml(rule.rase_type)}
        </span>
      </div>
      <div class="heatmap-row">
        <div class="heatmap-track">
          <div class="heatmap-bar ${barCls}" style="width:${pct}%"></div>
        </div>
        <span class="heatmap-pct">${pct}%</span>
      </div>
    `;
    container.appendChild(item);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 1: Benchmark summary table
// ─────────────────────────────────────────────────────────────────────────────
function renderBenchmarkTable(results) {
  const tbody = document.getElementById('benchmarkBody');
  tbody.innerHTML = '';

  ['v1', 'v2', 'v3'].forEach(pv => {
    const d     = results[pv] || {};
    const rules = d.rules || [];
    const conf  = Math.round((d.metadata?.ai_confidence_level || 0) * 100);
    const sim   = calculateSimilarity(rules);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong class="prompt-badge">${pv.toUpperCase()}</strong></td>
      <td>${rules.length}</td>
      <td>${conf}%</td>
      <td>${sim}%</td>
    `;
    tbody.appendChild(tr);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 3: Human vs Prompt multi-column comparison
// bench = { v1: data, v2: data, v3: data } or null
// ─────────────────────────────────────────────────────────────────────────────
function renderComparison(bench) {
  const tbody = document.getElementById('comparisonBody');
  tbody.innerHTML = '';

  FEATURES.forEach(feat => {
    const tick = ok =>
      ok === null
        ? '<span class="cmp-dash">—</span>'
        : ok
        ? '<span class="cmp-yes">✓</span>'
        : '<span class="cmp-no">✗</span>';

    const v1ok = bench ? feat.check(bench.v1?.rules || []) : null;
    const v2ok = bench ? feat.check(bench.v2?.rules || []) : null;
    const v3ok = bench ? feat.check(bench.v3?.rules || []) : null;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(feat.label)}</td>
      <td class="cmp-center">${tick(true)}</td>
      <td class="cmp-center">${tick(v1ok)}</td>
      <td class="cmp-center">${tick(v2ok)}</td>
      <td class="cmp-center">${tick(v3ok)}</td>
    `;
    tbody.appendChild(tr);
  });

  if (!bench) {
    const note = document.createElement('tr');
    note.innerHTML = `
      <td colspan="5" class="cmp-note">
        Click <strong>Compare Prompts</strong> to fill the V1 / V2 / V3 columns.
      </td>`;
    tbody.appendChild(note);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 4: RASE Structure Graph
//
// PURPOSE
//   The graph exists to make the conceptual structure of a regulation visible.
//   Rather than displaying raw JSON, it gives researchers and stakeholders an
//   at-a-glance map of how RASE elements relate to one another within a text.
//
// WHAT "CONCEPTUAL RELATIONSHIPS" MEANS
//   Nodes are grouped into rows by RASE type (Applicability → Requirement →
//   MeasurementLogic → Selection → Exception) and connected top-to-bottom with
//   dashed edges. This ordering reflects a common legal pattern: a scope
//   (Applicability) activates obligations (Requirements), which may be
//   qualified by measurement rules, selections, or exceptions.
//   The edges therefore represent plausible structural flow, not formal proofs
//   of dependency derived from the text.
//
// WHY LEGAL DEPENDENCIES ARE NOT YET INFERRED AUTOMATICALLY
//   Formally determining which exception overrides which requirement, or which
//   measurement clause qualifies exactly which threshold, requires either
//   (a) a structured ontology of the legal domain, or
//   (b) an LLM pass specifically trained to extract dependency triples.
//   Neither is implemented here. Introducing automated dependency inference
//   without validation would risk producing legally incorrect graphs.
//   This is flagged as a direction for future work.
// ─────────────────────────────────────────────────────────────────────────────
function renderGraph(rules) {
  const container = document.getElementById('ruleGraph');

  if (!rules.length) {
    container.innerHTML = '<p class="empty-msg">Run analysis to generate the rule graph.</p>';
    return;
  }

  // Group rules into rows by type (top → bottom)
  const rows = GRAPH_ORDER
    .map(type => ({ type, nodes: rules.filter(r => r.rase_type === type) }))
    .filter(row => row.nodes.length > 0);

  const NODE_W = 190, NODE_H = 68, GAP_X = 20, ROW_H = 110, PAD = 36;
  const W = Math.max(container.clientWidth || 700, 400);
  const svgH = PAD + rows.length * ROW_H + NODE_H;

  // Compute pixel positions for every node
  const placed = [];
  rows.forEach((row, ri) => {
    const totalW  = row.nodes.length * NODE_W + (row.nodes.length - 1) * GAP_X;
    const startX  = Math.max(PAD, (W - totalW) / 2);
    const y       = PAD + ri * ROW_H;
    row.nodes.forEach((rule, ci) => {
      placed.push({ rule, type: row.type, x: startX + ci * (NODE_W + GAP_X), y });
    });
  });

  const NS  = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('viewBox', `0 0 ${W} ${svgH}`);
  svg.style.display = 'block';

  // Arrowhead marker
  const defs   = document.createElementNS(NS, 'defs');
  const marker = document.createElementNS(NS, 'marker');
  marker.setAttribute('id',         'rase-arrow');
  marker.setAttribute('markerWidth', '8');
  marker.setAttribute('markerHeight', '6');
  marker.setAttribute('refX',        '7');
  marker.setAttribute('refY',        '3');
  marker.setAttribute('orient',      'auto');
  const arrowPoly = document.createElementNS(NS, 'polygon');
  arrowPoly.setAttribute('points', '0 0, 8 3, 0 6');
  arrowPoly.setAttribute('fill', 'rgba(99,102,241,0.55)');
  marker.appendChild(arrowPoly);
  defs.appendChild(marker);
  svg.appendChild(defs);

  // Draw edges: every node in row N → every node in row N+1
  for (let ri = 0; ri < rows.length - 1; ri++) {
    const froms = placed.filter(n => n.type === rows[ri].type);
    const tos   = placed.filter(n => n.type === rows[ri + 1].type);
    froms.forEach(from => {
      tos.forEach(to => {
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', from.x + NODE_W / 2);
        line.setAttribute('y1', from.y + NODE_H);
        line.setAttribute('x2', to.x   + NODE_W / 2);
        line.setAttribute('y2', to.y);
        line.setAttribute('stroke',           'rgba(99,102,241,0.38)');
        line.setAttribute('stroke-width',     '1.5');
        line.setAttribute('stroke-dasharray', '5,4');
        line.setAttribute('marker-end',       'url(#rase-arrow)');
        svg.appendChild(line);
      });
    });
  }

  // Draw nodes
  placed.forEach(({ rule, type, x, y }) => {
    const color = TYPE_COLOR[type] || '#6366f1';
    const g = document.createElementNS(NS, 'g');
    g.style.cursor = 'pointer';

    // Background rectangle
    const bg = document.createElementNS(NS, 'rect');
    bg.setAttribute('x',      x);     bg.setAttribute('y',      y);
    bg.setAttribute('width',  NODE_W); bg.setAttribute('height', NODE_H);
    bg.setAttribute('rx',     '14');
    bg.setAttribute('fill',   '#1a1e2e');
    bg.setAttribute('stroke', color);
    bg.setAttribute('stroke-width', '2');

    // RASE type label (small, coloured)
    const typeLabel = makeSVGText(NS, {
      x: x + NODE_W / 2, y: y + 24,
      anchor: 'middle', size: '10', weight: '800',
      fill: color, spacing: '0.08em',
      text: type.toUpperCase(),
    });

    // Rule ID (larger)
    const idLabel = makeSVGText(NS, {
      x: x + NODE_W / 2, y: y + 44,
      anchor: 'middle', size: '13', weight: '700',
      fill: '#e8eaf0',
      text: rule.id,
    });

    // Confidence (small, muted, bottom-right)
    const confLabel = makeSVGText(NS, {
      x: x + NODE_W - 10, y: y + 62,
      anchor: 'end', size: '10', weight: '400',
      fill: '#5b6280',
      text: Math.round((rule.confidence || 0) * 100) + '%',
    });

    // Native SVG tooltip (shows source_text on hover)
    const title = document.createElementNS(NS, 'title');
    title.textContent = rule.source_text || rule.id;

    g.appendChild(bg);
    g.appendChild(typeLabel);
    g.appendChild(idLabel);
    g.appendChild(confLabel);
    g.appendChild(title);
    svg.appendChild(g);

    // Hover: highlight background
    g.addEventListener('mouseenter', () => {
      bg.setAttribute('fill', 'rgba(99,102,241,0.18)');
      bg.setAttribute('stroke-width', '3');
    });
    g.addEventListener('mouseleave', () => {
      bg.setAttribute('fill', '#1a1e2e');
      bg.setAttribute('stroke-width', '2');
    });
  });

  container.innerHTML = '';
  container.appendChild(svg);
}

// Helper: create an SVG <text> element with common attributes
function makeSVGText(NS, { x, y, anchor, size, weight, fill, text, spacing }) {
  const el = document.createElementNS(NS, 'text');
  el.setAttribute('x',            x);
  el.setAttribute('y',            y);
  el.setAttribute('text-anchor',  anchor);
  el.setAttribute('font-size',    size);
  el.setAttribute('font-weight',  weight);
  el.setAttribute('fill',         fill);
  el.setAttribute('font-family',  "system-ui, 'Segoe UI', sans-serif");
  if (spacing) el.setAttribute('letter-spacing', spacing);
  el.textContent = text;
  return el;
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

// Percentage of FEATURES detected in a rules array (0–100)
function calculateSimilarity(rules) {
  const hits = FEATURES.filter(f => f.check(rules)).length;
  return Math.round(hits / FEATURES.length * 100);
}

// True if any rule contains needle in source_text, data_metric, or note
function ruleIncludes(rules, needle) {
  const n = needle.toLowerCase();
  return rules.some(r =>
    (r.source_text || '').toLowerCase().includes(n) ||
    (r.data_metric || '').toLowerCase().includes(n) ||
    (r.note        || '').toLowerCase().includes(n)
  );
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[s]));
}

// ── Seed comparison table on load (shows — placeholders until benchmark runs) ─
renderComparison(null);
