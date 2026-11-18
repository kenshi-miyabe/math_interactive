(function(){
 'use strict';
 const $=id=>document.getElementById(id),MAX=LLNDensity.maxSamples;
 const settings={
  normal:{name:"正規分布 N(μ, σ²)",a:["平均 μ",-10,10,.1,0],b:["標準偏差 σ",.1,5,.1,1]},
  exponential:{name:"指数分布 Exp(λ)",a:["率 λ",.2,5,.1,1]},
  uniform:{name:"一様分布 U(μ − h, μ + h)",a:["区間の中心 μ",-10,10,.1,0],b:["区間の半幅 h",.1,5,.1,1]},
  gamma:{name:"ガンマ分布 Gamma(k, rate = λ)",a:["率 λ",.2,5,.1,1],b:["形状 k",2,10,1,3]}
 };
 let m,probabilities,frame=0,playing=false,started=0,startN=1;
 const fmt=x=>Number(x.toPrecision(4)).toString();
 const probability=x=>x===0?'数値精度未満':x<.0001?x.toExponential(3):x.toFixed(4);
 function totalLabel(q){return +$('epsilon').value>=Math.max(m.leftReach,m.rightReach)?'0':probability(q);}
 function stop(){cancelAnimationFrame(frame);playing=false;$('play').textContent=+$('n').value===MAX?'最初から再生':'再生';}
 function setup(){
  stop();const kind=$('distribution').value;
  const inputs=settings[kind].b?[$('a'),$('b')]:[$('a')];
  inputs.forEach(el=>el.removeAttribute('aria-invalid'));
  const invalid=inputs.find(el=>!el.checkValidity());
  $('error').textContent=invalid?'分布のパラメータを入力欄の範囲内で指定してください．':'';
  for(const id of ['play','reset','end','n','epsilon'])$(id).disabled=!!invalid;
  if(invalid){invalid.setAttribute('aria-invalid','true');$('status').textContent='グラフは直前の有効な設定です．';return;}
  m=LLNDensity.model(kind,+$('a').value,+$('b').value);
  $('model').textContent=settings[kind].name;
  $('moments').textContent=`μ = ${fmt(m.mean)}，σ² = ${fmt(m.variance)}`;
  const eps=+$('epsilon').value;
  $('epsilonValue').textContent=fmt(eps);
  probabilities=Array.from({length:MAX},(_,i)=>m.tails(i+1,eps).total);
  $('status').textContent='ε を固定して，標本数を増やしてみましょう．';
  render();
 }
 function canvas(id){
  const el=$(id),w=el.clientWidth,h=el.clientHeight,dpr=window.devicePixelRatio||1;
  window.MathTypeset?.clearCanvas(el);el.width=Math.round(w*dpr);el.height=Math.round(h*dpr);
  const c=el.getContext('2d');c.scale(dpr,dpr);c.font='12px system-ui';c.textBaseline='middle';
  return {c,w,h,p:{l:55,r:w-20,t:50,b:h-48}};
 }
 function axes(c,p,X,Y,xTicks,yTicks){
  c.lineWidth=1;
  yTicks.forEach(v=>{c.strokeStyle='#e2e8ee';c.beginPath();c.moveTo(p.l,Y(v));c.lineTo(p.r,Y(v));c.stroke();c.fillStyle='#526675';c.textAlign='right';c.fillText(fmt(v),p.l-8,Y(v));});
  xTicks.forEach(v=>{c.fillStyle='#526675';c.textAlign='center';c.fillText(fmt(v),X(v),p.b+18);});
 }
 function density(){
  const {c,w,h,p}=canvas('density');if(w<1)return;
  const n=+$('n').value,eps=+$('epsilon').value;
  const lo=m.mean-Math.max(2*m.sd,eps*1.2);
  const hi=m.mean+Math.max(3*m.sd,eps*1.2);
  const ymax=m.density(MAX,m.mode(MAX))*1.16;
  const X=x=>p.l+(x-lo)/(hi-lo)*(p.r-p.l),Y=y=>p.b-y/ymax*(p.b-p.t);
  axes(c,p,X,Y,Array.from({length:5},(_,i)=>lo+(hi-lo)*i/4),Array.from({length:5},(_,i)=>ymax*i/4));
  c.fillStyle='#526675';c.textAlign='left';c.fillText('確率密度',p.l,14);c.textAlign='center';c.fillText('標本平均の値 x',(p.l+p.r)/2,h-8);
  c.save();c.beginPath();c.rect(p.l,p.t,p.r-p.l,p.b-p.t);c.clip();
  // Each filled segment includes its exact epsilon boundary, even on narrow screens.
  function curve(a,b,fill){
   if(b<=a)return;
   const count=Math.max(2,Math.ceil((b-a)/(hi-lo)*480));
   c.beginPath();c.moveTo(X(a),Y(0));
   for(let i=0;i<=count;i++){const x=a+(b-a)*i/count;c.lineTo(X(x),Y(m.density(n,x)));}
   c.lineTo(X(b),Y(0));c.closePath();c.fillStyle=fill;c.fill();
  }
  const left=m.mean-eps,right=m.mean+eps;
  curve(lo,left,'#d86a4a80');curve(left,right,'#16766730');curve(right,hi,'#d86a4a80');
  c.strokeStyle='#167667';c.lineWidth=2;c.beginPath();
  for(let i=0;i<=480;i++){const x=lo+(hi-lo)*i/480,y=Y(m.density(n,x));i?c.lineTo(X(x),y):c.moveTo(X(x),y);}c.stroke();
  for(const x of [left,right]){c.strokeStyle='#bd482e';c.setLineDash([5,4]);c.beginPath();c.moveTo(X(x),p.t);c.lineTo(X(x),p.b);c.stroke();}
  c.strokeStyle='#182c3c';c.setLineDash([3,4]);c.beginPath();c.moveTo(X(m.mean),p.t);c.lineTo(X(m.mean),p.b);c.stroke();c.setLineDash([]);c.restore();
  c.fillStyle='#bd482e';
  const leftLabel=`μ − ε = ${fmt(left)}`,rightLabel=`μ + ε = ${fmt(right)}`;
  c.textAlign='right';c.fillText(leftLabel,Math.max(c.measureText(leftLabel).width+4,X(left)),p.t-24);
  c.textAlign='left';c.fillText(rightLabel,Math.min(w-c.measureText(rightLabel).width-4,X(right)),p.t-8);
  const tails=m.tails(n,eps);
  const outsideSupport='0（分布の範囲外）';
  $('tailBreakdown').textContent=`左側：${eps>=m.leftReach?outsideSupport:probability(tails.left)} ／ 右側：${eps>=m.rightReach?outsideSupport:probability(tails.right)} ／ μ = ${fmt(m.mean)}`;
  $('density').setAttribute('aria-label',`標本数 ${n}，期待値 ${fmt(m.mean)}，許容誤差 ${fmt(eps)}．外側の確率 ${$('probability').textContent}．`);
 }
 function trend(){
  const {c,w,h,p}=canvas('trend');if(w<1)return;p.t=20;
  const X=n=>p.l+Math.log(n)/Math.log(MAX)*(p.r-p.l),Y=q=>p.b-q*(p.b-p.t);
  axes(c,p,X,Y,[1,2,5,10,20,50,MAX],[0,.25,.5,.75,1]);
  c.fillStyle='#526675';c.textAlign='center';c.fillText('標本数 n（対数目盛）',(p.l+p.r)/2,h-8);
  c.strokeStyle='#bd482e';c.lineWidth=2;c.beginPath();probabilities.forEach((q,i)=>i?c.lineTo(X(i+1),Y(q)):c.moveTo(X(1),Y(q)));c.stroke();
  const n=+$('n').value;c.fillStyle='#bd482e';c.beginPath();c.arc(X(n),Y(probabilities[n-1]),5,0,2*Math.PI);c.fill();
  $('trend').setAttribute('aria-label',`外側の確率：n = 1 で ${totalLabel(probabilities[0])}，n = ${MAX} で ${totalLabel(probabilities[MAX-1])}．`);
 }
 function render(){if(!m)return;const n=+$('n').value;$('currentN').textContent=$('nValue').textContent=n;$('probability').textContent=totalLabel(probabilities[n-1]);$('sd').textContent=fmt(m.sd/Math.sqrt(n));density();trend();}
 function tick(time){
  if(!playing)return;
  const t=Math.min(1,(time-started)/12000);
  const n=Math.min(MAX,Math.round(Math.exp(Math.log(startN)+(Math.log(MAX)-Math.log(startN))*t)));
  if(n!==+$('n').value){$('n').value=n;render();}
  if(t===1){stop();$('status').textContent=`n = ${MAX} まで再生しました．ε を小さくして，もう一度比べてみましょう．`;}else frame=requestAnimationFrame(tick);
 }
 $('distribution').addEventListener('change',()=>{
  const config=settings[$('distribution').value];
  $('parameter2').hidden=!config.b;
  for(const id of ['a','b']){
   if(!config[id])continue;
   const [label,min,max,step,value]=config[id];
   $(id+'Label').textContent=label;
   Object.assign($(id),{min,max,step,value});
  }
  setup();
 });
 for(const id of ['a','b','epsilon'])$(id).addEventListener('input',setup);
 $('n').addEventListener('input',()=>{stop();render();$('status').textContent='標本数を手動で選んでいます．';});
 $('reset').addEventListener('click',()=>{stop();$('n').value=1;render();$('status').textContent='n = 1 に戻しました．';});
 $('end').addEventListener('click',()=>{stop();$('n').value=MAX;render();$('play').textContent='最初から再生';$('status').textContent=`n = ${MAX} の分布です．`;});
 $('play').addEventListener('click',()=>{if(playing){stop();$('status').textContent='一時停止中．';return;}if(+$('n').value===MAX)$('n').value=1;startN=+$('n').value;started=performance.now();playing=true;$('play').textContent='一時停止';$('status').textContent='ε を固定して標本数を増やしています．';render();frame=requestAnimationFrame(tick);});
 new ResizeObserver(render).observe($('density').parentElement);
 setup();
}());
