// Run with: node --test tests/logic_game.test.cjs
// Exercise the standalone page's actual script with a minimal DOM and a manual clock.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function load(){
  class Element{
    constructor(){this.textContent='';this.value='';this.children=[];this.attrs={};this.className='';this.disabled=false;this.events={};this.classList={toggle:(name,force)=>{const classes=new Set(this.className.split(' ').filter(Boolean));const on=force===undefined?!classes.has(name):force;on?classes.add(name):classes.delete(name);this.className=[...classes].join(' ')},add:name=>this.classList.toggle(name,true)}}
    setAttribute(k,v){this.attrs[k]=v}append(...nodes){this.children.push(...nodes)}prepend(node){this.children.unshift(node)}replaceChildren(...nodes){this.children=nodes}focus(){}addEventListener(name,fn){this.events[name]=fn}
  }
  const elements=new Map();let id=0;const timers=new Map();
  const context=vm.createContext({document:{getElementById:id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)},createElement:()=>new Element()},setTimeout:fn=>{timers.set(++id,fn);return id},clearTimeout:id=>timers.delete(id)});
  context.document.getElementById('depth').value='all';
  const html=fs.readFileSync(path.join(__dirname,'../logic_game.html'),'utf8');
  const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInContext(script+'\nglobalThis.game={Q,add,sub,mul,cmp,fmt,parseNumber,prime,bank,primeProblem,state,start,move,pcMove,finish,truth,visible,$};',context);
  const game=context.game;
  game.submit=raw=>{game.$('value').value=raw;game.$('choice').events.submit({preventDefault(){}})};
  return game;
}
test('exact decimal/fraction arithmetic, integer validation, malformed inputs and primes',()=>{
  const g=load();assert.equal(g.fmt(g.parseNumber('-0.125','R')),'-1/8');assert.equal(g.fmt(g.parseNumber('2/-4','R')),'-1/2');
  assert.equal(g.cmp(g.add(g.parseNumber('0.1','R'),g.parseNumber('0.2','R')),g.parseNumber('0.3','R')),0);
  assert.equal(g.fmt(g.parseNumber('1000000000000000000000000000000001','Z')),'1000000000000000000000000000000001');
  assert.equal(g.fmt(g.parseNumber('4/2','Z')),'2');
  for(const raw of ['1/0','NaN','Infinity','1e3','1.2.3','', '<script>'])assert.throws(()=>g.parseNumber(raw,'R'));
  assert.throws(()=>g.parseNumber('1/2','Z'));
  for(const n of [-7,0,1,4,9,25])assert.equal(g.prime(g.Q(n)),false);
  for(const n of [2,3,5,97,997])assert.equal(g.prime(g.Q(n)),true);
});
test('initial example, incorrect moves, claim semantics and replay',()=>{
  const g=load();g.submit('5');assert.match(g.$('result').children[0].textContent,/あなたの勝ち/);
  g.start();g.submit('3');assert.match(g.$('result').children[0].textContent,/負け/);
  g.start();g.submit('0.5');assert.match(g.$('error').textContent,/整数/);assert.equal(g.state.index,0);
  g.start(g.bank.find(p=>p.id==='maximum'));g.submit('500000000000000000000000');g.pcMove();assert.match(g.$('result').children[0].textContent,/負け/);
  g.start();g.finish(true);assert.match(g.$('result').children[0].textContent,/正解/);
  g.start(g.bank[0]);g.finish(true);assert.doesNotMatch(g.$('result').children[0].textContent,/正解/);
  g.start(g.bank.find(p=>p.id==='five'));g.pcMove();g.submit('-99');g.finish(true);assert.doesNotMatch(g.$('result').children[0].textContent,/正解/); // A bad move does not make the original formula false.
  g.start();assert.equal(g.state.ended,false);assert.equal(g.state.history.length,0);
});
test('integer/real switch, density, filtering, prime limits and deep play',()=>{
  const g=load();const between=g.bank.find(p=>p.id==='between');g.start(between);assert.equal(g.truth(),false);g.finish(true);assert.match(g.$('result').children[0].textContent,/正解/);
  g.$('reals').onclick();assert.equal(g.truth(),true);g.pcMove();g.submit(g.fmt(g.add(g.state.env.n,g.Q(1,2))));assert.match(g.$('result').children[0].textContent,/あなたの勝ち/);
  g.$('depth').value='5';g.$('depth').onchange();assert.equal(g.visible().length,2);assert.equal(g.state.problem.qs.length,5);
  g.pcMove();g.submit(g.fmt(g.add(g.state.env.n,g.Q(1))));g.pcMove();g.submit(g.fmt(g.add(g.state.env.p,g.Q(1))));g.pcMove();assert.match(g.$('result').children[0].textContent,/あなたの勝ち/);assert.equal(g.state.history.length,5);
  g.$('integers').onclick();g.start(g.primeProblem);g.submit('1000000001');assert.match(g.$('error').textContent,/10 億/);assert.equal(g.state.index,0);g.submit('31');assert.match(g.$('result').children[0].textContent,/あなたの勝ち/);
});
test('all true formulas: constructive winning strategies across both domains',()=>{
  const g=load(),one=g.Q(1);
  for(const domain of ['Z','R']){g.state.domain=domain;for(const p of [...g.bank,...(domain==='Z'?[g.primeProblem]:[])]){
    g.state.problem=p;if(!g.truth())continue;
    for(let sample=0;sample<80;sample++){
      const e={},k=3+(sample%27);
      for(const q of p.qs){
        if(q.k==='A'){// Include large, negative, and fractional PC moves beyond the UI sampler.
          e[q.v]=g.Q(BigInt(sample-40)*100000000000000000001n,domain==='Z'?1n:7n);continue;
        }
        switch(p.id){
          case 'larger':e[q.v]=g.Q(k+1);break;
          case 'prime':e.n=g.Q(31);break;
          case 'between':e.m=g.add(e.n,g.Q(1,2));break;
          case 'respond':case 'square':e.m=g.add(e.n,one);break;
          case 'sum':case 'four':e[q.v]=q.v==='n'?g.Q(sample-40):g.add(g.add(e.n,e.m),one);break;
          case 'five':e[q.v]=g.add(q.v==='m'?e.n:e.p,one);break;
          default:throw Error('Missing strategy: '+p.id);
        }
      }
      assert.equal(p.test(e,k),true,`${domain}: ${p.id}, sample ${sample}`);
    }
  }}
});
test('all false formulas: PC counterstrategies defeat arbitrary user choices',()=>{
  const g=load();
  for(const domain of ['Z','R']){g.state.domain=domain;for(const p of g.bank){g.state.problem=p;if(g.truth())continue;
    for(let sample=0;sample<100;sample++){
      const e={},k=3+(sample%27);
      for(const q of p.qs)e[q.v]=q.k==='A'?p.pc(q.v,e,k):g.Q(BigInt(sample-50)*100000000000000000001n,domain==='Z'?1n:11n);
      assert.equal(p.test(e,k),false,`${domain}: ${p.id}, sample ${sample}`);
    }
  }}
});
