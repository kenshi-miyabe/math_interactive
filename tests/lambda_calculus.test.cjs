const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('../assets/lambda-calculus.js');
function run(source, strategy = 'normal', limit = 2000) {
  const c = new L.LambdaCalculation(source, strategy);
  for (let i = 0; c.next() && i < limit; i++) c.step();
  return c;
}
test('parser handles application precedence, multi-parameter abstractions and backslash syntax', () => {
  assert.ok(L.equivalent(L.parse('f x y'), L.parse('(f x) y')));
  assert.ok(!L.equivalent(L.parse('f x y'), L.parse('f (x y)')));
  assert.ok(L.equivalent(L.parse('\\x y. x y'), L.parse('λx. λy. x y')));
  assert.ok(L.equivalent(L.parse('λx. x y'), L.parse('λx. (x y)')));
  for (const source of ['λx. x', '(λx. x) (λy. y)', 'λx. (λy. x y) z', 'λx. λx. x', 'S K K a']) {
    assert.ok(L.equivalent(L.parse(source), L.parse(L.print(L.parse(source)))));
  }
  for (const source of ['', 'λ.', 'λx x', '(x', 'x)', 'λ1. x', 'a + b', '101', 'f λx. x']) assert.throws(() => L.parse(source));
});
test('beta reduction replaces free occurrences and preserves binder shadowing', () => {
  assert.equal(L.print(run('(λx. x x) a').term), 'a a');
  assert.ok(L.equivalent(run('(λx. λx. x) y').term, L.parse('λz. z')));
  assert.equal(L.print(run('(λx. λy. z) y').term), 'λy. z');
  assert.equal(L.print(run('(λx. x (λx. x)) y').term), 'y (λx. x)');
});
test('capture-avoiding alpha conversion is a separate step before beta', () => {
  const c = new L.LambdaCalculation('(λx. λy. x) y');
  const first = c.step();
  assert.equal(first.type, 'alpha');
  assert.equal(first.cycle, false, 'a necessary alpha-renaming is not a repeated reduction cycle');
  assert.equal(first.newName, 'y1');
  assert.equal(L.print(c.term), '(λx. λy1. x) y');
  assert.equal(c.step().type, 'beta');
  assert.ok(L.equivalent(c.term, L.parse('λz. y')));
  assert.deepEqual([...L.freeVariables(c.term)], ['y']);
  assert.equal(c.next(), null);
  const nested = run('(λx. λy. λy. x y) y');
  assert.ok(L.equivalent(nested.term, L.parse('λa. λb. y b')));
  const fresh = run('(λx. λy. x y1) y');
  assert.ok(L.equivalent(fresh.term, L.parse('λz. y y1')));
});
test('macros expand explicitly, remain closed, and respect locally bound names', () => {
  for (const definition of Object.values(L.definitions)) assert.equal(L.freeVariables(definition.term).size, 0);
  const c = new L.LambdaCalculation('I a');
  assert.equal(c.step().type, 'delta');
  assert.equal(c.step().type, 'beta');
  assert.equal(L.print(c.term), 'a');
  assert.equal(L.print(run('(λI. I) a').term), 'a');
  assert.equal(run('λI. I').history.length, 0);
  assert.ok(L.equivalent(run('(λx. λI. x) I').term, L.parse('λz. λw. w')));
});
test('Church numerals, successors, addition and multiplication normalize to the expected lambda terms', () => {
  for (let n = 0; n <= 6; n++) {
    assert.ok(L.equivalent(run(`${n}`).term, L.numeral(n)));
    assert.ok(L.equivalent(run(`SUCC ${n}`).term, L.numeral(n + 1)));
    for (let m = 0; m <= 6; m++) {
      for (const [operation, expected] of [['ADD', n + m], ['MUL', n * m]]) {
        const c = run(`${operation} ${n} ${m}`);
        assert.equal(c.next(), null, `${operation} ${n} ${m} terminates`);
        assert.ok(L.equivalent(c.term, L.numeral(expected)), `${operation} ${n} ${m}`);
      }
    }
  }
});
test('exponentiation includes zero exponents and yields a full Church numeral with beta reduction alone', () => {
  for (let n = 0; n <= 3; n++) for (let m = 0; m <= 3; m++) {
    const c = run(`POW ${n} ${m}`);
    assert.equal(c.next(), null);
    assert.ok(L.equivalent(c.term, L.numeral(n ** m)), `${n}^${m}`);
  }
});
test('booleans, pairs, zero test and SKK compute their advertised results', () => {
  for (const [source, expected] of [
    ['IF TRUE a b', 'a'], ['IF FALSE a b', 'b'], ['NOT TRUE', 'FALSE'],
    ['NOT FALSE', 'TRUE'], ['FST (PAIR a b)', 'a'], ['SND (PAIR a b)', 'b'], ['S K K a', 'a']
  ]) assert.ok(L.equivalent(run(source).term, run(expected).term), source);
  for (let n = 0; n <= 6; n++) assert.ok(L.equivalent(run(`ISZERO ${n}`).term, L.definitions[n === 0 ? 'TRUE' : 'FALSE'].term));
  assert.match(L.decode(run('0').term), /FALSE/);
  assert.match(L.decode(run('ADD 2 3').term), /numeral 5/);
});
test('normal and applicative orders differ on an unused divergent argument', () => {
  const normal = run('(λx. a) OMEGA');
  assert.equal(L.print(normal.term), 'a');
  assert.equal(normal.history.length, 1);
  const applicative = run('(λx. a) OMEGA', 'applicative', 5);
  assert.notEqual(applicative.next(), null);
  assert.ok(applicative.history.some(e => e.cycle));
  for (const strategy of ['normal', 'applicative']) assert.ok(L.equivalent(run('ADD 2 3', strategy).term, L.numeral(5)));
});
test('omega repeats but stays reducible; undo restores terms and cycle detection', () => {
  const c = new L.LambdaCalculation('OMEGA');
  assert.equal(c.step().cycle, false);
  assert.equal(c.step().cycle, true);
  assert.notEqual(c.next(), null);
  c.back();
  assert.equal(c.step().cycle, true);
  for (const source of ['ADD 2 3', '(λx. λy. x) y', 'IF FALSE a b']) {
    const calculation = run(source), states = calculation.history.map(event => L.print(event.before));
    while (states.length) { calculation.back(); assert.equal(L.print(calculation.term), states.pop()); }
    assert.ok(L.equivalent(calculation.term, L.parse(source)));
    assert.equal(calculation.back(), null);
  }
});
test('resource limits stop oversized observations without declaring a normal form', () => {
  assert.throws(() => L.parse('('.repeat(300) + 'x' + ')'.repeat(300)));
  const c = new L.LambdaCalculation('POW 100 100');
  assert.throws(() => { for (let i = 0; i < 100; i++) c.step(); }, /大きさ/);
});
test('UI previews alpha and beta rewrites, switches examples and strategies, and rewinds', () => {
  const fs = require('node:fs'), vm = require('node:vm'), nodes = new Map();
  const el = id => {
    if (!nodes.has(id)) nodes.set(id, { value: id === 'strategy' ? 'normal' : '', textContent: '', innerHTML: '', events: {}, addEventListener(name, handler) { this.events[name] = handler; } });
    return nodes.get(id);
  };
  const document = { getElementById: el, addEventListener() {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../assets/lambda-calculus-ui.js'), 'utf8'), { document, window: { LambdaSimulation: L }, clearInterval() {}, setInterval() { return 1; } });
  assert.match(el('currentTerm').innerHTML, /mark class="redex"/);
  el('step').events.click();
  assert.equal(el('status').textContent, '正規形');
  assert.equal(el('result').textContent, '結果：a');
  el('back').events.click();
  assert.equal(el('steps').textContent, 0);
  el('exampleSelect').value = 'capture'; el('exampleSelect').events.change();
  assert.match(el('rewriteKind').textContent, /α/);
  el('step').events.click();
  assert.match(el('rewriteKind').textContent, /β/);
  assert.equal(el('notice').textContent, '');
  el('exampleSelect').value = 'addition'; el('exampleSelect').events.change();
  assert.equal(el('source').value, 'ADD 2 3');
  for (let i = 0; !el('step').disabled && i < 100; i++) el('step').events.click();
  assert.match(el('result').textContent, /numeral 5/);
  el('exampleSelect').value = 'order'; el('exampleSelect').events.change();
  el('strategy').value = 'applicative'; el('strategy').events.change();
  for (let i = 0; i < 3; i++) el('step').events.click();
  assert.equal(el('status').textContent, '書き換え可能');
  assert.match(el('notice').textContent, /再出現/);
  el('strategy').value = 'normal'; el('strategy').events.change(); el('step').events.click();
  assert.equal(el('result').textContent, '結果：a');
  el('source').value = '(λz. z) b'; el('loadSource').events.click(); el('step').events.click();
  assert.equal(el('result').textContent, '結果：b');
  el('source').value = 'λ.'; el('loadSource').events.click();
  assert.equal(el('sourceError').hidden, false);
  assert.equal(el('result').textContent, '結果：b');
});
