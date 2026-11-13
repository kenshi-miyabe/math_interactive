const { test } = require('node:test');
const assert = require('node:assert/strict');
const { RegisterMachine, parseProgram, programs, natural } = require('../assets/register-machine.js');

function run(machine, limit = 100000) {
  for (let steps = 0; !machine.halted && steps < limit; steps++) machine.step();
  return machine;
}
test('input convention starts at position 1, initializes R0 and other registers to zero', () => {
  const m = new RegisterMachine('I 3', ['12', '34']);
  assert.equal(m.pc, 1n);
  assert.equal(m.K, 3n);
  assert.deepEqual([m.read(0), m.read(1), m.read(2), m.read(3)], [0n, 12n, 34n, 0n]);
  m.step();
  assert.equal(m.read(3), 1n);
  assert.equal(m.pc, 2n);
  assert.equal(m.haltKind, 'good');
  assert.equal(m.step(), null);
});
test('D at zero advances by one, while D at a positive value decrements and skips one instruction', () => {
  for (const value of [0, 1, 5]) {
    const m = new RegisterMachine('D 1\nI 0\nI 2', [value]);
    const event = m.step();
    assert.equal(event.before, BigInt(value));
    assert.equal(m.read(1), BigInt(Math.max(0, value - 1)));
    assert.equal(m.pc, value === 0 ? 2n : 3n);
    assert.equal(m.read(0), 0n);
  }
});
test('J uses a relative signed offset and J 0 never halts', () => {
  const m = new RegisterMachine('J 2\nI 0\nJ -2');
  assert.equal(m.step().next, 3n);
  assert.equal(m.step().next, 1n);
  assert.equal(m.read(0), 0n);
  const loop = run(new RegisterMachine('J 0'), 1000);
  assert.equal(loop.pc, 1n);
  assert.equal(loop.halted, false);
  assert.equal(loop.history.length, 1000);
});
test('good halt is exactly p+1, including empty programs; other out-of-range positions are bad', () => {
  assert.equal(new RegisterMachine('').haltKind, 'good');
  assert.equal(run(new RegisterMachine('J 1')).haltKind, 'good');
  for (const source of ['J -1', 'J -3', 'J 2', 'J 999999999999999999999999999999999']) {
    assert.equal(run(new RegisterMachine(source)).haltKind, 'bad');
  }
  assert.equal(run(new RegisterMachine('D 1', [0])).haltKind, 'good');
  const skipPastEnd = run(new RegisterMachine('D 1', [1]));
  assert.equal(skipPastEnd.pc, 3n);
  assert.equal(skipPastEnd.haltKind, 'bad');
});
test('parser counts instructions rather than source lines and rejects malformed instructions', () => {
  const p = parseProgram('# comment\nI 0 # add\n\nD 1\nj -2\n');
  assert.equal(p.instructions.length, 3);
  assert.equal(p.instructions[2].op, 'J');
  assert.equal(p.instructions[2].arg, -2n);
  assert.equal(p.maxRegister, 1n);
  for (const source of ['I -1', 'D -1', 'J 1.5', 'X 0', 'I', 'I 0 1', '1 I 0']) assert.throws(() => parseProgram(source));
  assert.throws(() => natural('-1'));
  assert.throws(() => natural('1.5'));
  assert.throws(() => natural(Number.MAX_SAFE_INTEGER + 1));
});
test('register values, register addresses and jump distances retain arbitrary integer precision', () => {
  const big = '99999999999999999999999999999999999999999999999';
  const m = run(new RegisterMachine('I 1\nD 2\nJ 1\nI 0', [big, big]));
  assert.equal(m.read(1), BigInt(big) + 1n);
  assert.equal(m.read(2), BigInt(big) - 1n);
  assert.equal(m.read(0), 1n);
  assert.equal(m.haltKind, 'good');
  const sparse = run(new RegisterMachine(`I ${big}`));
  assert.equal(sparse.K, BigInt(big));
  assert.equal(sparse.read(big), 1n);
  assert.equal(sparse.read(1), 0n);
  assert.equal(sparse.registers.size, 1);
  const jump = run(new RegisterMachine(`J ${big}`));
  assert.equal(jump.pc, BigInt(big) + 1n);
});
test('all arithmetic presets compute their functions and halt normally for zero and positive inputs', () => {
  for (const key of ['addition', 'multiplication', 'increment', 'decrement', 'parity']) {
    const p = programs[key];
    for (let a = 0; a <= 20; a++) for (let b = 0; b <= (p.arity === 2 ? 20 : 0); b++) {
      const m = run(new RegisterMachine(p.source, p.arity === 2 ? [a, b] : [a]));
      const expected = { addition: a + b, multiplication: a * b, increment: a + 1, decrement: Math.max(0, a - 1), parity: a % 2 }[key];
      assert.equal(m.haltKind, 'good', `${key}(${a}, ${b})`);
      assert.equal(m.read(0), BigInt(expected), `${key}(${a}, ${b})`);
      if (key === 'multiplication') { assert.equal(m.read(2), BigInt(b)); assert.equal(m.read(3), 0n); }
    }
  }
});
test('every executed instruction can be undone, including both kinds of halt and loops', () => {
  for (const p of Object.values(programs)) {
    const m = new RegisterMachine(p.source, p.arity === 2 ? [3, 4] : p.arity === 1 ? [3] : []);
    const snapshot = () => JSON.stringify({ pc: String(m.pc), registers: [...m.registers].map(([r, v]) => [String(r), String(v)]).sort() });
    const states = [];
    for (let i = 0; !m.halted && i < 1000; i++) { states.push(snapshot()); m.step(); }
    while (states.length) { m.back(); assert.equal(snapshot(), states.pop()); }
    assert.equal(m.pc, 1n);
    assert.equal(m.history.length, 0);
    assert.equal(m.back(), null);
    assert.equal(m.read(0), 0n);
  }
});
test('UI switches functions, executes and rewinds, loads custom code, and reports invalid programs', () => {
  const fs = require('node:fs'), vm = require('node:vm');
  const nodes = new Map();
  const element = id => {
    if (!nodes.has(id)) nodes.set(id, {
      value: '', textContent: '', innerHTML: '', dataset: {}, events: {}, classList: { toggle() {} },
      addEventListener(name, handler) { this.events[name] = handler; }
    });
    return nodes.get(id);
  };
  const document = { getElementById: element, querySelectorAll: () => [], addEventListener() {} };
  const window = { RegisterSimulation: { RegisterMachine, programs, natural } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../assets/register-machine-ui.js'), 'utf8'), { document, window, clearInterval() {}, setInterval() { return 1; } });
  assert.match(element('registers').innerHTML, />3<\/dd>/);
  for (let i = 0; !element('step').disabled && i < 1000; i++) element('step').events.click();
  assert.equal(element('result').textContent, '出力 R0 = 7');
  element('back').events.click();
  assert.equal(element('step').disabled, false);
  element('reset').events.click();
  assert.equal(element('steps').textContent, 0);
  element('functionSelect').value = 'multiplication'; element('functionSelect').events.change();
  for (let i = 0; !element('step').disabled && i < 1000; i++) element('step').events.click();
  assert.equal(element('result').textContent, '出力 R0 = 12');
  element('source').value = 'D 1'; element('loadSource').events.click();
  element('step').events.click();
  assert.equal(element('status').textContent, '正常でない停止');
  element('source').value = 'I -1'; element('loadSource').events.click();
  assert.equal(element('sourceError').hidden, false);
  assert.equal(element('status').textContent, '正常でない停止');
  element('source').value = ''; element('loadSource').events.click();
  assert.equal(element('status').textContent, '正常な停止');
  element('input1').value = 'direct'; element('direct1').value = '10000000000000000000000'; element('input1').events.change();
  assert.equal(element('direct1').disabled, false);
  element('source').value = 'I 1'; element('loadSource').events.click(); element('step').events.click();
  assert.match(element('registers').innerHTML, /10000000000000000000001/);
});
