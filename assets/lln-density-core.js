/* Exact sampling distributions; probabilities evaluated numerically, without simulation. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.LLNDensity=api;
}(globalThis,function(){
 'use strict';
 const logFactorial=[0];
 function lf(n){for(let k=logFactorial.length;k<=n;k++)logFactorial[k]=logFactorial[k-1]+Math.log(k);return logFactorial[n];}
 function erfc(x){
  if(x===0)return 1;
  const t=1/(1+x/2);
  return Math.min(1,t*Math.exp(-x*x-1.26551223+t*(1.00002368+t*(.37409196+t*(.09678418+t*(-.18628806+t*(.27886807+t*(-1.13520398+t*(1.48851587+t*(-.82215223+t*.17087277))))))))));
 }
 // Erlang CDF and survival: sum the small tail directly to avoid cancellation.
 function gammaTails(n,z){
  if(z<=0)return [0,1];
  if(z<n){
   let term=Math.exp(n*Math.log(z)-z-lf(n)),sum=term;
   for(let k=n+1;k<10000;k++){term*=z/k;sum+=term;if(term<=sum*1e-15)break;}
   return [Math.min(1,sum),Math.max(0,1-sum)];
  }
  let sum=0;
  for(let k=0;k<n;k++)sum+=Math.exp(k*Math.log(z)-z-lf(k));
  return [Math.max(0,1-sum),Math.min(1,sum)];
 }
 const maxSamples=100;
 // Density of a sum of unit uniforms, evaluated with the nonnegative
 // cardinal B-spline recurrence. For the CDF sum shifted order-(n+1) splines.
 function uniformSum(n,x,cdf=false){
  if(x<0||x>=n)return cdf&&x>=n?1:0;
  const index=Math.floor(x),fraction=x-index,order=n+Number(cdf);
  const values=new Float64Array(index+1);
  values[0]=1;
  for(let k=2;k<=order;k++){
   for(let j=Math.min(index,k-1);j>=1;j--){
    const t=fraction+j;
    values[j]=(t*values[j]+(k-t)*values[j-1])/(k-1);
   }
   values[0]*=fraction/(k-1);
  }
  return cdf?values.reduce((sum,value)=>sum+value,0):values[index];
 }
 function model(kind,a,b){
  const normal=kind==='normal',uniform=kind==='uniform';
  if(!Number.isFinite(a)||!['normal','exponential','uniform','gamma'].includes(kind))throw Error('分布の設定を確認してください．');
  if((normal||uniform)&&!(Number.isFinite(b)&&b>0))throw Error('標準偏差または半幅を正の数にしてください．');
  if(!normal&&!uniform&&!(a>0))throw Error('率を正の数にしてください．');
  if(kind==='gamma'&&(!Number.isInteger(b)||b<2||b>10))throw Error('形状を 2 以上 10 以下の整数にしてください．');
  const shape=kind==='gamma'?b:1;
  const mean=normal||uniform?a:shape/a;
  const sd=normal?b:uniform?b/Math.sqrt(3):Math.sqrt(shape)/a;
  const leftReach=normal?Infinity:uniform?b:mean;
  const rightReach=uniform?b:Infinity;
  const mode=n=>normal||uniform?mean:(n*shape-1)/(n*a);
  function density(n,x){
   if(normal){const s=sd/Math.sqrt(n);return Math.exp(-.5*((x-mean)/s)**2)/(s*Math.sqrt(2*Math.PI));}
   if(uniform){
    const distance=Math.abs(x-mean);
    if(distance>b)return 0;
    return n/(2*b)*uniformSum(n,n/2*(1-distance/b));
   }
   if(x<0)return 0;
   const k=n*shape,rate=n*a;
   if(x===0)return k===1?rate:0;
   return Math.exp(k*Math.log(rate)+(k-1)*Math.log(x)-rate*x-lf(k-1));
  }
  function tails(n,epsilon){
   if(!Number.isInteger(n)||n<1||n>maxSamples||!Number.isFinite(epsilon)||epsilon<=0)throw Error('標本数または ε が範囲外です．');
   if(normal||uniform){
    const tail=normal ? .5*erfc(epsilon*Math.sqrt(n)/(sd*Math.sqrt(2))) : uniformSum(n,n/2*(1-epsilon/b),true);
    return {left:tail,right:tail,total:2*tail};
   }
   const left=gammaTails(n*shape,n*a*(mean-epsilon))[0],right=gammaTails(n*shape,n*a*(mean+epsilon))[1];
   return {left,right,total:Math.min(1,left+right)};
  }
  return {kind,mean,sd,variance:sd*sd,leftReach,rightReach,mode,density,tails};
 }
 return {model,gammaTails,maxSamples};
}));
