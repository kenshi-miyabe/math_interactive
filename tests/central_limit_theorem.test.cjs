const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const core=require('../assets/central-limit-core.js');
const setup=(kind,a,b,repetitions=4000)=>({kind,a,b,repetitions,seed:20261015});
test('standardized averages have theoretical mean zero and variance one for all five distributions',()=>{
 for(const settings of [setup('exponential',1),setup('normal',3,2),setup('bernoulli',.3),setup('uniform',-2,5),setup('poisson',3)]){
  const e=core.simulate(settings);
  for(const index of [0,6,10]){const stats=core.statistics(e.samples[index]);assert.ok(Math.abs(stats.mean)<.07,`${settings.kind} n=${core.sizes[index]}: mean ${stats.mean}`);assert.ok(Math.abs(stats.variance-1)<.1,`${settings.kind} n=${core.sizes[index]}: variance ${stats.variance}`);}
 }
});
test('checkpoints use the same trial prefix and adding repetitions preserves existing trials',()=>{
 const settings=setup('uniform',-2,5,8),e=core.simulate(settings),long=core.simulate({...settings,repetitions:12}),m=core.model('uniform',-2,5);
 for(let trial=0;trial<8;trial++){const random=core.rng((settings.seed+Math.imul(trial+1,0x9e3779b9))>>>0);let sum=0,index=0;
  for(let n=1;n<=500;n++){sum+=(m.draw(random)-m.mean)/Math.sqrt(m.variance);if(n===core.sizes[index]){assert.equal(e.samples[index][trial],sum/Math.sqrt(n));assert.equal(e.samples[index][trial],long.samples[index][trial]);index++;}}
 }
 assert.notDeepEqual(Array.from(e.samples[0]),Array.from(core.simulate({...settings,seed:99}).samples[0]));
});
test('exponential rate changes cancel under standardization',()=>{
 const a=core.simulate(setup('exponential',.2,undefined,50)),b=core.simulate(setup('exponential',3,undefined,50));
 a.samples.forEach((values,j)=>values.forEach((x,i)=>assert.ok(Math.abs(x-b.samples[j][i])<1e-12)));
});
test('histogram area equals included relative frequency, without renormalizing away tails',()=>{
 const values=Float64Array.from([-100,-1,0,1,100]);const histogram=core.histogram(values,{kind:'normal',mean:0,variance:1},1);
 assert.equal(histogram.below,1);assert.equal(histogram.above,1);assert.equal(histogram.counts.reduce((a,b)=>a+b,0),3);
 assert.ok(Math.abs(histogram.densities.reduce((s,d)=>s+d*histogram.width,0)-.6)<1e-12);
 const boundary=core.histogram(Float64Array.from([histogram.lo,histogram.hi]),{kind:'normal',mean:0,variance:1},1);
 assert.equal(boundary.counts[0],1);assert.equal(boundary.above,1);
});
test('discrete histogram bins group complete lattice cells',()=>{
 for(const [kind,a]of [['bernoulli',.3],['poisson',3]]){const settings=setup(kind,a,undefined,120),e=core.simulate(settings),index=10,n=core.sizes[index],h=core.histogram(e.samples[index],e,n);
  assert.ok(h.lattice);assert.ok(Math.abs(h.width/h.spacing-Math.round(h.width/h.spacing))<1e-12);
  assert.equal(h.counts.reduce((s,c)=>s+c,0)+h.below+h.above,settings.repetitions);
  assert.ok(Math.abs(h.densities.reduce((s,d)=>s+d*h.width,0)-(settings.repetitions-h.below-h.above)/settings.repetitions)<1e-12);
 }
});
function cdf(x){const z=Math.abs(x)/Math.sqrt(2),t=1/(1+.3275911*z),erf=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-z*z);return(1+(x<0?-erf:erf))/2;}
function distance(values){const sorted=Array.from(values).sort((a,b)=>a-b);return sorted.reduce((max,x,i)=>Math.max(max,Math.abs(cdf(x)-i/sorted.length),Math.abs(cdf(x)-(i+1)/sorted.length)),0);}
test('exponential averages approach the normal CDF as n grows',()=>{
 const e=core.simulate(setup('exponential',1,undefined,6000));const initial=distance(e.samples[0]),final=distance(e.samples.at(-1));
 assert.ok(initial>.12);assert.ok(final<.035);assert.ok(final<initial/3,`${initial} -> ${final}`);
});
test('worker implementation returns the same samples as direct simulation',()=>{
 const messages=[],settings=setup('bernoulli',.2,undefined,10),sandbox={self:{postMessage:message=>messages.push(message)}};
 vm.runInNewContext(core.workerSource(),sandbox);sandbox.self.onmessage({data:settings});const last=messages.at(-1);assert.equal(last.type,'result');const direct=core.simulate(settings);
 direct.samples.forEach((xs,j)=>assert.deepEqual(Array.from(last.result.samples[j]),Array.from(xs)));
});
test('invalid or degenerate models cannot be standardized',()=>{
 for(const [kind,a,b]of [['bernoulli',0],['bernoulli',1],['normal',0,0],['exponential',0],['uniform',2,1],['poisson',-1],['poisson',21],['normal',NaN,1],['uniform',0,1e-200]])assert.throws(()=>core.model(kind,a,b));
 assert.throws(()=>core.simulate(setup('exponential',1,undefined,20001)));
});
