(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const { TuringMachine, programs } = window.TuringSimulation;
  let selectedProgram = Object.keys(programs)[0];
  let diagramMode = 'focus';
  let diagramZoom = 1, diagramPan = { x: 0, y: 0 }, diagramBounds = null, diagramDrag = null;
  let machine = new TuringMachine(), timer = null, view = 0;
  [['count', 1, 5], ['addLeft', 0, 3], ['addRight', 0, 4]].forEach(([id, min, initial]) => {
    $(id).innerHTML = Array.from({ length: 101 - min }, (_, i) => `<option value="${i + min}">${i + min}</option>`).join('');
    $(id).value = String(initial);
  });
  const stateName = state => machine.program.haltStates.includes(state) ? `${state}（停止）` : state;
  const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function applyDiagramView() {
    if (!diagramBounds) return;
    const { x, y, width, height } = diagramBounds;
    const w = width / diagramZoom, h = height / diagramZoom;
    $('stateDiagram').setAttribute('viewBox', `${x + (width - w) / 2 + diagramPan.x} ${y + (height - h) / 2 + diagramPan.y} ${w} ${h}`);
    $('diagramZoomValue').textContent = `${Math.round(diagramZoom * 100)}%`;
    $('diagramZoomOut').disabled = diagramZoom <= 0.25;
    $('diagramZoomIn').disabled = diagramZoom >= 8;
  }
  function zoomDiagram(factor) { diagramZoom = Math.min(8, Math.max(0.25, diagramZoom * factor)); applyDiagramView(); }
  function resetDiagramView() { diagramZoom = 1; diagramPan = { x: 0, y: 0 }; applyDiagramView(); }
  function syncDiagramFullscreen() {
    const expanded = document.fullscreenElement === $('diagramPanel') || $('diagramDialog').open;
    $('diagramFullscreen').textContent = expanded ? '⛶ 全画面を終了' : '⛶ 全画面';
    $('diagramFullscreen').setAttribute('aria-label', expanded ? '状態遷移図の全画面を終了する' : '状態遷移図を全画面にする');
  }
  async function toggleDiagramFullscreen() {
    const panel = $('diagramPanel'), dialog = $('diagramDialog');
    if (document.fullscreenElement === panel) { await document.exitFullscreen(); return; }
    if (dialog.open) { dialog.close(); return; }
    pause(); render();
    if (panel.requestFullscreen) {
      try { await panel.requestFullscreen(); syncDiagramFullscreen(); return; } catch (_) { /* Use a viewport dialog when native fullscreen is unavailable. */ }
    }
    dialog.appendChild(panel);
    dialog.showModal();
    syncDiagramFullscreen();
    $('diagramFullscreen').focus();
  }
  function loadProgram() {
    const program = programs[selectedProgram];
    const addition = ['addition', 'multiplication'].includes(program.inputKind);
    document.querySelector('.workspace').dataset.program = selectedProgram;
    $('countControl').hidden = addition;
    $('count').disabled = addition;
    $('additionControls').hidden = !addition;
    $('addLeft').disabled = !addition;
    $('addRight').disabled = !addition;
    $('inputOperator').textContent = program.operator || '＋';
    for (const id of ['addLeft', 'addRight']) {
      const value = Number($(id).value), max = program.maxOperand || 100;
      $(id).innerHTML = Array.from({ length: max + 1 }, (_, i) => `<option value="${i}">${i}</option>`).join('');
      $(id).value = String(value <= max ? value : id === 'addLeft' ? 3 : 4);
    }
    $('diagramModes').hidden = !program.focusDiagram;
    $('functionDescription').textContent = program.description;
    $('countLabel').textContent = program.inputLabel || '入力する 1 の個数';
    $('inputHint').textContent = program.inputHint;
    $('initialStateLabel').textContent = `開始状態：${program.initialState}`;
    $('guideTitle').textContent = program.guideTitle;
    $('functionGuide').innerHTML = program.guide.map(p => `<p>${escape(p)}</p>`).join('');
    $('ruleRows').innerHTML = Object.entries(program.rules).map(([key, rule]) => {
      const [state, read] = key.split(':');
      return `<tr data-rule="${escape(key)}"><td class="mono">${escape(state)}</td><td>${read}</td><td>${rule.write}</td><td>${rule.move === 1 ? '右 R' : '左 L'}</td><td class="mono">${escape(rule.next)}</td></tr>`;
    }).join('');
    $('programCode').textContent = '現在  読む → 書く  移動  次の状態\n' + Object.entries(program.rules).map(([key, rule]) => `${key.replace(':', '     ')}  →  ${rule.write}     ${rule.move === 1 ? 'R' : 'L'}     ${rule.next}`).join('\n');
    updateInputPreview();
  }
  function inputFromControls() {
    const program = programs[selectedProgram], addition = ['addition', 'multiplication'].includes(program.inputKind);
    const fields = addition ? [$('addLeft'), $('addRight')] : [$('count')];
    const values = fields.map(field => field.value === '' ? NaN : Number(field.value));
    const min = addition ? 0 : 1;
    if (values.some(n => !Number.isInteger(n) || n < min || n > (program.maxOperand || 100))) return null;
    return program.makeInput(...values);
  }
  function updateInputPreview() {
    const input = inputFromControls();
    $('inputPreview').textContent = input === null ? '' : `セットする初期テープ：${input}`;
  }
  function drawDiagram() {
    const program = machine.program, last = machine.history.at(-1);
    const nextKey = machine.halted ? null : `${machine.state}:${machine.read()}`;
    const lastKey = last ? `${last.from}:${last.read}` : null;
    let visibleStates = [...program.states];
    let positions = new Map(program.states.map((state, i) => [state, program.diagram?.positions[state] || [150 + i * 270, 150]]));
    let width = program.diagram?.width || Math.max(580, program.states.length * 270 + 40);
    let height = program.diagram?.height || 245;
    let viewX = 0, viewY = 0;
    const groups = new Map();
    for (const [key, rule] of Object.entries(program.rules)) {
      const from = key.split(':')[0], groupKey = `${from}:${rule.next}`;
      if (!groups.has(groupKey)) groups.set(groupKey, { from, to: rule.next, labels: [] });
      groups.get(groupKey).labels.push({ key, text: `${key.split(':')[1]} → ${rule.write}, ${rule.move === 1 ? 'R' : 'L'}` });
    }
    const focused = program.focusDiagram && diagramMode === 'focus';
    if (focused) {
      const incoming = [...new Set([...groups.values()].filter(g => g.to === machine.state && g.from !== machine.state).map(g => g.from))];
      const outgoing = [...new Set([...groups.values()].filter(g => g.from === machine.state && g.to !== machine.state).map(g => g.to))];
      visibleStates = [...new Set([...incoming, machine.state, ...outgoing])];
      positions = new Map([[machine.state, [340, 210]]]);
      incoming.forEach((state, i) => positions.set(state, [100, incoming.length === 1 ? 210 : 140 + i * 180]));
      outgoing.forEach((state, i) => positions.set(state, [580, outgoing.length === 1 ? 210 : 140 + i * 180]));
      const points = [...positions.values()];
      viewX = Math.min(...points.map(p => p[0])) - 100;
      viewY = Math.min(...points.map(p => p[1])) - 135;
      width = Math.max(...points.map(p => p[0])) - viewX + 100;
      height = Math.max(...points.map(p => p[1])) - viewY + 85;
    }
    $('stateDiagram').classList.toggle('full-diagram', !!program.focusDiagram && !focused);
    $('diagramFocus').setAttribute('aria-pressed', String(diagramMode === 'focus'));
    $('diagramAll').setAttribute('aria-pressed', String(diagramMode === 'all'));
    const markers = [['normal', 'var(--muted)'], ['next', 'var(--teal)'], ['last', 'var(--orange)']].map(([id, color]) => `<marker id="arrow-${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${color}"/></marker>`).join('');
    const edges = [...groups.values()].filter(group => !focused || group.from === machine.state || group.to === machine.state).map(group => {
      const [x, y] = positions.get(group.from), [end, endY] = positions.get(group.to), loop = group.from === group.to;
      const applied = group.labels.some(label => label.key === lastKey), next = group.labels.some(label => label.key === nextKey);
      const vertical = x === end && !loop, length = Math.hypot(end - x, endY - y) || 1;
      const dx = (end - x) / length, dy = (endY - y) / length;
      const detour = !focused && program.focusDiagram && group.from === 'q3' && group.to === 'q10';
      const path = loop ? `M ${x - 25} ${y - 32} C ${x - 120} ${y - 105} ${x + 120} ${y - 105} ${x + 25} ${y - 32}` : detour ? `M ${x + 40} ${y} C 1120 ${y} 1120 ${endY} ${end + 42} ${endY}` : `M ${x + dx * 40} ${y + dy * 40} L ${end - dx * 42} ${endY - dy * 42}`;
      const labelX = loop ? x : detour ? 1050 : vertical ? x + 66 : (x + end) / 2, labelY = loop ? y - 122 : detour ? 315 : vertical ? (y + endY) / 2 : (y + endY) / 2 - 26;
      return `<g><path class="edge-path ${next ? 'next' : ''} ${applied ? 'applied' : ''}" d="${path}"/>${group.labels.map((label, i) => `<text x="${labelX}" y="${labelY + i * 20}" class="edge-label ${label.key === nextKey ? 'next' : ''} ${label.key === lastKey ? 'applied' : ''}">${escape(label.text)}</text>`).join('')}</g>`;
    }).join('');
    const nodes = visibleStates.map(state => {
      const [x, y] = positions.get(state), current = state === machine.state;
      return `<g class="node ${current ? 'current' : ''}"><circle cx="${x}" cy="${y}" r="40"/>${state === program.initialState ? `<circle class="inner" cx="${x}" cy="${y}" r="33"/>` : ''}<text x="${x}" y="${y + 7}" class="state-label">${escape(state)}</text><text x="${x}" y="${y + 64}" class="${current ? 'current-label' : ''}">${current ? '● 現在の状態' : program.haltStates.includes(state) ? '停止' : ''}</text></g>`;
    }).join('');
    diagramBounds = { x: viewX, y: viewY, width, height };
    applyDiagramView();
    $('stateDiagram').setAttribute('aria-label', `${focused ? '現在の状態に接続する遷移を表示．' : '全体の状態遷移図．'}初期状態${program.initialState}は二重丸．現在の状態は${machine.state}．${Object.entries(program.rules).map(([key, rule]) => `${key.split(':')[0]}で${key.split(':')[1]}を読むと${rule.write}を書き${rule.move === 1 ? '右' : '左'}へ進み${rule.next}へ遷移`).join('．')}．${last ? `直前の遷移は${last.from}から${last.next}．` : ''}`);
    $('stateDiagram').innerHTML = `<defs>${markers}</defs>${edges}${nodes}`;
    $('diagramStateNote').textContent = `${program.stateLabels ? `${machine.state}：${program.stateLabels[machine.state]}${focused ? '（現在の周辺）' : '（全体図）'}．` : ''}ドラッグで移動できます．`;
  }
  function pause() { clearInterval(timer); timer = null; }
  function drawTape() {
    const width = $('tape').clientWidth;
    const cellWidth = window.matchMedia('(max-width:720px)').matches ? 48 : 58;
    const visible = Math.max(3, Math.floor(width / cellWidth));
    const half = Math.floor((visible - 1) / 2);
    const cells = [], spoken = [];
    for (let pos = view - half; pos <= view + half; pos++) {
      const symbol = machine.read(pos), isHead = pos === machine.head;
      cells.push(`<div class="cell ${symbol === 'B' ? 'blank' : symbol === '0' ? 'zero' : ''} ${isHead ? 'head' : ''}" aria-hidden="true">${isHead ? '<span class="head-label">ヘッド ▼</span>' : ''}<div class="symbol">${symbol}</div><span class="index">${pos}</span></div>`);
      spoken.push(`位置${pos}：${symbol}${isHead ? '（ヘッド）' : ''}`);
    }
    $('tape').innerHTML = cells.join('');
    $('tape').setAttribute('aria-label', `左右に無限のテープの一部．${spoken.join('，')}．${Math.abs(view - machine.head) > half ? `ヘッドは表示範囲外の位置${machine.head}です．` : ''}`);
  }
  function render() {
    const last = machine.history.at(-1);
    $('state').textContent = stateName(machine.state);
    $('head').textContent = machine.head;
    $('read').textContent = machine.read();
    $('steps').textContent = machine.history.length;
    $('statusText').textContent = machine.halted ? '完了・停止' : timer ? '自動再生中' : last ? '実行途中' : '実行前';
    $('step').disabled = machine.halted || timer !== null;
    $('back').disabled = !last || timer !== null;
    $('play').disabled = machine.halted;
    $('play').textContent = timer ? 'Ⅱ 一時停止' : '▶ 自動再生';
    $('explanation').textContent = !last
      ? `初期状態：ヘッドはBでない最も左の文字（位置${machine.head}）の上，状態は${machine.program.initialState}です．`
      : `ステップ${last.step}：位置${last.position}で ${last.read} を読み，${last.write} を書き，${last.move === 1 ? '右' : '左'}へ1マス移動（${last.position} → ${machine.head}）．状態は ${last.from} → ${stateName(last.next)}．${machine.halted ? ` ${machine.program.completion(machine.input)}` : ''}`;
    document.querySelectorAll('[data-rule]').forEach(row => {
      row.classList.toggle('next', !machine.halted && row.dataset.rule === `${machine.state}:${machine.read()}`);
      row.classList.toggle('applied', !!last && row.dataset.rule === `${last.from}:${last.read}`);
      if (row.dataset.rule === (machine.halted && last ? `${last.from}:${last.read}` : `${machine.state}:${machine.read()}`)) {
        $('rulesViewport').scrollTop = Math.max(0, row.offsetTop - $('rulesViewport').clientHeight / 2 + row.offsetHeight / 2);
      }
    });
    $('history').innerHTML = machine.history.length ? `<table><thead><tr><th>手順</th><th>位置</th><th>読→書</th><th>移動</th><th>状態</th></tr></thead><tbody>${machine.history.slice(-200).map(e => `<tr><td>${e.step}</td><td>${e.position} → ${e.position + e.move}</td><td>${e.read} → ${e.write}</td><td>${e.move === 1 ? '右' : '左'}</td><td class="mono">${e.from} → ${e.next}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">「1ステップ進む」で最初の規則を実行します．</p>';
    $('historyHint').textContent = machine.history.length > 200 ? '直近200ステップを表示．巻き戻しは最初まで可能です．' : '上から順に実行';
    $('history').scrollTop = $('history').scrollHeight;
    $('outputLabel').textContent = machine.halted ? machine.program.resultLabel(machine.input) : last ? '現在のテープ（両端の空白を除く）' : '初期入力';
    const occupied = [...machine.tape.keys()];
    const left = occupied.length ? Math.min(...occupied) : 0, right = occupied.length ? Math.max(...occupied) : -1;
    $('output').textContent = occupied.length ? Array.from({ length: right - left + 1 }, (_, i) => machine.read(left + i)).join('') : '（すべて空白）';
    drawTape();
    drawDiagram();
  }
  function advance() {
    machine.step();
    view = machine.head;
    if (machine.halted) pause();
    render();
  }
  function startTimer() { timer = setInterval(advance, Number($('speed').value)); }
  $('step').addEventListener('click', advance);
  $('back').addEventListener('click', () => { pause(); machine.back(); view = machine.head; render(); });
  $('play').addEventListener('click', () => { if (timer) pause(); else if (!machine.halted) startTimer(); render(); });
  $('speed').addEventListener('change', () => { if (timer) { pause(); startTimer(); } });
  $('reset').addEventListener('click', () => { pause(); machine = new TuringMachine(machine.input, machine.program); view = machine.head; render(); });
  $('setup').addEventListener('submit', event => {
    event.preventDefault();
    const input = inputFromControls();
    if (input === null) {
      $('inputError').textContent = programs[selectedProgram].inputKind ? `それぞれ0〜${programs[selectedProgram].maxOperand || 100}の整数を選んでください．` : '1〜100の整数を選んでください．';
      $('inputError').hidden = false;
      return;
    }
    $('inputError').hidden = true;
    pause(); machine = new TuringMachine(input, programs[selectedProgram]); view = machine.head; render();
  });
  const plannedFunctions = [
    ['increment', '1増やす'],
    ['decrement', '1減らす'],
    ['parity', '偶奇判定'],
    ['copy', 'コピー'],
    ['subtraction', '引き算'],
    ['quotient', '割り算の商']
  ];
  $('functionSelect').innerHTML = Object.entries(programs).map(([key, program]) => `<option value="${escape(key)}">${escape(program.name)}</option>`).join('')
    + plannedFunctions.map(([key, name]) => `<option value="planned-${key}" disabled>${escape(name)}（実装予定）</option>`).join('');
  $('functionSelect').addEventListener('change', () => {
    if (!programs[$('functionSelect').value]) { $('functionSelect').value = selectedProgram; return; }
    pause(); selectedProgram = $('functionSelect').value; diagramMode = 'focus'; resetDiagramView();
    loadProgram();
    if (inputFromControls() === null) { $('count').value = 5; $('addLeft').value = 3; $('addRight').value = 4; }
    $('inputError').hidden = true;
    machine = new TuringMachine(inputFromControls(), programs[selectedProgram]);
    view = machine.head; loadProgram(); render();
  });
  ['count', 'addLeft', 'addRight'].forEach(id => $(id).addEventListener('change', updateInputPreview));
  $('diagramFocus').addEventListener('click', () => { diagramMode = 'focus'; resetDiagramView(); drawDiagram(); });
  $('diagramAll').addEventListener('click', () => { diagramMode = 'all'; resetDiagramView(); drawDiagram(); });
  $('diagramZoomIn').addEventListener('click', () => zoomDiagram(1.25));
  $('diagramZoomOut').addEventListener('click', () => zoomDiagram(0.8));
  $('diagramZoomReset').addEventListener('click', resetDiagramView);
  $('diagramFullscreen').addEventListener('click', toggleDiagramFullscreen);
  document.addEventListener('fullscreenchange', syncDiagramFullscreen);
  $('diagramDialog').addEventListener('close', () => {
    $('machineGrid').insertBefore($('diagramPanel'), $('rulesPanel'));
    syncDiagramFullscreen();
    $('diagramFullscreen').focus();
  });
  $('diagramViewport').addEventListener('pointerdown', event => {
    if (event.button !== 0 || !diagramBounds) return;
    const rect = $('stateDiagram').getBoundingClientRect();
    const scale = Math.min(rect.width * diagramZoom / diagramBounds.width, rect.height * diagramZoom / diagramBounds.height);
    diagramDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, pan: { ...diagramPan }, scale };
    $('diagramViewport').setPointerCapture(event.pointerId);
    $('diagramViewport').classList.add('dragging');
  });
  $('diagramViewport').addEventListener('pointermove', event => {
    if (!diagramDrag || event.pointerId !== diagramDrag.id) return;
    diagramPan = { x: diagramDrag.pan.x - (event.clientX - diagramDrag.x) / diagramDrag.scale, y: diagramDrag.pan.y - (event.clientY - diagramDrag.y) / diagramDrag.scale };
    applyDiagramView();
  });
  const stopDiagramDrag = () => { diagramDrag = null; $('diagramViewport').classList.remove('dragging'); };
  $('diagramViewport').addEventListener('pointerup', stopDiagramDrag);
  $('diagramViewport').addEventListener('pointercancel', stopDiagramDrag);
  $('diagramViewport').addEventListener('lostpointercapture', stopDiagramDrag);
  $('panLeft').addEventListener('click', () => { view -= 5; drawTape(); });
  $('panRight').addEventListener('click', () => { view += 5; drawTape(); });
  $('center').addEventListener('click', () => { view = machine.head; drawTape(); });
  window.addEventListener('resize', drawTape);
  document.addEventListener('visibilitychange', () => { if (document.hidden && timer) { pause(); render(); } });
  loadProgram(); render();
})();
