// Sound kit B (Chiptune), lifted unchanged in sound from docs/product/variants/sound-direction/B.html.
// createSoundKit(ctx, destination[, {seed}]): kit.play(id, when) -> end time; kit.startAmbient(zone, when[, {duration}]) -> {stop(when)};
// kit.setVolume('master'|'sfx'|'ambient', 0..1); kit.setMuted(bool); kit.sfxIds; kit.zones. Pure Web Audio, no DOM.
import { bindKit } from "./common.js";
const KIT_TRIM = {"sfx":{"swing":0.54954,"hitFlesh":0.36308,"hitPaper":0.4217,"miss":1.02329,"hurtZombie":0.59566,"hurtImp":0.97724,"hurtManager":0.49545,"deathZombie":0.45186,"deathImp":0.57544,"deathManager":0.38905,"heroHurt":0.44157,"heartbeat":0.50699,"potion":0.77625,"coin":0.74131,"pickupItem":0.62373,"pickupRare":0.65313,"pickupUnique":0.42658,"levelUp":0.41687,"castStapler":0.75858,"castReplyAll":0.74989,"castCoffee":0.48978,"castMute":0.50118,"uiClick":1.1885,"uiOpen":1.01158,"uiEquip":0.63095,"stairs":0.44669,"ding":0.57544},"amb":{"open-plan":0.16982,"basement":0.19953,"lobby":0.30903}};
const { makeKit } = bindKit(KIT_TRIM);

export function createSoundKit(ctx,dest,opts){
  const cfg={id:'B'};
  let Bus=null;const waves={};
  const mid=n=>440*Math.pow(2,(n-69)/12);
  function pw(d){return waves[d]||(function(){const N=40,re=new Float32Array(N),im=new Float32Array(N);for(let n=1;n<N;n++)re[n]=2/(n*Math.PI)*Math.sin(n*Math.PI*d);return waves[d]=ctx.createPeriodicWave(re,im);})();}
  function env(g,t,pk,dur,steps){steps=steps||5;for(let i=0;i<steps;i++)g.gain.setValueAtTime(pk*Math.pow(1-i/steps,1.4)+0.0001,t+dur*i/steps);g.gain.setValueAtTime(0,t+dur);}
  /* pulse channel: notes = [[freq,dur],...], 2 nodes */
  function pulse(o,t,duty,notes,pk,decay){const s=ctx.createOscillator(),g=ctx.createGain();s.setPeriodicWave(pw(duty));let x=t;notes.forEach(n=>{s.frequency.setValueAtTime(n[0],x);x+=n[1];});
    if(decay===false){g.gain.setValueAtTime(pk,t);g.gain.setValueAtTime(0,x);}else env(g,t,pk,x-t,decay||6);s.connect(g);g.connect(o);s.start(t);s.stop(x+0.02);return x;}
  function tri(o,t,notes,pk,decay){const s=ctx.createOscillator(),g=ctx.createGain();s.type='triangle';let x=t;notes.forEach(n=>{s.frequency.setValueAtTime(n[0],x);x+=n[1];});
    if(decay===false){g.gain.setValueAtTime(pk,t);g.gain.setValueAtTime(0,x);}else env(g,t,pk,x-t,decay||6);s.connect(g);g.connect(o);s.start(t);s.stop(x+0.02);return x;}
  /* noise channel: rates = [[playbackRate,dur],...] */
  function nz(o,t,kind,rates,pk,decay){const s=ctx.createBufferSource(),g=ctx.createGain();s.buffer=Bus.nz(kind);s.loop=true;let x=t;rates.forEach(n=>{s.playbackRate.setValueAtTime(n[0],x);x+=n[1];});
    env(g,t,pk,x-t,decay||5);s.connect(g);g.connect(o);s.start(t);s.stop(x+0.02);return x;}
  const arp=(base,steps,dur)=>steps.map(s=>[mid(base+s),dur]);
  const slide=(f0,f1,n,dur)=>{const a=[];for(let i=0;i<n;i++)a.push([f0*Math.pow(f1/f0,i/(n-1)),dur/n]);return a;};
  const S={
    swing(o,t){nz(o,t,'chip',slide(3,0.8,6,0.18),0.5,4);pulse(o,t,0.125,slide(900,220,6,0.14),0.3,4);return t+0.2;},
    hitFlesh(o,t){nz(o,t,'chip',slide(1.2,0.3,6,0.17),0.7,5);pulse(o,t,0.5,slide(190,60,6,0.12),0.6,5);tri(o,t,slide(110,45,6,0.15),0.6,5);return t+0.2;},
    hitPaper(o,t){nz(o,t,'chipS',[[4,0.04],[5,0.04]],0.5,2);nz(o,t+0.09,'chipS',[[6,0.05]],0.4,2);pulse(o,t,0.25,[[1500,0.02],[1000,0.02]],0.3,2);return t+0.2;},
    miss(o,t){nz(o,t,'chip',slide(2.2,0.9,5,0.16),0.28,4);pulse(o,t,0.125,slide(700,380,5,0.12),0.15,4);return t+0.2;},
    hurtZombie(o,t){const n=[];for(let i=0;i<8;i++)n.push([115*Math.pow(0.5,i/8)*(i%2?1.04:0.97),0.05]);pulse(o,t,0.25,n,0.55,5);nz(o,t,'chip',[[0.5,0.2]],0.3,4);return t+0.45;},
    hurtImp(o,t){pulse(o,t,0.125,[[1500,0.03],[2100,0.03],[1600,0.03],[2400,0.03]],0.4,4);tri(o,t,slide(900,400,4,0.12),0.3,4);return t+0.2;},
    hurtManager(o,t){pulse(o,t,0.5,slide(150,80,7,0.28),0.5,5);nz(o,t,'chip',[[0.7,0.12]],0.4,4);return t+0.35;},
    deathZombie(o,t){pulse(o,t,0.25,arp(60,[0,-2,-4,-6,-8,-11,-13,-16,-19,-22,-25,-28],0.05),0.5,8);tri(o,t,slide(100,30,10,0.6),0.6,6);nz(o,t+0.35,'chip',[[0.5,0.15],[0.3,0.2]],0.35,5);return t+0.8;},
    deathImp(o,t){pulse(o,t,0.125,[...slide(1000,2400,5,0.12),...slide(2400,150,12,0.5)],0.4,7);nz(o,t+0.5,'chip',[[2,0.1],[1,0.15]],0.55,4);return t+0.8;},
    deathManager(o,t){pulse(o,t,0.5,slide(140,40,10,0.5),0.5,6);tri(o,t,slide(90,28,10,0.6),0.6,6);nz(o,t+0.2,'chip',[[1,0.1],[0.6,0.15],[0.3,0.3]],0.7,6);return t+0.85;},
    heroHurt(o,t){pulse(o,t,0.5,slide(520,200,6,0.16),0.5,5);nz(o,t,'chip',[[1.5,0.12]],0.5,4);return t+0.2;},
    heartbeat(o,t){tri(o,t,slide(70,42,5,0.15),0.9,5);tri(o,t+0.26,slide(62,38,5,0.18),0.75,5);return t+0.5;},
    potion(o,t){pulse(o,t,0.25,arp(60,[0,7,0,7,4,11,7,14,9],0.04),0.3,3);tri(o,t+0.38,slide(260,110,5,0.14),0.7,4);return t+0.55;},
    coin(o,t){pulse(o,t,0.5,[[mid(83),0.05],[mid(88),0.2]],0.4,6);pulse(o,t+0.09,0.5,[[mid(88),0.05],[mid(95),0.2]],0.35,6);pulse(o,t+0.18,0.5,[[mid(95),0.05],[mid(100),0.2]],0.3,6);return t+0.45;},
    pickupItem(o,t){pulse(o,t,0.25,arp(72,[0,7,12,16],0.045),0.4,6);tri(o,t,arp(60,[0,7,12,16],0.045),0.5,6);return t+0.25;},
    pickupRare(o,t){pulse(o,t,0.125,arp(76,[0,4,7,12,16,19,24,28],0.055),0.4,3);tri(o,t+0.1,arp(64,[0,4,7,12,16,19,24,28],0.055),0.5,3);nz(o,t+0.4,'chipS',[[7,0.2]],0.12,4);return t+0.6;},
    pickupUnique(o,t){pulse(o,t,0.125,arp(72,[0,3,7,12,15,19,24,27,31,36],0.06),0.4,2);pulse(o,t+0.03,0.5,arp(60,[0,3,7,12,15,19,24,27,31,36],0.06),0.25,2);tri(o,t,[[mid(36),0.8]],0.7,6);nz(o,t+0.45,'chipS',[[8,0.35]],0.14,4);return t+0.9;},
    levelUp(o,t){pulse(o,t,0.25,[[mid(72),0.1],[mid(76),0.1],[mid(79),0.1],[mid(84),0.45]],0.4,3);tri(o,t,[[mid(60),0.1],[mid(64),0.1],[mid(67),0.1],[mid(72),0.45]],0.7,3);pulse(o,t+0.3,0.5,[[mid(88),0.05],[mid(91),0.05],[mid(96),0.4]],0.2,6);nz(o,t+0.3,'chipS',[[3,0.03]],0.3,2);return t+0.9;},
    castStapler(o,t){nz(o,t,'chipS',[[5,0.03]],0.6,2);pulse(o,t+0.02,0.125,slide(1900,300,8,0.2),0.4,5);return t+0.3;},
    castReplyAll(o,t){pulse(o,t,0.25,arp(72,[0,4,7,12,7,12,16,19],0.04),0.35,2);pulse(o,t+0.02,0.125,arp(79,[0,4,7,12,7,12,16,19],0.04),0.22,2);nz(o,t,'chipS',[[4,0.06],[6,0.1]],0.2,3);return t+0.4;},
    castCoffee(o,t){pulse(o,t,0.5,arp(60,[0,4,7,12,16,19],0.07),0.3,2);tri(o,t,arp(48,[0,4,7,12,16,19],0.07),0.6,2);pulse(o,t+0.42,0.25,[[mid(79),0.3]],0.25,6);return t+0.75;},
    castMute(o,t){pulse(o,t,0.5,slide(900,70,8,0.4),0.45,6);nz(o,t,'chip',slide(2,0.2,6,0.35),0.4,5);return t+0.5;},
    uiClick(o,t){pulse(o,t,0.5,[[1400,0.015],[900,0.025]],0.4,3);return t+0.06;},
    uiOpen(o,t){pulse(o,t,0.25,[[mid(67),0.05],[mid(74),0.08]],0.35,4);nz(o,t,'chip',[[4,0.03]],0.2,2);return t+0.2;},
    uiEquip(o,t){nz(o,t,'chipS',[[5,0.02]],0.5,2);pulse(o,t,0.5,[[mid(79),0.05],[mid(86),0.05],[mid(91),0.12]],0.35,5);return t+0.25;},
    stairs(o,t){for(let i=0;i<4;i++)nz(o,t+i*0.16,'chip',[[1-i*0.08,0.05]],0.7,3);tri(o,t,slide(220,70,10,0.65),0.4,6);return t+0.7;},
    ding(o,t){pulse(o,t,0.5,[[mid(88),0.9]],0.3,10);tri(o,t,[[mid(76),0.9]],0.5,10);return t+0.95;}
  };
  /* ambients --------------------------------------------------- */
  function chan(A,type,f,gain,filt){const s=A.add(ctx.createOscillator()),g=ctx.createGain();if(type<1)s.setPeriodicWave(pw(type));else s.type=type;s.frequency.value=f;g.gain.value=gain;s.connect(g);g.connect(A.out);s.start(A.t0);return {s,g};}
  function lfo(A,hz,depth,param,sq){const l=A.add(ctx.createOscillator()),g=ctx.createGain();l.type=sq?'square':'triangle';l.frequency.value=hz;g.gain.value=depth;l.connect(g);g.connect(param);l.start(A.t0);}
  function nbed(A,kind,rate,ft,f,gain){const n=A.noise(kind),b=ctx.createBiquadFilter(),g=ctx.createGain();n.playbackRate.value=rate;b.type=ft;b.frequency.value=f;g.gain.value=gain;n.connect(b);b.connect(g);g.connect(A.out);return g;}
  function blip(A,t,type,f,dur,v){const s=ctx.createOscillator(),g=ctx.createGain();if(type<1)s.setPeriodicWave(pw(type));else s.type=type;s.frequency.value=f;env(g,t,v,dur,4);s.connect(g);g.connect(A.out);s.start(t);s.stop(t+dur+0.02);}
  const AMB={
    'open-plan'(A){
      chan(A,0.125,120,0.02);chan(A,0.5,60,0.012);
      const hv=nbed(A,'chip',0.12,'lowpass',500,0.28);lfo(A,0.2,0.1,hv.gain);
      const bs=[33,33,36,31];let k=0;A.every(t=>{blip(A,t,'triangle',mid(bs[k++%4]+12),0.9,0.16);blip(A,t+0.5,'triangle',mid(bs[(k-1)%4]+19),0.5,0.07);},()=>2,0);
      A.every(t=>{for(let i=0;i<6;i++){const n=ctx.createBufferSource(),g=ctx.createGain(),x=t+i*0.17;n.buffer=Bus.nz('chipS');n.loop=true;n.playbackRate.value=1.8+(i%2)*0.5;env(g,x,0.05,0.12,3);n.connect(g);g.connect(A.out);n.start(x);n.stop(x+0.14);}},()=>7+A.rng()*6,3);},
    basement(A){
      const fn=nbed(A,'chipS',0.55,'bandpass',200,0.5);lfo(A,19,0.06,fn.gain,true);nbed(A,'chip',0.2,'lowpass',250,0.25);
      chan(A,'triangle',36.7,0.2).g;const d2=chan(A,'triangle',43.7,0.16);lfo(A,0.07,0.1,d2.g.gain);
      A.every(t=>{const f=mid(84+Math.floor(A.rng()*6)*2);[1,0.8,0.6,0.45].forEach((m,i)=>blip(A,t+i*0.03,0.5,f*m,0.03,0.09));},()=>1.5+A.rng()*3.5,0.7);},
    lobby(A){
      chan(A,0.25,mid(53),0.014);chan(A,'triangle',mid(41),0.2);
      const ch=[[53,57,60,64],[52,55,59,62],[50,53,57,60],[55,59,62,65]];let n=0;
      A.every(t=>{const c=ch[Math.floor(n/8)%4],i=n%8,idx=[0,1,2,3,2,1,2,3][i];n++;blip(A,t,'triangle',mid(c[idx]+12),0.45,0.17);if(i===0)blip(A,t,0.25,mid(c[0]),1.5,0.05);},()=>0.3,0);}
  };
  const kit=makeKit(ctx,dest,cfg,S,AMB,opts);Bus=kit.bus;kit.name='Retro chiptune';return kit;
}
export default createSoundKit;
