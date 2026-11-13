const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TuringMachine, rules, programs } = require('../assets/turing-machine.js');

test('every input length 1–100 becomes the same number of contiguous zeros, then halts', () => {
  for (let n = 1; n <= 100; n++) {
    const machine = new TuringMachine('1'.repeat(n));
    assert.equal(machine.head, 0);
    for (let k = 0; k < n; k++) {
      const event = machine.step();
      assert.equal(event.read, '1');
      assert.equal(machine.head, k + 1);
      assert.equal(machine.state, 'q0');
      for (let i = 0; i < n; i++) assert.equal(machine.read(i), i <= k ? '0' : '1');
    }
    assert.equal(machine.read(), 'B');
    const final = machine.step();
    assert.equal(final.read, 'B');
    assert.equal(final.move, -1);
    assert.equal(machine.halted, true);
    assert.equal(machine.head, n - 1);
    assert.equal(machine.history.length, n + 1);
    assert.equal(machine.tape.size, n);
    assert.equal(machine.read(-1), 'B');
    assert.equal(machine.read(n), 'B');
    assert.equal(machine.step(), null);
    assert.equal(machine.history.length, n + 1);
  }
});
test('undo restores every configuration, including the final blank transition', () => {
  const machine = new TuringMachine('111');
  const snapshot = () => JSON.stringify({ tape: [...machine.tape], head: machine.head, state: machine.state });
  const configurations = [];
  while (!machine.halted) { configurations.push(snapshot()); machine.step(); }
  while (configurations.length) { machine.back(); assert.equal(snapshot(), configurations.pop()); }
  assert.equal(machine.back(), null);
  assert.equal(machine.history.length, 0);
  assert.equal(machine.head, 0);
  assert.equal(machine.step().read, '1');
});
test('blank tape extends in both directions without allocating blank cells', () => {
  const machine = new TuringMachine('1');
  for (const position of [-1000000, -1, 1, 1000000]) assert.equal(machine.read(position), 'B');
  assert.equal(machine.tape.size, 1);
  assert.deepEqual(Object.keys(rules).sort(), ['q0:0', 'q0:1', 'q0:B']);
});
test('rejects inputs outside the specified contiguous, nonempty unary input', () => {
  for (const input of ['', '0', '101', '11B1', 'B111', 'abc']) assert.throws(() => new TuringMachine(input));
});
test('a selected program controls states, transitions and halting, including leftward extension', () => {
  const alternate = {
    initialState: 'start', states: ['start', 'left', 'done'], haltStates: ['done'],
    acceptsInput: input => input === 'B1',
    rules: {
      'start:1': { write: '0', move: -1, next: 'left' },
      'left:B': { write: '1', move: -1, next: 'done' }
    }
  };
  const machine = new TuringMachine('B1', alternate);
  assert.equal(machine.head, 1, 'initial head skips leading blanks');
  assert.equal(machine.state, 'start');
  machine.step();
  assert.equal(machine.state, 'left');
  assert.equal(machine.halted, false);
  machine.step();
  assert.equal(machine.state, 'done');
  assert.equal(machine.halted, true);
  assert.equal(machine.head, -1);
  assert.equal(machine.read(0), '1');
  assert.equal(machine.read(1), '0');
  machine.back();
  assert.equal(machine.state, 'left');
  assert.equal(machine.read(0), 'B');
  assert.equal(machine.halted, false);
});
test('catalog entries provide a consistent machine and presentation definition', () => {
  for (const program of Object.values(programs)) {
    assert.ok(program.states.includes(program.initialState));
    for (const state of program.haltStates) assert.ok(program.states.includes(state));
    for (const [key, rule] of Object.entries(program.rules)) {
      const [state, read] = key.split(':');
      assert.ok(program.states.includes(state));
      assert.ok(program.states.includes(rule.next));
      assert.ok(['0', '1', 'B'].includes(read));
      assert.ok(['0', '1', 'B'].includes(rule.write));
      assert.ok([-1, 1].includes(rule.move));
    }
    assert.ok(program.acceptsInput(program.makeInput(5)));
    assert.ok(program.name && program.description && program.guideTitle);
  }
});
test('unary addition produces exactly the sum for positive numbers and zero operands', () => {
  const program = programs.unaryAddition;
  const pairs = [];
  for (let a = 0; a <= 30; a++) for (let b = 0; b <= 30; b++) pairs.push([a, b]);
  pairs.push([100, 100], [0, 100], [100, 0]);
  for (const [a, b] of pairs) {
    const machine = new TuringMachine(program.makeInput(a, b), program);
    for (let step = 0; !machine.halted && step < a + b + 4; step++) machine.step();
    assert.ok(machine.halted, `${a} + ${b} must halt`);
    assert.equal(machine.history.length, a + b + 3);
    assert.equal(machine.tape.size, a + b);
    assert.equal(machine.head, a + b - 1);
    for (let position = 0; position < a + b; position++) assert.equal(machine.read(position), '1');
    assert.equal(machine.read(-1), 'B');
    assert.equal(machine.read(a + b), 'B');
  }
});
test('the requested 3 + 4 example traverses all states and can be undone completely', () => {
  const machine = new TuringMachine('11101111', programs.unaryAddition);
  const states = new Set([machine.state]);
  const snapshots = [];
  const snapshot = () => JSON.stringify({ tape: [...machine.tape], head: machine.head, state: machine.state });
  while (!machine.halted) { snapshots.push(snapshot()); machine.step(); states.add(machine.state); }
  assert.deepEqual([...states], ['q0', 'q1', 'q2', 'halt']);
  assert.equal([...machine.tape.values()].join(''), '1111111');
  while (snapshots.length) { machine.back(); assert.equal(snapshot(), snapshots.pop()); }
  assert.equal([...machine.tape.values()].join(''), '11101111');
  assert.equal(machine.history.length, 0);
});
test('addition rejects missing or repeated separators and blank-containing inputs', () => {
  for (const input of ['', '111', '00', '10101', '1B01', 'B101']) {
    assert.throws(() => new TuringMachine(input, programs.unaryAddition));
  }
});
test('function selector switches inputs, rules, diagram, execution and reset together', () => {
  const fs = require('node:fs'), vm = require('node:vm');
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      value: ({ count: '5', addLeft: '3', addRight: '4', speed: '800' })[id] || '',
      textContent: '', innerHTML: '', clientWidth: 1000, dataset: {}, events: {}, attributes: {}, classList: { toggle() {}, add() {}, remove() {} },
      addEventListener(event, handler) { this.events[event] = handler; },
      setAttribute(key, value) { this.attributes[key] = value; },
      getBoundingClientRect() { return { width: 600, height: 300 }; },
      setPointerCapture() {}, focus() {},
      appendChild(child) { this.child = child; },
      insertBefore(child) { this.child = child; },
      showModal() { this.open = true; },
      close() { this.open = false; this.events.close?.(); }
    });
    return elements.get(id);
  }
  const document = {
    getElementById: element, querySelector: element, querySelectorAll: () => [],
    addEventListener() {}
  };
  const window = { TuringSimulation: { TuringMachine, programs }, matchMedia: () => ({ matches: false }), addEventListener() {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../assets/turing-machine-ui.js'), 'utf8'), {
    document, window, clearInterval() {}, setInterval() { return 1; }
  });
  const change = name => { element('functionSelect').value = name; element('functionSelect').events.change(); };
  change('unaryAddition');
  assert.equal(element('count').disabled, true);
  assert.equal(element('addLeft').disabled, false);
  assert.equal(element('additionControls').hidden, false);
  assert.equal(element('output').textContent, '11101111');
  assert.match(element('ruleRows').innerHTML, /q2:1/);
  assert.match(element('stateDiagram').innerHTML, />q2</);
  for (let step = 0; step < 10; step++) element('step').events.click();
  assert.equal(element('output').textContent, '1111111');
  assert.match(element('outputLabel').textContent, /3 \+ 4 = 7/);
  assert.equal(element('step').disabled, true);
  element('back').events.click();
  assert.equal(element('output').textContent, '11111111');
  element('reset').events.click();
  assert.equal(element('output').textContent, '11101111');
  element('addLeft').value = '0'; element('addRight').value = '0';
  element('setup').events.submit({ preventDefault() {} });
  for (let step = 0; step < 3; step++) element('step').events.click();
  assert.equal(element('output').textContent, '（すべて空白）');
  assert.match(element('outputLabel').textContent, /0 \+ 0 = 0/);
  change('onesToZeros');
  assert.equal(element('count').disabled, false);
  assert.equal(element('addLeft').disabled, true);
  assert.equal(element('output').textContent, '11111');
  assert.doesNotMatch(element('ruleRows').innerHTML, /q2:1/);
  element('addLeft').value = '3'; element('addRight').value = '4';
  change('unaryMultiplication');
  assert.equal(element('inputOperator').textContent, '×');
  assert.equal(element('count').disabled, true);
  assert.equal(element('output').textContent, '11101111');
  for (let step = 0; step < 345; step++) element('step').events.click();
  assert.equal(element('step').disabled, true);
  assert.equal(element('output').textContent, '111111111111');
  assert.match(element('outputLabel').textContent, /3 × 4 = 12/);
  assert.match(element('historyHint').textContent, /200/);
  element('diagramAll').events.click();
  assert.match(element('stateDiagram').innerHTML, />qR</);
  element('diagramFocus').events.click();
  assert.equal(element('diagramFocus').attributes['aria-pressed'], 'true');
  element('reset').events.click();
  assert.equal(element('output').textContent, '11101111');
  const viewBox = () => element('stateDiagram').attributes.viewBox.split(' ').map(Number);
  const originalView = viewBox();
  element('diagramZoomIn').events.click();
  assert.equal(element('diagramZoomValue').textContent, '125%');
  assert.ok(viewBox()[2] < originalView[2]);
  element('diagramViewport').events.pointerdown({ button: 0, pointerId: 1, clientX: 100, clientY: 100 });
  element('diagramViewport').events.pointermove({ pointerId: 1, clientX: 130, clientY: 120 });
  assert.notEqual(viewBox()[0], originalView[0]);
  element('diagramViewport').events.pointerup();
  element('diagramZoomReset').events.click();
  assert.deepEqual(viewBox(), originalView);
  for (let i = 0; i < 30; i++) element('diagramZoomOut').events.click();
  assert.equal(element('diagramZoomValue').textContent, '25%');
  assert.equal(element('diagramZoomOut').disabled, true);
  for (let i = 0; i < 40; i++) element('diagramZoomIn').events.click();
  assert.equal(element('diagramZoomValue').textContent, '800%');
  assert.equal(element('diagramZoomIn').disabled, true);
  element('diagramFullscreen').events.click();
  assert.equal(element('diagramDialog').open, true);
  assert.equal(element('diagramDialog').child, element('diagramPanel'));
  assert.match(element('diagramFullscreen').textContent, /終了/);
  element('diagramZoomReset').events.click();
  assert.equal(element('diagramZoomValue').textContent, '100%');
  element('diagramFullscreen').events.click();
  assert.equal(element('diagramDialog').open, false);
  assert.equal(element('machineGrid').child, element('diagramPanel'));
});
test('multiplication computes all 0–10 pairs and leaves no input or marker behind', () => {
  const program = programs.unaryMultiplication;
  const pairs = [];
  for (let a = 0; a <= 10; a++) for (let b = 0; b <= 10; b++) pairs.push([a, b]);
  // The program has no UI limit: also exercise numbers outside the observation controls.
  pairs.push([12, 11], [1, 25], [25, 1], [0, 25], [25, 0]);
  for (const [a, b] of pairs) {
    const input = program.makeInput(a, b), machine = new TuringMachine(input, program);
    for (let steps = 0; !machine.halted && steps < 200000; steps++) machine.step();
    assert.ok(machine.halted, `${a} × ${b} must halt`);
    const outputStart = input.length + 1;
    assert.equal(machine.head, outputStart);
    assert.equal(machine.tape.size, a * b);
    for (let pos = 0; pos < outputStart; pos++) assert.equal(machine.read(pos), 'B');
    for (let i = 0; i < a * b; i++) assert.equal(machine.read(outputStart + i), '1');
    assert.equal(machine.read(outputStart + a * b), 'B');
    assert.equal(machine.step(), null);
  }
});
test('multiplication uses one local transition per step and every step is reversible', () => {
  const machine = new TuringMachine('11101111', programs.unaryMultiplication);
  const snapshot = () => JSON.stringify({ tape: [...machine.tape].sort((a, b) => a[0] - b[0]), head: machine.head, state: machine.state });
  const snapshots = [];
  while (!machine.halted) {
    snapshots.push(snapshot());
    const before = new Map(machine.tape), head = machine.head;
    const event = machine.step();
    assert.equal(Math.abs(machine.head - head), 1);
    assert.ok(['0', '1', 'B'].includes(event.write));
    for (const pos of new Set([...before.keys(), ...machine.tape.keys()])) {
      if (pos !== head) assert.equal(machine.read(pos), before.get(pos) || 'B');
    }
  }
  assert.equal(machine.history.length, 345);
  while (snapshots.length) { machine.back(); assert.equal(snapshot(), snapshots.pop()); }
  assert.equal(machine.head, 0);
  assert.equal(machine.state, 'q0');
});
test('multiplication accepts exactly two unary operands separated by one zero', () => {
  for (const input of ['', '111', '00', '10101', '1B01', 'B101']) {
    assert.throws(() => new TuringMachine(input, programs.unaryMultiplication));
  }
});
