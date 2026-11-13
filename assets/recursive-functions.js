(function (root) {
  'use strict';
  const zero = arity => ({ type: 'zero', arity });
  const successor = () => ({ type: 'successor' });
  const projection = (arity, index) => ({ type: 'projection', arity, index });
  const reference = name => ({ type: 'reference', name });
  const composition = (outer, inner, arity = 0) => ({ type: 'composition', outer, inner, arity });
  const primitiveRecursion = (base, step) => ({ type: 'primitiveRecursion', base, step });
  const minimization = target => ({ type: 'minimization', target });
  const clone = node => JSON.parse(JSON.stringify(node));
  const integer = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum;
  const validName = name => typeof name === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(name) && !['constructor', 'prototype', '__proto__'].includes(name);
  function natural(value) {
    if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('大きな自然数は文字列で指定してください．');
    if (!/^\d+$/.test(String(value))) throw new Error('入力は0以上の整数を，カンマで区切って指定してください．');
    if (String(value).length > 1200) throw new Error('教材で扱える入力の桁数を超えています．');
    return BigInt(value);
  }
  function info(tree, library = new Map(), trail = [], depth = 0, budget = { nodes: 0 }) {
    if (++budget.nodes > 12000 || depth > 80) throw new Error('構成が表示上限を超えています（深さ80・検査ノード12000まで）．');
    if (!tree || typeof tree !== 'object' || Array.isArray(tree)) throw new Error('関数が接続されていないスロットがあります．');
    const child = node => info(node, library, trail, depth + 1, budget);
    switch (tree.type) {
      case 'zero':
        if (!integer(tree.arity)) throw new Error('零関数の引数の個数は0以上の整数です．');
        return { arity: tree.arity, primitive: true };
      case 'successor': return { arity: 1, primitive: true };
      case 'projection':
        if (!integer(tree.arity, 1) || !integer(tree.index, 1) || tree.index > tree.arity) throw new Error('射影は n ≥ 1，1 ≤ i ≤ n としてください．');
        return { arity: tree.arity, primitive: true };
      case 'reference': {
        if (!validName(tree.name) || !library.has(tree.name)) throw new Error(`関数「${String(tree.name)}」が見つかりません．`);
        if (trail.includes(tree.name)) throw new Error(`循環参照は禁止です：${[...trail, tree.name].join(' → ')}．再帰は原始再帰ブロックで表します．`);
        return info(library.get(tree.name).tree, library, [...trail, tree.name], depth + 1, budget);
      }
      case 'composition': {
        const outer = child(tree.outer);
        if (!Array.isArray(tree.inner) || tree.inner.length !== outer.arity) throw new Error(`合成の外側が${outer.arity}変数なので，内側の関数は${outer.arity}個必要です．`);
        const inner = tree.inner.map(child);
        const arity = inner.length ? inner[0].arity : tree.arity;
        if (!integer(arity)) throw new Error('内側が0個の合成では，入力の個数を指定してください．');
        if (inner.some(i => i.arity !== arity)) throw new Error(`合成の内側の関数は，すべて同じ引数の個数（${arity}変数）でなければなりません．`);
        return { arity, primitive: outer.primitive && inner.every(i => i.primitive) };
      }
      case 'primitiveRecursion': {
        const base = child(tree.base), step = child(tree.step);
        if (step.arity !== base.arity + 2) throw new Error(`初期関数が${base.arity}変数なので，更新関数は${base.arity + 2}変数（元の引数・段階y・直前の値）でなければなりません．今は${step.arity}変数です．`);
        return { arity: base.arity + 1, primitive: base.primitive && step.primitive };
      }
      case 'minimization': {
        const target = child(tree.target);
        if (target.arity < 1) throw new Error('最小化の対象には，探索するyを含む1個以上の引数が必要です．');
        return { arity: target.arity - 1, primitive: false };
      }
      default: throw new Error(`未知のブロックの種類です：${String(tree.type)}．`);
    }
  }
  function validateLibrary(library) {
    if (!(library instanceof Map)) throw new Error('関数一覧の形式が違います．');
    for (const [name, def] of library) {
      if (!validName(name)) throw new Error('関数名は英字で始まる32文字以内の英数字・_にしてください．');
      if (!def || typeof def.description !== 'string' || def.description.length > 3000) throw new Error(`「${name}」の説明文が不正です．`);
      const metadata = info(def.tree, library, [name]);
      if (def.arity !== undefined && def.arity !== metadata.arity) throw new Error(`「${name}」の引数の個数が，保存された定義と一致しません．`);
    }
    return library;
  }
  function saveDefinition(library, name, tree, description = '') {
    if (!validName(name)) throw new Error('関数名は英字で始まる32文字以内の英数字・_にしてください．');
    const proposed = new Map(library);
    proposed.set(name, { name, description, tree: clone(tree), kind: 'user' });
    validateLibrary(proposed);
    proposed.get(name).arity = info(tree, proposed, [name]).arity;
    return proposed;
  }
  function exportLibrary(library) {
    validateLibrary(library);
    return JSON.stringify({ version: 1, functions: [...library].map(([name, def]) => ({ name, arity: info(def.tree, library, [name]).arity, description: def.description, tree: def.tree, kind: def.kind === 'sample' ? 'sample' : 'user' })) }, null, 2);
  }
  function importLibrary(text, current = new Map()) {
    if (text.length > 1500000) throw new Error('JSONファイルが大きすぎます（1.5MBまで）．');
    let data;
    try { data = JSON.parse(text); } catch (_) { throw new Error('JSONの書式を確認してください．'); }
    if (data?.version !== 1 || !Array.isArray(data.functions) || data.functions.length > 150) throw new Error('version: 1 と functions 配列を持つJSONが必要です（150関数まで）．');
    const proposed = new Map(current), names = new Set();
    for (const def of data.functions) {
      if (!def || !validName(def.name) || names.has(def.name) || !integer(def.arity)) throw new Error('関数名の重複，または関数の情報が不正です．');
      names.add(def.name);
      proposed.set(def.name, { name: def.name, arity: def.arity, description: def.description, tree: clone(def.tree), kind: def.kind === 'sample' ? 'sample' : 'user' });
    }
    return validateLibrary(proposed);
  }
  const one = n => composition(successor(), [zero(n)], n);
  function samples() {
    const p = projection, r = reference, c = composition, pr = primitiveRecursion, mu = minimization;
    const definitions = [
      ['add', pr(p(1, 1), c(successor(), [p(3, 3)])), '加法．初期値はx，更新は直前の値に1を足します．'],
      ['mul', pr(zero(1), c(r('add'), [p(3, 1), p(3, 3)])), '乗法．addを再利用して，xを繰り返し足します．'],
      ['pow', pr(one(1), c(r('mul'), [p(3, 1), p(3, 3)])), '冪乗．初期値1から始め，mulでxを繰り返しかけます．0の0乗は1とします．'],
      ['factorial', pr(one(0), c(r('mul'), [c(successor(), [p(2, 1)]), p(2, 2)])), '階乗．初期値1，段階yの更新でy+1をかけます．'],
      ['pred', pr(zero(0), p(2, 1)), '切り下げた前者．pred(0)=0，pred(y+1)=y．'],
      ['sub', pr(p(1, 1), c(r('pred'), [p(3, 3)])), '切り下げ減算．xからy回だけ1を引き，0より小さくはしません．'],
      ['isZero', pr(one(0), zero(2)), '0なら1，正なら0を返す関数．'],
      ['square', c(r('mul'), [p(1, 1), p(1, 1)]), 'mulを合成してxの2乗を作ります．'],
      ['ceilSqrt', mu(c(r('sub'), [p(2, 1), c(r('square'), [p(2, 2)])])), 'xからyの2乗を切り下げ減算し，初めて0になるyを探します．平方根の切り上げです．'],
      ['evenHalf', mu(c(r('add'), [
        c(r('sub'), [p(2, 1), c(r('add'), [p(2, 2), p(2, 2)])]),
        c(r('sub'), [c(r('add'), [p(2, 2), p(2, 2)]), p(2, 1)])
      ])), 'xと2yの差の絶対値が0になる最小のyを探します．偶数ではx/2，奇数では探索が終了しません．']
    ];
    const library = new Map(definitions.map(([name, tree, description]) => [name, { name, tree, description, kind: 'sample' }]));
    validateLibrary(library);
    for (const def of library.values()) def.arity = info(def.tree, library).arity;
    return library;
  }
  function symbol(node) {
    return ({ zero: `Z_${node.arity}`, successor: 'S', projection: `P_${node.index}^${node.arity}`, composition: '合成', primitiveRecursion: '原始再帰', minimization: '最小化 μ', reference: node.name })[node.type] || '?';
  }
  function* evaluate(node, args, library, path = [], depth = 0) {
    if (depth > 160) throw new Error('評価の入れ子が観察上限を超えました．未定義という判定ではありません．');
    const label = symbol(node), common = { path, label, args: args.slice() };
    yield { ...common, type: 'enter', major: false, message: `${label}(${args.join(', ')}) の評価を開始` };
    let value;
    switch (node.type) {
      case 'zero': value = 0n; break;
      case 'successor': value = args[0] + 1n; break;
      case 'projection': value = args[node.index - 1]; break;
      case 'reference':
        yield { ...common, type: 'reference', major: true, message: `${node.name}の定義を呼び出す：${node.name}(${args.join(', ')})` };
        value = yield* evaluate(library.get(node.name).tree, args, library, [...path, '@' + node.name], depth + 1);
        break;
      case 'composition': {
        const innerValues = [];
        for (let i = 0; i < node.inner.length; i++) {
          yield { ...common, type: 'compositionArgument', index: i, major: false, message: `内側 h${i + 1} に同じ入力 (${args.join(', ')}) を渡す` };
          innerValues.push(yield* evaluate(node.inner[i], args, library, [...path, 'inner', i], depth + 1));
        }
        yield { ...common, type: 'compositionOuter', major: false, values: innerValues, message: `内側の結果 (${innerValues.join(', ')}) を外側 ${symbol(node.outer)} へ渡す` };
        value = yield* evaluate(node.outer, innerValues, library, [...path, 'outer'], depth + 1);
        break;
      }
      case 'primitiveRecursion': {
        const parameters = args.slice(0, -1), target = args.at(-1);
        yield { ...common, type: 'recursionBase', major: true, iteration: 0n, message: `初期段階 f(${[...parameters, 0n].join(', ')}) = g(${parameters.join(', ')}) を計算` };
        value = yield* evaluate(node.base, parameters, library, [...path, 'base'], depth + 1);
        yield { ...common, type: 'recursionResult', major: true, iteration: 0n, value, message: `f(${[...parameters, 0n].join(', ')}) = ${value}` };
        for (let y = 0n; y < target; y++) {
          yield { ...common, type: 'recursionStep', major: true, iteration: y + 1n, previous: value, message: `段階 ${y + 1n}：h(${[...parameters, y, value].join(', ')}) を計算（段階y=${y}，直前の値=${value}）` };
          value = yield* evaluate(node.step, [...parameters, y, value], library, [...path, 'step'], depth + 1);
          yield { ...common, type: 'recursionResult', major: true, iteration: y + 1n, value, message: `f(${[...parameters, y + 1n].join(', ')}) = ${value}` };
        }
        break;
      }
      case 'minimization': {
        for (let y = 0n;; y++) {
          yield { ...common, type: 'search', major: true, candidate: y, message: `y=${y} を試す：g(${[...args, y].join(', ')}) を計算` };
          const tested = yield* evaluate(node.target, [...args, y], library, [...path, 'target'], depth + 1);
          yield { ...common, type: 'searchResult', major: true, candidate: y, tested, message: `g(${[...args, y].join(', ')}) = ${tested}${tested === 0n ? '．最初の0なので探索終了' : '．正なので次のyへ'}` };
          if (tested === 0n) { value = y; break; }
        }
        break;
      }
    }
    yield { ...common, type: 'return', major: node.type === 'primitiveRecursion' || node.type === 'minimization' || path.length === 0, value, message: `${label}(${args.join(', ')}) = ${value}${path.length === 0 ? '．評価完了' : ''}` };
    return value;
  }
  class Evaluation {
    constructor(tree, inputs, library, maxEvents = 20000) {
      const metadata = info(tree, library);
      if (!Array.isArray(inputs) || inputs.length !== metadata.arity) throw new Error(`この関数は${metadata.arity}変数です．入力を${metadata.arity}個指定してください．`);
      this.tree = clone(tree);
      this.library = new Map([...library].map(([name, def]) => [name, { ...def, tree: clone(def.tree) }]));
      this.inputs = inputs.map(natural); this.events = []; this.status = 'ready'; this.result = null; this.reason = '';
      this.maxEvents = maxEvents; this.iterator = evaluate(this.tree, this.inputs, this.library);
    }
    step() {
      if (['finished', 'limited', 'interrupted', 'error'].includes(this.status)) return null;
      if (this.events.length >= this.maxEvents) { this.status = 'limited'; this.reason = `評価イベント${this.maxEvents}回の観察上限です．数学的な未定義の判定ではありません．`; return null; }
      try {
        this.status = 'running';
        const next = this.iterator.next();
        if (next.done) { this.status = 'finished'; this.result = next.value; return null; }
        const event = { ...next.value, number: this.events.length + 1 };
        this.events.push(event);
        if (event.type === 'return' && event.path.length === 0) { this.status = 'finished'; this.result = event.value; }
        return event;
      } catch (error) { this.status = 'error'; this.reason = `${error.message} 計算の中断であり，未定義の証明ではありません．`; return null; }
    }
    interrupt() { if (!['finished', 'limited', 'error'].includes(this.status)) { this.status = 'interrupted'; this.reason = 'ユーザーが計算を中断しました．未定義と証明されたわけではありません．'; } }
  }
  const api = { zero, successor, projection, reference, composition, primitiveRecursion, minimization, clone, natural, info, samples, symbol, validateLibrary, saveDefinition, exportLibrary, importLibrary, Evaluation };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RecursiveFunctions = api;
})(typeof window !== 'undefined' ? window : globalThis);
