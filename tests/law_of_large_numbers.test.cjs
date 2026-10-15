// Run with: node --test tests/law_of_large_numbers.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../law_of_large_numbers.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function load(){
 const elements=new Map();let scheduled,clock=0;
 const ctx=new Proxy({},{get:(_,key)=>key==='measureText'?()=>({width:30}):()=>{}});
 class Element{
  constructor(id){this.id=id;this.value='';this.attrs={};this.events={};this.disabled=false;this.hidden=false;this.clientWidth=800;this.clientHeight=380;this.parentElement=this;}
  get value(){return this._value;}set value(v){this._value=String(v);}
  setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}addEventListener(k,fn){this.events[k]=fn;}
  getContext(){return ctx;}
 }
 const get=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
 Object.entries({distribution:'bernoulli',sampleSize:'1000',paths:'5',progress:'1000'}).forEach(([id,v])=>get(id).value=v);
 const sandbox=vm.createContext({document:{getElementById:get},window:{devicePixelRatio:1},performance:{now:()=>clock},ResizeObserver:class{observe(){}},requestAnimationFrame:fn=>{scheduled=fn;return 1;},cancelAnimationFrame:()=>{scheduled=null;}});
 vm.runInContext(script+'\nglobalThis.api={model,rng,simulate,run,$,get experiment(){return experiment;},get playing(){return playing;}};',sandbox);
 return{...sandbox.api,get experiment(){return sandbox.api.experiment;},get playing(){return sandbox.api.playing;},advance(ms){clock+=ms;const fn=scheduled;scheduled=null;if(fn)fn(clock);}};
}
test('five samplers have their theoretical mean, variance and support',()=>{
 const g=load();
 for(const [kind,a,b] of [['bernoulli',.3],['normal',2,3],['exponential',.4],['uniform',-2,6],['poisson',12]]){
  const m=g.model(kind,a,b),r=g.rng(5321);let mean=0,m2=0;const N=200000;
  for(let i=1;i<=N;i++){const x=m.draw(r);assert.ok(Number.isFinite(x));if(kind==='bernoulli')assert.ok(x===0||x===1);if(kind==='poisson')assert.ok(x>=0&&Number.isInteger(x));if(kind==='exponential')assert.ok(x>=0);if(kind==='uniform')assert.ok(x>=a&&x<=b);const d=x-mean;mean+=d/i;m2+=d*(x-mean);}
  assert.ok(Math.abs(mean-m.mean)<6*Math.sqrt(m.variance/N),`${kind}: mean ${mean}`);
  assert.ok(Math.abs(m2/N-m.variance)<.03*m.variance,`${kind}: variance ${m2/N}`);
 }
});
test('running averages match direct sums; larger experiments preserve every existing prefix',()=>{
 const g=load();
 for(const [kind,a,b] of [['bernoulli',.4],['normal',-1,2],['exponential',2],['uniform',-5,5],['poisson',3]]){
  const m=g.model(kind,a,b),short=g.simulate(m,100,3,88),long=g.simulate(m,1000,5,88);
  short.paths.forEach((p,j)=>assert.deepEqual(Array.from(p),Array.from(long.paths[j].slice(0,100))));
  assert.notDeepEqual(Array.from(short.paths[0]),Array.from(short.paths[1]));
  const r=g.rng((88+Math.imul(1,0x9e3779b9))>>>0);let sum=0;
  for(let i=0;i<100;i++){sum+=m.draw(r);assert.ok(Math.abs(short.paths[0][i]-sum/(i+1))<1e-10);}
 }
});
test('degenerate Bernoulli endpoints remain constant and axis limits are finite',()=>{
 const g=load();for(const p of [0,1]){const e=g.simulate(g.model('bernoulli',p),100,3,99);assert.ok(e.paths.every(xs=>xs.every(x=>x===p)));assert.ok(e.lo<p&&e.hi>p);}
});
test('reject invalid parameters and recover without replacing valid data',()=>{
 const g=load(),old=g.experiment;
 for(const value of ['', '-1','2','NaN']){g.$('p1').value=value;assert.equal(g.run(),false);assert.equal(g.experiment,old);assert.ok(g.$('play').disabled);}
 g.$('distribution').value='uniform';g.$('distribution').events.change();g.$('p1').value='3';g.$('p2').value='2';assert.equal(g.run(),false);
 g.$('p2').value='7';assert.equal(g.run(),true);assert.equal(g.experiment.m.mean,5);assert.equal(g.$('play').disabled,false);
});
test('play, pause, scrub and display changes reuse the generated data; reseed replaces it',()=>{
 const g=load(),initial=g.experiment;
 g.$('play').events.click();assert.equal(g.playing,true);g.advance(100);assert.ok(+g.$('progress').value>1);assert.equal(g.experiment,initial);
 g.$('play').events.click();assert.equal(g.playing,false);
 g.$('progress').value=25;g.$('progress').events.input();assert.equal(g.$('currentN').textContent,'25');
 g.$('logScale').checked=true;g.$('logScale').events.change();g.$('showBand').checked=true;g.$('showBand').events.change();assert.equal(g.experiment,initial);
 g.$('play').events.click();for(let i=0;i<70;i++)g.advance(100);assert.equal(+g.$('progress').value,1000);assert.equal(g.playing,false);
 g.$('resample').events.click();assert.notDeepEqual(Array.from(g.experiment.paths[0]),Array.from(initial.paths[0]));
});
