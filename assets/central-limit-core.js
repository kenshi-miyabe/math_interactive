/* Sampling and density histograms shared by the page, its worker and Node tests. */
(function (root, factory) {
  const api = factory();
  api.workerSource = () => `const core=(${factory.toString()})();self.onmessage=event=>{try{const result=core.simulate(event.data,done=>self.postMessage({type:'progress',done}));self.postMessage({type:'result',result},result.samples.map(a=>a.buffer));}catch(error){self.postMessage({type:'error',message:error.message});}};`;
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CLTCore = api;
}(globalThis, function createCore() {
  'use strict';
  const sizes = [1, 2, 3, 5, 10, 20, 30, 50, 100, 200, 500];
  function rng(seed) {
    return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function model(kind, a, b) {
    if (!Number.isFinite(a) || (['normal', 'uniform'].includes(kind) && !Number.isFinite(b))) throw Error('パラメータに有限の数を入力してください。');
    if (kind === 'bernoulli') { if (!(a > 0 && a < 1)) throw Error('成功確率は 0 より大きく 1 より小さくしてください。'); return {mean:a, variance:a*(1-a), discrete:true, draw:r=>r()<a?1:0}; }
    if (kind === 'normal') { if (!(b > 0)) throw Error('標準偏差は正にしてください。'); return {mean:a, variance:b*b, draw:r=>a+b*Math.sqrt(-2*Math.log(1-r()))*Math.cos(2*Math.PI*r())}; }
    if (kind === 'exponential') { if (!(a > 0)) throw Error('率は正にしてください。'); return {mean:1/a, variance:1/(a*a), draw:r=>-Math.log(1-r())/a}; }
    if (kind === 'uniform') { if (!(b > a)) throw Error('上端は下端より大きくしてください。'); const variance=(b-a)**2/12;if(!(variance>0&&Number.isFinite(variance)))throw Error('区間の幅が小さすぎるため、標準化できません。');return {mean:(a+b)/2, variance, draw:r=>a+(b-a)*r()}; }
    if (kind === 'poisson') { if (!(a > 0 && a <= 20)) throw Error('率は 0 より大きく 20 以下にしてください。'); return {mean:a, variance:a, discrete:true, draw:r=>{let p=1,k=0;const limit=Math.exp(-a);do{k++;p*=r();}while(p>limit);return k-1;}}; }
    throw Error('未知の分布です。');
  }
  function simulate({kind, a, b, repetitions, seed}, onProgress) {
    if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 20000) throw Error('実験回数が範囲外です。');
    const m=model(kind,a,b),sd=Math.sqrt(m.variance),samples=sizes.map(()=>new Float64Array(repetitions));
    for(let trial=0;trial<repetitions;trial++) {
      const random=rng((seed+Math.imul(trial+1,0x9e3779b9))>>>0);let sum=0,checkpoint=0;
      for(let n=1;n<=sizes[sizes.length-1];n++) {
        sum+=(m.draw(random)-m.mean)/sd;
        if(n===sizes[checkpoint]){samples[checkpoint][trial]=sum/Math.sqrt(n);checkpoint++;}
      }
      if(onProgress&&(trial+1)%1000===0)onProgress(trial+1);
    }
    return {kind,a,b,repetitions,seed,mean:m.mean,variance:m.variance,samples};
  }
  function normalDensity(x) { return Math.exp(-x*x/2)/Math.sqrt(2*Math.PI); }
  function histogram(values, {kind,mean,variance}, n, coarse=false) {
    const discrete=kind==='bernoulli'||kind==='poisson',spacing=discrete?1/Math.sqrt(n*variance):0;
    let width=coarse?.5:.25,lo=-4.5,hi=4.5;
    // At small lattice spacing, group complete lattice cells to avoid artificial
    // alternating high/low bars caused solely by incompatible bin boundaries.
    if(discrete&&spacing<=.5){width=spacing*Math.max(1,Math.round(width/spacing));const origin=-n*mean/Math.sqrt(n*variance);lo=origin+(Math.floor((-4.5-origin)/spacing)-.5)*spacing;hi=lo+Math.ceil((4.5-lo)/width)*width;}
    const count=Math.ceil((hi-lo)/width);hi=lo+count*width;
    const counts=new Uint32Array(count);let below=0,above=0;
    for(const x of values){if(x<lo)below++;else if(x>=hi)above++;else counts[Math.min(count-1,Math.floor((x-lo)/width))]++;}
    return {lo,hi,width,counts,densities:Array.from(counts,c=>c/(values.length*width)),below,above,spacing,lattice:discrete&&spacing<=.5};
  }
  function statistics(values) {
    let mean=0,m2=0,inside=0;
    values.forEach((x,i)=>{const d=x-mean;mean+=d/(i+1);m2+=d*(x-mean);if(Math.abs(x)<=1)inside++;});
    return {mean,variance:m2/values.length,inside:inside/values.length};
  }
  return {sizes,rng,model,simulate,normalDensity,histogram,statistics};
}));
