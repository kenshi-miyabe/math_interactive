/* Shared KaTeX rendering for static text, interactive readouts and canvas labels.
 * New formulas should use data-tex or \\( ... \\) / \\[ ... \\] delimiters.
 * Legacy Unicode notation is supported so simulation strings stay usable as plain text.
 */
(function () {
  'use strict';
  const symbols = {'α':'\\alpha ','β':'\\beta ','γ':'\\gamma ','δ':'\\delta ','ε':'\\varepsilon ','θ':'\\theta ','λ':'\\lambda ','μ':'\\mu ','ξ':'\\xi ','π':'\\pi ','ρ':'\\rho ','σ':'\\sigma ','φ':'\\varphi ','Σ':'\\Sigma ','Δ':'\\Delta ','ℝ':'\\mathbb{R}','ℤ':'\\mathbb{Z}','ℚ':'\\mathbb{Q}','∞':'\\infty ','∀':'\\forall ','∃':'\\exists ','∧':'\\land ','∨':'\\lor ','∈':'\\in ','∉':'\\notin ','≤':'\\le ','≥':'\\ge ','≠':'\\ne ','≈':'\\approx ','→':'\\to ','⇒':'\\implies ','−':'-','–':'-','×':'\\times ','·':'\\cdot ','±':'\\pm ','…':'\\cdots ','⋯':'\\cdots ','½':'\\frac{1}{2}','°':'^{\\circ}','＝':'=','∠':'\\angle ','△':'\\triangle ','÷':'\\div ','〜':'\\ldots '};
  const subs='₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜₓ',subChars='0123456789+-=()aehijklmnoprstx';
  const supers='⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ᵀᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻ',superChars='0123456789+-=()Tabcdefghijklmnoprstuvwxyz';
  function toTex(source) {
    let s=String(source).replace(/X̄/g,'\\bar{X}').replace(/x̄/g,'\\bar{x}');
    s=s.replace(/Σ(?=[₀-₉ᵢₖₙ(a-z])/g,'\\sum ');
    let out='';
    for(let i=0;i<s.length;i++) {
      const ch=s[i],sub=subs.includes(ch),sup=supers.includes(ch);
      if(sub||sup){const alphabet=sub?subs:supers,values=sub?subChars:superChars;let group='';while(i<s.length&&alphabet.includes(s[i]))group+=values[alphabet.indexOf(s[i++])];i--;out+=(sub?'_':'^')+'{'+group+'}';}
      else if(ch==='√'){
        let radicand='';
        if(s[i+1]==='('){let depth=1;i+=2;while(i<s.length&&depth){if(s[i]==='(')depth++;if(s[i]===')')depth--;if(depth)radicand+=s[i];i++;}i--;}
        else if(s[i+1]==='|'){radicand='|';i+=2;while(i<s.length&&s[i]!=='|')radicand+=s[i++];radicand+='|';}
        else radicand=s[++i]||'';
        out+='\\sqrt{'+toTex(radicand)+'}';
      }
      else out+=symbols[ch]||ch;
    }
    out=out.replace(/‖([^‖]*)‖/g,'\\lVert $1\\rVert ');
    out=out.replace(/(?<!\\)\b(sin|cos|tan|log|exp|inf|sup|lim|max|min)(?=\b|\\)/g,'\\$1 ');
    return out;
  }
  // Recognise mathematical tokens, never arbitrary words in Japanese/English prose.
  const token=/(?:[Xx]̄|\\bar\{[Xx]\}|[A-Za-z]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?|[αβγδεθλμξπρσφΣΔℝℤℚ∞∀∃∧∨∈∉≤≥≠≈⇒→−–×·±…⋯½°＝∠△÷〜√‖₀-₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜₓ⁰-⁹¹²³⁺⁻⁼⁽⁾ᵀᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻ]|[=+*/^_<>|()[\]{},!:.\-]|[ \t　]+)/gu;
  const word=/^(?:[a-zA-Z]|sin|cos|tan|log|exp|inf|sup|lim|max|min|SD|MSE|Exp|Poi|APB|AOB|AOP|BOP|OPA|OPB|OAP|OBP|OA|OB|OP|PA|PB|AB)$/;
  function segments(text) {
    const output=[];let start=-1,end=0,hasSymbol=false;
    function flush(){if(start<0)return;const raw=text.slice(start,end),trim=raw.trim().replace(/[,:.]+$/,'');if(hasSymbol&&trim&&trim!=='/'){const offset=raw.indexOf(trim);output.push({start:start+offset,end:start+offset+trim.length,tex:toTex(trim)});}start=-1;hasSymbol=false;}
    token.lastIndex=0;let m,previous=0;
    while((m=token.exec(text))){const t=m[0];if(m.index!==previous)flush();if(/^[A-Za-z]+$/.test(t)&&!word.test(t)){flush();previous=token.lastIndex;continue;}if(start<0){if(/^[\s,!:.)\]}]+$/.test(t)){previous=token.lastIndex;continue;}start=m.index;}end=token.lastIndex;if(t.startsWith('\\bar')||/[Xx]̄/u.test(t)||word.test(t)||/[α-ωΣΔℝℤℚ∞∀∃∧∨∈∉≤≥≠≈√‖∠△÷°=/*^±×]/u.test(t))hasSymbol=true;previous=token.lastIndex;}
    flush();return output;
  }
  const ignored='script,style,textarea,pre,code,option,select,input,title,.katex,[data-tex],.math-tex,.canvas-math';
  function typeset(el,tex,display=false) {
    if(!window.katex)return;
    try {window.katex.render(tex,el,{displayMode:display,throwOnError:true,strict:'ignore',trust:false});el.dataset.renderedTex=tex;}
    catch(error){el.textContent=tex;el.classList.add('math-error');console.error('KaTeX:',tex,error.message);}
  }
  function renderText(node) {
    const text=node.nodeValue;if(!text||!node.parentElement||node.parentElement.closest(ignored))return;
    const explicit=/\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g;
    let list=[],m;while((m=explicit.exec(text)))list.push({start:m.index,end:explicit.lastIndex,tex:m[1]??m[2],display:m[2]!==undefined});
    if(!list.length)list=segments(text);
    if(!list.length)return;
    const frag=document.createDocumentFragment();let end=0;
    for(const part of list){frag.append(document.createTextNode(text.slice(end,part.start)));const span=document.createElement('span');span.className='math-tex';span.dataset.tex=part.tex;typeset(span,part.tex,part.display);frag.append(span);end=part.end;}
    frag.append(document.createTextNode(text.slice(end)));node.replaceWith(frag);
  }
  function render(root) {
    if(!window.katex||!root)return;
    if(root.nodeType===3){renderText(root);return;}
    if(root.nodeType!==1&&root.nodeType!==9)return;
    if(root.nodeType===1&&root.closest('.katex,.math-tex,.canvas-math'))return;
    const explicit=[];if(root.matches?.('[data-tex]'))explicit.push(root);
    explicit.push(...root.querySelectorAll('[data-tex]:not(.math-tex)'));
    for(const el of explicit){if(el.closest('.katex,.canvas-math'))continue;const tex=el.dataset.tex;if(el.dataset.renderedTex!==tex||!el.querySelector('.katex'))typeset(el,tex,el.hasAttribute('data-display'));}
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(renderText);
  }
  // Canvas retains the plots. Formula labels are HTML overlays rendered by KaTeX.
  // Coordinates use the actual canvas transform and CSS size, including HiDPI.
  const overlays=new Map();
  function clearCanvas(canvas){const labels=overlays.get(canvas);if(labels)labels.forEach(el=>el.remove());overlays.delete(canvas);}
  function positionLabel(el,canvas,x,y,align,baseline,font,color,alpha,transform){
    const rect=canvas.getBoundingClientRect();el.hidden=!canvas.isConnected||rect.width===0||rect.height===0;if(el.hidden)return;const point=new DOMPoint(x,y).matrixTransform(transform);
    const sx=rect.width/canvas.width,sy=rect.height/canvas.height;
    Object.assign(el.style,{position:'absolute',left:rect.left+window.scrollX+point.x*sx+'px',top:rect.top+window.scrollY+point.y*sy+'px',font,color,opacity:String(alpha),fontSize:(parseFloat(font.match(/([\d.]+)px/)?.[1]||12)*Math.hypot(transform.a,transform.b)*sx)+'px',transform:`translate(${align==='center'?'-50%':align==='right'||align==='end'?'-100%':'0'},${baseline==='middle'?'-50%':baseline==='top'||baseline==='hanging'?'0':'-80%'})`});
  }
  if(typeof CanvasRenderingContext2D!=='undefined') {
    const proto=CanvasRenderingContext2D.prototype,fillText=proto.fillText,clearRect=proto.clearRect;
    proto.clearRect=function(...args){clearCanvas(this.canvas);return clearRect.apply(this,args);};
    proto.fillText=function(text,x,y,maxWidth){
      text=String(text);const parts=segments(text);
      if(!parts.length&&!/\\[([]/.test(text))return fillText.call(this,text,x,y,...(maxWidth===undefined?[]:[maxWidth]));
      const canvas=this.canvas,el=document.createElement('span');el.className='canvas-math';el.setAttribute('aria-hidden','true');
      // Render a text/math mixture without feeding Japanese prose to the TeX parser.
      let end=0;for(const part of parts){el.append(document.createTextNode(text.slice(end,part.start)));const span=document.createElement('span');span.dataset.tex=part.tex;span.className='math-tex';span.textContent=text.slice(part.start,part.end);typeset(span,part.tex);el.append(span);end=part.end;}el.append(document.createTextNode(text.slice(end)));
      document.body.append(el);const labels=overlays.get(canvas)||[];labels.push(el);overlays.set(canvas,labels);
      // Snapshot state: later drawing calls change the context.
      const align=this.textAlign,baseline=this.textBaseline,font=this.font,color=this.fillStyle,alpha=this.globalAlpha,transform=this.getTransform();
      el.reposition=()=>positionLabel(el,canvas,x,y,align,baseline,font,color,alpha,transform);el.reposition();
    };
    window.addEventListener('resize',()=>overlays.forEach(labels=>labels.forEach(el=>el.reposition())));
  }
  window.MathTypeset={render,toTex,segments,clearCanvas};
  function start(){
    if(!window.katex)return;
    render(document.body);
    // Batch only changed subtrees; disconnect while rendering to avoid self-observation.
    const observer=new MutationObserver(records=>{
      observer.disconnect();
      const roots=new Set();for(const record of records){if(record.type==='characterData'||record.type==='attributes')roots.add(record.target);else record.addedNodes.forEach(node=>roots.add(node));}
      roots.forEach(root=>{if(root.isConnected)render(root);});
      overlays.forEach((labels,canvas)=>{if(!canvas.isConnected)clearCanvas(canvas);else labels.forEach(el=>el.reposition());});
      observe();
    });
    function observe(){observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style','hidden','data-tex']});}
    observe();
    // Initial plots may have been drawn before the deferred KaTeX library loaded.
    overlays.forEach(labels=>labels.forEach(el=>el.querySelectorAll('[data-tex]').forEach(span=>typeset(span,span.dataset.tex))));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
}());
