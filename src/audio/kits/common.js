// Shared synthesis plumbing for the three sound kits, lifted unchanged from the sound-direction prototypes
// (docs/product/variants/sound-direction/{A,B,C}.html). Web Audio only, no DOM, no files (NFR-L01).
// bindKit(KIT_TRIM) closes the per-kit calibration table over the bus, noise and ambient-runner helpers.
export function bindKit(KIT_TRIM) {
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
/* deterministic noise buffers: white | pink | chip (held, +-1) | chipS (93-sample period, metallic) */
function makeNoise(ctx,kind,sec){
  const sr=ctx.sampleRate,n=kind==='chipS'?93:Math.floor(sr*sec),b=ctx.createBuffer(1,n,sr),d=b.getChannelData(0),r=mulberry(kind.length*7919+n);
  if(kind==='white'){for(let i=0;i<n;i++)d[i]=r()*2-1;}
  else if(kind==='pink'){let a=0,c=0,e=0;for(let i=0;i<n;i++){const w=r()*2-1;a=0.99765*a+w*0.099046;c=0.963*c+w*0.2965164;e=0.57*e+w*1.0526913;d[i]=(a+c+e+w*0.1848)*0.2;}}
  else{let v=1,h=kind==='chip'?3:1;for(let i=0;i<n;i++){if(i%h===0)v=r()<0.5?-1:1;d[i]=v;}}
  return b;
}
/* master chain: sfx bus + ambient bus -> master -> compressor -> soft ceiling (never above 0.97) -> dest. cfg.reverb: feedback-delay "room", no convolution */
function makeBus(ctx,dest,cfg){
  const B={vol:{master:1,sfx:1,ambient:1},muted:false,noise:{}};
  const g=()=>ctx.createGain();
  B.master=g();B.sfx=g();B.amb=g();
  const comp=ctx.createDynamicsCompressor();comp.threshold.value=-4;comp.knee.value=0;comp.ratio.value=20;comp.attack.value=0.001;comp.release.value=0.09;
  const sat=ctx.createWaveShaper(),cv=new Float32Array(2049);
  for(let i=0;i<2049;i++){const x=i/1024-1,a=Math.abs(x);cv[i]=Math.sign(x)*(a<0.8?a:0.8+0.17*Math.tanh((a-0.8)/0.17));}
  sat.curve=cv;
  B.sfx.connect(B.master);B.amb.connect(B.master);B.master.connect(comp);comp.connect(sat);sat.connect(dest);
  B.rvIn=null;
  if(cfg&&cfg.reverb){
    const R=cfg.reverb,inp=g(),wet=g();wet.gain.value=R.wet;
    R.times.forEach((tm,i)=>{const d=ctx.createDelay(0.5),lp=ctx.createBiquadFilter(),fb=g(),pn=ctx.createStereoPanner();
      d.delayTime.value=tm;lp.type='lowpass';lp.frequency.value=R.damp;fb.gain.value=R.fb;pn.pan.value=(i%2?1:-1)*R.width*(0.4+0.2*i);
      inp.connect(d);d.connect(lp);lp.connect(fb);fb.connect(d);lp.connect(pn);pn.connect(wet);});
    wet.connect(B.master);B.rvIn=inp;}
  B.apply=function(){const t=ctx.currentTime;
    B.master.gain.setTargetAtTime(B.muted?0:B.vol.master,t,0.02);B.sfx.gain.setTargetAtTime(B.vol.sfx,t,0.02);B.amb.gain.setTargetAtTime(B.vol.ambient,t,0.02);};
  B.nz=function(kind){return B.noise[kind]||(B.noise[kind]=makeNoise(ctx,kind,kind==='pink'?4:2));};
  return B;
}
/* ambient runner: builder(A) creates sustained nodes (A.add registers sources) and recurring events (A.every). Offline: opts.duration renders a fixed span. */
function runAmbient(ctx,B,build,zone,when,opts){
  opts=opts||{};
  const out=ctx.createGain(),trim=KIT_TRIM.amb[zone]||1,srcs=[],evs=[];
  out.gain.setValueAtTime(0,when);out.gain.linearRampToValueAtTime(trim,when+0.6);out.connect(B.amb);
  const A={ctx,out,t0:when,rng:mulberry(opts.seed||zone.length*977+7),
    add(n){srcs.push(n);return n;},
    noise(kind,off){const s=ctx.createBufferSource();s.buffer=B.nz(kind);s.loop=true;s.start(when,(off||0)*0.37+A.rng()*0.5);srcs.push(s);return s;},
    send(l){if(B.rvIn){const s=ctx.createGain();s.gain.value=l;out.connect(s);s.connect(B.rvIn);}},
    every(fn,gap,first){evs.push({next:when+(first||0),fn,gap});}};
  build(A);
  function pump(until){evs.forEach(e=>{while(e.next<until){e.fn(e.next);e.next+=e.gap();}});}
  const h={stop(t){t=t==null?ctx.currentTime:t;if(h.done)return;h.done=true;clearInterval(h.timer);
      out.gain.cancelScheduledValues(t);out.gain.setValueAtTime(out.gain.value,t);out.gain.linearRampToValueAtTime(0,t+0.8);
      srcs.forEach(s=>{try{s.stop(t+0.85);}catch(e){}});},zone};
  if(opts.duration){pump(when+opts.duration+0.2);h.stop(when+opts.duration);}
  else{pump(when+2);h.timer=setInterval(()=>pump(ctx.currentTime+2),250);}
  return h;
}
function makeKit(ctx,dest,cfg,S,AMB,opts){
  opts=opts||{};const B=makeBus(ctx,dest,cfg);B.apply();
  const rnd=mulberry(opts.seed||4242);
  const kit={id:cfg.id,sfxIds:Object.keys(S),zones:Object.keys(AMB),bus:B,
    /* sp (optional, engine addition, sound-neutral): {gain, pan} distance attenuation and stereo placement; omitted = identical to the prototype */
    play(id,when,sp){const t=when==null?ctx.currentTime:when,o=ctx.createGain();o.gain.value=(KIT_TRIM.sfx[id]||1)*(sp&&sp.gain!=null?sp.gain:1);
      let dst=B.sfx;if(sp&&sp.pan){const pn=ctx.createStereoPanner();pn.pan.value=sp.pan;pn.connect(B.sfx);dst=pn;}
      o.connect(dst);
      return S[id](o,t,B,rnd);},
    startAmbient(zone,when,o){return runAmbient(ctx,B,AMB[zone],zone,when==null?ctx.currentTime:when,o);},
    setVolume(name,v){B.vol[name]=Math.max(0,Math.min(1,+v));B.apply();},
    getVolume(){return Object.assign({muted:B.muted},B.vol);},
    setMuted(m){B.muted=!!m;B.apply();}};
  return kit;
}
  return { mulberry, makeNoise, makeBus, runAmbient, makeKit };
}
