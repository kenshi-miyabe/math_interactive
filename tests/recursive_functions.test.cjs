const { test } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../assets/recursive-functions.js');
const library = R.samples();
function run(tree, inputs, lib = library, limit = 100000) {
  const evaluation = new R.Evaluation(tree, inputs, lib, limit);
  while (evaluation.step());
  return evaluation;
}
test('basic functions include nullary zero, arbitrary arities and exact large natural numbers', () => {
  assert.equal(run(R.zero(0), []).result, 0n);
  assert.equal(run(R.zero(4), [1, 2, 3, 4]).result, 0n);
  assert.equal(R.info(R.zero(1000000)).arity, 1000000);
  assert.equal(run(R.projection(3, 2), [3, 9, 5]).result, 9n);
  const big = '99999999999999999999999999999999999999999999';
  assert.equal(run(R.successor(), [big]).result, BigInt(big) + 1n);
  assert.throws(() => new R.Evaluation(R.successor(), [-1], library));
  assert.throws(() => R.natural(Number.MAX_SAFE_INTEGER + 1));
});
test('arity checks reject invalid slots, and nullary outer composition retains its domain', () => {
  for (const tree of [
    R.projection(1, 2), R.projection(0, 0), R.zero(-1),
    R.composition(R.successor(), []),
    R.composition(R.reference('add'), [R.zero(1), R.zero(2)]),
    R.primitiveRecursion(R.zero(1), R.zero(2)), R.minimization(R.zero(0))
  ]) assert.throws(() => R.info(tree, library));
  const nullaryOuter = R.composition(R.zero(0), [], 3);
  assert.equal(R.info(nullaryOuter).arity, 3);
  assert.equal(run(nullaryOuter, [2, 3, 4]).result, 0n);
  assert.throws(() => new R.Evaluation(R.zero(2), [1], library));
});
test('composition evaluates inner functions first and passes only their results to the outer function', () => {
  const e = run(R.composition(R.reference('add'), [R.successor(), R.projection(1, 1)]), [3]);
  assert.equal(e.result, 7n);
  const outer = e.events.find(event => event.type === 'compositionOuter');
  assert.deepEqual(outer.values, [4n, 3n]);
  const addCall = e.events.find(event => event.type === 'reference' && event.label === 'add');
  assert.deepEqual(addCall.args, [4n, 3n]);
});
test('primitive recursion exposes base and successive results and gives h the correct argument order', () => {
  const e = run(library.get('add').tree, [2, 3]);
  assert.equal(e.result, 5n);
  assert.deepEqual(e.events.filter(event => event.type === 'recursionResult' && !event.path.length).map(event => event.value), [2n, 3n, 4n, 5n]);
  const calls = e.events.filter(event => event.type === 'enter' && event.path.length === 1 && event.path[0] === 'step');
  assert.deepEqual(calls.map(event => event.args), [[2n, 0n, 2n], [2n, 1n, 3n], [2n, 2n, 4n]]);
});
test('saved-function samples compute arithmetic, factorial, zero test and rounded square roots', () => {
  for (let x = 0; x <= 5; x++) for (let y = 0; y <= 4; y++) {
    for (const [name, expected] of [['add', x + y], ['mul', x * y], ['pow', x ** y], ['sub', Math.max(0, x - y)]]) {
      // Exponentiation uses the constructed multiplication/addition, not native arithmetic.
      if (name === 'pow' && (x > 3 || y > 3)) continue;
      const e = run(library.get(name).tree, [x, y]);
      assert.equal(e.status, 'finished', `${name}(${x},${y})`);
      assert.equal(e.result, BigInt(expected), `${name}(${x},${y})`);
    }
  }
  for (const [n, expected] of [[0, 1], [1, 1], [4, 24], [5, 120]]) assert.equal(run(library.get('factorial').tree, [n]).result, BigInt(expected));
  for (let n = 0; n <= 12; n++) {
    assert.equal(run(library.get('ceilSqrt').tree, [n]).result, BigInt(Math.ceil(Math.sqrt(n))));
    assert.equal(run(library.get('isZero').tree, [n]).result, n === 0 ? 1n : 0n);
  }
  const reuse = run(library.get('mul').tree, [2, 3]);
  assert.ok(reuse.events.some(event => event.type === 'reference' && event.label === 'add'));
});
test('minimization returns the first zero and exposes each tested candidate', () => {
  const e = run(library.get('ceilSqrt').tree, [5]);
  const searches = e.events.filter(event => event.type === 'searchResult' && !event.path.length);
  assert.deepEqual(searches.map(event => [event.candidate, event.tested]), [[0n, 5n], [1n, 4n], [2n, 1n], [3n, 0n]]);
  assert.equal(e.result, 3n);
  assert.equal(run(R.minimization(R.zero(1)), []).result, 0n);
});
test('a divergent intermediate computation blocks later minimization candidates', () => {
  // g(x,y) = mu z [isZero(y)=0]: g(x,0) diverges, g(x,1)=0.
  const g = R.minimization(R.composition(R.reference('isZero'), [R.projection(3, 2)]));
  const e = run(R.minimization(g), [7], library, 2000);
  assert.equal(e.status, 'limited');
  assert.equal(e.result, null);
  assert.deepEqual(e.events.filter(event => event.type === 'search' && !event.path.length).map(event => event.candidate), [0n]);
  assert.equal(e.events.filter(event => event.type === 'searchResult' && !event.path.length).length, 0);
});
test('partial-function observations and user interruption are not reported as mathematical undefinedness', () => {
  const totalButExpensive = run(library.get('pow').tree, [5, 4], library, 1000);
  assert.equal(R.info(totalButExpensive.tree, library).primitive, true);
  assert.equal(totalButExpensive.status, 'limited');
  assert.equal(totalButExpensive.result, null);
  for (const n of [0, 2, 4, 6]) assert.equal(run(library.get('evenHalf').tree, [n]).result, BigInt(n / 2));
  const pending = run(library.get('evenHalf').tree, [3], library, 3000);
  assert.equal(pending.status, 'limited');
  assert.equal(pending.result, null);
  assert.match(pending.reason, /未定義の判定ではありません/);
  const cancelled = new R.Evaluation(library.get('evenHalf').tree, [3], library);
  cancelled.step(); cancelled.interrupt();
  assert.equal(cancelled.step(), null);
  assert.equal(cancelled.status, 'interrupted');
  assert.match(cancelled.reason, /証明されたわけではありません/);
});
test('naming and reuse are transactional; direct and indirect circular definitions are rejected', () => {
  let lib = R.saveDefinition(library, 'myAdd', library.get('add').tree, '加法');
  lib = R.saveDefinition(lib, 'twice', R.composition(R.reference('myAdd'), [R.projection(1, 1), R.projection(1, 1)]), '2倍');
  assert.equal(run(R.reference('twice'), [4], lib).result, 8n);
  assert.throws(() => R.saveDefinition(lib, 'myAdd', R.reference('myAdd')), /循環/);
  assert.throws(() => R.saveDefinition(lib, 'myAdd', R.reference('twice')), /循環/);
  assert.throws(() => R.saveDefinition(lib, 'constructor', R.zero(1)));
  assert.throws(() => R.saveDefinition(lib, 'myAdd', R.zero(3)), /変数/);
  assert.equal(run(R.reference('twice'), [4], lib).result, 8n);
  const original = R.clone(lib.get('myAdd').tree);
  const e = new R.Evaluation(R.reference('myAdd'), [2, 3], lib);
  lib.get('myAdd').tree = R.zero(2);
  while (e.step());
  assert.equal(e.result, 5n, 'an active evaluation retains its definition snapshot');
  lib.get('myAdd').tree = original;
});
test('JSON roundtrip preserves definitions and refuses broken references, arities and cycles', () => {
  const text = R.exportLibrary(library), restored = R.importLibrary(text);
  assert.equal(run(R.reference('factorial'), [4], restored).result, 24n);
  assert.equal(R.exportLibrary(restored), text);
  for (const data of [
    { version: 2, functions: [] },
    { version: 1, functions: [{ name: 'f', arity: 1, description: '', tree: R.reference('missing') }] },
    { version: 1, functions: [{ name: 'f', arity: 2, description: '', tree: R.zero(1) }] },
    { version: 1, functions: [{ name: 'f', arity: 1, description: '', tree: R.reference('f') }] }
  ]) assert.throws(() => R.importLibrary(JSON.stringify(data)));
  assert.throws(() => R.importLibrary('not JSON'));
});
test('browser UI starts empty, opens saved functions, persists, evaluates, and runs finite exercise tests', async () => {
  const fs = require('node:fs'), vm = require('node:vm'), nodes = new Map(), saved = new Map();
  const defaults = { arguments: '', viewMode: 'simple', speed: '250', functionName: 'untitled', exerciseSelect: '0' };
  const element = id => {
    if (!nodes.has(id)) nodes.set(id, {
      value: defaults[id] || '', textContent: '', innerHTML: '', events: {}, dataset: {}, hidden: false,
      classList: { toggle() {} }, addEventListener(name, handler) { this.events[name] = handler; }, setAttribute() {}, scrollIntoView() {}
    });
    return nodes.get(id);
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../assets/recursive-functions-ui.js'), 'utf8'), {
    document: { getElementById: element, querySelectorAll: () => [], addEventListener() {} }, window: { RecursiveFunctions: R, confirm: () => true },
    localStorage: { getItem: name => saved.get(name), setItem: (name, value) => saved.set(name, value) },
    clearInterval() {}, setInterval() { return 1; }, setTimeout
  });
  const submit = { preventDefault() {} };
  assert.match(element('tree').innerHTML, /関数を追加/);
  assert.match(element('formula').innerHTML, /boxed/);
  assert.equal(element('run').disabled, true);

  // A saved sample opens as an ordinary editable tree.
  element('openMenu').events.click();
  element('library').events.click({ target: { closest: selector => selector === '[data-open]' ? { dataset: { open: 'add' } } : null } });
  assert.match(element('tree').innerHTML, /原始再帰/);
  assert.match(element('tree').innerHTML, /role-badge">h₁/);
  assert.match(element('tree').innerHTML, /role-badge">h₂/);
  assert.match(element('formula').innerHTML, /operatorname/);
  assert.match(element('formulaMap').innerHTML, /h_\{1\}/);
  assert.match(element('formulaMap').innerHTML, /h_\{2\}/);
  element('tree').events.click({ target: { closest: selector => selector === '[data-tree-path]' ? { dataset: { treePath: '["base"]' } } : null } });
  assert.match(element('inspector').innerHTML, /applyProperties/);
  assert.equal(element('inspector').events.change, undefined);
  element('closeInspector').events.click();
  element('evalForm').events.submit(submit);
  for (let i = 0; !element('step').disabled && i < 100; i++) element('step').events.click();
  assert.equal(element('result').textContent, '5');

  element('functionName').value = 'myAdd'; element('saveTop').events.click();
  assert.ok(saved.size);
  assert.match(element('library').innerHTML, /myAdd/);

  // New functions begin with a truly empty canvas and can be added from +.
  element('newFunction').events.click();
  element('tree').events.click({ target: { closest: selector => selector === '[data-add-path]' ? { dataset: { addPath: '[]' } } : null } });
  assert.equal(element('pickerOverlay').hidden, false);
  element('operationPalette').events.click({ target: { closest: selector => selector === '[data-kind]' ? { dataset: { kind: 'primitiveRecursion' }, disabled: false } : null } });
  assert.match(element('tree').innerHTML, /初期関数/);
  assert.match(element('tree').innerHTML, /g\(x₁\)/);
  assert.match(element('tree').innerHTML, /h\(x₁, y, untitled\(x₁, y\)\)/);
  assert.match(element('formula').innerHTML, /初期関数/);
  assert.match(element('formula').innerHTML, /更新関数/);
  assert.match(element('formulaNote').textContent, /初期関数/);
  assert.equal(element('run').disabled, true);

  element('showSolution').events.click();
  await element('testExercise').events.click();
  assert.match(element('exerciseResult').textContent, /有限個のテストを通過/);
  assert.match(element('exerciseResult').textContent, /証明したわけではありません/);
  for (let index = 1; index < 7; index++) {
    element('exerciseSelect').value = String(index); element('exerciseSelect').events.change();
    element('showSolution').events.click();
    await element('testExercise').events.click();
    assert.match(element('exerciseResult').textContent, /有限個のテストを通過/, `exercise ${index + 1}`);
  }
  assert.match(element('exerciseResult').textContent, /未定義の証明ではありません/);
  const extra = R.saveDefinition(library, 'plusTwoImported', R.composition(R.successor(), [R.successor()]), 'JSONで持ち込んだ関数');
  const json = R.exportLibrary(extra);
  element('jsonFile').files = [{ size: json.length, text: async () => json }];
  await element('jsonFile').events.change();
  assert.match(element('library').innerHTML, /plusTwoImported/);
  assert.match(element('storageStatus').textContent, /保存/);
});
