import { RBush, Envelope } from '../src/index.js';

const $ = id => document.getElementById(id);
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
const categories = ['coral', 'teal', 'indigo'];
const colors = { coral: '#e78b79', teal: '#6badad', indigo: '#929bcc' };
const number = new Intl.NumberFormat('en-US');
const state = { tree: new RBush(9), items: [], results: [], resultSet: new Set(), mode: 'query', selected: null, query: new Envelope(300, 200, 650, 450), center: { x: 500, y: 350 }, k: 12, radius: null, view: { x: 500, y: 350, scale: 1 }, nextId: 1, buildTime: 0, queryTime: 0, bruteTime: null, resultKind: 'query', drag: null, dirty: true, space: false, width: 0, height: 0, nodes: [] };
let toastTimer;
let renderPending = false;

function notify(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3600);
}
function protect(action) {
  return async (...args) => {
    try { await action(...args); }
    catch (error) { notify(error.message || String(error)); console.error(error); }
  };
}
function numeric(id, min = -Infinity, max = Infinity, integer = false) {
  const input = $(id), n = Number(input.value);
  if (input.value.trim() === '' || !Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
    input.focus();
    throw new Error(`Enter a valid ${input.labels?.[0]?.textContent || id}${Number.isFinite(min) && Number.isFinite(max) ? ` from ${min} to ${max}` : ''}.`);
  }
  return n;
}
function formatMs(value) { return value < 0.001 ? '<0.001' : value.toFixed(3); }
function categoryPredicate() { const category = $('category').value; return category === 'all' ? undefined : item => item.category === category; }
function pseudoRandom(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let n = Math.imul(seed ^ seed >>> 15, 1 | seed); n = n + Math.imul(n ^ n >>> 7, 61 | n) ^ n; return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
function generateItems(count) {
  const random = pseudoRandom(numeric('seed', 0, 4294967295, true));
  const shape = $('shape').value, distribution = $('distribution').value;
  const columns = Math.ceil(Math.sqrt(count * 1000 / 700)), rows = Math.ceil(count / columns);
  const clusters = [[200, 160], [750, 190], [440, 450], [820, 550], [130, 560]];
  return Array.from({ length: count }, (_, i) => {
    let x, y;
    if (distribution === 'grid') { x = (i % columns + .5) * 960 / columns + 20; y = (Math.floor(i / columns) + .5) * 660 / rows + 20; }
    else if (distribution === 'clusters') { const center = clusters[i % clusters.length]; const angle = random() * Math.PI * 2, radius = Math.sqrt(random()) * 95; x = center[0] + Math.cos(angle) * radius; y = center[1] + Math.sin(angle) * radius; }
    else { x = 20 + random() * 950; y = 20 + random() * 650; }
    const w = shape === 'points' ? 0 : 2 + random() * 13;
    const h = shape === 'points' ? 0 : 2 + random() * 11;
    return { id: i + 1, category: categories[i % 3], Envelope: new Envelope(x, y, x + w, y + h) };
  });
}
function collectNodes() {
  const nodes = [], visit = (node, depth) => { nodes.push({ node, depth }); if (!node.IsLeaf) for (const child of node.Children) visit(child, depth + 1); };
  visit(state.tree.Root, 0);
  state.nodes = nodes;
}
function updateStats() {
  collectNodes();
  $('count').textContent = number.format(state.tree.Count);
  $('height').innerHTML = `${state.tree.Root.Height}<span> levels</span>`;
  $('node-count').textContent = `${number.format(state.nodes.length)} nodes · capacity ${state.capacity ?? 9}`;
  $('build-time').innerHTML = `${formatMs(state.buildTime)}<span> ms</span>`;
  $('canvas-empty').hidden = state.items.length > 0;
  $('export').disabled = state.items.length === 0;
  requestRender();
}
async function generate() {
  const count = numeric('dataset-size', 100, 100000, true), capacity = numeric('capacity', 4, 128, true);
  $('generate').disabled = true;
  try {
    await new Promise(requestAnimationFrame);
    const items = generateItems(count), tree = new RBush(capacity);
    const start = performance.now(); tree.BulkLoad(items); state.buildTime = performance.now() - start;
    Object.assign(state, { tree, items, capacity, nextId: count + 1, selected: null });
    $('dataset-description').textContent = `${$('distribution').selectedOptions[0].text} ${$('shape').value}`;
    $('build-method').textContent = 'Bulk loading · OMT packing';
    $('benchmark-result').hidden = true;
    $('inspector').hidden = true;
    updateStats(); fitView(); runQuery(undefined, false);
  } finally { $('generate').disabled = false; }
}
async function benchmark() {
  if (!state.items.length) return notify('Generate or import items before benchmarking.');
  $('benchmark').disabled = true;
  $('benchmark-result').hidden = false;
  $('benchmark-result').textContent = 'Building both trees using the current dataset…';
  try {
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    // Timed regions include index construction only, excluding data generation and drawing.
    const bulk = new RBush(state.capacity), inserted = new RBush(state.capacity);
    let start = performance.now(); bulk.BulkLoad(state.items); const bulkMs = performance.now() - start;
    start = performance.now(); for (const item of state.items) inserted.Insert(item); const insertMs = performance.now() - start;
    const query = state.query ?? new Envelope(300, 200, 650, 450);
    const a = new Set(bulk.Search(query).map(item => item.id)), b = inserted.Search(query);
    const matches = bulk.Count === inserted.Count && a.size === b.length && b.every(item => a.has(item.id));
    $('benchmark-result').innerHTML = `<b>BulkLoad</b> ${formatMs(bulkMs)} ms<br><b>Insert × ${number.format(state.items.length)}</b> ${formatMs(insertMs)} ms<br>${matches ? '✓ Counts and current window query agree' : '⚠ Results disagree'}<br>One measured run · device-dependent`;
  } finally { $('benchmark').disabled = false; }
}
function queryBounds() {
  const minX = numeric('min-x'), minY = numeric('min-y'), maxX = numeric('max-x'), maxY = numeric('max-y');
  if (minX > maxX || minY > maxY) throw new Error('Minimum coordinates must not exceed maximum coordinates.');
  return new Envelope(minX, minY, maxX, maxY);
}
function syncBounds(e) {
  $('min-x').value = Number(e.MinX.toFixed(2)); $('min-y').value = Number(e.MinY.toFixed(2));
  $('max-x').value = Number(e.MaxX.toFixed(2)); $('max-y').value = Number(e.MaxY.toFixed(2));
}
function distance(item, point) {
  const e = item.Envelope, dx = Math.max(e.MinX - point.x, 0, point.x - e.MaxX), dy = Math.max(e.MinY - point.y, 0, point.y - e.MaxY);
  return Math.hypot(dx, dy);
}
function runQuery(kind = state.mode === 'nearest' ? 'nearest' : 'query', fromInputs = true) {
  const predicate = categoryPredicate();
  let result, reference, snippet, start, good = null, k, radius;
  state.bruteTime = null;
  if (kind === 'nearest') {
    const center = fromInputs ? { x: numeric('min-x'), y: numeric('min-y') } : state.center;
    k = fromInputs ? numeric('neighbors', 0, 100000, true) : state.k;
    radius = fromInputs ? ($('radius').value.trim() === '' ? null : numeric('radius', 0, 2000)) : state.radius;
    state.center = center; state.k = k; state.radius = radius;
    start = performance.now(); result = state.tree.Knn(k, state.center.x, state.center.y, radius, predicate); state.queryTime = performance.now() - start;
    snippet = `const matches = tree.Knn(\n  ${k}, ${state.center.x}, ${state.center.y}, ${radius ?? 'null'}${predicate ? `,\n  item => item.category === '${$('category').value}'` : ''}\n);`;
    if ($('verify').checked) {
      start = performance.now();
      reference = state.items.map(item => ({ item, distance: distance(item, state.center) })).filter(entry => (radius === null || entry.distance <= radius) && (!predicate || predicate(entry.item))).sort((a, b) => a.distance - b.distance);
      if (k > 0) reference = reference.slice(0, k);
      state.bruteTime = performance.now() - start;
      // Equal-distance neighbors may validly appear in any order; compare sorted distances.
      const actualDistances = result.map(item => distance(item, state.center)).sort((a, b) => a - b);
      good = result.length === reference.length && new Set(result).size === result.length && result.every(item => !predicate || predicate(item)) && actualDistances.every((d, i) => Math.abs(d - reference[i].distance) <= 1e-8);
    }
  } else {
    const bounds = kind === 'all' ? null : fromInputs ? queryBounds() : state.query;
    if (bounds) state.query = bounds;
    start = performance.now(); result = bounds ? state.tree.Search(bounds) : state.tree.Search(); if (predicate) result = result.filter(predicate); state.queryTime = performance.now() - start;
    snippet = bounds ? `const bounds = new Envelope(${[bounds.MinX, bounds.MinY, bounds.MaxX, bounds.MaxY].join(', ')});\nconst matches = tree.Search(bounds);` : 'const matches = tree.Search();\nconsole.log(tree.Count, tree.Root.Height);';
    if (predicate) snippet += `\nconst filtered = matches.filter(item => item.category === '${$('category').value}');`;
    if ($('verify').checked) {
      start = performance.now(); reference = state.items.filter(item => (!bounds || bounds.Intersects(item.Envelope)) && (!predicate || predicate(item))); state.bruteTime = performance.now() - start;
      const expected = new Set(reference); good = result.length === reference.length && new Set(result).size === result.length && result.every(item => expected.has(item));
    }
  }
  state.resultKind = kind;
  state.results = result;
  state.resultSet = new Set(result);
  $('query-time').innerHTML = `${formatMs(state.queryTime)}<span> ms</span>`;
  $('query-summary').textContent = `${number.format(result.length)} ${kind === 'nearest' ? 'neighbors' : 'matches'} found`;
  $('result-time').textContent = `${formatMs(state.queryTime)} ms`;
  $('brute-time').textContent = state.bruteTime === null ? 'Disabled' : `${formatMs(state.bruteTime)} ms`;
  $('verification').textContent = good === null ? 'Verification disabled' : good ? '✓ Results match the linear scan' : '⚠ Results differ from the linear scan';
  $('verification').className = `verification${good === null ? '' : good ? ' good' : ' bad'}`;
  $('verification').dataset.valid = String(good);
  $('result-column').textContent = kind === 'nearest' ? 'DISTANCE' : 'BOUNDS';
  $('api-code').textContent = snippet;
  renderResults(); requestRender();
}
function renderResults() {
  $('result-count').textContent = number.format(state.results.length);
  const list = $('result-list'); list.replaceChildren();
  if (!state.results.length) { const empty = document.createElement('div'); empty.className = 'empty-results'; empty.innerHTML = '<span aria-hidden="true">⌕</span>No matches in this space.<br>Try a larger query or another filter.'; list.append(empty); }
  for (const item of state.results.slice(0, 100)) {
    const row = document.createElement('button'), e = item.Envelope;
    row.className = `result-row${state.selected === item ? ' selected' : ''}`;
    row.dataset.id = item.id; row.type = 'button'; row.setAttribute('role', 'listitem');
    row.setAttribute('aria-label', `Inspect item ${item.id}, ${item.category}`);
    row.innerHTML = `<span class="result-row-main"><i class="item-glyph ${item.category}" aria-hidden="true"></i><span><span class="item-name">Item ${String(item.id).padStart(4, '0')}</span><span class="item-category">${item.category}</span></span></span><span class="item-bounds">${state.resultKind === 'nearest' ? `${distance(item, state.center).toFixed(2)} units` : `${e.MinX.toFixed(0)}, ${e.MinY.toFixed(0)}<br>${e.MaxX.toFixed(0)}, ${e.MaxY.toFixed(0)}`}</span>`;
    row.addEventListener('click', () => inspectItem(item)); list.append(row);
  }
  $('result-limit').textContent = state.results.length > 100 ? `Showing 100 of ${number.format(state.results.length)} matches` : `${number.format(state.results.length)} ${state.results.length === 1 ? 'item' : 'items'} in this result`;
}
function inspectItem(item) {
  state.selected = item;
  $('inspector').hidden = false;
  $('item-details').textContent = JSON.stringify({ id: item.id, category: item.category, Envelope: { MinX: Number(item.Envelope.MinX.toFixed(3)), MinY: Number(item.Envelope.MinY.toFixed(3)), MaxX: Number(item.Envelope.MaxX.toFixed(3)), MaxY: Number(item.Envelope.MaxY.toFixed(3)) }, Area: Number(item.Envelope.Area.toFixed(3)), Margin: Number(item.Envelope.Margin.toFixed(3)) }, null, 2);
  renderResults(); requestRender();
}
function insertAt(point) {
  const pointOnly = $('shape').value === 'points', category = $('category').value === 'all' ? categories[(state.nextId - 1) % 3] : $('category').value;
  const item = { id: state.nextId++, category, Envelope: new Envelope(point.x, point.y, point.x + (pointOnly ? 0 : 18), point.y + (pointOnly ? 0 : 14)) };
  state.tree.Insert(item); state.items.push(item); updateStats(); runQuery(state.resultKind, false); inspectItem(item);
  $('api-code').textContent = `const item = { id: ${item.id}, category: '${category}',\n  Envelope: new Envelope(${[item.Envelope.MinX, item.Envelope.MinY, item.Envelope.MaxX, item.Envelope.MaxY].map(n => Number(n.toFixed(2))).join(', ')}) };\ntree.Insert(item);`;
  notify(`Inserted item ${item.id}. The index now contains ${number.format(state.tree.Count)} items.`);
}
function deleteSelected() {
  const item = state.selected;
  if (!item) return notify('Select an item in the results first.');
  if (!state.tree.Delete(item)) throw new Error('The selected item could not be removed.');
  state.items.splice(state.items.indexOf(item), 1); state.selected = null; $('inspector').hidden = true;
  updateStats(); runQuery(state.resultKind, false);
  $('api-code').textContent = `const removed = tree.Delete(item); // true\nconsole.log(tree.Count); // ${state.tree.Count}`;
  notify(`Deleted item ${item.id}.`);
}
function setMode(mode) {
  // Point-based modes reuse the minimum-coordinate fields. Restore the saved
  // rectangle on exit instead of treating a point as new rectangle minima.
  if (state.mode !== mode && (state.mode === 'nearest' || state.mode === 'insert') && mode !== 'nearest') syncBounds(state.query);
  if (state.mode !== mode && mode === 'nearest') { $('min-x').value = state.center.x; $('min-y').value = state.center.y; }
  state.mode = mode;
  for (const button of document.querySelectorAll('[data-mode]')) { const on = button.dataset.mode === mode; button.classList.toggle('selected', on); button.setAttribute('aria-pressed', String(on)); }
  const instructions = { query: 'Drag a rectangle to discover what\'s inside', nearest: 'Click anywhere to find its nearest neighbors', insert: 'Click to insert a new item into the index', move: 'Drag an item to update its indexed position' };
  $('canvas-instruction').innerHTML = `<span aria-hidden="true">↖</span> ${instructions[mode]}`;
  $('query-kind').textContent = { query: 'Envelope intersection', nearest: 'Distance to envelope', insert: 'Insert at minimum coordinates', move: 'Envelope intersection' }[mode];
  $('run-query').innerHTML = mode === 'insert' ? 'Insert item <span aria-hidden="true">＋</span>' : 'Run query <span aria-hidden="true">→</span>';
  $('max-x').disabled = $('max-y').disabled = mode === 'nearest' || mode === 'insert';
  canvas.style.cursor = mode === 'move' ? 'grab' : 'crosshair';
}
function fitView() {
  const root = state.tree.Root.Envelope;
  const minX = Math.min(0, state.items.length ? root.MinX : 0), minY = Math.min(0, state.items.length ? root.MinY : 0);
  const maxX = Math.max(1000, state.items.length ? root.MaxX : 1000), maxY = Math.max(700, state.items.length ? root.MaxY : 700);
  state.view = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, scale: Math.min((state.width - 58) / (maxX - minX), (state.height - 65) / (maxY - minY)) };
  requestRender();
}
function screenToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return { x: (clientX - rect.left - state.width / 2) / state.view.scale + state.view.x, y: (clientY - rect.top - state.height / 2) / state.view.scale + state.view.y };
}
function drawBounds(e, fill = true) {
  const x = e.MinX, y = e.MinY, w = e.MaxX - e.MinX, h = e.MaxY - e.MinY;
  if (w === 0 && h === 0) { const r = 1.8 / state.view.scale; if (fill) ctx.rect(x - r, y - r, r * 2, r * 2); else ctx.rect(x - 3 / state.view.scale, y - 3 / state.view.scale, 6 / state.view.scale, 6 / state.view.scale); }
  else ctx.rect(x, y, w, h);
}
function requestRender() {
  state.dirty = true;
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => { renderPending = false; if (state.dirty) render(); });
}
function render() {
  state.dirty = false;
  const { width, height, view } = state;
  if (!width || !height) return;
  const dark = document.documentElement.dataset.theme === 'dark', dpr = Math.min(devicePixelRatio || 1, 2);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
  ctx.translate(width / 2, height / 2); ctx.scale(view.scale, view.scale); ctx.translate(-view.x, -view.y);
  const left = view.x - width / 2 / view.scale, top = view.y - height / 2 / view.scale, right = view.x + width / 2 / view.scale, bottom = view.y + height / 2 / view.scale;
  const interval = 10 ** Math.floor(Math.log10(90 / view.scale)), grid = interval * (90 / view.scale / interval > 5 ? 5 : 1);
  ctx.strokeStyle = dark ? '#34415460' : '#dfe4eb'; ctx.lineWidth = .6 / view.scale; ctx.beginPath();
  for (let x = Math.ceil(left / grid) * grid; x <= right; x += grid) { ctx.moveTo(x, top); ctx.lineTo(x, bottom); }
  for (let y = Math.ceil(top / grid) * grid; y <= bottom; y += grid) { ctx.moveTo(left, y); ctx.lineTo(right, y); }
  ctx.stroke();
  const viewport = new Envelope(left, top, right, bottom), visible = state.tree.Count > 20000 && view.scale > .8 ? state.tree.Search(viewport) : state.items;
  const filtered = state.results.length > 0;
  for (const category of categories) {
    ctx.fillStyle = colors[category]; ctx.globalAlpha = filtered ? (dark ? .22 : .3) : (dark ? .65 : .58); ctx.beginPath();
    for (const item of visible) if (item.category === category && viewport.Intersects(item.Envelope)) drawBounds(item.Envelope);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if ($('show-tree').checked) {
    const depthValue = $('tree-level').value, levels = ['#d87947', '#7397bc', '#9383bc', '#5c9c84', '#bd889b'];
    let drawn = 0;
    for (const { node, depth } of state.nodes) {
      if (drawn >= 1200) break;
      if ((depthValue !== 'all' && depth !== Number(depthValue)) || !viewport.Intersects(node.Envelope) || !Number.isFinite(node.Envelope.MinX)) continue;
      ctx.strokeStyle = levels[depth % levels.length]; ctx.globalAlpha = .48; ctx.lineWidth = (depth === 0 ? 1.4 : .7) / view.scale;
      ctx.strokeRect(node.Envelope.MinX, node.Envelope.MinY, node.Envelope.MaxX - node.Envelope.MinX, node.Envelope.MaxY - node.Envelope.MinY); drawn++;
    }
    ctx.globalAlpha = 1;
  }
  for (const category of categories) {
    ctx.fillStyle = colors[category]; ctx.strokeStyle = colors[category]; ctx.lineWidth = .8 / view.scale; ctx.beginPath();
    for (const item of state.results) if (item.category === category && viewport.Intersects(item.Envelope)) drawBounds(item.Envelope);
    ctx.globalAlpha = .95; ctx.fill(); if (state.results.length < 3000) ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const isQueryDrag = state.drag?.type === 'query';
  if ((state.resultKind === 'query' || isQueryDrag) && state.query) {
    const e = state.query;
    ctx.fillStyle = dark ? '#f28a6e12' : '#e3634709'; ctx.fillRect(e.MinX, e.MinY, e.MaxX - e.MinX, e.MaxY - e.MinY);
    ctx.strokeStyle = dark ? '#f28a6e' : '#e36347'; ctx.lineWidth = 1.3 / view.scale; ctx.setLineDash([5 / view.scale, 4 / view.scale]); ctx.strokeRect(e.MinX, e.MinY, e.MaxX - e.MinX, e.MaxY - e.MinY); ctx.setLineDash([]);
    ctx.fillStyle = dark ? '#f28a6e' : '#e36347'; const s = 4 / view.scale;
    for (const [x, y] of [[e.MinX, e.MinY], [e.MaxX, e.MinY], [e.MinX, e.MaxY], [e.MaxX, e.MaxY]]) ctx.fillRect(x - s / 2, y - s / 2, s, s);
  }
  if (state.resultKind === 'nearest') {
    const p = state.center;
    if (state.radius != null) { ctx.beginPath(); ctx.arc(p.x, p.y, state.radius, 0, Math.PI * 2); ctx.fillStyle = '#e3634709'; ctx.fill(); ctx.strokeStyle = '#e3634770'; ctx.lineWidth = 1 / view.scale; ctx.setLineDash([4 / view.scale, 4 / view.scale]); ctx.stroke(); ctx.setLineDash([]); }
    if (state.results.length <= 100) { ctx.beginPath(); ctx.strokeStyle = '#e3634748'; ctx.lineWidth = .65 / view.scale; for (const item of state.results) { const e = item.Envelope; ctx.moveTo(p.x, p.y); ctx.lineTo(Math.max(e.MinX, Math.min(e.MaxX, p.x)), Math.max(e.MinY, Math.min(e.MaxY, p.y))); } ctx.stroke(); }
    ctx.beginPath(); ctx.arc(p.x, p.y, 5 / view.scale, 0, Math.PI * 2); ctx.fillStyle = '#e36347'; ctx.fill(); ctx.strokeStyle = dark ? '#1b2531' : '#fff'; ctx.lineWidth = 2 / view.scale; ctx.stroke();
  }
  if (state.selected) {
    const e = state.drag?.type === 'move' && state.drag.preview ? state.drag.preview : state.selected.Envelope;
    ctx.strokeStyle = dark ? '#fff' : '#263243'; ctx.lineWidth = 2 / view.scale; ctx.beginPath(); drawBounds(new Envelope(e.MinX - 3 / view.scale, e.MinY - 3 / view.scale, e.MaxX + 3 / view.scale, e.MaxY + 3 / view.scale), false); ctx.stroke();
  }
  $('canvas-scale').style.width = `${grid * view.scale}px`; $('canvas-scale').textContent = `${grid} units`;
}

const resizeObserver = new ResizeObserver(() => {
  const rect = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2), initial = state.width === 0;
  state.width = rect.width; state.height = rect.height; canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
  if (initial) fitView(); else requestRender();
});
resizeObserver.observe(canvas);

canvas.addEventListener('pointerdown', protect(event => {
  if (event.button !== 0 && event.button !== 1) return;
  canvas.focus(); canvas.setPointerCapture(event.pointerId);
  const point = screenToWorld(event.clientX, event.clientY);
  if (state.space || event.button === 1) { state.drag = { type: 'pan', point, view: { ...state.view }, screen: { x: event.clientX, y: event.clientY } }; canvas.style.cursor = 'grabbing'; return; }
  if (state.mode === 'query') { state.drag = { type: 'query', point }; state.query = new Envelope(point.x, point.y, point.x, point.y); requestRender(); }
  else if (state.mode === 'nearest') { $('min-x').value = point.x.toFixed(2); $('min-y').value = point.y.toFixed(2); runQuery('nearest'); }
  else if (state.mode === 'insert') insertAt(point);
  else if (state.mode === 'move') {
    const tolerance = 8 / state.view.scale;
    const candidates = state.tree.Search(new Envelope(point.x - tolerance, point.y - tolerance, point.x + tolerance, point.y + tolerance)).sort((a, b) => distance(a, point) - distance(b, point));
    if (!candidates.length) return notify('No item here. Drag one of the colored geometries.');
    inspectItem(candidates[0]); state.drag = { type: 'move', point, item: candidates[0], original: candidates[0].Envelope }; canvas.style.cursor = 'grabbing';
  }
}));
canvas.addEventListener('pointermove', event => {
  const point = screenToWorld(event.clientX, event.clientY);
  $('pointer-coords').textContent = `x: ${point.x.toFixed(1)}  y: ${point.y.toFixed(1)}`;
  const drag = state.drag;
  if (!drag) return;
  if (drag.type === 'pan') { state.view.x = drag.view.x - (event.clientX - drag.screen.x) / state.view.scale; state.view.y = drag.view.y - (event.clientY - drag.screen.y) / state.view.scale; }
  else if (drag.type === 'query') { state.query = new Envelope(Math.min(point.x, drag.point.x), Math.min(point.y, drag.point.y), Math.max(point.x, drag.point.x), Math.max(point.y, drag.point.y)); syncBounds(state.query); }
  else if (drag.type === 'move') { const e = drag.original, dx = point.x - drag.point.x, dy = point.y - drag.point.y; drag.preview = new Envelope(e.MinX + dx, e.MinY + dy, e.MaxX + dx, e.MaxY + dy); }
  requestRender();
});
canvas.addEventListener('pointerup', protect(event => {
  const drag = state.drag; state.drag = null; canvas.style.cursor = state.mode === 'move' ? 'grab' : 'crosshair';
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  if (drag?.type === 'query') { syncBounds(state.query); runQuery('query'); }
  else if (drag?.type === 'move' && drag.preview) {
    if (!state.tree.Delete(drag.item)) throw new Error('Could not update the selected item.');
    drag.item.Envelope = drag.preview; state.tree.Insert(drag.item); updateStats(); runQuery(state.resultKind, false); inspectItem(drag.item);
    $('api-code').textContent = 'tree.Delete(item); // remove using the original envelope\nitem.Envelope = updatedEnvelope;\ntree.Insert(item); // re-index its new position';
    notify(`Updated item ${drag.item.id} with Delete + Insert.`);
  }
  requestRender();
}));
canvas.addEventListener('pointercancel', () => { state.drag = null; requestRender(); });
canvas.addEventListener('wheel', event => {
  event.preventDefault(); const before = screenToWorld(event.clientX, event.clientY);
  state.view.scale = Math.max(.02, Math.min(100, state.view.scale * Math.exp(-event.deltaY * .0015)));
  const after = screenToWorld(event.clientX, event.clientY); state.view.x += before.x - after.x; state.view.y += before.y - after.y; requestRender();
}, { passive: false });

$('generate').addEventListener('click', protect(generate));
$('benchmark').addEventListener('click', protect(benchmark));
$('run-query').addEventListener('click', protect(() => state.mode === 'insert' ? insertAt({ x: numeric('min-x'), y: numeric('min-y') }) : runQuery()));
$('search-all').addEventListener('click', protect(() => runQuery('all')));
$('fit').addEventListener('click', fitView);
for (const button of document.querySelectorAll('[data-mode]')) button.addEventListener('click', () => setMode(button.dataset.mode));
for (const id of ['category', 'neighbors', 'radius']) $(id).addEventListener('change', protect(() => state.mode === 'nearest' ? runQuery('nearest') : runQuery(state.resultKind, false)));
$('verify').addEventListener('change', protect(() => runQuery(state.resultKind, false)));
for (const id of ['show-tree', 'tree-level']) $(id).addEventListener('change', () => { $('tree-level-value').value = $('tree-level').value === 'all' ? 'All' : $('tree-level').value; requestRender(); });
$('delete-item').addEventListener('click', protect(deleteSelected));
$('close-inspector').addEventListener('click', () => { state.selected = null; $('inspector').hidden = true; renderResults(); requestRender(); });
$('focus-item').addEventListener('click', () => { if (!state.selected) return; const e = state.selected.Envelope; state.view = { x: (e.MinX + e.MaxX) / 2, y: (e.MinY + e.MaxY) / 2, scale: Math.min(10, (state.width - 60) / Math.max(60, e.MaxX - e.MinX), (state.height - 60) / Math.max(60, e.MaxY - e.MinY)) }; requestRender(); });
$('clear').addEventListener('click', protect(() => { state.tree.Clear(); state.items = []; state.selected = null; state.buildTime = 0; state.nextId = 1; $('inspector').hidden = true; $('benchmark-result').hidden = true; updateStats(); runQuery(state.resultKind, false); $('api-code').textContent = 'tree.Clear();\nconsole.log(tree.Count); // 0'; notify('Index cleared. Generate a new dataset or insert individual items.'); }));
$('copy-code').addEventListener('click', protect(async () => { await navigator.clipboard.writeText($('api-code').textContent); notify('API example copied.'); }));
$('run-recipe').addEventListener('click', protect(() => {
  const kind = $('recipe').value;
  let output;
  if (kind === 'geometry') {
    const a = new Envelope(0, 0, 10, 20), b = new Envelope(5, 5, 15, 15);
    $('api-code').textContent = 'const a = new Envelope(0, 0, 10, 20);\nconst b = new Envelope(5, 5, 15, 15);\na.Area; a.Margin; a.Contains(b); a.Intersects(b);\na.Extend(b); a.Intersection(b); a.DistanceTo(13, 24);\na.Equals(new Envelope(0, 0, 10, 20));\na.Deconstruct(); a.GetHashCode(); a.ToString();';
    output = { Area: a.Area, Margin: a.Margin, Contains: a.Contains(b), Intersects: a.Intersects(b), Extend: a.Extend(b).Deconstruct(), Intersection: a.Intersection(b).Deconstruct(), DistanceTo: a.DistanceTo(13, 24), Equals: a.Equals(new Envelope(0, 0, 10, 20)), Hash: a.GetHashCode(), InfiniteContains: Envelope.InfiniteBounds.Contains(a), EmptyExtended: Envelope.EmptyBounds.Extend(a).Deconstruct() };
  } else if (kind === 'comparer') {
    const tree = new RBush(9, (a, b) => a.id === b.id), item = { id: 42, Envelope: new Envelope(1, 1, 2, 2) };
    tree.Insert(item); tree.Insert(item);
    const before = tree.Count, removed = tree.Delete({ id: 42, Envelope: new Envelope(1, 1, 2, 2) });
    $('api-code').textContent = 'const tree = new RBush(9, (a, b) => a.id === b.id);\ntree.Insert(item); tree.Insert(item); // duplicates allowed\nconst removed = tree.Delete({ id: item.id,\n  Envelope: item.Envelope }); // custom equality';
    output = { BeforeDelete: before, Removed: removed, AfterDelete: tree.Count, RemainingItems: tree.Search().length };
  } else if (kind === 'snapshot') {
    const serialized = JSON.stringify(state.tree.ToJSON());
    const start = performance.now(), restored = RBush.FromJSON(JSON.parse(serialized));
    const restoreTime = performance.now() - start;
    const expected = new Set(state.tree.Search(state.query).map(item => item.id)), actual = restored.Search(state.query);
    $('api-code').textContent = 'const snapshot = JSON.stringify(tree.ToJSON());\nconst restored = RBush.FromJSON(JSON.parse(snapshot));\nrestored.Validate(); restored.GetStats();\nconst matches = restored.Search(bounds);';
    output = { OriginalCount: state.tree.Count, RestoredCount: restored.Count, RestoredHeight: restored.Root.Height, Valid: restored.Validate(), Stats: restored.GetStats(), SnapshotBytes: new TextEncoder().encode(serialized).length, RestoreMilliseconds: Number(restoreTime.toFixed(3)), QueryAgrees: expected.size === actual.length && actual.every(item => expected.has(item.id)) };
  } else {
    const tree = new RBush(), item = { minX: 1, minY: 2, maxX: 3, maxY: 4 };
    tree.insert(item);
    $('api-code').textContent = 'const tree = new RBush();\ntree.insert({ minX: 1, minY: 2, maxX: 3, maxY: 4 });\nconst matches = tree.search(); const items = [...tree];\ntree.collides(item); tree.getStats(); tree.validate();\ntree.remove(items[0]);';
    const found = tree.search(), iterated = [...tree], collides = tree.collides(item), stats = tree.getStats(), valid = tree.validate(); tree.remove(item);
    output = { SearchCount: found.length, IteratedCount: iterated.length, Collides: collides, Stats: stats, Valid: valid, CountAfterRemove: tree.Count };
  }
  $('recipe-output').textContent = JSON.stringify(output, null, 2);
}));
$('export').addEventListener('click', () => {
  const contents = { format: 'RBushWeb.dataset', version: 1, capacity: state.capacity ?? 9, items: state.items.map(item => ({ id: item.id, category: item.category, Envelope: { MinX: item.Envelope.MinX, MinY: item.Envelope.MinY, MaxX: item.Envelope.MaxX, MaxY: item.Envelope.MaxY } })) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(contents)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'rbushweb-dataset.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); notify(`Exported ${number.format(state.items.length)} items.`);
});
$('import').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', protect(async event => {
  const file = event.target.files[0]; event.target.value = ''; if (!file) return;
  if (file.size > 64 * 1024 * 1024) throw new Error('Choose a JSON dataset smaller than 64 MB.');
  const payload = JSON.parse(await file.text()), source = Array.isArray(payload) ? payload : payload.items;
  if (!Array.isArray(source) || source.length > 100000) throw new Error('The JSON must contain an items array with at most 100,000 items.');
  const ids = new Set();
  const items = source.map((record, index) => {
    if (!record || typeof record !== 'object') throw new Error(`Invalid item at index ${index}.`);
    const e = record.Envelope ?? record.envelope ?? record, values = [e.MinX ?? e.minX, e.MinY ?? e.minY, e.MaxX ?? e.maxX, e.MaxY ?? e.maxY];
    if (!values.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e9) || values[0] > values[2] || values[1] > values[3]) throw new Error(`Invalid envelope at item ${index + 1}. Coordinates must be finite, ordered, and within ±1 billion.`);
    const id = Number.isSafeInteger(record.id) && record.id > 0 && record.id < Number.MAX_SAFE_INTEGER - 100001 ? record.id : index + 1;
    if (ids.has(id)) throw new Error(`Duplicate item ID ${id}. IDs must be unique positive integers.`);
    ids.add(id);
    return { id, category: categories.includes(record.category) ? record.category : categories[index % 3], Envelope: new Envelope(...values) };
  });
  const capacity = Number.isInteger(payload.capacity) && payload.capacity >= 4 && payload.capacity <= 128 ? payload.capacity : numeric('capacity', 4, 128, true);
  const tree = new RBush(capacity); const start = performance.now(); tree.BulkLoad(items); state.buildTime = performance.now() - start;
  Object.assign(state, { tree, items, capacity, nextId: items.reduce((max, item) => Math.max(max, item.id), 0) + 1, selected: null });
  $('capacity').value = capacity; $('dataset-description').textContent = 'Imported JSON dataset'; $('build-method').textContent = 'Bulk loading · imported data'; $('inspector').hidden = true; $('benchmark-result').hidden = true;
  updateStats(); fitView(); runQuery(undefined, false); notify(`Imported ${number.format(items.length)} items.`);
}));
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('theme').setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
  try { localStorage.setItem('rbushweb-theme', theme); } catch { /* Storage may be unavailable in embedded previews. */ }
  requestRender();
}
$('theme').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
document.addEventListener('keydown', protect(event => {
  if (event.target.closest('input,select,textarea,button,a') || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.code === 'Space') { event.preventDefault(); state.space = true; canvas.style.cursor = 'grab'; }
  const modes = { q: 'query', n: 'nearest', i: 'insert', m: 'move' };
  if (modes[event.key.toLowerCase()]) setMode(modes[event.key.toLowerCase()]);
  if (event.key === 'Delete' && state.selected) deleteSelected();
  if (event.key === 'Escape') { state.drag = null; state.selected = null; $('inspector').hidden = true; requestRender(); }
}));
document.addEventListener('keyup', event => { if (event.code === 'Space') { state.space = false; canvas.style.cursor = state.mode === 'move' ? 'grab' : 'crosshair'; } });
window.addEventListener('blur', () => { state.space = false; state.drag = null; });
let savedTheme;
try { savedTheme = localStorage.getItem('rbushweb-theme'); } catch { /* Keep the default light theme. */ }
applyTheme(savedTheme === 'dark' ? 'dark' : 'light');
await protect(generate)();
// A read-only diagnostic snapshot helps host applications and browser tests inspect the demo.
Object.defineProperty(window, 'RBushDemo', { value: Object.freeze({ snapshot: () => ({ count: state.tree.Count, results: state.results.length, mode: state.mode, selectedId: state.selected?.id ?? null, height: state.tree.Root.Height, queryTime: state.queryTime, bounds: state.query ? { ...state.query } : null, view: { ...state.view } }) }), writable: false });
