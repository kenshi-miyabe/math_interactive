/* Exact theoretical quantities; shared by the page and the Node tests. */
(function(root){
 'use strict';
 const normal=(x,m,s)=>Math.exp(-.5*((x-m)/s)**2)/(s*Math.sqrt(2*Math.PI));
 // u - log(1+u), evaluated without cancellation near zero.
 function logGap(u){
  if(Math.abs(u)>.01)return u-Math.log1p(u);
  let sum=0,power=u*u;
  for(let k=2;k<=14;k++){sum+=(k%2===0?1:-1)*power/k;power*=u;}
  return sum;
 }
 const models={
  mean:{name:'正規分布：平均 μ',symbol:'μ',min:-3,max:3,step:.01,initial:0,info:()=>1,range:t=>[t-4,t+4],density:(x,t)=>normal(x,t,1),kl:(t,q)=>(q-t)**2/2},
  scale:{name:'正規分布：標準偏差 σ',symbol:'σ',min:.3,max:3,step:.01,initial:1,info:t=>2/t**2,range:t=>[-4*t,4*t],density:(x,t)=>normal(x,0,t),kl:(t,q)=>{const u=(q-t)/t;return -logGap(u)+u*u*(3+2*u)/(2*(1+u)**2);}},
  variance:{name:'正規分布：分散 v = σ²',symbol:'v',min:.09,max:9,step:.01,initial:1,info:t=>1/(2*t*t),range:t=>[-4*Math.sqrt(t),4*Math.sqrt(t)],density:(x,t)=>normal(x,0,Math.sqrt(t)),kl:(t,q)=>{const u=(q-t)/t;return (-logGap(u)+u*u/(1+u))/2;}},
  bernoulli:{name:'Bernoulli分布：成功確率 p',symbol:'p',min:.02,max:.98,step:.01,initial:.3,discrete:true,info:t=>1/(t*(1-t)),range:()=>[-.4,1.4],density:(x,t)=>x===0?1-t:x===1?t:0,kl:(t,q)=>t*logGap((q-t)/t)+(1-t)*logGap((t-q)/(1-t))},
  poisson:{name:'Poisson分布：平均 λ',symbol:'λ',min:.2,max:8,step:.01,initial:2,discrete:true,info:t=>1/t,range:t=>[-.5,Math.ceil(t+5*Math.sqrt(t)+2)],density:(x,t)=>{if(x<0||x!==Math.floor(x))return 0;let p=Math.exp(-t);for(let k=1;k<=x;k++)p*=t/k;return p;},kl:(t,q)=>t*logGap((q-t)/t)},
  exponential:{name:'指数分布：率 λ',symbol:'λ',min:.2,max:4,step:.01,initial:1,info:t=>1/t**2,range:t=>[0,6/t],density:(x,t)=>x<0?0:t*Math.exp(-t*x),kl:(t,q)=>logGap((q-t)/t)}
 };
 function hRange(kind,t){
  if(kind==='mean')return [-.6,.6];
  return [Math.max(-.6,-.8*t),kind==='bernoulli'?Math.min(.6,.8*(1-t)):.6];
 }
 const weighted=(a,s1,s2)=>a*a*s1*s1+(1-a)**2*s2*s2;
 const optimum=(s1,s2)=>s2*s2/(s1*s1+s2*s2);
 const shrink=(a,mu,s)=>({variance:a*a*s*s,bias:(a-1)*mu,bias2:(a-1)**2*mu*mu,mse:a*a*s*s+(1-a)**2*mu*mu});
 const api={models,normal,hRange,weighted,optimum,shrink};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FisherCore=api;
})(typeof window==='object'?window:globalThis);
