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
 const str='標本平均 X̄ₙ と分散 σ²/n を PC と比べる．';
 const parts=segments(str);
 assert.deepEqual(Array.from(parts,p=>str.slice(p.start,p.end)),['X̄ₙ','σ²/n']);
 for(const text of ['さわる数学 / LOGIC GAME','STEP 1','20,000 個の実験','コンピュータが選ぶ'])assert.equal(segments(text).length,0,text);
 assert.equal(segments('P₀〜Pₙ₋₁').length,1);
});
test('every HTML page loads the bundled KaTeX and renderer without remote resources',()=>{
 const files=fs.readdirSync(root).filter(f=>f.endsWith('.html')).concat(['review/inscribed_angle_theorem.html']);
 assert.ok(files.includes('central_limit_theorem.html'));
 for(const name of files){
  const file=path.join(root,name), html=fs.readFileSync(file,'utf8');
  const resources=[...html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"/g)].map(match=>match[1]);
  for(const target of ['vendor/katex-0.19.0/katex.min.js','vendor/katex-0.19.0/katex.min.css','math-typeset.js','math-typeset.css']){
   assert.equal(resources.filter(url=>path.resolve(path.dirname(file),url)===path.join(root,'assets',target)).length,1,`${name}: ${target}`);
  }
  if(name.startsWith('review/')) assert.ok(resources.includes('../assets/vendor/tailwindcss-3.4.17/inscribed-angle.min.css'));
  for(const url of resources){
   assert.doesNotMatch(url,/^(?:[a-z]+:)?\/\//i,name);
   assert.ok(fs.existsSync(path.resolve(path.dirname(file),url)),`${name}: ${url}`);
  }
  assert.match(html,/data-tex=/);
  for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))assert.doesNotThrow(()=>new Function(m[1]),name);
 }
 const katexDir=path.join(root,'assets/vendor/katex-0.19.0');
 const css=fs.readFileSync(path.join(katexDir,'katex.min.css'),'utf8');
 const fontPaths=[...css.matchAll(/url\((fonts\/[^)]+)\)/g)].map(match=>match[1]);
 assert.ok(fontPaths.length>0);
 for(const font of fontPaths) assert.ok(fs.existsSync(path.join(katexDir,font)),font);
});

test('emoji before formulas does not change angle values or prose',()=>{
 const html=fs.readFileSync(path.join(root,'review/inscribed_angle_theorem.html'),'utf8');
 assert.match(html,/📌 標準（中心角<span data-tex="120\^\{\\circ\}">120°<\/span>）/);
 assert.match(html,/📐 半円（中心角<span data-tex="180\^\{\\circ\}">180°<\/span> ➔ <span data-tex="90\^\{\\circ\}">90°<\/span>）/);
});
