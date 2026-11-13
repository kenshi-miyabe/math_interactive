(function (root) {
  'use strict';
  function natural(value) {
    if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('大きな自然数は文字列で指定してください．');
    if (!/^\d+$/.test(String(value))) throw new Error('レジスタの値には0以上の整数を指定してください．');
    return BigInt(value);
  }
  function parseProgram(source) {
    const instructions = [];
    let maxRegister = 0n;
    source.split(/\r?\n/).forEach((line, index) => {
      const text = line.split('#')[0].trim();
      if (!text) return;
      const match = /^(I|D|J)\s+([+-]?\d+)$/i.exec(text);
      if (!match) throw new Error(`${index + 1}行目：I r，D r，J q のいずれかを指定してください．`);
      const op = match[1].toUpperCase(), arg = BigInt(match[2]);
      if (op !== 'J' && arg < 0n) throw new Error(`${index + 1}行目：レジスタ番号は0以上です．`);
      if (op !== 'J' && arg > maxRegister) maxRegister = arg;
      instructions.push(Object.freeze({ op, arg, sourceLine: index + 1 }));
    });
    return Object.freeze({ instructions: Object.freeze(instructions), maxRegister });
  }
  const programs = Object.freeze({
    addition: Object.freeze({
      name: '足し算', arity: 2, operator: '＋',
      source: 'D 1\nJ 3\nI 0\nJ -3\nD 2\nJ 3\nI 0\nJ -3',
      notes: ['R1を1減らすごとにR0を1増やし，R1が0になったらR2も同じように移します．', '入力3，4なら，正常に停止したときのR0は7です．R1とR2は0になります．']
    }),
    multiplication: Object.freeze({
      name: '掛け算', arity: 2, operator: '×',
      source: 'D 1\nJ 10\nD 2\nJ 4\nI 0\nI 3\nJ -4\nD 3\nJ -8\nI 2\nJ -3',
      notes: ['R1の1回の減少につき，R2の内容をR0へ足します．R2を減らすときR3を増やしておき，その後R3からR2へ戻します．', 'R2を元に戻せるので，足し算をR1の初期値と同じ回数繰り返せます．入力3，4なら，正常な停止時のR0は12です．']
    }),
    increment: Object.freeze({
      name: '1増やす', arity: 1,
      source: 'D 1\nJ 3\nI 0\nJ -3\nI 0',
      notes: ['入力R1をR0へ移し，最後にI 0をもう1回実行します．正常に停止したときのR0は入力より1大きくなります．']
    }),
    decrement: Object.freeze({
      name: '1減らす（0なら0）', arity: 1,
      source: 'D 1\nJ 5\nD 1\nJ 3\nI 0\nJ -3',
      notes: ['最初にR1から1だけ取り除き，残りをR0へ移します．入力が0ならそのまま正常に停止し，R0は0です．']
    }),
    parity: Object.freeze({
      name: '偶奇判定（偶数0・奇数1）', arity: 1,
      source: 'D 1\nJ 5\nD 1\nJ 2\nJ -4\nI 0',
      notes: ['R1から2個ずつ取り除きます．1個も残らなければR0は0のまま，1個残ればI 0を実行してR0を1にします．']
    }),
    loop: Object.freeze({
      name: 'J 0 の無限ループ', arity: 0, source: 'J 0',
      notes: ['J 0は実行位置を変えません．何ステップ実行しても命令1のままで，停止しません．「一時停止」は観察用の操作で，機械の停止ではありません．']
    }),
    badJump: Object.freeze({
      name: '範囲外ジャンプ（正常でない停止）', arity: 0, source: 'J -1',
      notes: ['命令1からJ -1を実行すると実行位置は0になります．プログラムの外なので停止しますが，長さ1のプログラムの正常な停止位置は2です．この停止は正常な停止ではありません．']
    })
  });
  class RegisterMachine {
    constructor(source, inputs = []) {
      this.program = typeof source === 'string' ? parseProgram(source) : source;
      this.K = this.program.maxRegister > BigInt(inputs.length) ? this.program.maxRegister : BigInt(inputs.length);
      this.registers = new Map();
      inputs.forEach((value, index) => { const n = natural(value); if (n) this.registers.set(BigInt(index + 1), n); });
      this.pc = 1n;
      this.history = [];
    }
    read(index) {
      const r = natural(index);
      if (r > this.K) throw new Error('存在しないレジスタです．');
      return this.registers.get(r) || 0n;
    }
    get halted() { return this.pc < 1n || this.pc > BigInt(this.program.instructions.length); }
    get haltKind() { return !this.halted ? null : this.pc === BigInt(this.program.instructions.length) + 1n ? 'good' : 'bad'; }
    step() {
      if (this.halted) return null;
      const { op, arg } = this.program.instructions[Number(this.pc - 1n)];
      const before = op === 'J' ? null : this.read(arg);
      let after = before, next = this.pc + 1n;
      if (op === 'I') after = before + 1n;
      else if (op === 'D' && before > 0n) { after = before - 1n; next = this.pc + 2n; }
      else if (op === 'J') next = this.pc + arg;
      const event = { step: this.history.length + 1, pc: this.pc, op, arg, before, after, next };
      if (op !== 'J') { if (after === 0n) this.registers.delete(arg); else this.registers.set(arg, after); }
      this.pc = next;
      this.history.push(event);
      return event;
    }
    back() {
      const event = this.history.pop();
      if (!event) return null;
      this.pc = event.pc;
      if (event.op !== 'J') { if (event.before === 0n) this.registers.delete(event.arg); else this.registers.set(event.arg, event.before); }
      return event;
    }
  }
  const api = { RegisterMachine, parseProgram, programs, natural };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RegisterSimulation = api;
})(typeof window !== 'undefined' ? window : globalThis);
