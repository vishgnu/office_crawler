// Sound kit A (Gothic), lifted unchanged in sound from docs/product/variants/sound-direction/A.html.
// createSoundKit(ctx, destination[, {seed}]): kit.play(id, when) -> end time; kit.startAmbient(zone, when[, {duration}]) -> {stop(when)};
// kit.setVolume('master'|'sfx'|'ambient', 0..1); kit.setMuted(bool); kit.sfxIds; kit.zones. Pure Web Audio, no DOM.
import { bindKit } from "./common.js";
const KIT_TRIM = {"sfx":{"swing":1.97242,"hitFlesh":0.59566,"hitPaper":0.63097,"miss":2.51189,"hurtZombie":1.42889,"hurtImp":1.58489,"hurtManager":1.13501,"deathZombie":1.17489,"deathImp":1.23027,"deathManager":0.69984,"heroHurt":0.94406,"heartbeat":0.74989,"potion":0.8414,"coin":0.93325,"pickupItem":1.25893,"pickupRare":0.79432,"pickupUnique":0.96605,"levelUp":0.42658,"castStapler":1.30316,"castReplyAll":1.6788,"castCoffee":1.05925,"castMute":0.82224,"uiClick":0.97724,"uiOpen":1.01158,"uiEquip":0.88103,"stairs":2.39884,"ding":0.89125},"amb":{"open-plan":0.16406,"basement":0.18407,"lobby":0.09016}};
const { makeKit } = bindKit(KIT_TRIM);

export function createSoundKit(ctx,dest,opts){
  const cfg={id:'A',reverb:{times:[0.0537,0.0671,0.0793,0.0971],fb:0.42,damp:2400,wet:0.9,width:0.8}};
  const E=0.0001;
  let Bus=null;
  /* tone: oscillator + exp envelope (2 nodes) */
  function tone(o,t,type,f0,f1,dur,pk,att){const s=ctx.createOscillator(),g=ctx.createGain();s.type=type;s.frequency.setValueAtTime(f0,t);
    if(f1&&f1!==f0)s.frequency.exponentialRampToValueAtTime(f1,t+dur);att=att||0.004;
    g.gain.setValueAtTime(E,t);g.gain.linearRampToValueAtTime(pk,t+att);g.gain.exponentialRampToValueAtTime(E,t+dur);
    s.connect(g);g.connect(o);s.start(t);s.stop(t+dur+0.03);}
  /* noise burst: source + biquad + env (3 nodes) */
  function noise(o,t,dur,pk,ft,f0,f1,q,att,kind){const s=ctx.createBufferSource(),b=ctx.createBiquadFilter(),g=ctx.createGain();
    s.buffer=Bus.nz(kind||'white');s.loop=true;b.type=ft;b.Q.value=q||1;b.frequency.setValueAtTime(f0,t);
    if(f1&&f1!==f0)b.frequency.exponentialRampToValueAtTime(f1,t+dur);att=att||0.003;
    g.gain.setValueAtTime(E,t);g.gain.linearRampToValueAtTime(pk,t+att);g.gain.exponentialRampToValueAtTime(E,t+dur);
    s.connect(b);b.connect(g);g.connect(o);s.start(t,(t*7.31)%1);s.stop(t+dur+0.03);}
  /* voice: saw through two formant bandpasses (6 nodes) */
  function vox(o,t,f0,f1,dur,pk,fa,fb,fb2,type){const s=ctx.createOscillator(),e=ctx.createGain(),a=ctx.createBiquadFilter(),b=ctx.createBiquadFilter(),ga=ctx.createGain(),gb=ctx.createGain();
    s.type=type||'sawtooth';s.frequency.setValueAtTime(f0,t);s.frequency.exponentialRampToValueAtTime(f1,t+dur);
    a.type=b.type='bandpass';a.Q.value=b.Q.value=4;a.frequency.setValueAtTime(fa,t);a.frequency.exponentialRampToValueAtTime(fa*0.7,t+dur);
    b.frequency.setValueAtTime(fb,t);b.frequency.exponentialRampToValueAtTime(fb2||fb*0.75,t+dur);ga.gain.value=1;gb.gain.value=0.6;
    e.gain.setValueAtTime(E,t);e.gain.linearRampToValueAtTime(pk,t+0.03);e.gain.setTargetAtTime(E,t+dur*0.55,dur*0.2);
    s.connect(e);e.connect(a);e.connect(b);a.connect(ga);b.connect(gb);ga.connect(o);gb.connect(o);s.start(t);s.stop(t+dur+0.05);}
  function send(o,l){if(Bus.rvIn){const g=ctx.createGain();g.gain.value=l;o.connect(g);g.connect(Bus.rvIn);}}
  const S={
    swing(o,t){noise(o,t,0.32,0.5,'bandpass',250,1200,1.4,0.1);tone(o,t,'sawtooth',95,42,0.3,0.3,0.05);send(o,0.25);return t+0.5;},
    hitFlesh(o,t){tone(o,t,'sine',150,42,0.26,0.6);noise(o,t,0.3,0.9,'lowpass',1400,250,0.8);noise(o,t,0.04,0.35,'highpass',3000,3000);tone(o,t,'sawtooth',70,35,0.2,0.3);send(o,0.3);return t+0.5;},
    hitPaper(o,t){noise(o,t,0.16,0.8,'highpass',2500,5200,0.7);noise(o,t+0.05,0.14,0.7,'bandpass',3600,2400,2);tone(o,t,'triangle',900,300,0.06,0.12);send(o,0.2);return t+0.3;},
    miss(o,t){noise(o,t,0.26,0.35,'bandpass',600,1700,1.2,0.09);tone(o,t,'sine',210,110,0.2,0.2,0.06);send(o,0.15);return t+0.4;},
    hurtZombie(o,t){vox(o,t,95,58,0.5,0.7,500,950);send(o,0.3);return t+0.7;},
    hurtImp(o,t){vox(o,t,640,1250,0.28,0.45,1500,2800,2000,'square');tone(o,t,'sawtooth',900,500,0.2,0.18);send(o,0.3);return t+0.5;},
    hurtManager(o,t){vox(o,t,135,85,0.38,0.7,600,1100);noise(o,t,0.12,0.3,'lowpass',900,300,1);send(o,0.3);return t+0.6;},
    deathZombie(o,t){vox(o,t,100,34,0.6,0.8,420,800);noise(o,t+0.25,0.3,0.3,'lowpass',700,150,1,0.1);send(o,0.35);return t+1;},
    deathImp(o,t){vox(o,t,1300,200,0.5,0.45,1800,3200,900,'square');noise(o,t+0.35,0.2,0.5,'bandpass',2200,400,1);send(o,0.35);return t+1;},
    deathManager(o,t){vox(o,t,125,38,0.6,0.8,560,1000);tone(o,t+0.35,'sine',70,32,0.35,0.9);send(o,0.35);return t+1;},
    heroHurt(o,t){tone(o,t,'sine',120,52,0.25,0.8);vox(o,t,190,120,0.25,0.4,700,1200);send(o,0.25);return t+0.45;},
    heartbeat(o,t){tone(o,t,'sine',62,38,0.22,1);tone(o,t+0.3,'sine',54,34,0.25,0.8);noise(o,t,0.06,0.1,'lowpass',200,100,1);send(o,0.2);return t+0.6;},
    potion(o,t){noise(o,t,0.34,0.4,'bandpass',350,1700,9,0.06,'pink');tone(o,t+0.05,'sine',520,980,0.08,0.3);tone(o,t+0.2,'sine',480,900,0.08,0.3);tone(o,t+0.4,'sine',320,110,0.14,0.7);send(o,0.2);return t+0.6;},
    coin(o,t){[1568,2093,2637].forEach((f,i)=>tone(o,t+i*0.07,'sine',f,f,0.34,0.4,0.002));noise(o,t,0.03,0.2,'highpass',5000,5000);send(o,0.35);return t+0.55;},
    pickupItem(o,t){noise(o,t,0.08,0.4,'bandpass',1800,900,2);tone(o,t,'triangle',220,320,0.22,0.6);tone(o,t+0.06,'sine',660,660,0.4,0.25);send(o,0.3);return t+0.55;},
    pickupRare(o,t){[587,698,880,1175].forEach((f,i)=>tone(o,t+i*0.08,'sine',f,f,0.5,0.35,0.003));tone(o,t,'sine',147,147,0.6,0.35,0.05);send(o,0.5);return t+0.8;},
    pickupUnique(o,t){[293,440,587,880].forEach((f,i)=>tone(o,t+i*0.07,'sine',f,f,0.4,0.3,0.003));tone(o,t,'sawtooth',73,73,0.55,0.25,0.1);send(o,0.55);return t+0.7;},
    levelUp(o,t){const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.setValueAtTime(500,t);lp.frequency.linearRampToValueAtTime(2400,t+0.35);lp.Q.value=1;
      const g=ctx.createGain();g.gain.setValueAtTime(E,t);g.gain.linearRampToValueAtTime(0.5,t+0.05);g.gain.setValueAtTime(0.5,t+0.3);g.gain.exponentialRampToValueAtTime(E,t+0.55);lp.connect(g);g.connect(o);
      [[147,0],[220,0],[185,0.28],[294,0.28]].forEach(([f,d])=>{const s=ctx.createOscillator();s.type='sawtooth';s.frequency.value=f;s.connect(lp);s.start(t+d);s.stop(t+0.6);});
      tone(o,t,'sine',73,73,0.55,0.5,0.03);tone(o,t+0.25,'sine',1480,1480,0.3,0.15,0.003);send(o,0.4);return t+0.75;},
    castStapler(o,t){noise(o,t,0.015,0.4,'highpass',2500,2500);tone(o,t,'square',1800,500,0.04,0.15);noise(o,t+0.05,0.26,0.9,'bandpass',800,2800,1.2,0.08);tone(o,t+0.1,'sine',2200,2200,0.3,0.12);send(o,0.25);return t+0.5;},
    castReplyAll(o,t){for(let i=0;i<5;i++)tone(o,t+i*0.06,i%2?'triangle':'sawtooth',500+i*140,320+i*60,0.2,0.3,0.003);send(o,0.4);return t+0.6;},
    castCoffee(o,t){noise(o,t,0.4,0.25,'bandpass',1300,900,5,0.05,'pink');[220,262,330].forEach((f,i)=>tone(o,t+0.1+i*0.07,'sine',f,f*1.02,0.45,0.3,0.1));send(o,0.4);return t+0.8;},
    castMute(o,t){noise(o,t,0.45,0.5,'lowpass',2600,70,1.5,0.02);tone(o,t,'sine',90,36,0.45,0.8);tone(o,t,'sawtooth',220,55,0.3,0.2);send(o,0.15);return t+0.55;},
    uiClick(o,t){tone(o,t,'sine',240,100,0.12,0.8,0.002);noise(o,t,0.05,0.15,'bandpass',1600,1600,2);send(o,0.12);return t+0.2;},
    uiOpen(o,t){noise(o,t,0.32,0.3,'bandpass',260,720,7,0.1);tone(o,t+0.3,'sine',130,60,0.14,0.7);noise(o,t+0.3,0.06,0.3,'lowpass',900,300,1);send(o,0.3);return t+0.55;},
    uiEquip(o,t){tone(o,t,'sine',1250,1250,0.25,0.5,0.002);tone(o,t+0.04,'sine',1870,1870,0.2,0.4,0.002);tone(o,t,'sine',160,70,0.12,0.35);noise(o,t,0.03,0.15,'highpass',3500,3500);send(o,0.3);return t+0.4;},
    stairs(o,t){for(let i=0;i<3;i++)noise(o,t+i*0.17,0.14,0.8,'lowpass',500,140,1,0.004);send(o,0.45);return t+0.8;},
    ding(o,t){tone(o,t,'sine',440,440,0.6,0.5,0.002);tone(o,t,'sine',660.5,660.5,0.5,0.25,0.002);tone(o,t,'sine',1317,1317,0.35,0.12,0.002);send(o,0.5);return t+0.7;}
  };
  /* ambients ------------------------------------------------ */
  function osc(A,type,f,gain,dest){const s=A.add(ctx.createOscillator());s.type=type;s.frequency.value=f;const g=ctx.createGain();g.gain.value=gain;s.connect(g);g.connect(dest||A.out);s.start(A.t0);return {s,g};}
  function nband(A,kind,ft,f,q,gain,lfoHz,lfoDepth){const n=A.noise(kind),b=ctx.createBiquadFilter(),g=ctx.createGain();b.type=ft;b.frequency.value=f;b.Q.value=q;g.gain.value=gain;n.connect(b);b.connect(g);g.connect(A.out);
    if(lfoHz){const l=A.add(ctx.createOscillator()),lg=ctx.createGain();l.frequency.value=lfoHz;lg.gain.value=lfoDepth;l.connect(lg);lg.connect(g.gain);l.start(A.t0);}return {b,g};}
  const AMB={
    'open-plan'(A){ /* fluorescent hum + distant printer + HVAC over a D minor drone */
      osc(A,'sine',100,0.10);osc(A,'sine',200,0.04);osc(A,'sawtooth',120,0.012);nband(A,'white','highpass',7000,0.7,0.012,0.13,0.006);
      const d=ctx.createBiquadFilter();d.type='lowpass';d.frequency.value=260;d.connect(A.out);
      [36.7,55,73.4].forEach((f,i)=>{const o=osc(A,'sawtooth',f+i*0.2,0.1,d);o.s.detune.value=i*4;});
      nband(A,'pink','lowpass',380,0.7,0.5,0.07,0.2);
      A.every(t=>{for(let i=0;i<6;i++){const n=ctx.createBufferSource(),b=ctx.createBiquadFilter(),g=ctx.createGain();n.buffer=Bus.nz('white');b.type='bandpass';b.frequency.value=700+A.rng()*300;b.Q.value=2;
        g.gain.setValueAtTime(E,t+i*0.16);g.gain.linearRampToValueAtTime(0.07,t+i*0.16+0.02);g.gain.exponentialRampToValueAtTime(E,t+i*0.16+0.13);n.connect(b);b.connect(g);g.connect(A.out);n.start(t+i*0.16,A.rng());n.stop(t+i*0.16+0.15);}},()=>7+A.rng()*6,2);
      A.send(0.5);},
    basement(A){ /* server fans + drips + low drones */
      nband(A,'pink','bandpass',320,2.5,0.7,0.3,0.15);nband(A,'white','bandpass',900,3,0.07);
      osc(A,'sine',176,0.03);osc(A,'sine',180,0.03);
      const d=ctx.createBiquadFilter();d.type='lowpass';d.frequency.value=180;d.connect(A.out);
      [36.7,43.65,55].forEach((f,i)=>{const o=osc(A,'sawtooth',f,0.12,d);o.s.detune.value=-i*5;const l=A.add(ctx.createOscillator()),lg=ctx.createGain();l.frequency.value=0.05+i*0.03;lg.gain.value=0.06;l.connect(lg);lg.connect(o.g.gain);l.start(A.t0);});
      A.every(t=>{const s=ctx.createOscillator(),g=ctx.createGain(),f=900+A.rng()*700;s.frequency.setValueAtTime(f,t);s.frequency.exponentialRampToValueAtTime(f*0.4,t+0.12);g.gain.setValueAtTime(E,t);g.gain.linearRampToValueAtTime(0.25,t+0.004);g.gain.exponentialRampToValueAtTime(E,t+0.15);s.connect(g);g.connect(A.out);s.start(t);s.stop(t+0.2);},()=>1.5+A.rng()*3.5,0.8);
      A.send(0.8);},
    lobby(A){ /* muffled elevator-music-like pad, warm, safe */
      const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=700;lp.Q.value=0.5;const pg=ctx.createGain();pg.gain.value=0.5;lp.connect(pg);pg.connect(A.out);
      osc(A,'sine',73.4,0.25);nband(A,'pink','lowpass',300,0.5,0.25);
      const ch=[[146.8,220,261.6,329.6],[130.8,196,246.9,329.6],[116.5,174.6,220,293.7],[130.8,196,261.6,329.6]];
      let k=0;A.every(t=>{const c=ch[k++%4];c.forEach((f,i)=>{const s=ctx.createOscillator(),g=ctx.createGain();s.type=i%2?'triangle':'sine';s.frequency.value=f;s.detune.value=(i-1.5)*4;
        g.gain.setValueAtTime(E,t);g.gain.linearRampToValueAtTime(0.16,t+1.4);g.gain.linearRampToValueAtTime(0.1,t+3);g.gain.exponentialRampToValueAtTime(E,t+4.4);s.connect(g);g.connect(lp);s.start(t);s.stop(t+4.5);});},()=>3.6,0);
      A.every(t=>{const f=[587,523,440,392,349][Math.floor(A.rng()*5)],s=ctx.createOscillator(),g=ctx.createGain();s.frequency.value=f;g.gain.setValueAtTime(E,t);g.gain.linearRampToValueAtTime(0.07,t+0.01);g.gain.exponentialRampToValueAtTime(E,t+1.6);s.connect(g);g.connect(lp);s.start(t);s.stop(t+1.7);},()=>1.8+A.rng()*1.2,1.2);
      A.send(0.7);}
  };
  const kit=makeKit(ctx,dest,cfg,S,AMB,opts);Bus=kit.bus;kit.name='Gothic office';return kit;
}
export default createSoundKit;
