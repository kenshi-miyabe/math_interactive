(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const { LambdaCalculation, definitions, print, freeVariables, decode } = window.LambdaSimulation;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const examples = {
    identity: { name: '恒等関数：そのまま返す', source: '(λx. x) a', description: '最初の1ステップで，xがaに置き換わります．' },
    constant: { name: '定数関数：2番目の引数を使わない', source: '(λx. λy. x) a b', description: '引数を二つ渡しても，最初のaだけを返します．' },
    self: { name: '関数に自分自身を渡す', source: '(λf. f f) (λx. x)', description: 'fが2か所に現れるので，引数の関数が2か所へ置き換わります．' },
    ski: { name: 'S K K は恒等関数', source: 'S K K a', description: '三つの関数の組合せだけで，aをそのまま返せます．' },
    capture: { name: 'α変換：自由変数を捕まえない', source: '(λx. λy. x) y', description: '先に束縛変数を改名します．最後の自由変数yが，自由なまま残ることを確かめましょう．' },
    true: { name: '条件分岐：TRUE', source: 'IF TRUE a b', description: 'TRUEが最初の選択肢aを選びます．' },
    false: { name: '条件分岐：FALSE', source: 'IF FALSE a b', description: 'FALSEが2番目の選択肢bを選びます．' },
    not: { name: 'NOT：真偽を反転', source: 'NOT TRUE', description: '二つの引数を逆順で渡すと，真偽値を反転できます．' },
    pair: { name: '組から値を取り出す', source: 'FST (PAIR a b)', description: 'PAIRで二つの値を関数に包み，FSTで最初の値aを取り出します．SNDならbを取り出せます．' },
    numeral: { name: 'Church numeral：数を関数で表す', numbers: 1, make: n => `${n}`, description: '数字の略記を展開して，関数fが何回適用されるか見てみましょう．' },
    successor: { name: 'Church numeral：1増やす', numbers: 1, make: n => `SUCC ${n}`, description: 'fをもう1回適用することで，次の自然数を表します．' },
    addition: { name: 'Church numeral：足し算', numbers: 2, make: (n, m) => `ADD ${n} ${m}`, description: 'fをm回適用した結果へ，さらにn回適用します．' },
    multiplication: { name: 'Church numeral：掛け算', numbers: 2, make: (n, m) => `MUL ${n} ${m}`, description: '「fをm回適用する関数」をn回使います．' },
    power: { name: 'Church numeral：べき乗', numbers: 2, max: 3, make: (n, m) => `POW ${n} ${m}`, description: 'mが関数nを繰り返し適用することで，nのm乗を表します．0の0乗はこの符号化では1になります．' },
    zero: { name: 'Church numeral：0かどうか判定', numbers: 1, make: n => `ISZERO ${n}`, description: 'nが0ならTRUE，正ならFALSEになります．nを0と正の数で試しましょう．' },
    order: { name: '順序で違いが出る：使わない引数', source: '(λx. a) OMEGA', description: '正規順序ならすぐaへ．適用順序では，使わない引数の簡約を続けます．順序を切り替えて比べましょう．' },
    omega: { name: 'OMEGA：同じ式へ戻り続ける', source: 'OMEGA', description: 'β簡約しても同じ式が現れます．「式が同じ」と「書き換えができない」は別です．' }
  };
  let selected = 'identity', calculation, timer = null, playbackSteps = 0, notice = '';
  const typeName = type => ({ beta: 'β簡約', alpha: 'α変換', delta: '定義展開' }[type]);
  function pause() { clearInterval(timer); timer = null; }
  function termHTML(term, highlight = null, kind = 'redex', path = [], context = 0) {
    const precedence = term.type === 'abs' ? 0 : term.type === 'app' ? 1 : 2;
    let html = term.type === 'var' ? escape(term.name) : term.type === 'abs' ? `<span class="lambda">λ${escape(term.param)}.</span> ${termHTML(term.body, highlight, kind, [...path, 'body'])}` : `${termHTML(term.fn, highlight, kind, [...path, 'fn'], 1)} ${termHTML(term.arg, highlight, kind, [...path, 'arg'], 2)}`;
    if (precedence < context) html = `(${html})`;
    return highlight !== null && path.join('.') === highlight.join('.') ? `<mark class="${kind}">${html}</mark>` : html;
  }
  function updateExampleControls() {
    const example = examples[selected];
    $('churchControls').hidden = !example?.numbers;
    $('secondNumber').hidden = example?.numbers !== 2;
    $('number1').disabled = !example?.numbers;
    $('number2').disabled = example?.numbers !== 2;
    const max = example?.max ?? 6;
    for (const id of ['number1', 'number2']) {
      const old = $(id).value;
      $(id).innerHTML = Array.from({ length: max + 1 }, (_, n) => `<option value="${n}">${n}</option>`).join('');
      $(id).value = old !== '' && Number(old) <= max ? old : id === 'number1' ? '2' : '3';
    }
    $('exampleDescription').textContent = example?.description || '自分で入力した式を，選んだ順序で書き換えます．';
    updateInputPreview();
  }
  function exampleSource() {
    const example = examples[selected];
    return example?.numbers ? example.make(Number($('number1').value), Number($('number2').value)) : example?.source ?? $('source').value;
  }
  function updateInputPreview() { $('inputPreview').textContent = `セットする初期式：${exampleSource()}`; }
  function install(source) {
    const replacement = new LambdaCalculation(source, $('strategy').value);
    pause(); calculation = replacement; notice = ''; $('source').value = source;
    $('setupError').hidden = true; $('sourceError').hidden = true;
    render();
  }
  function render() {
    let next = null, blocked = '';
    try { next = calculation.next(); } catch (error) { blocked = error.message; pause(); }
    const last = calculation.history.at(-1), normal = !next && !blocked;
    $('currentTerm').innerHTML = termHTML(calculation.term, next?.path ?? null);
    const free = [...freeVariables(calculation.term)].filter(name => !definitions[name] && name !== 'Ω' && !/^\d+$/.test(name));
    $('freeVariables').textContent = `自由変数：${free.length ? free.join('，') : 'なし（閉じた式）'}`;
    $('status').textContent = blocked ? '表示上限・簡約を一時停止' : normal ? '正規形' : timer ? '自動再生中' : '書き換え可能';
    $('rewriteKind').textContent = next ? `↓ ${typeName(next.type)}` : normal ? '✓ 正規形' : '一時停止';
    $('rewriteDescription').textContent = next ? next.description : blocked || '書き換える場所は残っていません．';
    $('nextTerm').innerHTML = next ? termHTML(next.after, next.path, 'contractum') : '';
    $('nextTerm').hidden = !next;
    $('previewHint').hidden = !next;
    $('previewTitle').textContent = normal ? '簡約の結果' : '次の式';
    $('result').textContent = normal ? decode(calculation.term) || `結果：${print(calculation.term)}` : '';
    $('step').disabled = normal || !!blocked || timer !== null;
    $('play').disabled = normal || !!blocked;
    $('back').disabled = !last || timer !== null;
    $('play').textContent = timer ? 'Ⅱ 一時停止' : '▶ 自動再生';
    $('steps').textContent = calculation.history.length;
    $('betaCount').textContent = calculation.history.filter(event => event.type === 'beta').length;
    $('notice').textContent = notice || (last?.cycle ? '同じ式が再出現しました（束縛変数の名前の違いは除きます）．まだ書き換え可能です．' : '');
    $('notice').hidden = !$('notice').textContent;
    $('historyHint').textContent = calculation.history.length > 80 ? '直近80ステップを表示．巻き戻しは最初まで可能．' : '上から順に書き換え';
    $('history').innerHTML = last ? `<table><thead><tr><th>手順</th><th>操作</th><th>書き換え後の式</th></tr></thead><tbody>${calculation.history.slice(-80).map(event => `<tr><td>${event.step}</td><td>${typeName(event.type)}</td><td class="mono">${escape(print(event.after))}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">「1ステップ進む」で書き換えを始めます．</p>';
    $('history').scrollTop = $('history').scrollHeight;
  }
  function advance() {
    try {
      const event = calculation.step();
      if (timer && event) {
        playbackSteps++;
        if (event.cycle) { pause(); notice = '同じ式が再出現したので，自動再生を一時停止しました．まだ書き換え可能です．'; }
        else if (playbackSteps >= 200) { pause(); notice = '観察のため，200ステップで自動再生を一時停止しました．続きは手動または自動再生で進められます．'; }
      }
      if (!calculation.next()) pause();
    } catch (error) { pause(); notice = error.message; }
    render();
  }
  function startTimer() { timer = setInterval(advance, Number($('speed').value)); }
  $('exampleSelect').innerHTML = Object.entries(examples).map(([key, example]) => `<option value="${key}">${escape(example.name)}</option>`).join('') + '<option value="custom">自分の式</option>';
  $('definitions').innerHTML = Object.entries(definitions).map(([name, d]) => `<tr><td class="mono">${name}</td><td class="mono">${escape(print(d.term))}</td><td>${escape(d.description)}</td></tr>`).join('');
  $('step').addEventListener('click', advance);
  $('back').addEventListener('click', () => { pause(); calculation.back(); notice = ''; render(); });
  $('reset').addEventListener('click', () => install(calculation.source));
  $('play').addEventListener('click', () => { if (timer) pause(); else { notice = ''; playbackSteps = 0; startTimer(); } render(); });
  $('speed').addEventListener('change', () => { if (timer) { pause(); startTimer(); } });
  $('strategy').addEventListener('change', () => install(calculation.source));
  $('exampleSelect').addEventListener('change', () => {
    const previous = selected; selected = $('exampleSelect').value;
    updateExampleControls();
    try { install(exampleSource()); } catch (error) { selected = previous; $('exampleSelect').value = previous; updateExampleControls(); $('setupError').textContent = error.message; $('setupError').hidden = false; }
  });
  $('setup').addEventListener('submit', event => {
    event.preventDefault();
    try { install(exampleSource()); } catch (error) { $('setupError').textContent = error.message; $('setupError').hidden = false; }
  });
  ['number1', 'number2'].forEach(id => $(id).addEventListener('change', updateInputPreview));
  $('loadSource').addEventListener('click', () => {
    try { install($('source').value); selected = 'custom'; $('exampleSelect').value = 'custom'; updateExampleControls(); }
    catch (error) { $('sourceError').textContent = error.message; $('sourceError').hidden = false; }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && timer) { pause(); render(); } });
  updateExampleControls(); install(examples.identity.source);
})();
