const {test}=require('node:test');
const assert=require('node:assert/strict');
const {model,gammaTails,maxSamples}=require('../assets/lln-density-core.js');
const near=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
test('normal tails agree with known probabilities and scale with the standard error',()=>{
 const m=model('normal',3,2);
 near(m.tails(1,2).total,.317310507862914);
 near(m.tails(4,2).total,.0455002638963584);
 near(m.tails(100,.4).total,m.tails(1,4).total,1e-14);
 near(m.density(25,3),5/(2*Math.sqrt(2*Math.PI)),1e-14);
});
test('exponential n=1 and n=2 match closed-form tails, including a nonpositive left boundary',()=>{
 const m=model('exponential',2);
 for(const eps of [.1,.5,1])for(const n of [1,2]){
  const survival=x=>x<=0?1:Math.exp(-2*n*x)*(n===1?1:1+2*n*x);
  const t=m.tails(n,eps);
  near(t.left,1-survival(.5-eps),1e-13);near(t.right,survival(.5+eps),1e-13);
 }
 assert.equal(m.density(1,0),2);assert.equal(m.density(2,0),0);assert.equal(m.density(3,-1),0);
});
test('densities integrate to one and colored areas agree with tail probabilities',()=>{
 for(const kind of ['normal','exponential'])for(const n of [1,2,20,maxSamples]){
  const m=model(kind,kind==='normal'?0:1,1),eps=.25;
  const integrate=(a,b)=>{const steps=30000,dx=(b-a)/steps;let sum=0;for(let i=0;i<steps;i++)sum+=m.density(n,a+(i+.5)*dx);return sum*dx;};
  const lo=kind==='normal'?-10:0,hi=30;
  near(integrate(lo,hi),1,1e-6);
  near(integrate(lo,m.mean-eps)+integrate(m.mean+eps,hi),m.tails(n,eps).total,1e-6);
 }
});
test('probabilities remain bounded, approach zero and satisfy Chebyshev for every slider n',()=>{
 for(const kind of ['normal','exponential']){
  const m=model(kind,kind==='normal'?0:1,1);
  for(const eps of [.05,.25,2]){
   let last=1;
   for(let n=1;n<=maxSamples;n++){
    const t=m.tails(n,eps);assert.ok(t.total>=0&&t.total<=1);near(t.left+t.right,t.total,1e-12);
    assert.ok(t.total<=m.variance/(n*eps*eps)+1e-7);
    assert.ok(t.total<=last+1e-8);last=t.total;
   }
  }
  assert.ok(m.tails(maxSamples,.25).total<.02);
 }
});
test('gamma CDF and survival complement one another at extreme and central values',()=>{
 for(const n of [1,2,100,500])for(const ratio of [.001,.5,1,2,10]){const [p,q]=gammaTails(n,n*ratio);near(p+q,1,1e-13);assert.ok(p>=0&&q>=0&&p<=1&&q<=1);}
 assert.ok(model('normal',0,1).tails(maxSamples,1).total>0);
 assert.ok(model('exponential',1).tails(maxSamples,1).right>0);
});
test('page controls update density metrics, animate, pause and recover from invalid inputs',()=>{
 const vm=require('node:vm'),fs=require('node:fs');
 const elements=new Map();let scheduled,now=0;
 const ctx=new Proxy({measureText:text=>({width:text.length*7})},{get:(o,k)=>k in o?o[k]:(...args)=>{for(const x of args)if(typeof x==='number')assert.ok(Number.isFinite(x),`canvas ${k}`);}});
 const get=id=>{
  if(!elements.has(id))elements.set(id,{value:'',clientWidth:320,clientHeight:350,parentElement:{},events:{},attrs:{},addEventListener(k,fn){this.events[k]=fn;},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},checkValidity(){return this.value!==''&&Number.isFinite(+this.value)&&+this.value>=+this.min&&+this.value<=+this.max;},getContext(){return ctx;}});
  return elements.get(id);
 };
 for(const [id,value,min,max]of [['distribution','normal'],['a','0',-10,10],['b','1',.1,5],['epsilon','.25',.05,2],['n','1',1,maxSamples]])Object.assign(get(id),{value,min,max});
 const sandbox=vm.createContext({LLNDensity:require('../assets/lln-density-core.js'),document:{getElementById:get},window:{devicePixelRatio:1},performance:{now:()=>now},ResizeObserver:class{observe(){}},requestAnimationFrame:fn=>{scheduled=fn;return 1;},cancelAnimationFrame:()=>scheduled=null});
 vm.runInContext(fs.readFileSync(require.resolve('../assets/lln-density-ui.js'),'utf8'),sandbox);
 const initial=get('probability').textContent;
 get('end').events.click();assert.equal(get('currentN').textContent,maxSamples);assert.ok(+get('probability').textContent<+initial);
 get('play').events.click();assert.equal(get('play').textContent,'一時停止');now=6000;scheduled(now);assert.ok(+get('n').value>1&&+get('n').value<maxSamples);
 get('play').events.click();assert.equal(scheduled,null);
 get('reset').events.click();assert.equal(get('probability').textContent,initial);
 get('a').value='';get('a').events.input();assert.equal(get('play').disabled,true);assert.ok(get('error').textContent);
 get('distribution').value='exponential';get('distribution').events.change();assert.equal(get('play').disabled,false);assert.equal(get('parameter2').hidden,true);
 get('epsilon').value=2;get('epsilon').events.input();assert.match(get('tailBreakdown').textContent,/範囲外/);
 get('end').events.click();assert.match(get('density').attrs['aria-label'],/100/);
 get('distribution').value='uniform';get('distribution').events.change();assert.equal(get('probability').textContent,'0');
 get('distribution').value='gamma';get('distribution').events.change();assert.equal(get('parameter2').hidden,false);
 assert.equal(get('b').value,3);assert.ok(+get('probability').textContent>0);
});

test('uniform means match the uniform and triangular laws and have exact zero tails outside their support',()=>{
 const m=model('uniform',2,1);
 near(m.density(1,2),.5);
 near(m.density(2,2.5),.5);
 near(m.tails(1,.5).total,.5);
 near(m.tails(2,.5).total,.25);
 assert.equal(m.tails(maxSamples,1).total,0);
 const n=maxSamples, eps=.15, dx=.0002;
 let total=0,tail=0;
 for(let i=0;i<10000;i++){
  const x=1+(i+.5)*dx, area=m.density(n,x)*dx;
  total+=area;
  if(Math.abs(x-2)>eps)tail+=area;
 }
 near(total,1,1e-10);
 near(tail,m.tails(n,eps).total,1e-7);
});
test('gamma means match an exponential mean with the corresponding shape and rate',()=>{
 const g=model('gamma',2,3),e=model('exponential',2/3);
 for(const n of [1,4,20]){
  near(g.density(n,1.5),e.density(n*3,1.5),1e-12);
  near(g.tails(n,.4).total,e.tails(n*3,.4).total,1e-12);
 }
});
