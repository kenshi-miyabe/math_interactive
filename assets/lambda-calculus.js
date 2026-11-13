(function (root) {
  'use strict';
  const variable = name => ({ type: 'var', name });
  const abstraction = (param, body) => ({ type: 'abs', param, body });
  const application = (fn, arg) => ({ type: 'app', fn, arg });
  function checkSize(term) {
    const pending = [[term, 0]];
    let count = 0;
    while (pending.length) {
      const [node, depth] = pending.pop();
      if (++count > 6000 || depth > 256) throw new Error('表示できる式の大きさを超えました．小さな入力で試してください．');
      if (node.type === 'abs') pending.push([node.body, depth + 1]);
      if (node.type === 'app') pending.push([node.fn, depth + 1], [node.arg, depth + 1]);
    }
    return term;
  }
  function parse(source) {
    if (source.length > 12000) throw new Error('式が長すぎます．');
    const tokens = [];
    for (let i = 0; i < source.length;) {
      if (/\s/.test(source[i])) { i++; continue; }
      if ('λ\\().'.includes(source[i])) { tokens.push(source[i] === '\\' ? 'λ' : source[i]); i++; continue; }
      const match = /^(?:[\p{L}_][\p{L}\p{N}_']*|\d+)/u.exec(source.slice(i));
      if (!match) throw new Error(`「${source[i]}」は使えません．λx. x や (f x) の形で入力してください．`);
      tokens.push(match[0]); i += match[0].length;
    }
    let position = 0, depth = 0;
    const identifier = token => token && !['λ', '(', ')', '.'].includes(token);
    function expression() {
      if (++depth > 256) throw new Error('括弧やλの入れ子が深すぎます．');
      let term;
      if (tokens[position] === 'λ') {
        position++;
        const params = [];
        while (identifier(tokens[position])) {
          const param = tokens[position++];
          if (/^\d+$/.test(param)) throw new Error('束縛変数には文字で始まる名前を付けてください．');
          params.push(param);
        }
        if (!params.length || tokens[position++] !== '.') throw new Error('λの後に変数名とピリオドが必要です．例：λx. x');
        term = expression();
        for (let i = params.length - 1; i >= 0; i--) term = abstraction(params[i], term);
      } else {
        term = atom();
        while (identifier(tokens[position]) || tokens[position] === '(') term = application(term, atom());
      }
      depth--;
      return term;
    }
    function atom() {
      const token = tokens[position++];
      if (token === '(') {
        const term = expression();
        if (tokens[position++] !== ')') throw new Error('閉じ括弧 ) が必要です．');
        return term;
      }
      if (!identifier(token)) throw new Error('変数・関数・括弧で囲んだ式が必要です．');
      if (/^\d+$/.test(token) && BigInt(token) > 100n) throw new Error('Church numeralの略記は，この教材では0〜100で指定してください．');
      return variable(/^\d+$/.test(token) ? String(Number(token)) : token);
    }
    const term = expression();
    if (position !== tokens.length) throw new Error('括弧やピリオドの位置を確認してください．λ式を関数として使うときは括弧で囲みます．');
    return checkSize(term);
  }
  function print(term, context = 0) {
    const precedence = term.type === 'abs' ? 0 : term.type === 'app' ? 1 : 2;
    const text = term.type === 'var' ? term.name : term.type === 'abs' ? `λ${term.param}. ${print(term.body)}` : `${print(term.fn, 1)} ${print(term.arg, 2)}`;
    return precedence < context ? `(${text})` : text;
  }
  function freeVariables(term, bound = new Set(), result = new Set()) {
    if (term.type === 'var') { if (!bound.has(term.name)) result.add(term.name); }
    else if (term.type === 'abs') freeVariables(term.body, new Set([...bound, term.param]), result);
    else { freeVariables(term.fn, bound, result); freeVariables(term.arg, bound, result); }
    return result;
  }
  function allNames(term, result = new Set()) {
    if (term.type === 'var') result.add(term.name);
    else if (term.type === 'abs') { result.add(term.param); allNames(term.body, result); }
    else { allNames(term.fn, result); allNames(term.arg, result); }
    return result;
  }
  function renameBound(term, oldName, newName) {
    if (term.type === 'var') return term.name === oldName ? variable(newName) : term;
    if (term.type === 'abs') return term.param === oldName ? term : abstraction(term.param, renameBound(term.body, oldName, newName));
    return application(renameBound(term.fn, oldName, newName), renameBound(term.arg, oldName, newName));
  }
  function substitute(term, name, value) {
    if (term.type === 'var') return term.name === name ? value : term;
    if (term.type === 'abs') return term.param === name ? term : abstraction(term.param, substitute(term.body, name, value));
    return application(substitute(term.fn, name, value), substitute(term.arg, name, value));
  }
  function replaceAt(term, path, value) {
    if (!path.length) return value;
    const [key, ...rest] = path;
    return { ...term, [key]: replaceAt(term[key], rest, value) };
  }
  function at(term, path) { return path.reduce((node, key) => node[key], term); }
  function numeral(n) {
    let body = variable('x');
    for (let i = 0; i < n; i++) body = application(variable('f'), body);
    return abstraction('f', abstraction('x', body));
  }
  const definitions = Object.freeze(Object.fromEntries([
    ['I', 'λx. x', '恒等関数'],
    ['K', 'λx. λy. x', '2番目の引数を使わない'],
    ['S', 'λx. λy. λz. x z (y z)', '引数zを二つの関数へ渡す'],
    ['TRUE', 'λa. λb. a', '最初の引数を選ぶ'],
    ['FALSE', 'λa. λb. b', '2番目の引数を選ぶ'],
    ['IF', 'λp. λa. λb. p a b', '真偽値に応じて選ぶ'],
    ['NOT', 'λp. λa. λb. p b a', '真偽を反転'],
    ['SUCC', 'λn. λf. λx. f (n f x)', 'Church numeralを1増やす'],
    ['ADD', 'λm. λn. λf. λx. m f (n f x)', 'Church numeralの足し算'],
    ['MUL', 'λm. λn. λf. m (n f)', 'Church numeralの掛け算'],
    ['POW', 'λm. λn. λf. λx. n m f x', 'Church numeralのべき乗'],
    ['ISZERO', 'λn. n (λx. λa. λb. b) (λa. λb. a)', '0ならTRUE，正ならFALSE'],
    ['PAIR', 'λa. λb. λp. p a b', '二つの値を組にする'],
    ['FST', 'λp. p (λa. λb. a)', '組の最初の値を取り出す'],
    ['SND', 'λp. p (λa. λb. b)', '組の2番目の値を取り出す'],
    ['OMEGA', '(λx. x x) (λx. x x)', '同じ式へ戻る，停止しない例']
  ].map(([name, source, description]) => [name, Object.freeze({ source, description, term: parse(source) })])));
  function expand(name) {
    if (/^\d+$/.test(name)) return numeral(Number(name));
    if (name === 'Ω') return definitions.OMEGA.term;
    return definitions[name]?.term || null;
  }
  function capturePath(body, name, valueFree, path = []) {
    if (body.type === 'var') return null;
    if (body.type === 'abs') {
      if (body.param === name || !freeVariables(body.body).has(name)) return null;
      if (valueFree.has(body.param)) return path;
      return capturePath(body.body, name, valueFree, [...path, 'body']);
    }
    return capturePath(body.fn, name, valueFree, [...path, 'fn']) ?? capturePath(body.arg, name, valueFree, [...path, 'arg']);
  }
  function findRewrite(term, strategy = 'normal', path = [], bound = new Set()) {
    if (term.type === 'var') return !bound.has(term.name) && expand(term.name) ? { type: 'delta', path, name: term.name } : null;
    if (term.type === 'abs') return findRewrite(term.body, strategy, [...path, 'body'], new Set([...bound, term.param]));
    const beta = term.fn.type === 'abs' ? { type: 'beta', path } : null;
    if (strategy === 'normal' && beta) return beta;
    return findRewrite(term.fn, strategy, [...path, 'fn'], bound) || findRewrite(term.arg, strategy, [...path, 'arg'], bound) || beta;
  }
  function nextRewrite(term, strategy = 'normal') {
    if (!['normal', 'applicative'].includes(strategy)) throw new Error('未知の簡約順序です．');
    const candidate = findRewrite(term, strategy);
    if (!candidate) return null;
    const node = at(term, candidate.path);
    if (candidate.type === 'delta') {
      return { ...candidate, before: term, after: checkSize(replaceAt(term, candidate.path, expand(node.name))), description: `${node.name} の略記を，定義のλ式へ展開します．` };
    }
    const collision = capturePath(node.fn.body, node.fn.param, freeVariables(node.arg));
    if (collision !== null) {
      const path = [...candidate.path, 'fn', 'body', ...collision], binder = at(term, path), used = allNames(term);
      let suffix = 1;
      while (used.has(binder.param + suffix)) suffix++;
      const renamed = binder.param + suffix;
      const value = abstraction(renamed, renameBound(binder.body, binder.param, renamed));
      return { type: 'alpha', path, before: term, after: checkSize(replaceAt(term, path, value)), oldName: binder.param, newName: renamed, description: `変数の捕獲を避けるため，束縛変数 ${binder.param} を ${renamed} に改名します．自由変数は変えません．` };
    }
    return { ...candidate, before: term, after: checkSize(replaceAt(term, candidate.path, substitute(node.fn.body, node.fn.param, node.arg))), parameter: node.fn.param, argument: node.arg, description: `${node.fn.param} の自由な出現を，引数 ${print(node.arg)} に置き換えます．` };
  }
  function canonical(term, binders = []) {
    if (term.type === 'var') {
      const index = binders.lastIndexOf(term.name);
      return index < 0 ? ['free', term.name] : ['bound', binders.length - 1 - index];
    }
    if (term.type === 'abs') return ['abs', canonical(term.body, [...binders, term.param])];
    return ['app', canonical(term.fn, binders), canonical(term.arg, binders)];
  }
  const key = term => JSON.stringify(canonical(term));
  const equivalent = (a, b) => key(a) === key(b);
  function decode(term) {
    if (term.type !== 'abs' || term.body.type !== 'abs') return null;
    const f = term.param, x = term.body.param;
    let body = term.body.body, count = 0;
    while (body.type === 'app' && body.fn.type === 'var' && body.fn.name === f && f !== x) { count++; body = body.arg; }
    if (body.type === 'var' && body.name === x) return count === 0 ? 'Church numeral 0 ／ FALSE（同じλ式）' : `Church numeral ${count}（fを${count}回適用）`;
    if (equivalent(term, definitions.TRUE.term)) return 'TRUE（最初の引数を選ぶ関数）';
    return null;
  }
  class LambdaCalculation {
    constructor(source, strategy = 'normal') {
      if (!['normal', 'applicative'].includes(strategy)) throw new Error('未知の簡約順序です．');
      this.term = parse(source); this.source = source; this.strategy = strategy; this.history = [];
      this.seen = new Map([[key(this.term), 1]]);
    }
    next() { return nextRewrite(this.term, this.strategy); }
    step() {
      const event = this.next();
      if (!event) return null;
      const afterKey = key(event.after);
      // Alpha-renaming preserves this key by design; it is preparation, not a reduction loop.
      event.cycle = event.type !== 'alpha' && this.seen.has(afterKey);
      event.step = this.history.length + 1;
      this.seen.set(afterKey, (this.seen.get(afterKey) || 0) + 1);
      this.term = event.after; this.history.push(event);
      return event;
    }
    back() {
      const event = this.history.pop();
      if (!event) return null;
      const afterKey = key(event.after), count = this.seen.get(afterKey) - 1;
      if (count === 0) this.seen.delete(afterKey); else this.seen.set(afterKey, count);
      this.term = event.before;
      return event;
    }
  }
  const api = { parse, print, freeVariables, numeral, definitions, nextRewrite, equivalent, decode, LambdaCalculation };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LambdaSimulation = api;
})(typeof window !== 'undefined' ? window : globalThis);
