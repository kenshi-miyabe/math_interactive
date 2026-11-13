(() => {
  'use strict';
  const $ = id => document.getElementById(id), R = window.RecursiveFunctions;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const storageKey = 'math-interactive.recursive-functions.v1';
  const clone = value => value == null ? null : R.clone(value);
  const confirmAction = text => typeof window.confirm !== 'function' || window.confirm(text);
  let library = R.samples(), draft = null, selected = [], pickerPath = [], past = [], future = [];
  let evaluation = null, timer = null, lastEvent = null, storageNote = '', testToken = 0, judging = false;
  const exercises = [
    { name: 'x + 2', key: 'plus2', arity: 1, hint: 'Sを二重に合成します．', tree: () => R.composition(R.successor(), [R.successor()]), cases: [[0], [1], [3], [5]], expected: ([x]) => x + 2n },
    { name: '加法', key: 'add', arity: 2, hint: '初期関数はP₁¹，更新関数はSとP₃³の合成です．', cases: [[0, 0], [0, 3], [2, 3], [3, 1]], expected: ([x, y]) => x + y },
    { name: '乗法', key: 'mul', arity: 2, hint: '初期値はZ₁．更新ではxと直前の値をaddへ渡します．', cases: [[0, 0], [0, 3], [2, 3], [3, 2]], expected: ([x, y]) => x * y },
    { name: '階乗', key: 'factorial', arity: 1, hint: '初期値は1，更新はmul(y+1, 直前の値)です．', cases: [[0], [1], [3], [4]], expected: ([n]) => { let v = 1n; for (let i = 1n; i <= n; i++) v *= i; return v; } },
    { name: '冪乗', key: 'pow', arity: 2, hint: '初期値は1，更新はmul(x, 直前の値)です．', cases: [[0, 0], [2, 0], [2, 3], [3, 2]], expected: ([x, y]) => x ** y },
    { name: '平方根の切り上げ', key: 'ceilSqrt', arity: 1, hint: 'sub(x, square(y)) が初めて0になるyを探します．', cases: [[0], [1], [2], [4], [5]], expected: ([x]) => { let y = 0n; while (y * y < x) y++; return y; } },
    { name: '偶数だけ半分にする部分関数', key: 'evenHalf', arity: 1, hint: 'xと2yの差が0になる最小のyを探します．', cases: [[0], [2], [4], [3]], expected: ([x]) => x % 2n === 0n ? x / 2n : null }
  ];

  function message(text, error = false) {
    $('message').textContent = text; $('messageArea').hidden = !text; $('message').classList.toggle('error', error);
  }
  function pause() { clearInterval(timer); timer = null; }
  function clearEvaluation() {
    pause(); evaluation = null; lastEvent = null; testToken++;
    if (judging) $('exerciseResult').textContent = '構成が変わったため，テストを中断しました．';
  }
  function getAt(tree, path) { return path.reduce((node, key) => node?.[key], tree); }
  function replaceAt(tree, path, value) {
    if (!path.length) return value;
    const result = clone(tree), parent = getAt(result, path.slice(0, -1)); parent[path.at(-1)] = value; return result;
  }
  const pathKey = path => JSON.stringify(path);
  const equalPath = (a, b) => pathKey(a) === pathKey(b);
  const isPrefix = (prefix, path) => prefix.length <= path.length && prefix.every((v, i) => v === path[i]);

  function toCore(node) {
    if (!node) throw new Error('関数が未設定です．');
    if (node.type === 'zero') return R.zero(node.arity);
    if (node.type === 'successor') return R.successor();
    if (node.type === 'projection') return R.projection(node.arity, node.index);
    if (node.type === 'reference') return R.reference(node.name);
    if (node.type === 'composition') return R.composition(toCore(node.outer), (node.inner || []).map(toCore), node.arity);
    if (node.type === 'primitiveRecursion') return R.primitiveRecursion(toCore(node.base), toCore(node.step));
    if (node.type === 'minimization') return R.minimization(toCore(node.target));
    throw new Error('未知の関数です．');
  }
  function safeInfo(node, lib = library) { try { return R.info(toCore(node), lib); } catch (_) { return null; } }
  function validationMessage(node, lib = library) { try { R.info(toCore(node), lib); return ''; } catch (error) { return error.message; } }
  function nodeArity(node) {
    if (!node) return null;
    const complete = safeInfo(node); if (complete) return complete.arity;
    if (node.type === 'zero' || node.type === 'projection') return node.arity;
    if (node.type === 'successor') return 1;
    if (node.type === 'reference') return library.get(node.name)?.arity ?? null;
    if (node.type === 'composition' || node.type === 'minimization') return node.arity ?? 1;
    if (node.type === 'primitiveRecursion') return (node.parameters ?? 1) + 1;
    return null;
  }
  function normalize(node) {
    if (!node) return null;
    const copy = clone(node);
    if (copy.type === 'composition') {
      copy.outer = normalize(copy.outer); copy.inner = (copy.inner || []).map(normalize);
      copy.arity = safeInfo(node)?.arity ?? copy.arity ?? 1;
    } else if (copy.type === 'primitiveRecursion') {
      copy.base = normalize(copy.base); copy.step = normalize(copy.step);
      copy.parameters = safeInfo(copy.base)?.arity ?? copy.parameters ?? 1;
    } else if (copy.type === 'minimization') {
      copy.target = normalize(copy.target); copy.arity = safeInfo(node)?.arity ?? copy.arity ?? 1;
    }
    return copy;
  }
  function expectedAt(path) {
    if (!path.length) return null;
    const parent = getAt(draft, path.slice(0, -1)), key = path.at(-1);
    if (!parent) return null;
    if (key === 'outer') return null;
    if (path.at(-2) === 'inner') return parent.arity;
    if (key === 'base') return parent.parameters;
    if (key === 'step') return parent.parameters + 2;
    if (key === 'target') return parent.arity + 1;
    return null;
  }
  function missingSlots(node, label = '関数', output = []) {
    if (!node) { output.push(label); return output; }
    if (node.type === 'composition') {
      missingSlots(node.outer, '外側 g', output);
      (node.inner || []).forEach((child, i) => missingSlots(child, `内側 h${i + 1}`, output));
    } else if (node.type === 'primitiveRecursion') {
      missingSlots(node.base, '初期関数 g', output); missingSlots(node.step, '更新関数 h', output);
    } else if (node.type === 'minimization') missingSlots(node.target, '探索対象 g', output);
    return output;
  }
  function makeNode(type, expected) {
    const n = expected ?? 1;
    if (type === 'zero') return R.zero(n);
    if (type === 'successor') return R.successor();
    if (type === 'projection') return R.projection(Math.max(1, n), Math.max(1, n));
    if (type === 'composition') return { type, outer: null, inner: [], arity: n };
    if (type === 'primitiveRecursion') return { type, base: null, step: null, parameters: expected == null ? 1 : Math.max(0, n - 1) };
    return { type: 'minimization', target: null, arity: n };
  }
  function noteTree(node) {
    if (!node) return '□';
    if (node.type === 'composition') return `合成(${noteTree(node.outer)}；${(node.inner || []).map(noteTree).join(', ') || '□'})`;
    if (node.type === 'primitiveRecursion') return `原始再帰(${noteTree(node.base)}；${noteTree(node.step)})`;
    if (node.type === 'minimization') return `最小化(${noteTree(node.target)})`;
    return R.symbol(node);
  }

  const subscript = n => String(n).replace(/\d/g, digit => '₀₁₂₃₄₅₆₇₈₉'[digit]);
  const readableVariables = n => Array.from({ length: n }, (_, i) => `x${subscript(i + 1)}`);
  function currentFunctionName() {
    const name = $('functionName').value.trim();
    return /^[A-Za-z][A-Za-z0-9_]*$/.test(name) ? name : 'f';
  }
  function roleAt(path) {
    if (draft?.type !== 'primitiveRecursion' || !path.length || !['base', 'step'].includes(path[0])) return '';
    const letter = path[0] === 'base' ? 'g' : 'h', indices = [];
    let node = draft[path[0]], cursor = 1;
    while (node?.type === 'composition' && cursor < path.length) {
      if (path[cursor] === 'outer') { indices.push(1); node = node.outer; cursor++; }
      else if (path[cursor] === 'inner' && Number.isInteger(path[cursor + 1])) { const index = path[cursor + 1]; indices.push(index + 2); node = node.inner?.[index]; cursor += 2; }
      else break;
    }
    return letter + indices.map(subscript).join('');
  }
  function roleTex(role) {
    const plain = role.slice(1).split('').map(char => '₀₁₂₃₄₅₆₇₈₉'.indexOf(char)).join('');
    return plain ? `${role[0]}_{${plain}}` : role;
  }

  function treeHTML(node, path = [], expected = null) {
    const key = escape(pathKey(path));
    if (!node) return `<button class="slot-add" type="button" data-add-path="${key}">＋ ${path.length ? '追加' : '関数を追加'}</button>`;
    const arity = nodeArity(node), style = ['composition', 'primitiveRecursion'].includes(node.type) ? 'operation' : node.type === 'minimization' ? 'mu' : node.type;
    const slot = (label, child, childPath, childExpected, help = '') => `<div><p class="slot-label">${escape(label)}${childExpected == null ? '' : ` · ${childExpected}変数`}</p>${help ? `<p class="slot-help">${help}</p>` : ''}${treeHTML(child, childPath, childExpected)}</div>`;
    let slots = '';
    if (node.type === 'composition') {
      const outerPath = [...path, 'outer'], outerRole = roleAt(outerPath);
      slots = slot(`外側 ${outerRole || 'g'}`, node.outer, outerPath, null, '内側の関数が返した値を引数として受け取ります．') + (node.inner || []).map((child, i) => { const innerPath = [...path, 'inner', i], innerRole = roleAt(innerPath); return slot(`内側 ${innerRole || `h${i + 1}`}`, child, innerPath, node.arity, '合成した関数と同じ入力を受け取ります．'); }).join('');
    }
    if (node.type === 'primitiveRecursion') {
      const xs = readableVariables(node.parameters), fixed = xs.join(', '), fn = currentFunctionName();
      const baseCall = `${fn}(${fixed ? `${fixed}, ` : ''}0)`;
      const previous = `${fn}(${fixed ? `${fixed}, ` : ''}y)`;
      const baseHelp = node.parameters ? `<strong>g(${escape(fixed)})</strong> は ${escape(fixed)} を受け取り，${escape(baseCall)} の初期値を決めます．` : `<strong>g()</strong> は引数を取らず，${escape(baseCall)} の初期値を決めます．`;
      const stepArgs = [...xs, 'y', previous].join(', ');
      const stepHelp = `<strong>h(${escape(stepArgs)})</strong> は，固定した入力${fixed ? ` ${escape(fixed)}，` : '，'}段階 y，直前の値 ${escape(previous)} を受け取ります．`;
      slots = slot('初期関数 g', node.base, [...path, 'base'], node.parameters, baseHelp) + slot('更新関数 h', node.step, [...path, 'step'], node.parameters + 2, stepHelp);
    }
    if (node.type === 'minimization') slots = slot('探索対象 g', node.target, [...path, 'target'], node.arity + 1, '元の入力に候補 y を加えて受け取り，値が0かを調べます．');
    const role = roleAt(path);
    return `<div class="node ${style}"><button class="node-head ${equalPath(path, selected) ? 'selected' : ''}" type="button" data-tree-path="${key}">${role ? `<span class="role-badge">${escape(role)}</span>` : ''}<span class="node-symbol">${escape(R.symbol(node))}</span><span class="arity">${arity == null ? '引数未定' : `${arity}変数`}</span></button>${slots ? `<div class="slots">${slots}</div>` : ''}</div>`;
  }

  const variables = n => Array.from({ length: n }, (_, i) => `x_${i + 1}`);
  function expression(node, args = []) {
    if (!node) return '\\boxed{\\;?\\;}';
    if (node.type === 'zero') return '0';
    if (node.type === 'successor') return `${args[0] ?? '?'}+1`;
    if (node.type === 'projection') return args[node.index - 1] ?? `x_${node.index}`;
    if (node.type === 'reference') return `\\operatorname{${node.name}}(${args.join(',')})`;
    if (node.type === 'composition') return expression(node.outer, (node.inner || []).map(child => expression(child, args)));
    if (node.type === 'primitiveRecursion') return `\\operatorname{Rec}[${node.base ? 'g' : '\\square'},${node.step ? 'h' : '\\square'}](${args.join(',')})`;
    if (node.type === 'minimization') return `\\mu y\\,[${expression(node.target, [...args, 'y'])}=0]`;
    return '?';
  }
  function formulaTex() {
    const raw = $('functionName').value.trim(), name = /^[A-Za-z][A-Za-z0-9_]*$/.test(raw) ? raw : 'f';
    const fn = name.length === 1 ? name : `\\operatorname{${name}}`;
    if (!draft) return `${fn}(\\vec{x})=\\boxed{\\;?\\;}`;
    if (draft.type === 'primitiveRecursion') {
      const xs = variables(draft.parameters), fixed = xs.length ? `${xs.join(',')},` : '';
      const baseValue = expression(draft.base, xs), previous = `${fn}(${fixed}y)`;
      const stepArgs = [...xs, 'y', previous], stepValue = expression(draft.step, stepArgs);
      const base = `\\underbrace{${baseValue}}_{\\text{初期関数 }g(${xs.join(',')})}`;
      const step = `\\underbrace{${stepValue}}_{\\text{更新関数 }h(${stepArgs.join(',')})}`;
      return `\\begin{aligned}${fn}(${fixed}0)&=${base},\\\\${fn}(${fixed}y+1)&=${step}.\\end{aligned}`;
    }
    const arity = nodeArity(draft) ?? 1, xs = variables(arity);
    if (draft.type === 'minimization') return `${fn}(${xs.join(',')})=\\mu y\\,[${expression(draft.target, [...xs, 'y'])}=0]`;
    return `${fn}(${xs.join(',')})=${expression(draft, xs)}`;
  }
  function symbolicExpression(node, args, path) {
    let value;
    if (!node) value = '\\boxed{\\;?\\;}';
    else if (node.type === 'zero') value = `Z_{${node.arity}}(${args.join(',')})`;
    else if (node.type === 'successor') value = `S(${args[0] ?? '?'})`;
    else if (node.type === 'projection') value = `P_{${node.index}}^{${node.arity}}(${args.join(',')})`;
    else if (node.type === 'reference') value = `\\operatorname{${node.name}}(${args.join(',')})`;
    else if (node.type === 'composition') {
      const inner = (node.inner || []).map((child, i) => symbolicExpression(child, args, [...path, 'inner', i]));
      value = symbolicExpression(node.outer, inner, [...path, 'outer']);
    } else value = expression(node, args);
    const role = roleAt(path);
    return role.length > 1 ? `\\underbrace{${value}}_{${roleTex(role)}}` : value;
  }
  function renderFormulaMap() {
    const rows = [];
    if (draft?.type === 'primitiveRecursion') {
      const xs = variables(draft.parameters), fixed = xs.join(','), name = currentFunctionName(), fn = name.length === 1 ? name : `\\operatorname{${name}}`, previous = `${fn}(${fixed ? `${fixed},` : ''}y)`, stepArgs = [...xs, 'y', previous];
      if (draft.base?.type === 'composition') rows.push(`g(${fixed})=${symbolicExpression(draft.base, xs, ['base'])}`);
      if (draft.step?.type === 'composition') rows.push(`h(${stepArgs.join(',')})=${symbolicExpression(draft.step, stepArgs, ['step'])}`);
    }
    $('formulaMap').hidden = !rows.length;
    $('formulaMap').innerHTML = rows.map(tex => `<div data-tex="${escape(tex)}">${escape(tex)}</div>`).join('');
  }

  function renderFormula() {
    const missing = missingSlots(draft), invalid = !missing.length && draft ? validationMessage(draft) : '', tex = formulaTex();
    $('formula').innerHTML = `<div data-tex="${escape(tex)}" data-display>${escape(tex)}</div>`;
    $('formulaNote').textContent = missing.length ? `未設定：${missing.join('，')}` : invalid;
    $('completionStatus').textContent = !draft ? '' : missing.length ? `${missing.length}か所未設定` : invalid ? '接続を確認' : '完成';
    renderFormulaMap();
  }
  function renderEditor() {
    const info = safeInfo(draft), missing = missingSlots(draft);
    $('tree').innerHTML = draft ? treeHTML(draft) : '<div class="empty-canvas"><div class="empty-prompt"><button class="add-root" type="button" data-add-path="[]">＋ 関数を追加</button><p>基本関数や構成操作から始められます．</p></div></div>';
    $('classification').textContent = !draft ? '' : missing.length ? '未完成' : !info ? '引数の個数が適合していません' : `${info.arity}変数 · ${info.primitive ? '原始再帰関数（全域）' : '最小化を含む構成'}`;
    $('undoEdit').disabled = !past.length; $('redoEdit').disabled = !future.length;
    const arity = info?.arity;
    $('argumentsLabel').textContent = arity == null ? '入力' : arity === 0 ? '入力なし' : `入力（${arity}個の自然数）`;
    $('arguments').disabled = arity === 0 || !info;
    $('arguments').placeholder = arity ? '例：2, 3' : '空欄';
    $('saveTop').disabled = !info; $('runTop').disabled = !info;
    renderFormula(); renderEvaluation();
  }
  function commitDraft(candidate, text = '') {
    if (JSON.stringify(candidate).length > 250000) { message('構成木が表示上限を超えています．', true); return false; }
    past.push(clone(draft)); if (past.length > 60) past.shift(); future = [];
    draft = candidate; selected = []; clearEvaluation(); renderEditor(); if (text) message(text); return true;
  }

  function compatible(node, expected) { return expected == null || nodeArity(node) === expected; }
  function pickerButton(kind, label, expected, help) {
    const impossible = kind === 'successor' && expected != null && expected !== 1 || kind === 'primitiveRecursion' && expected === 0;
    const reason = impossible ? `${expected}変数のスロットには接続できません` : help;
    return `<button class="picker-button ${impossible ? 'incompatible' : ''}" type="button" data-kind="${kind}" ${impossible ? 'disabled' : ''}><span>${label}</span><small>${reason}</small></button>`;
  }
  function renderLibrary() {
    $('library').innerHTML = [...library].map(([name, def]) => `<div class="library-row"><button type="button" data-open="${escape(name)}">${escape(name)}<small>${def.arity}変数 · ${def.kind === 'sample' ? '見本' : '自作'}</small></button></div>`).join('');
    const expected = expectedAt(pickerPath);
    $('savedPicker').innerHTML = [...library].map(([name, def]) => { const bad = expected != null && def.arity !== expected; return `<button class="picker-button ${bad ? 'incompatible' : ''}" type="button" data-reference="${escape(name)}" ${bad ? 'disabled' : ''}><span>${escape(name)}</span><small>${def.arity}変数${bad ? ` · ${expected}変数が必要` : ''}</small></button>`; }).join('');
    $('storageStatus').textContent = storageNote;
  }
  function openPicker(path) {
    pickerPath = path; const expected = expectedAt(path);
    $('pickerRequirement').textContent = expected == null ? '関数を選択してください．' : `${expected}変数の関数を選択してください．`;
    $('basicPalette').innerHTML = pickerButton('zero', '零関数', expected, '入力によらず，常に0を返す') + pickerButton('successor', '後者関数', expected, '入力に1を加える') + pickerButton('projection', '射影関数', expected, '複数の入力から1つを取り出す');
    $('operationPalette').innerHTML = pickerButton('composition', '合成', expected, '内側の結果を外側の関数へ渡す') + pickerButton('primitiveRecursion', '原始再帰', expected, '初期値から，更新を繰り返す') + pickerButton('minimization', '最小化', expected, '値が0になる最小のyを探す');
    renderLibrary(); $('pickerOverlay').hidden = false;
  }
  function closePicker() { $('pickerOverlay').hidden = true; }
  function connect(node) {
    const expected = expectedAt(pickerPath);
    if (!compatible(node, expected)) { message(`このスロットには${expected}変数の関数が必要です．`, true); return; }
    let candidate = replaceAt(draft, pickerPath, normalize(node));
    if (pickerPath.at(-1) === 'outer') {
      const parent = getAt(candidate, pickerPath.slice(0, -1)), count = nodeArity(node), previous = getAt(draft, pickerPath.slice(0, -1))?.inner || [];
      if (count > 20) { message('外側の関数は20変数まで選択できます．', true); return; }
      parent.inner = Array.from({ length: count }, (_, i) => compatible(previous[i], parent.arity) ? previous[i] : null);
    }
    closePicker(); commitDraft(candidate, '関数を追加しました．');
  }

  function hasChildren(node) { return !!node && (node.type === 'composition' || node.type === 'primitiveRecursion' || node.type === 'minimization'); }
  function renderInspector() {
    const node = getAt(draft, selected), arity = nodeArity(node);
    const field = (label, property, value, min = 0) => `<label>${label} <input type="number" min="${min}" step="1" value="${value}" data-property="${property}"></label>`;
    let content = `<p><strong>${escape(R.symbol(node))}</strong> · ${arity}変数</p>`;
    if (node.type === 'zero') content += `<p class="node-explanation">入力の値によらず0を返します．引数の個数だけを指定します．</p><div class="fields">${field('引数 n', 'arity', node.arity)}</div>`;
    if (node.type === 'successor') content += '<p class="node-explanation">1つの入力を受け取り，その値に1を加えます．</p>';
    if (node.type === 'projection') content += `<p class="node-explanation">n個の入力から，i番目の値だけを取り出します．</p><div class="fields">${field('入力 n', 'arity', node.arity, 1)}${field('位置 i', 'index', node.index, 1)}</div>`;
    if (node.type === 'composition') content += `<p class="node-explanation">すべての内側の関数に同じ入力を渡し，その結果を外側の関数へ渡します．</p><div class="fields">${field('共通の入力 n', 'arity', node.arity)}</div>`;
    if (node.type === 'primitiveRecursion') {
      const xs = readableVariables(node.parameters), fixed = xs.join(', '), fn = currentFunctionName(), previous = `${fn}(${fixed ? `${fixed}, ` : ''}y)`;
      content += `<p class="node-explanation">初期関数 <strong>g(${escape(fixed)})</strong> が0段階目の値を決めます．更新関数 <strong>h(${escape([...xs, 'y', previous].join(', '))})</strong> は，元の入力・段階 y・直前の値を受け取ります．</p><div class="fields">${field('パラメータ k', 'parameters', node.parameters)}</div>`;
    }
    if (node.type === 'minimization') content += `<p class="node-explanation">探索対象gが初めて0になる，最小の自然数yを探します．</p><div class="fields">${field('結果の引数 n', 'arity', node.arity)}</div>`;
    if (['zero', 'projection', 'composition', 'primitiveRecursion', 'minimization'].includes(node.type)) content += '<div class="fields"><button id="applyProperties" class="primary" type="button">セット</button><span class="note">数値は「セット」を押すまで構成に反映されません．</span></div>';
    if (node.type === 'reference') { const def = library.get(node.name); content += `<p>${escape(def.description)}</p><div class="definition">${escape(noteTree(def.tree))}</div><button id="expandDefinition" type="button">内部定義を展開</button>`; }
    content += '<div class="fields"><button id="replaceNode" type="button">置き換え</button><button id="deleteNode" class="danger" type="button">削除</button></div>';
    $('inspector').innerHTML = content;
  }
  function openInspector(path) { selected = path; renderInspector(); $('editorOverlay').hidden = false; renderEditor(); }
  function closeInspector() { $('editorOverlay').hidden = true; }

  function openFunction(name) {
    const def = library.get(name); if (!def) return;
    $('openOverlay').hidden = true; $('functionName').value = name; $('description').value = def.description;
    commitDraft(normalize(def.tree), `「${name}」を開きました．`);
    const n = def.arity; $('arguments').value = n === 2 ? '2, 3' : n === 1 ? name === 'evenHalf' ? '3' : '4' : '';
  }
  function persist() {
    try { localStorage.setItem(storageKey, R.exportLibrary(library)); storageNote = 'このブラウザに保存しました．'; }
    catch (_) { storageNote = 'ブラウザ内に保存できません．JSONを書き出してください．'; }
    $('storageStatus').textContent = storageNote;
  }
  function saveDraft() {
    try {
      const core = toCore(draft), name = $('functionName').value.trim();
      library = R.saveDefinition(library, name, core, $('description').value.trim()); persist(); renderLibrary(); renderEditor(); message(`「${name}」を保存しました．`);
    } catch (error) { message(error.message, true); }
  }

  function parseInputs() {
    const info = safeInfo(draft); if (!info) throw new Error(`構成が未完成です．${missingSlots(draft).join('，')}を追加してください．`);
    if (info.arity === 0) return [];
    const parts = $('arguments').value.trim().split(/[,，、]/).map(s => s.trim());
    if (parts.length !== info.arity || parts.some(s => !s)) throw new Error(`${info.arity}個の自然数をカンマで区切って入力してください．`);
    return parts.map(R.natural);
  }
  function prepareEvaluation() {
    pause();
    try { evaluation = new R.Evaluation(toCore(draft), parseInputs(), library); lastEvent = null; message(''); renderEvaluation(); return true; }
    catch (error) { message(error.message, true); renderEvaluation(); return false; }
  }
  function renderEvaluation() {
    const complete = !!safeInfo(draft), stopped = evaluation && ['finished', 'limited', 'interrupted', 'error'].includes(evaluation.status);
    $('step').disabled = !complete || !!stopped || timer !== null; $('run').disabled = !complete || !!stopped;
    $('run').textContent = timer ? 'Ⅱ 一時停止' : '▶ 実行'; $('interrupt').disabled = !evaluation || !!stopped;
    $('evalStatus').textContent = !complete ? '構成が未完成' : !evaluation ? '未実行' : ({ ready: '準備完了', running: timer ? '実行中' : '一時停止中', finished: '評価完了', limited: '観察上限', interrupted: '中断', error: '中断' })[evaluation.status];
    $('result').textContent = evaluation?.status === 'finished' ? String(evaluation.result) : '—';
    $('evaluationReason').textContent = evaluation?.reason || (evaluation ? `入力 (${evaluation.inputs.join(', ')})` : complete ? '' : '空欄を埋めると実行できます．');
    const events = evaluation?.events || [], major = events.filter(e => e.major), visible = ($('viewMode').value === 'detail' ? events : major).slice(-65);
    $('counts').textContent = events.length ? `内部イベント ${events.length} ／ 主要イベント ${major.length}` : '';
    $('currentEvent').textContent = lastEvent ? `#${lastEvent.number} ${lastEvent.message}` : '実行すると計算過程を確認できます．';
    $('eventLog').innerHTML = visible.map(e => `<div class="event-row"><small>#${e.number} · ${escape(e.label)}(${escape(e.args.join(', '))})</small>${escape(e.message)}</div>`).join('');
    $('eventLog').scrollTop = $('eventLog').scrollHeight;
    const buttons = [...document.querySelectorAll('[data-tree-path]')]; let active = null;
    if (lastEvent) for (const button of buttons) { const path = JSON.parse(button.dataset.treePath); if (isPrefix(path, lastEvent.path) && (!active || path.length > active.path.length)) active = { button, path }; }
    buttons.forEach(button => button.classList.toggle('evaluating', active?.button === button));
  }
  function advance() {
    if (!evaluation && !prepareEvaluation()) return;
    const detail = $('viewMode').value === 'detail';
    for (let i = 0; i < (detail ? 1 : 250); i++) { const event = evaluation.step(); if (event) lastEvent = event; if (!event || event.major || detail) break; }
    if (['finished', 'limited', 'interrupted', 'error'].includes(evaluation.status)) pause(); renderEvaluation();
  }
  function startRun() { if (timer) { pause(); renderEvaluation(); return; } if (!evaluation && !prepareEvaluation()) return; timer = setInterval(advance, Number($('speed').value)); renderEvaluation(); }

  function restoreEdit(from, to, text) {
    if (!from.length) return; to.push(clone(draft)); draft = from.pop(); selected = []; clearEvaluation(); renderEditor(); message(text);
  }
  function adaptNodeChange(candidate, path) {
    if (path.at(-1) === 'outer') {
      const parent = getAt(candidate, path.slice(0, -1)), count = nodeArity(getAt(candidate, path));
      parent.inner = Array.from({ length: count }, (_, i) => compatible(parent.inner?.[i], parent.arity) ? parent.inner[i] : null);
    }
    return candidate;
  }
  function applyInspectorProperties() {
    const original = getAt(draft, selected), node = clone(original), values = {};
    for (const input of $('inspector').querySelectorAll('[data-property]')) {
      const value = Number(input.value);
      if (!Number.isSafeInteger(value) || value < 0) { message('0以上の整数を指定してください．', true); return; }
      values[input.dataset.property] = value;
    }
    if (node.type === 'projection') {
      if (values.arity < 1 || values.index < 1 || values.index > values.arity) { message('射影関数は n ≥ 1，1 ≤ i ≤ n となるように指定してください．', true); return; }
      node.arity = values.arity; node.index = values.index;
    } else if (node.type === 'primitiveRecursion') {
      node.parameters = values.parameters;
      node.base = compatible(node.base, values.parameters) ? node.base : null;
      node.step = compatible(node.step, values.parameters + 2) ? node.step : null;
    } else {
      Object.assign(node, values);
      if (node.type === 'composition') node.inner = (node.inner || []).map(child => compatible(child, values.arity) ? child : null);
    }
    const lostChildren = hasChildren(original) && missingSlots(node).length > missingSlots(original).length;
    if (lostChildren && !confirmAction('引数の個数を変えると，適合しない子関数が空欄に戻ります．続けますか？')) return;
    const expected = expectedAt(selected);
    if (expected != null && nodeArity(node) !== expected) { message(`このスロットには${expected}変数の関数が必要です．`, true); return; }
    closeInspector(); commitDraft(adaptNodeChange(replaceAt(draft, selected, node), selected), '設定を反映しました．');
  }

  $('tree').addEventListener('click', event => {
    const add = event.target.closest('[data-add-path]'), button = event.target.closest('[data-tree-path]');
    if (add) openPicker(JSON.parse(add.dataset.addPath)); else if (button) openInspector(JSON.parse(button.dataset.treePath));
  });
  for (const id of ['basicPalette', 'operationPalette']) $(id).addEventListener('click', event => { const button = event.target.closest('[data-kind]'); if (button && !button.disabled) connect(makeNode(button.dataset.kind, expectedAt(pickerPath))); });
  $('savedPicker').addEventListener('click', event => { const button = event.target.closest('[data-reference]'); if (button && !button.disabled) connect(R.reference(button.dataset.reference)); });
  $('closePicker').addEventListener('click', closePicker); $('pickerOverlay').addEventListener('click', event => { if (event.target === $('pickerOverlay')) closePicker(); });
  $('openMenu').addEventListener('click', () => { renderLibrary(); $('openOverlay').hidden = false; });
  $('closeOpen').addEventListener('click', () => { $('openOverlay').hidden = true; });
  $('library').addEventListener('click', event => { const button = event.target.closest('[data-open]'); if (button) openFunction(button.dataset.open); });
  $('closeInspector').addEventListener('click', closeInspector);
  $('inspector').addEventListener('click', event => {
    const node = getAt(draft, selected);
    if (event.target.id === 'applyProperties') applyInspectorProperties();
    if (event.target.id === 'replaceNode') { if (hasChildren(node) && !confirmAction('この関数を置き換えると，内側の構成は失われます．続けますか？')) return; closeInspector(); openPicker(selected); }
    if (event.target.id === 'deleteNode') { if (hasChildren(node) && !confirmAction('この関数と内側の構成を削除しますか？')) return; let candidate = replaceAt(draft, selected, null); if (selected.at(-1) === 'outer') getAt(candidate, selected.slice(0, -1)).inner = []; closeInspector(); commitDraft(candidate, '関数を削除しました．'); }
    if (event.target.id === 'expandDefinition') { closeInspector(); commitDraft(adaptNodeChange(replaceAt(draft, selected, normalize(library.get(node.name).tree)), selected), '内部定義を展開しました．'); }
  });
  $('undoEdit').addEventListener('click', () => restoreEdit(past, future, '1つ戻しました．')); $('redoEdit').addEventListener('click', () => restoreEdit(future, past, 'やり直しました．'));
  $('newFunction').addEventListener('click', () => { if (draft && !confirmAction('現在の未保存の構成を閉じますか？')) return; $('functionName').value = 'untitled'; $('description').value = ''; $('arguments').value = ''; commitDraft(null); message(''); });
  $('saveTop').addEventListener('click', saveDraft); $('saveForm').addEventListener('submit', event => { event.preventDefault(); saveDraft(); });
  $('functionName').addEventListener('input', renderEditor);
  $('moreMenu').addEventListener('click', () => { const open = $('morePopover').hidden; $('morePopover').hidden = !open; $('moreMenu').setAttribute('aria-expanded', String(open)); });
  $('evalForm').addEventListener('submit', event => { event.preventDefault(); prepareEvaluation(); }); $('step').addEventListener('click', advance); $('run').addEventListener('click', startRun);
  $('runTop').addEventListener('click', () => { $('executionPanel').scrollIntoView?.({ behavior: 'smooth' }); startRun(); });
  $('interrupt').addEventListener('click', () => { pause(); evaluation?.interrupt(); renderEvaluation(); }); $('viewMode').addEventListener('change', renderEvaluation);
  $('speed').addEventListener('change', () => { if (timer) { pause(); timer = setInterval(advance, Number($('speed').value)); } });
  $('dismissMessage').addEventListener('click', () => { $('messageArea').hidden = true; });

  function updateExercise() { const e = exercises[Number($('exerciseSelect').value) || 0]; $('exercisePrompt').textContent = `${e.arity}変数の「${e.name}」を構成してください．`; $('exerciseHint').textContent = e.hint; $('exerciseResult').textContent = ''; }
  const waitFrame = () => new Promise(resolve => setTimeout(resolve, 0));
  async function testExercise() {
    const exercise = exercises[Number($('exerciseSelect').value) || 0], token = ++testToken, info = safeInfo(draft);
    if (!info) { $('exerciseResult').textContent = '構成を完成させてください．'; return; }
    if (info.arity !== exercise.arity) { $('exerciseResult').textContent = `この課題は${exercise.arity}変数です．`; return; }
    judging = true; $('testExercise').disabled = true; const tree = toCore(draft), snapshot = new Map(library), lines = [];
    try {
      for (const values of exercise.cases) {
        const inputs = values.map(BigInt), expected = exercise.expected(inputs), run = new R.Evaluation(tree, inputs, snapshot, 12000);
        while (!['finished', 'limited', 'error'].includes(run.status)) { for (let batch = 0; batch < 400 && !['finished', 'limited', 'error'].includes(run.status); batch++) run.step(); await waitFrame(); if (token !== testToken) return; }
        const passed = expected === null ? run.status === 'limited' : run.status === 'finished' && run.result === expected;
        lines.push(`${passed ? '✓' : '×'} (${inputs.join(', ')})：${run.status === 'finished' ? run.result : '観察上限まで未終了'}${expected === null ? '（未定義の証明ではありません）' : ''}`);
        if (!passed) { $('exerciseResult').textContent = lines.join('\n'); return; }
      }
      $('exerciseResult').textContent = lines.join('\n') + '\n有限個のテストを通過しました．正しさ・未定義性を証明したわけではありません．';
    } catch (error) { $('exerciseResult').textContent = error.message; }
    finally { judging = false; $('testExercise').disabled = false; }
  }
  $('exerciseSelect').innerHTML = exercises.map((e, i) => `<option value="${i}">${i + 1}．${escape(e.name)}</option>`).join('');
  $('exerciseSelect').addEventListener('change', () => { testToken++; updateExercise(); });
  $('startExercise').addEventListener('click', () => { const e = exercises[Number($('exerciseSelect').value) || 0]; $('functionName').value = e.key; $('description').value = ''; $('arguments').value = e.arity === 2 ? '2, 3' : '3'; commitDraft(null); openPicker([]); });
  $('showSolution').addEventListener('click', () => { const e = exercises[Number($('exerciseSelect').value) || 0]; if (e.tree) { $('functionName').value = e.key; commitDraft(normalize(e.tree()), '構成例を開きました．'); } else openFunction(e.key); });
  $('testExercise').addEventListener('click', testExercise);

  $('exportJson').addEventListener('click', () => {
    try { const blob = new Blob([R.exportLibrary(library)], { type: 'application/json' }), url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'recursive-functions.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); message('JSONを書き出しました．'); }
    catch (error) { message(error.message, true); }
  });
  $('importJson').addEventListener('click', () => $('jsonFile').click());
  $('jsonFile').addEventListener('change', async () => {
    const file = $('jsonFile').files[0]; if (!file) return;
    try { if (file.size > 1500000) throw new Error('JSONは1.5MBまで読み込めます．'); const proposed = R.importLibrary(await file.text(), library); if (draft && safeInfo(draft)) R.info(toCore(draft), proposed); library = proposed; persist(); renderLibrary(); renderEditor(); message('JSONの関数を読み込みました．'); }
    catch (error) { message(error.message, true); } $('jsonFile').value = '';
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && timer) { pause(); renderEvaluation(); } });
  try { const saved = localStorage.getItem(storageKey); if (saved) { library = R.importLibrary(saved, library); storageNote = '保存した関数を読み込みました．'; } else storageNote = '関数はこのブラウザに保存されます．'; }
  catch (_) { storageNote = '保存データを読み込めませんでした．'; }
  renderLibrary(); renderEditor(); updateExercise();
})();
