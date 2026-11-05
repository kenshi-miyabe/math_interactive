const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const C=require('../assets/fisher-core.js');
const close=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('optimal weighted estimator attains inverse joint information',()=>{
 for(const s of [.3,1,3])for(const t of [.3,2,3]){
  const a=C.optimum(s,t),v=C.weighted(a,s,t);close(v,1/(1/s**2+1/t**2));
  for(let i=0;i<=100;i++)assert.ok(C.weighted(i/100,s,t)>=v-1e-12);
  const x=1.7,y=-.4,mu=.6;
  close(a*x+(1-a)*y-mu,((x-mu)/s**2+(y-mu)/t**2)/(1/s**2+1/t**2));
 }
});
test('Fisher information agrees with numerical expectation of squared scores',()=>{
 for(const [kind,m]of Object.entries(C.models)){
  const t=m.initial,eps=1e-5,score=x=>(Math.log(m.density(x,t+eps))-Math.log(m.density(x,t-eps)))/(2*eps);
  let total=0,mean=0;
  const range=kind==='exponential'?[0,32/t]:kind==='mean'?[t-8,t+8]:kind==='scale'?[-8*t,8*t]:kind==='variance'?[-8*Math.sqrt(t),8*Math.sqrt(t)]:kind==='poisson'?[0,Math.ceil(t+12*Math.sqrt(t)+12)]:m.range(t),lo=range[0],hi=range[1];
  const n=m.discrete?Math.floor(hi)-Math.ceil(lo)+1:20000,dx=m.discrete?1:(hi-lo)/n;
  for(let i=0;i<n;i++){const x=m.discrete?Math.ceil(lo)+i:lo+(i+.5)*dx,p=m.density(x,t),s=score(x);if(p>0){total+=p*s*s*dx;mean+=p*s*dx;}}
  close(total,m.info(t),1e-5);assert.ok(Math.abs(mean)<.003,kind);
 }
});
test('exact KL has local curvature I and is invariant under normal reparameterization',()=>{
 for(const [kind,m]of Object.entries(C.models))for(const t of [m.min,m.initial,m.max]){
  close(m.kl(t,t),0);const h=1e-4*(kind==='bernoulli'?Math.min(t,1-t):kind==='mean'?1:t),ratio=m.kl(t,t+h)/(.5*m.info(t)*h*h);close(ratio,1,.002);
  for(const d of C.hRange(kind,t)){const q=t+d;assert.ok(kind==='mean'||q>0);if(kind==='bernoulli')assert.ok(q<1);assert.ok(Number.isFinite(m.kl(t,q)));assert.ok(m.kl(t,q)>=-1e-12);}
 }
 for(const t of [.3,1,2.9]){const q=t+.1;close(C.models.scale.kl(t,q),C.models.variance.kl(t*t,q*q));close(C.models.scale.info(t)/(4*t*t),C.models.variance.info(t*t));}
 close(C.models.bernoulli.kl(.3,.5),.3*Math.log(.6)+.7*Math.log(1.4));
 close(C.models.mean.kl(-1,2),4.5);
});
test('biased estimator separates variance, squared bias and MSE, including point masses',()=>{
 for(const mu of [-3,0,2])for(const s of [.3,1,3])for(const a of [0,.5,1]){
  const r=C.shrink(a,mu,s);close(r.mse,r.variance+r.bias*r.bias);close(r.bias2,r.bias*r.bias);if(a===0){close(r.variance,0);close(r.mse,mu*mu);}if(a===1)close(r.mse,s*s);
 }
});
// Execute the actual page script with DOM and canvas stand-ins, exercising event wiring.
function page(){
 const html=fs.readFileSync(require.resolve('../fisher_information.html'),'utf8'),nodes={};
 const ctx=new Proxy({}, {get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 function node(id,attrs=''){
  const listeners={},el={id,dataset:{},hidden:/\bhidden\b/.test(attrs),textContent:'',innerHTML:'',clientWidth:500,clientHeight:290,
   addEventListener:(e,f)=>listeners[e]=f,fire:e=>listeners[e]?.(),getContext:()=>ctx,setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];}};
  for(const m of attrs.matchAll(/(min|max|step|value)="([^"]*)"/g))el[m[1]]=m[2];return el;
 }
 for(const m of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g))nodes[m[1]]=node(m[1],m[0]);
 const nav=Array.from({length:5},(_,i)=>node('nav'+i));let hashchange;
 const sandbox={FisherCore:C,document:{getElementById:id=>{assert.ok(nodes[id],id);return nodes[id];},querySelectorAll:s=>s==='.step'?[1,2,3,4,5].map(n=>nodes['step'+n]):nav},location:{hash:''},window:{devicePixelRatio:1,addEventListener:(e,f)=>{if(e==='hashchange')hashchange=f;}},setTimeout,clearTimeout};
 vm.runInNewContext([...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].at(-1)[1],sandbox);
 return{nodes,nav,go(n){sandbox.location.hash='#step'+n;hashchange();},change(id,value,event='input'){nodes[id].value=String(value);nodes[id].fire(event);}};
}
test('all five steps navigate and controls update theoretical readouts',()=>{
 const p=page(),n=p.nodes;
 for(let i=1;i<=5;i++){p.go(i);assert.equal(n['step'+i].hidden,false);assert.equal(p.nav[i-1]['aria-current'],'step');assert.equal(Object.values(n).filter(x=>/^step[1-5]$/.test(x.id)&&!x.hidden).length,1);}
 p.go(1);p.change('weight',0);assert.match(n.weightedResult.textContent,/4/);p.change('weight',1);assert.match(n.weightedResult.textContent,/1/);
 n.useOptimum.fire('click');close(+n.weight.value,.8);
 p.go(5);p.change('shrinkWeight',0);assert.match(n.shrinkDistributionNote.textContent,/確率1/);p.change('trueMean',0);assert.match(n.shrinkResult.textContent,/この点ではバイアス0/);
 p.change('shrinkWeight',1);assert.match(n.shrinkResult.textContent,/下界を達成/);
});
test('distribution, coordinate and KL controls stay linked, including domain endpoints',()=>{
 const p=page(),n=p.nodes;
 for(const step of [2,3]){
  p.go(step);if(step===3)close(+n.delta.value,.3);
  for(const kind of ['mean','scale','bernoulli','poisson','exponential']){
   p.change('family'+step,kind,'change');
   for(const t of [C.models[kind].min,C.models[kind].max]){
    p.change('theta'+step,t);assert.equal(n['theta'+step+'Value'].textContent,String(t));
    if(step===2){assert.ok(n.derivation2.innerHTML.includes('data-tex'));assert.match(n.informationValue2.textContent,/I =/);}
    else{p.change('delta',-.6);assert.ok(!/NaN|Infinity/.test(n.klResult.textContent));const previous=+n.delta.value;n.halveDelta.fire('click');close(+n.delta.value,previous/2);}
   }
  }
  p.change('family'+step,'scale','change');p.change('theta'+step,2);p.change('coordinate'+step,'variance','change');close(+n['theta'+step].value,4);p.change('coordinate'+step,'scale','change');close(+n['theta'+step].value,2);
 }
 p.change('delta',0);assert.match(n.klResult.textContent,/両方0/);
});
