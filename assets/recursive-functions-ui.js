(() => {
  'use strict';
  const $ = id => document.getElementById(id), R = window.RecursiveFunctions;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const storageKey = 'math-interactive.recursive-functions.v1';
  let library = R.samples(), draft = R.clone(library.get('add').tree), selected = [], past = [], future = [], evaluation = null, timer = null, testToken = 0;
  let lastEvent = null, storageNote = '', judging = false;
  const exercises = [
    { name: '1．x + 2 を構成', key: 'plus2', arity: 1, hint: 'Sを二重に合成します．内側のSと外側のSはどちらも1変数です．', tree: () => R.composition(R.successor(), [R.successor()]), cases: [[0], [1], [3], [5]], expected: ([x]) => x + 2n },
    { name: '2．加法を構成', key: 'add', arity: 2, hint: '初期関数はP₁¹，更新関数はSとP₃³の合成．段階yではなく，直前の値を1増やします．', cases: [[0, 0], [0, 3], [2, 3], [3, 1]], expected: ([x, y]) => x + y },
    { name: '3．乗法を構成', key: 'mul', arity: 2, hint: '初期値はZ₁．更新では元のxと直前の値をaddへ渡します．', cases: [[0, 0], [0, 3], [2, 3], [3, 2]], expected: ([x, y]) => x * y },
    { name: '4．階乗を構成', key: 'factorial', arity: 1, hint: '原始再帰のkを0にします．初期値は0変数の定数1，更新はmul(y+1, 直前の値)．', cases: [[0], [1], [3], [4]], expected: ([n]) => { let v = 1n; for (let i = 1n; i <= n; i++) v *= i; return v; } },
    { name: '5．冪乗を構成', key: 'pow', arity: 2, hint: '初期値は1．更新はmul(x, 直前の値)です．', cases: [[0, 0], [2, 0], [2, 3], [3, 2]], expected: ([x, y]) => x ** y },
    { name: '6．最小化で平方根の切り上げ', key: 'ceilSqrt', arity: 1, hint: 'sub(x, square(y)) が初めて0になるyを探します．subは切り下げ減算です．', cases: [[0], [1], [2], [4], [5]], expected: ([x]) => { let y = 0n; while (y * y < x) y++; return y; } },
    { name: '7．偶数だけ半分にする部分関数', key: 'evenHalf', arity: 1, hint: 'xと2yの差の絶対値が0になる最小のyを探します．奇数では探索が続きます．未終了の観察は未定義の証明ではありません．', cases: [[0], [2], [4], [3]], expected: ([x]) => x % 2n === 0n ? x / 2n : null }
  ];
  function message(text, error = false) { $('message').textContent = text; $('messageArea').hidden = !text; $('message').classList.toggle('error', error); }
  function pause() { clearInterval(timer); timer = null; }
  function clearEvaluation() { pause(); evaluation = null; lastEvent = null; testToken++; if (judging) $('exerciseResult').textContent = '構成が変わったので，テストを中断しました．'; }
  function getAt(tree, path) { return path.reduce((node, key) => node[key], tree); }
  function replaceAt(tree, path, value) {
    if (!path.length) return value;
    const result = R.clone(tree), parent = getAt(result, path.slice(0, -1)); parent[path.at(-1)] = value; return result;
  }
  const pathKey = path => JSON.stringify(path);
  const equalPath = (a, b) => pathKey(a) === pathKey(b);
  const isPrefix = (prefix, path) => prefix.length <= path.length && prefix.every((v, i) => v === path[i]);
  function noteTree(node) {
    if (node.type === 'composition') return `合成(${noteTree(node.outer)}；${node.inner.map(noteTree).join(', ') || '内側なし'})`;
    if (node.type === 'primitiveRecursion') return `原始再帰(${noteTree(node.base)}；${noteTree(node.step)})`;
    if (node.type === 'minimization') return `最小化(${noteTree(node.target)})`;
    return R.symbol(node);
  }
  function treeHTML(node, path = []) {
    const metadata = R.info(node, library), key = escape(pathKey(path));
    const slot = (label, child, childPath, guide = '') => `<div><p class="slot-label">${escape(label)}</p>${guide}${treeHTML(child, childPath)}</div>`;
    const subscript = n => String(n).replace(/\d/g, d => '₀₁₂₃₄₅₆₇₈₉'[d]);
    const names = (letter, n) => n === 0 ? '' : n === 1 ? `${letter}₁` : n === 2 ? `${letter}₁, ${letter}₂` : `${letter}₁, …, ${letter}${subscript(n)}`;
    const guideHTML = (formula, rows, note = '') => `<div class="recursion-guide"><p class="recursion-equation">${escape(formula)}</p><dl>${rows.map(([label, text]) => `<dt>${escape(label)}</dt><dd>${escape(text)}</dd>`).join('')}</dl>${note ? `<p>${escape(note)}</p>` : ''}</div>`;
    let slots = '';
    if (node.type === 'composition') {
      const n = metadata.arity, m = node.inner.length, xs = names('x', n), zs = names('z', m);
      const outerGuide = guideHTML(`f(${xs}) = g(${zs})`, m ? [['入力', '各hの計算結果を，h₁, h₂, …の順に受け取る．'], ['返り値', '合成した関数fの答え．']] : [['入力なし', 'g()の値が，そのままfの答え．']]);
      slots = slot('外側 g', node.outer, [...path, 'outer'], outerGuide) + node.inner.map((inner, i) => slot(`内側 h${subscript(i + 1)}`, inner, [...path, 'inner', i], guideHTML(`h${subscript(i + 1)}(${xs}) → z${subscript(i + 1)}`, [[n ? '入力' : '入力なし', n ? 'fに与えた入力を，そのまま全部受け取る．' : '引数を受け取らない定数関数．'], ['返り値', `外側gの第${i + 1}入力になる．`]]))).join('');
    }
    if (node.type === 'primitiveRecursion') {
      const k = R.info(node.base, library).arity;
      const fixedOnly = names('x', k), fixed = k ? `${fixedOnly}, ` : '';
      const guide = guideHTML(`f(${fixed}y + 1) = h(${fixed}y, z)`, [...(k ? [[k === 1 ? '第1入力' : `第1〜${k}入力`, `${fixedOnly}：fに与えた入力．繰り返しの間は変わりません．`]] : []), [`第${k + 1}入力`, 'y：いま何回目か．0, 1, 2, …と進みます．'], [`第${k + 2}入力`, `z：ここまでの計算結果 f(${fixed}y)．`]]);
      const baseGuide = guideHTML(`f(${fixed}0) = g(${fixedOnly})`, [[k ? '入力' : '入力なし', k ? `${fixedOnly}だけを受け取る．繰り返す回数は渡さない．` : '引数を受け取らない定数関数．'], ['返り値', '繰り返しが0回のときの答え．']]);
      slots = slot('初期関数 g', node.base, [...path, 'base'], baseGuide) + slot('更新関数 h', node.step, [...path, 'step'], guide);
    }
    if (node.type === 'minimization') {
      const n = metadata.arity, xs = names('x', n), fixed = n ? `${xs}, ` : '';
      const guide = guideHTML(`g(${fixed}y) = 0 となる最小のyを探す`, [...(n ? [[n === 1 ? '第1入力' : `第1〜${n}入力`, `${xs}：fに与えた入力．探索中は変わりません．`]] : []), [`第${n + 1}入力`, 'y：試す候補．0, 1, 2, …の順に渡す．']], 'gの値が0なら，その候補yが答え．途中の評価が終わらなければ，次へは進みません．');
      slots = slot('探索対象 g', node.target, [...path, 'target'], guide);
    }
    const style = ['composition', 'primitiveRecursion'].includes(node.type) ? 'operation' : node.type === 'minimization' ? 'mu' : node.type;
    return `<div class="node ${style}"><button class="node-head ${equalPath(path, selected) ? 'selected' : ''}" data-tree-path="${key}" aria-pressed="${equalPath(path, selected)}"><span>${escape(R.symbol(node))}</span><span class="arity">${metadata.arity}変数</span></button>${slots ? `<div class="slots">${slots}</div>` : ''}</div>`;
  }
  function renderInspector() {
    const node = getAt(draft, selected), n = R.info(node, library).arity;
    const field = (label, key, value, min = 0) => `<label>${escape(label)} <input type="number" min="${min}" step="1" value="${value}" data-property="${key}"></label>`;
    let content = `<h3>選択中：${escape(R.symbol(node))}（${n}変数）</h3>`;
    if (node.type === 'zero') content += `<div class="fields">${field('引数の個数 n', 'arity', node.arity)}</div><p>入力に関係なく0を返します．n=0は定数0です．</p>`;
    else if (node.type === 'successor') content += '<p>1変数の関数S(x)=x+1です．</p>';
    else if (node.type === 'projection') content += `<div class="fields">${field('入力の個数 n', 'arity', node.arity, 1)}${field('取り出す位置 i', 'index', node.index, 1)}</div><p>1 ≤ i ≤ n．xᵢを返します．</p>`;
    else if (node.type === 'composition') content += `<div class="fields">${field('共通の入力の個数 n', 'domain', n)}</div><p>nを変えると内側の関数をZₙへ初期化します．外側の関数を置き換えると，必要な個数だけ内側スロットを用意します．</p>`;
    else if (node.type === 'primitiveRecursion') content += `<div class="fields">${field('パラメータ数 k', 'parameters', R.info(node.base, library).arity)}</div><p>kを変えると初期・更新の関数を初期化します．gはk変数，hはk+2変数．最後の入力が繰り返す回数です．</p>`;
    else if (node.type === 'minimization') content += '<p>探索対象を選び，左から接続してください．gの最後の入力yを0から順に調べます．gが途中で終了しなければ，次のyへは進みません．</p>';
    else if (node.type === 'reference') {
      const def = library.get(node.name);
      content += `<p>${escape(def.description)}</p><div class="definition">${escape(noteTree(def.tree))}</div><button id="expandDefinition" type="button">定義を展開</button><p>この参照ブロックを，その定義の構成木に置き換えます．</p>`;
    }
    $('inspector').innerHTML = content;
  }
  function renderLibrary() {
    $('library').innerHTML = [...library].map(([name, def]) => `<div class="library-row"><button class="ref-btn" data-reference="${escape(name)}">${escape(name)}<small>${def.arity ?? R.info(def.tree, library).arity}変数 · ${def.kind === 'sample' ? '見本' : '自作'}</small></button><button class="open-btn" data-open="${escape(name)}" aria-label="${escape(name)}の構成木を開く">開く</button></div>`).join('');
    const old = $('sampleSelect').value;
    $('sampleSelect').innerHTML = [...library].map(([name, def]) => `<option value="${escape(name)}">${escape(name)}（${def.arity ?? R.info(def.tree, library).arity}変数）</option>`).join('');
    if (library.has(old)) $('sampleSelect').value = old;
    $('storageStatus').textContent = storageNote;
  }
  function renderEditor() {
    const metadata = R.info(draft, library);
    $('classification').textContent = `${metadata.arity}変数 · ${metadata.primitive ? '原始再帰関数（全域）' : '最小化を含む構成（部分関数を許す）'}`;
    $('tree').innerHTML = treeHTML(draft);
    renderInspector();
    $('undoEdit').disabled = !past.length; $('redoEdit').disabled = !future.length;
    $('argumentsLabel').textContent = metadata.arity === 0 ? '入力なし（0変数関数）' : `入力：${metadata.arity}個の自然数をカンマ区切りで`;
    $('arguments').disabled = metadata.arity === 0;
    $('arguments').placeholder = metadata.arity ? '例：2, 3' : '空欄';
    renderEvaluation();
  }
  function commitTree(candidate, text = '') {
    try {
      R.info(candidate, library);
      if (JSON.stringify(candidate).length > 250000) throw new Error('構成木が表示上限を超えています．');
      past.push(R.clone(draft)); if (past.length > 60) past.shift(); future = [];
      draft = candidate; clearEvaluation(); renderEditor(); message(text);
      return true;
    } catch (error) { message(error.message, true); renderInspector(); return false; }
  }
  function connect(node) {
    let candidate = replaceAt(draft, selected, node);
    if (selected.at(-1) === 'outer') {
      const parentPath = selected.slice(0, -1), previous = getAt(draft, parentPath);
      if (previous.type === 'composition') {
        const count = R.info(node, library).arity, n = R.info(previous, library).arity;
        if (count > 20) { message('構成図の内側スロットは20個まで表示できます．より少ない引数の外側関数を選んでください．', true); return; }
        const parent = getAt(candidate, parentPath);
        parent.inner = Array.from({ length: count }, (_, i) => previous.inner[i] || R.zero(n)); parent.arity = n;
      }
    }
    commitTree(candidate, '選択したブロックを接続しました．');
  }
  function paletteNode(type) {
    const n = R.info(getAt(draft, selected), library).arity;
    if (type === 'zero') return R.zero(n);
    if (type === 'successor') return R.successor();
    if (type === 'projection') return R.projection(Math.max(1, n), Math.max(1, n));
    if (type === 'composition') return R.composition(R.successor(), [n ? R.projection(n, n) : R.zero(0)], n);
    if (type === 'primitiveRecursion') { const k = Math.max(0, n - 1); return R.primitiveRecursion(R.zero(k), R.projection(k + 2, k + 2)); }
    return R.minimization(R.zero(n + 1));
  }
  function openFunction(name) {
    const def = library.get(name); if (!def) return;
    selected = [];
    if (commitTree(R.clone(def.tree), `「${name}」の構成木を開きました．`)) {
      $('functionName').value = name; $('description').value = def.description;
      const n = R.info(draft, library).arity;
      $('arguments').value = n === 2 ? '2, 3' : n === 1 ? name === 'evenHalf' ? '3' : '4' : '';
    }
  }
  function parseInputs() {
    const n = R.info(draft, library).arity;
    if (n === 0) return [];
    const parts = $('arguments').value.trim().split(/[,，、]/).map(s => s.trim());
    if (parts.length !== n || parts.some(s => !s)) throw new Error(`${n}個の自然数をカンマで区切って入力してください．`);
    return parts.map(R.natural);
  }
  function prepareEvaluation() {
    pause();
    try { const replacement = new R.Evaluation(draft, parseInputs(), library); pause(); evaluation = replacement; lastEvent = null; message(''); renderEvaluation(); return true; }
    catch (error) { message(error.message, true); renderEvaluation(); return false; }
  }
  function renderEvaluation() {
    const stopped = evaluation && ['finished', 'limited', 'interrupted', 'error'].includes(evaluation.status);
    $('step').disabled = !!stopped || timer !== null;
    $('run').disabled = !!stopped;
    $('run').textContent = timer ? 'Ⅱ 一時停止' : '▶ 実行';
    $('interrupt').disabled = !evaluation || !!stopped;
    $('evalStatus').textContent = !evaluation ? '未実行' : ({ ready: '準備完了', running: timer ? '実行中' : '一時停止中', finished: '評価完了', limited: '観察上限', interrupted: '中断', error: '中断' })[evaluation.status];
    $('result').textContent = evaluation?.status === 'finished' ? String(evaluation.result) : '—';
    $('evaluationReason').textContent = evaluation?.reason || (evaluation ? `入力 (${evaluation.inputs.join(', ')})` : 'まだ評価していません．');
    const events = evaluation?.events || [], major = events.filter(e => e.major);
    $('counts').textContent = `内部イベント ${events.length} ／ 主要イベント ${major.length}`;
    $('currentEvent').textContent = lastEvent ? `#${lastEvent.number} ${lastEvent.message}` : '入力をセットして，構成木に沿った評価を始めましょう．';
    const visible = ($('viewMode').value === 'detail' ? events : major).slice(-65);
    $('eventLog').innerHTML = visible.length ? visible.map(e => `<div class="event-row"><small>#${e.number} · ${escape(e.label)}(${escape(e.args.join(', '))})</small>${escape(e.message)}</div>`).join('') : '<p class="empty">ここに評価の順番を表示します．</p>';
    $('eventLog').scrollTop = $('eventLog').scrollHeight;
    const buttons = [...document.querySelectorAll('[data-tree-path]')];
    let active = null;
    if (lastEvent) for (const button of buttons) {
      const path = JSON.parse(button.dataset.treePath);
      if (isPrefix(path, lastEvent.path) && (!active || path.length > active.path.length)) active = { button, path };
    }
    buttons.forEach(button => button.classList.toggle('evaluating', active?.button === button));
    document.querySelectorAll('[data-reference]').forEach(button => button.classList.toggle('evaluating', !!lastEvent?.path.includes('@' + button.dataset.reference)));
  }
  function advance() {
    if (!evaluation && !prepareEvaluation()) return;
    const detail = $('viewMode').value === 'detail';
    for (let i = 0; i < (detail ? 1 : 250); i++) {
      const event = evaluation.step();
      if (event) lastEvent = event;
      if (!event || event.major || detail) break;
    }
    if (['finished', 'limited', 'interrupted', 'error'].includes(evaluation.status)) pause();
    renderEvaluation();
  }
  function persist() {
    try { localStorage.setItem(storageKey, R.exportLibrary(library)); storageNote = '名前を付けた関数を，このブラウザに保存しました．'; }
    catch (_) { storageNote = 'ブラウザ内への保存が使えません．関数はこの画面で使えますが，閉じる前にJSONを書き出してください．'; }
    $('storageStatus').textContent = storageNote;
  }
  function updateExercise() { const e = exercises[Number($('exerciseSelect').value) || 0]; $('exercisePrompt').textContent = `${e.name}．${e.arity}変数の関数を構成してください．`; $('exerciseHint').textContent = e.hint; $('exerciseResult').textContent = ''; }
  const waitFrame = () => new Promise(resolve => setTimeout(resolve, 0));
  $('dismissMessage').addEventListener('click', () => { $('messageArea').hidden = true; });
  async function testExercise() {
    const exercise = exercises[Number($('exerciseSelect').value) || 0], token = ++testToken;
    const metadata = R.info(draft, library);
    if (metadata.arity !== exercise.arity) { $('exerciseResult').textContent = `この課題は${exercise.arity}変数ですが，今の構成は${metadata.arity}変数です．`; return; }
    judging = true; $('testExercise').disabled = true;
    const tree = R.clone(draft), snapshot = new Map(library), lines = [];
    try {
      for (const values of exercise.cases) {
        const inputs = values.map(BigInt), expected = exercise.expected(inputs), run = new R.Evaluation(tree, inputs, snapshot, 12000);
        while (!['finished', 'limited', 'error'].includes(run.status)) {
          for (let batch = 0; batch < 400 && !['finished', 'limited', 'error'].includes(run.status); batch++) run.step();
          $('exerciseResult').textContent = `${lines.join('\n')}\n入力 (${inputs.join(', ')}) を検査中：${run.events.length}イベント`;
          await waitFrame();
          if (token !== testToken) return;
        }
        const passed = expected === null ? run.status === 'limited' : run.status === 'finished' && run.result === expected;
        lines.push(`${passed ? '✓' : '×'} (${inputs.join(', ')})：${run.status === 'finished' ? `結果 ${run.result}` : '観察上限までに未終了'}${expected === null ? '（未定義の証明ではありません）' : ` ／ 期待値 ${expected}`}`);
        if (!passed) { $('exerciseResult').textContent = lines.join('\n') + '\nこの入力で見直してください．未終了の場合は上限による可能性もあります．'; return; }
      }
      $('exerciseResult').textContent = lines.join('\n') + '\n指定した有限個のテストを通過しました．すべての入力に対する正しさ・未定義性を証明したわけではありません．';
    } catch (error) { $('exerciseResult').textContent = error.message; }
    finally { judging = false; $('testExercise').disabled = false; }
  }
  $('tree').addEventListener('click', event => {
    const button = event.target.closest('[data-tree-path]'); if (!button) return;
    selected = JSON.parse(button.dataset.treePath); $('tree').innerHTML = treeHTML(draft); renderInspector(); renderEvaluation();
  });
  for (const id of ['basicPalette', 'operationPalette']) $(id).addEventListener('click', event => { const button = event.target.closest('[data-kind]'); if (button) connect(paletteNode(button.dataset.kind)); });
  $('library').addEventListener('click', event => {
    const ref = event.target.closest('[data-reference]'), open = event.target.closest('[data-open]');
    if (ref) connect(R.reference(ref.dataset.reference)); else if (open) openFunction(open.dataset.open);
  });
  $('openSample').addEventListener('click', () => openFunction($('sampleSelect').value));
  $('selectRoot').addEventListener('click', () => { selected = []; renderEditor(); });
  $('inspector').addEventListener('click', event => { if (event.target.id === 'expandDefinition') connect(R.clone(library.get(getAt(draft, selected).name).tree)); });
  $('inspector').addEventListener('change', event => {
    const property = event.target.dataset.property; if (!property) return;
    const value = Number(event.target.value);
    if (!Number.isSafeInteger(value) || value < 0) { message('0以上の整数を指定してください．', true); renderInspector(); return; }
    const node = R.clone(getAt(draft, selected));
    if (property === 'parameters') { node.base = R.zero(value); node.step = R.projection(value + 2, value + 2); }
    else if (property === 'domain') { node.arity = value; node.inner = node.inner.map(() => R.zero(value)); }
    else { node[property] = value; if (node.type === 'projection' && property === 'arity') node.index = Math.min(node.index, value); }
    commitTree(replaceAt(draft, selected, node));
  });
  function restoreEdit(from, to, text) {
    if (!from.length) return;
    try {
      R.info(from.at(-1), library);
      to.push(R.clone(draft)); draft = from.pop(); selected = []; clearEvaluation(); renderEditor(); message(text);
    } catch (error) { message(`参照する関数の定義が変わったため，この構成には戻せません．${error.message}`, true); }
  }
  $('undoEdit').addEventListener('click', () => restoreEdit(past, future, '構成の編集を1つ戻しました．'));
  $('redoEdit').addEventListener('click', () => restoreEdit(future, past, '構成の編集をやり直しました．'));
  $('saveForm').addEventListener('submit', event => {
    event.preventDefault();
    try {
      library = R.saveDefinition(library, $('functionName').value.trim(), draft, $('description').value.trim());
      clearEvaluation(); persist(); renderLibrary(); renderEditor(); message(`「${$('functionName').value.trim()}」を保存しました．左の一覧から部品として接続できます．`);
    } catch (error) { message(error.message, true); }
  });
  $('evalForm').addEventListener('submit', event => { event.preventDefault(); prepareEvaluation(); });
  $('step').addEventListener('click', advance);
  $('run').addEventListener('click', () => {
    if (timer) { pause(); renderEvaluation(); return; }
    if (!evaluation && !prepareEvaluation()) return;
    timer = setInterval(advance, Number($('speed').value)); renderEvaluation();
  });
  $('interrupt').addEventListener('click', () => { pause(); evaluation?.interrupt(); renderEvaluation(); });
  $('viewMode').addEventListener('change', renderEvaluation);
  $('speed').addEventListener('change', () => { if (timer) { pause(); timer = setInterval(advance, Number($('speed').value)); } });
  $('exerciseSelect').innerHTML = exercises.map((e, i) => `<option value="${i}">${escape(e.name)}</option>`).join('');
  $('exerciseSelect').addEventListener('change', () => { testToken++; updateExercise(); });
  $('startExercise').addEventListener('click', () => {
    const e = exercises[Number($('exerciseSelect').value) || 0]; selected = [];
    if (commitTree(R.zero(e.arity), '零関数から構成を始めます．左の操作を接続してください．')) { $('functionName').value = e.key; $('description').value = ''; $('arguments').value = e.arity === 2 ? '2, 3' : '3'; }
  });
  $('showSolution').addEventListener('click', () => {
    const e = exercises[Number($('exerciseSelect').value) || 0];
    if (e.tree) { selected = []; commitTree(e.tree(), '課題の構成例を開きました．'); $('functionName').value = e.key; }
    else openFunction(e.key);
  });
  $('testExercise').addEventListener('click', testExercise);
  $('exportJson').addEventListener('click', () => {
    try {
      const blob = new Blob([R.exportLibrary(library)], { type: 'application/json' }), url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = 'recursive-functions.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      message('保存した関数をJSONとして書き出しました．未保存の構成は先に名前を付けて保存してください．');
    } catch (error) { message(error.message, true); }
  });
  $('importJson').addEventListener('click', () => $('jsonFile').click());
  $('jsonFile').addEventListener('change', async () => {
    const file = $('jsonFile').files[0]; if (!file) return;
    try {
      if (file.size > 1500000) throw new Error('JSONは1.5MBまで読み込めます．');
      const proposed = R.importLibrary(await file.text(), library); R.info(draft, proposed);
      library = proposed; clearEvaluation(); persist(); renderLibrary(); renderEditor(); message('JSONの関数を読み込みました．');
    } catch (error) { message(error.message, true); }
    $('jsonFile').value = '';
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && timer) { pause(); renderEvaluation(); } });
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) { library = R.importLibrary(saved, library); storageNote = 'このブラウザに保存した関数を読み込みました．'; }
    else storageNote = '見本を用意しました．名前を付けて保存すると，次回も同じブラウザで使えます．';
  } catch (error) { storageNote = '保存データを読み込めませんでした．見本から始めます．必要ならJSONを読み込んでください．'; }
  draft = R.clone(library.get('add').tree); $('description').value = library.get('add').description;
  renderLibrary(); renderEditor(); updateExercise();
})();
