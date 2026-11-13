(function (root) {
  'use strict';
  const rules = Object.freeze({
    'q0:1': Object.freeze({ write: '0', move: 1, next: 'q0' }),
    'q0:0': Object.freeze({ write: '0', move: 1, next: 'q0' }),
    'q0:B': Object.freeze({ write: 'B', move: -1, next: 'halt' })
  });
  // Add a function here: the selector, transition table and diagram share this definition.
  const programs = Object.freeze({
    onesToZeros: Object.freeze({
      name: '1を0に変える',
      description: '連続する1を，同じ個数の0に変えます．',
      initialState: 'q0',
      states: Object.freeze(['q0', 'halt']),
      haltStates: Object.freeze(['halt']),
      rules,
      makeInput: count => '1'.repeat(count),
      acceptsInput: input => /^1+$/.test(input),
      inputLabel: '入力する 1 の個数',
      inputHint: '1〜100個で試せます．初期ヘッドは一番左の 1．',
      resultLabel: input => `出力：0 が ${input.length} 個`,
      completion: input => `${input.length}個の0ができました．`,
      guideTitle: 'どうして，同じ個数の 0 になる？',
      guide: [
        '状態 q0 で 1 を読むたび，そのマスを 0 に書き換え，右へ進みます．マスを増やしたり飛ばしたりしないので，1個の 1 がちょうど1個の 0 に変わります．',
        '右端の先の B を読むと，空白はそのままにして左へ1マス戻り，halt で停止します．停止時のヘッドは，いちばん右の 0 の上です．入力が5個なら，書き換えが5ステップ，停止への遷移が1ステップで，合計6ステップです．0 を読む規則はこの入力では使いません．'
      ]
    }),
    unaryAddition: Object.freeze({
      name: '足し算（1の個数で表す）',
      description: '二つの数を1の個数で表し，0で区切ります．例：11101111 は 3 + 4．',
      initialState: 'q0',
      states: Object.freeze(['q0', 'q1', 'q2', 'halt']),
      haltStates: Object.freeze(['halt']),
      rules: Object.freeze({
        'q0:1': Object.freeze({ write: '1', move: 1, next: 'q0' }),
        'q0:0': Object.freeze({ write: '1', move: 1, next: 'q1' }),
        'q1:1': Object.freeze({ write: '1', move: 1, next: 'q1' }),
        'q1:B': Object.freeze({ write: 'B', move: -1, next: 'q2' }),
        'q2:1': Object.freeze({ write: 'B', move: -1, next: 'halt' })
      }),
      inputKind: 'addition',
      makeInput: (left, right = 4) => '1'.repeat(left) + '0' + '1'.repeat(right),
      acceptsInput: input => /^1*01*$/.test(input),
      inputHint: 'それぞれ0〜100の整数．0は1を0個並べて表します（0 + 0 の入力は「0」）．',
      resultLabel: input => {
        const [left, right] = input.split('0').map(part => part.length);
        return `出力：${left} + ${right} = ${left + right}（1 が ${left + right} 個）`;
      },
      completion: input => {
        const [left, right] = input.split('0').map(part => part.length);
        return `${left} + ${right} = ${left + right}．${left + right === 0 ? 'テープはすべて空白です．' : `${left + right}個の1ができました．`}`;
      },
      diagram: Object.freeze({ width: 540, height: 405, positions: { q0: [120, 145], q1: [410, 145], q2: [410, 320], halt: [120, 320] } }),
      guideTitle: 'どうして，足し算になる？',
      guide: [
        'q0 では左側の1を右へたどり，区切りの0を1に書き換えて q1 に移ります．q1 では右側の1を右へたどります．ここまでで，二つの数の和より1個多い1が連続しています．',
        '右端の空白Bを読むと，左へ戻って q2 に移ります．q2 は右端の1をBにして消し，もう1マス左へ動いて停止します．余分な1が消え，同じ位置から和の個数の1が残ります．',
        '3 + 4 なら 11101111 → 11111111 → 1111111．1ステップずつ動かすと，計10ステップで停止します．0を含む足し算も同じ規則で計算できます．0 + 0 の出力は，すべて空白のテープです．'
      ]
    }),
    unaryMultiplication: Object.freeze({
      name: '掛け算（1の個数で表す）',
      description: '二つの数を1の個数で表し，0で区切ります．例：11101111 は 3 × 4．',
      initialState: 'q0',
      states: Object.freeze(['q0', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'qR', 'q9', 'q10', 'q11', 'halt']),
      haltStates: Object.freeze(['halt']),
      rules: Object.freeze({
        'q0:1': Object.freeze({ write: '1', move: 1, next: 'q0' }),
        'q0:0': Object.freeze({ write: 'B', move: 1, next: 'q1' }),
        'q1:1': Object.freeze({ write: '1', move: 1, next: 'q1' }),
        'q1:B': Object.freeze({ write: 'B', move: -1, next: 'q2' }),
        'q2:1': Object.freeze({ write: '1', move: -1, next: 'q2' }),
        'q2:B': Object.freeze({ write: 'B', move: -1, next: 'q3' }),
        'q3:0': Object.freeze({ write: '0', move: -1, next: 'q3' }),
        'q3:1': Object.freeze({ write: '0', move: 1, next: 'q4' }),
        'q3:B': Object.freeze({ write: 'B', move: 1, next: 'q10' }),
        'q4:0': Object.freeze({ write: '0', move: 1, next: 'q4' }),
        'q4:B': Object.freeze({ write: 'B', move: 1, next: 'q5' }),
        'q5:0': Object.freeze({ write: '0', move: 1, next: 'q5' }),
        'q5:1': Object.freeze({ write: '0', move: 1, next: 'q6' }),
        'q5:B': Object.freeze({ write: 'B', move: -1, next: 'q9' }),
        'q6:1': Object.freeze({ write: '1', move: 1, next: 'q6' }),
        'q6:B': Object.freeze({ write: 'B', move: 1, next: 'q7' }),
        'q7:1': Object.freeze({ write: '1', move: 1, next: 'q7' }),
        'q7:B': Object.freeze({ write: '1', move: -1, next: 'q8' }),
        'q8:1': Object.freeze({ write: '1', move: -1, next: 'q8' }),
        'q8:B': Object.freeze({ write: 'B', move: -1, next: 'qR' }),
        'qR:0': Object.freeze({ write: '0', move: -1, next: 'qR' }),
        'qR:1': Object.freeze({ write: '1', move: -1, next: 'qR' }),
        'qR:B': Object.freeze({ write: 'B', move: 1, next: 'q5' }),
        'q9:0': Object.freeze({ write: '1', move: -1, next: 'q9' }),
        'q9:B': Object.freeze({ write: 'B', move: -1, next: 'q3' }),
        'q10:0': Object.freeze({ write: 'B', move: 1, next: 'q10' }),
        'q10:B': Object.freeze({ write: 'B', move: 1, next: 'q11' }),
        'q11:1': Object.freeze({ write: 'B', move: 1, next: 'q11' }),
        'q11:B': Object.freeze({ write: 'B', move: 1, next: 'halt' })
      }),
      inputKind: 'multiplication',
      maxOperand: 10,
      operator: '×',
      makeInput: (left, right = 4) => '1'.repeat(left) + '0' + '1'.repeat(right),
      acceptsInput: input => /^1*01*$/.test(input),
      inputHint: '観察用にそれぞれ0〜10を選べます．0は1を0個並べて表します．計算には多くのステップが必要です．',
      resultLabel: input => {
        const [left, right] = input.split('0').map(part => part.length);
        return `出力：${left} × ${right} = ${left * right}（1 が ${left * right} 個）`;
      },
      completion: input => {
        const [left, right] = input.split('0').map(part => part.length);
        return `${left} × ${right} = ${left * right}．${left * right === 0 ? 'テープはすべて空白です．' : `${left * right}個の1ができました．`}`;
      },
      stateLabels: Object.freeze({ q0: '区切りを空白に', q1: '右端を探す', q2: '左の数へ戻る', q3: '左の1を1個選ぶ', q4: '右の数へ進む', q5: 'コピーする1を選ぶ', q6: '出力へ進む', q7: '出力に1を追加', q8: '右の数へ戻る', qR: '右の数の先頭へ', q9: '右の数の印を戻す', q10: '左の印を消す', q11: '右の数を消す', halt: '停止' }),
      focusDiagram: true,
      diagram: Object.freeze({ width: 1120, height: 940, positions: {
        q0: [130, 150], q1: [410, 150], q2: [690, 150], q3: [970, 150],
        q4: [970, 370], q5: [690, 370], q6: [410, 370], q7: [130, 370],
        q8: [130, 590], qR: [410, 590], q9: [690, 590], q10: [970, 590],
        q11: [970, 810], halt: [690, 810]
      } }),
      guideTitle: 'どうして，掛け算になる？',
      guide: [
        'まず区切りの0をBに変え，左の数・右の数・出力を空白で区切って扱います．出力は元の入力の右側に作ります．例：111 B 1111 B（出力はまだ空）．',
        'q3 は左の数の1を右から1個選び，0を印として付けます．q5〜qR は右の数の1を1個ずつ0に変えながら，そのたびに出力へ1を1個追加します．これは状態とヘッド下の文字だけで行い，掛け算の答えを先に計算して書き込む処理はありません．',
        '右の数をすべてコピーしたら，q9 で印の0を1に戻します．左の1を次に1個選び，同じコピーを繰り返します．3 × 4 なら「4個の1をコピーする」を3回行うので，出力は12個の1になります．',
        '左の1をすべて使ったら，q10・q11 で入力と印を消します．最後には右側の出力だけが残り，ヘッドは出力の先頭で停止します．どちらかが0なら出力も0で，テープはすべて空白になります．',
        '掛け算は状態が多いので，図は初めに「現在の周辺」を表示します．「全体図」で全14状態を確認できます．拡大縮小・ドラッグ・全画面表示で図を見渡せます．プログラム欄は次に使う規則へ自動でスクロールします．入力上限10は観察用の制限で，プログラム自体は任意の非負整数に使えます．'
      ]
    })
  });
  class TuringMachine {
    constructor(input = '11111', program = programs.onesToZeros) {
      if (!/^[01B]+$/.test(input) || !program.acceptsInput(input)) throw new Error('選択した関数に合う入力を指定してください．');
      this.program = program;
      this.input = input;
      this.tape = new Map(Array.from(input, (symbol, index) => [index, symbol]).filter(([, symbol]) => symbol !== 'B'));
      this.head = Math.max(0, input.search(/[01]/));
      this.state = program.initialState;
      this.history = [];
    }
    read(position = this.head) { return this.tape.get(position) || 'B'; }
    get halted() { return this.program.haltStates.includes(this.state); }
    step() {
      if (this.halted) return null;
      const read = this.read(), rule = this.program.rules[`${this.state}:${read}`];
      if (!rule) throw new Error(`状態 ${this.state}，文字 ${read} の遷移が未定義です．`);
      const event = { step: this.history.length + 1, from: this.state, position: this.head, read, ...rule };
      if (rule.write === 'B') this.tape.delete(this.head);
      else this.tape.set(this.head, rule.write);
      this.head += rule.move;
      this.state = rule.next;
      this.history.push(event);
      return event;
    }
    back() {
      const event = this.history.pop();
      if (!event) return null;
      this.head = event.position;
      this.state = event.from;
      if (event.read === 'B') this.tape.delete(this.head);
      else this.tape.set(this.head, event.read);
      return event;
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { TuringMachine, rules, programs };
  else root.TuringSimulation = { TuringMachine, rules, programs };
})(typeof window !== 'undefined' ? window : globalThis);
