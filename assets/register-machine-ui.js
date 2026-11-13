(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const { RegisterMachine, programs, natural } = window.RegisterSimulation;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let selected = 'addition', arity = 2, timer = null, machine, initialSource, initialInputs, previousRegisterMarkup = '';
  for (let i = 1; i <= 2; i++) {
    $('input' + i).innerHTML = Array.from({ length: 21 }, (_, n) => `<option value="${n}">${n}</option>`).join('') + '<option value="direct">直接入力…</option>';
    $('input' + i).value = i === 1 ? '3' : '4';
  }
  $('functionSelect').innerHTML = Object.entries(programs).map(([key, p]) => `<option value="${key}">${escape(p.name)}</option>`).join('') + '<option value="custom">自分のプログラム</option>';
  function pause() { clearInterval(timer); timer = null; }
  function inputValues(count = arity) {
    return Array.from({ length: count }, (_, i) => {
      const index = i + 1;
      return natural($('input' + index).value === 'direct' ? $('direct' + index).value.trim() : $('input' + index).value);
    });
  }
  function updateInputs() {
    $('operand1').hidden = arity < 1;
    $('operand2').hidden = arity < 2;
    $('operator').hidden = arity < 2;
    $('operator').textContent = programs[selected]?.operator || '，';
    for (let i = 1; i <= 2; i++) {
      const direct = $('input' + i).value === 'direct';
      $('input' + i).disabled = i > arity;
      $('direct' + i).hidden = !direct;
      $('direct' + i).disabled = i > arity || !direct;
    }
    $('inputHint').textContent = arity === 0 ? '入力なし．すべてのレジスタを0から始めます．' : `入力をR1${arity === 2 ? 'とR2' : ''}へ入れます．R0を含むほかのレジスタは0です．`;
  }
  function branchText(pc, instruction) {
    if (instruction.op === 'I') return `${pc + 1n}`;
    if (instruction.op === 'J') return `${pc} ${instruction.arg < 0n ? '−' : '＋'} ${instruction.arg < 0n ? -instruction.arg : instruction.arg} → ${pc + instruction.arg}`;
    return `0なら ${pc + 1n} ／ 正なら ${pc + 2n}`;
  }
  function install(source, inputs) {
    const replacement = new RegisterMachine(source, inputs);
    pause(); machine = replacement; initialSource = source; initialInputs = inputs.slice();
    $('programRows').innerHTML = machine.program.instructions.map((instruction, i) => `<tr data-pc="${i + 1}"><td>${i + 1}</td><td class="mono">${instruction.op} ${instruction.arg}</td><td>${escape(branchText(BigInt(i + 1), instruction))}</td></tr>`).join('') + `<tr data-pc="${machine.program.instructions.length + 1}"><td>${machine.program.instructions.length + 1}</td><td colspan="2">正常な停止位置（命令なし）</td></tr>`;
    $('programSize').textContent = `${machine.program.instructions.length}命令`;
    $('programViewport').scrollTop = 0;
    $('inputError').hidden = true; $('sourceError').hidden = true;
    const notes = programs[selected]?.notes || ['I・D・Jの規則に従って，入力欄の値から実行します．正常に停止したときのR0が出力です．'];
    $('programNotes').innerHTML = notes.map(note => `<p>${escape(note)}</p>`).join('');
    $('registerRange').textContent = `レジスタはR0〜R${machine.K}．番号が大きい場合，画面には命令・入力で使うレジスタとR0を表示し，それ以外は0です．`;
    previousRegisterMarkup = '';
    render();
  }
  function displayedRegisters() {
    if (machine.K <= 10n) return Array.from({ length: Number(machine.K) + 1 }, (_, i) => BigInt(i));
    return [...new Set([0n, ...initialInputs.map((_, i) => BigInt(i + 1)), ...machine.program.instructions.filter(i => i.op !== 'J').map(i => i.arg)])].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  }
  function positionName(pc) {
    if (pc === BigInt(machine.program.instructions.length) + 1n) return `位置${pc}（正常な停止位置）`;
    if (pc < 1n || pc > BigInt(machine.program.instructions.length)) return `位置${pc}（範囲外）`;
    return `命令${pc}`;
  }
  function nextDescription() {
    if (machine.halted) return machine.haltKind === 'good' ? '存在しない最初の命令を指したので，正常に停止しました．' : '正常な停止位置以外の範囲外を指したので，正常でない停止です．';
    const { op, arg } = machine.program.instructions[Number(machine.pc - 1n)];
    if (op === 'J') return `次：J ${arg}．レジスタを変えず，${positionName(machine.pc + arg)}へ進みます．`;
    const value = machine.read(arg);
    if (op === 'I') return `次：I ${arg}．R${arg}を ${value} → ${value + 1n} にして，${positionName(machine.pc + 1n)}へ．`;
    return value === 0n ? `次：D ${arg}．R${arg}は0なので変えず，${positionName(machine.pc + 1n)}へ．` : `次：D ${arg}．R${arg}を ${value} → ${value - 1n} にし，命令を1つスキップして${positionName(machine.pc + 2n)}へ．`;
  }
  function describeEvent(event) {
    const change = event.op === 'J' ? 'レジスタはそのまま' : `R${event.arg}：${event.before} → ${event.after}`;
    return `${event.op} ${event.arg}．${change}．${positionName(event.pc)} → ${positionName(event.next)}${event.op === 'D' && event.before > 0n ? `（命令${event.pc + 1n}をスキップ）` : ''}．`;
  }
  function render() {
    const last = machine.history.at(-1), instruction = machine.halted ? null : machine.program.instructions[Number(machine.pc - 1n)];
    const registerMarkup = displayedRegisters().map(r => `<div class="register ${r === 0n ? 'output' : ''} ${instruction && instruction.op !== 'J' && instruction.arg === r ? 'current' : ''} ${last && last.op !== 'J' && last.arg === r && last.before !== last.after ? 'changed' : ''}"><dt>R${r}<span class="role">${r === 0n ? '出力' : r <= BigInt(initialInputs.length) ? '入力' : '作業用'}</span></dt><dd>${machine.read(r)}</dd></div>`).join('');
    if (registerMarkup !== previousRegisterMarkup) { $('registers').innerHTML = registerMarkup; previousRegisterMarkup = registerMarkup; }
    $('steps').textContent = machine.history.length;
    $('pc').textContent = String(machine.pc);
    $('status').textContent = machine.halted ? machine.haltKind === 'good' ? '正常な停止' : '正常でない停止' : timer ? '自動再生中' : machine.history.length ? '実行途中' : '実行前';
    $('status').classList.toggle('bad', machine.haltKind === 'bad');
    $('step').disabled = machine.halted || timer !== null;
    $('back').disabled = !last || timer !== null;
    $('play').disabled = machine.halted;
    $('play').textContent = timer ? 'Ⅱ 一時停止' : '▶ 自動再生';
    $('nextAction').textContent = nextDescription();
    $('lastAction').textContent = last ? `直前のステップ：${describeEvent(last)}` : machine.halted ? '命令はありません．位置1が正常な停止位置です．' : '先頭の命令1から始めます．';
    $('result').textContent = machine.haltKind === 'good' ? `出力 R0 = ${machine.read(0)}` : machine.haltKind === 'bad' ? `R0 = ${machine.read(0)}（正常な出力ではありません）` : '出力は正常に停止したときのR0です．';
    $('result').classList.toggle('bad', machine.haltKind === 'bad');
    document.querySelectorAll('[data-pc]').forEach(row => {
      const pc = BigInt(row.dataset.pc);
      row.classList.toggle('current', pc === machine.pc);
      row.classList.toggle('last', !!last && pc === last.pc);
      row.classList.toggle('skipped', !!last && last.op === 'D' && last.before > 0n && pc === last.pc + 1n);
      if (pc === machine.pc) $('programViewport').scrollTop = Math.max(0, row.offsetTop - $('programViewport').clientHeight / 2 + row.offsetHeight / 2);
    });
    $('historyHint').textContent = machine.history.length > 200 ? '直近200ステップを表示．巻き戻しは最初まで可能．' : '上から順に実行';
    $('history').innerHTML = last ? `<table><thead><tr><th>手順</th><th>位置</th><th>命令</th><th>レジスタ</th><th>次の位置</th></tr></thead><tbody>${machine.history.slice(-200).map(e => `<tr><td>${e.step}</td><td>${e.pc}</td><td class="mono">${e.op} ${e.arg}</td><td class="register-change">${e.op === 'J' ? '変更なし' : `R${e.arg}：${e.before} → ${e.after}`}</td><td>${e.next}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">「1ステップ進む」で実行を始めます．</p>';
    $('history').scrollTop = $('history').scrollHeight;
  }
  function advance() { machine.step(); if (machine.halted) pause(); render(); }
  function startTimer() { timer = setInterval(advance, Number($('speed').value)); }
  $('step').addEventListener('click', advance);
  $('back').addEventListener('click', () => { pause(); machine.back(); render(); });
  $('play').addEventListener('click', () => { if (timer) pause(); else if (!machine.halted) startTimer(); render(); });
  $('reset').addEventListener('click', () => install(initialSource, initialInputs));
  $('speed').addEventListener('change', () => { if (timer) { pause(); startTimer(); } });
  for (let i = 1; i <= 2; i++) $('input' + i).addEventListener('change', updateInputs);
  $('setup').addEventListener('submit', event => {
    event.preventDefault();
    try { install(initialSource, inputValues()); }
    catch (error) { $('inputError').textContent = error.message; $('inputError').hidden = false; }
  });
  $('functionSelect').addEventListener('change', () => {
    const previous = selected;
    selected = $('functionSelect').value;
    arity = programs[selected]?.arity ?? 2;
    try {
      const source = programs[selected]?.source ?? $('source').value;
      const inputs = inputValues();
      install(source, inputs);
      $('source').value = source;
      updateInputs();
    } catch (error) {
      selected = previous; arity = programs[selected]?.arity ?? 2; $('functionSelect').value = selected;
      updateInputs(); $('inputError').textContent = error.message; $('inputError').hidden = false;
    }
  });
  $('loadSource').addEventListener('click', () => {
    const previous = selected;
    try {
      const inputs = inputValues(2);
      selected = 'custom';
      install($('source').value, inputs);
      arity = 2; $('functionSelect').value = 'custom'; updateInputs();
    } catch (error) { selected = previous; $('sourceError').textContent = error.message; $('sourceError').hidden = false; }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && timer) { pause(); render(); } });
  $('source').value = programs.addition.source;
  updateInputs(); install(programs.addition.source, inputValues());
})();
