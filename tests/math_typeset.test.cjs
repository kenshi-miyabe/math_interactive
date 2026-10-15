const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const context={window:{},document:{readyState:'loading',addEventListener(){}}};
vm.runInNewContext(fs.readFileSync(path.join(root,'assets/math-typeset.js'),'utf8'),context);
const {toTex,segments}=context.window.MathTypeset;
test('legacy notation converts accents, complete indices, roots and quantifiers to TeX',()=>{
 const examples=new Map([
  ['X̄ₙ','\\bar{X}_{n}'],['σ²/n','\\sigma ^{2}/n'],['Pₙ₋₁','P_{n-1}'],
  ['Σᵢ₌₁ⁿ Xᵢ','\\sum _{i=1}^{n} X_{i}'],
  ['√(2/(n−1))','\\sqrt{2/(n-1)}'],['√(2(n−1))','\\sqrt{2(n-1)}'],
  ['∀x∈ℝ','\\forall x\\in \\mathbb{R}'],['∠APB','\\angle APB']
 ]);
 for(const [source,tex]of examples)assert.equal(toTex(source),tex,source);
});
test('recognition keeps Japanese and English prose outside mathematical spans',()=>{
 const str='標本平均 X̄ₙ と分散 σ²/n を PC と比べる。';
 const parts=segments(str);
 assert.deepEqual(Array.from(parts,p=>str.slice(p.start,p.end)),['X̄ₙ','σ²/n']);
 for(const text of ['さわる数学 / LOGIC GAME','STEP 1','20,000 個の実験','コンピュータが選ぶ'])assert.equal(segments(text).length,0,text);
 assert.equal(segments('P₀〜Pₙ₋₁').length,1);
});
test('every HTML page includes the same version of KaTeX and the shared renderer',()=>{
 const files=fs.readdirSync(root).filter(f=>f.endsWith('.html')).concat(['review/inscribed_angle_theorem.html']);
 assert.ok(files.includes('central_limit_theorem.html'));
 for(const name of files){const html=fs.readFileSync(path.join(root,name),'utf8');assert.equal((html.match(/katex@0\.19\.0\/dist\/katex.min.js/g)||[]).length,1,name);assert.match(html,/assets\/math-typeset.js/);assert.match(html,/assets\/math-typeset.css/);assert.match(html,/data-tex=/);for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))assert.doesNotThrow(()=>new Function(m[1]),name);}
});

test('emoji before formulas does not change angle values or prose',()=>{
 const html=fs.readFileSync(path.join(root,'review/inscribed_angle_theorem.html'),'utf8');
 assert.match(html,/📌 標準（中心角<span data-tex="120\^\{\\circ\}">120°<\/span>）/);
 assert.match(html,/📐 半円（中心角<span data-tex="180\^\{\\circ\}">180°<\/span> ➔ <span data-tex="90\^\{\\circ\}">90°<\/span>）/);
});
