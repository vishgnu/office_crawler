// Sound kit C (Foley-synth), lifted unchanged in sound from docs/product/variants/sound-direction/C.html.
// createSoundKit(ctx, destination[, {seed}]): kit.play(id, when) -> end time; kit.startAmbient(zone, when[, {duration}]) -> {stop(when)};
// kit.setVolume('master'|'sfx'|'ambient', 0..1); kit.setMuted(bool); kit.sfxIds; kit.zones. Pure Web Audio, no DOM.
import { bindKit } from "./common.js";
const KIT_TRIM = {"sfx":{"swing":1.92752,"hitFlesh":0.63826,"hitPaper":0.66069,"miss":3.23594,"hurtZombie":1.97242,"hurtImp":3.0903,"hurtManager":2.11349,"deathZombie":1.8197,"deathImp":2.13796,"deathManager":0.69184,"heroHurt":1.05925,"heartbeat":0.83176,"potion":0.86099,"coin":1.41254,"pickupItem":1.94984,"pickupRare":1.39637,"pickupUnique":1.08392,"levelUp":0.95499,"castStapler":1.36457,"castReplyAll":1.84077,"castCoffee":1.41254,"castMute":0.82224,"uiClick":1.01158,"uiOpen":1.12202,"uiEquip":0.90157,"stairs":2.01836,"ding":0.92257},"amb":{"open-plan":0.31989,"basement":0.302,"lobby":0.16788}};
const { makeKit } = bindKit(KIT_TRIM);

export function createSoundKit(ctx,dest,opts){
  const cfg={id:'C',reverb:{times:[0.0191,0.0293,0.0371,0.0437],fb:0.55,damp:4200,wet:0.55,width:0.7}};
  const E=0.0001;let Bus=null;
  function tone(o,t,f0,f1,dur,pk,att,type){const s=ctx.createOscillator(),g=ctx.createGain();s.type=type||'sine';s.frequency.setValueAtTime(f0,t);if(f1&&f1!==f0)s.frequency.exponentialRampToValueAtTime(f1,t+dur);
    g.gain.setValueAtTime(E,t);g.gain.linearRampToValueAtTime(pk,t+(att||0.004));g.gain.exponentialRampToValueAtTime(E,t+dur);s.connect(g);g.connect(o);s.start(t);s.stop(t+dur+0.03);}
  function noise(o,t,dur,pk,ft,f0,f1,q,att,kind){const s=ctx.createBufferSource(),b=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=Bus.nz(kind||'white');s.loop=true;b.type=ft;b.Q.value=q||1;b.frequency.setValueAtTime(f0,t);
    if(f1&&f1!==f0)b.frequency.exponentialRampToValueAtTime(f1,t+dur);att=att||0.003;g.gain.setValueAtTime(E,t);g.gain.linearRampToValueAtTime(pk,t+att);g.gain.exponentialRampToValueAtTime(E,t+dur);
    s.connect(b);b.connect(g);g.connect(o);s.start(t,(t*5.77)%1);s.stop(t+dur+0.03);}
  /* FM click/tick: carrier + modulator, 4 nodes */
  function fm(o,t,fc,ratio,idx,dur,pk){const c=ctx.createOscillator(),m=ctx.createOscillator(),mg=ctx.createGain(),g=ctx.createGain();c.frequency.value=fc;m.frequency.value=fc*ratio;
    mg.gain.setValueAtTime(fc*idx,t);mg.gain.exponentialRampToValueAtTime(1,t+dur*0.8);g.gain.setValueAtTime(E,t);g.gain.linearRampToValueAtTime(pk,t+0.002);g.gain.exponentialRampToValueAtTime(E,t+dur);
    m.connect(mg);mg.connect(c.frequency);c.connect(g);g.connect(o);c.start(t);m.start(t);c.stop(t+dur+0.03);m.stop(t+dur+0.03);}
  /* bell bank: one shared modulator (constant index in Hz), many carriers */
  function bank(o,t,notes,ratio,idx,dur,pk){const m=ctx.createOscillator(),mg=ctx.createGain();m.frequency.value=notes[0][0]*ratio;mg.gain.value=idx;m.connect(mg);m.start(t);m.stop(t+dur+notes.length*0.12);
    notes.forEach(([f,d])=>{const c=ctx.createOscillator(),g=ctx.createGain();c.frequency.value=f;mg.connect(c.frequency);g.gain.setValueAtTime(E,t+d);g.gain.linearRampToValueAtTime(pk,t+d+0.003);g.gain.exponentialRampToValueAtTime(E,t+d+dur);c.connect(g);g.connect(o);c.start(t+d);c.stop(t+d+dur+0.03);});}
  function vox(o,t,f0,f1,dur,pk,fa,fb,type){const s=ctx.createOscillator(),e=ctx.createGain(),a=ctx.createBiquadFilter(),b=ctx.createBiquadFilter(),ga=ctx.createGain(),gb=ctx.createGain();
    s.type=type||'sawtooth';s.frequency.setValueAtTime(f0,t);s.frequency.exponentialRampToValueAtTime(f1,t+dur);a.type=b.type='bandpass';a.Q.value=b.Q.value=5;
    a.frequency.setValueAtTime(fa,t);a.frequency.exponentialRampToValueAtTime(fa*0.65,t+dur);b.frequency.setValueAtTime(fb,t);b.frequency.exponentialRampToValueAtTime(fb*0.7,t+dur);gb.gain.value=0.5;
    e.gain.setValueAtTime(E,t);e.gain.linearRampToValueAtTime(pk,t+0.04);e.gain.setTargetAtTime(E,t+dur*0.5,dur*0.2);s.connect(e);e.connect(a);e.connect(b);a.connect(ga);b.connect(gb);ga.connect(o);gb.connect(o);s.start(t);s.stop(t+dur+0.05);}
  function send(o,l){if(Bus.rvIn){const g=ctx.createGain();g.gain.value=l;o.connect(g);g.connect(Bus.rvIn);}}
  const S={
    swing(o,t){noise(o,t,0.3,0.5,'bandpass',500,2300,1.2,0.12);noise(o,t,0.25,0.2,'highpass',3500,5500,0.5,0.1);send(o,0.1);return t+0.35;},
    hitFlesh(o,t){noise(o,t,0.12,0.7,'lowpass',900,220,0.8);tone(o,t,120,55,0.14,0.8);fm(o,t,900,1.41,1.5,0.025,0.5);send(o,0.15);return t+0.3;},
    hitPaper(o,t){noise(o,t,0.14,0.8,'highpass',3000,6500,0.6);noise(o,t+0.045,0.12,0.8,'bandpass',2200,3200,2);fm(o,t,2600,2.3,1.2,0.02,0.15);send(o,0.1);return t+0.25;},
    miss(o,t){noise(o,t,0.22,0.3,'bandpass',450,1500,1,0.09);noise(o,t,0.18,0.12,'highpass',3000,4500,0.5,0.08);send(o,0.08);return t+0.3;},
    hurtZombie(o,t){vox(o,t,88,66,0.5,0.7,600,1050);noise(o,t,0.4,0.15,'bandpass',900,500,1.5,0.1,'pink');send(o,0.15);return t+0.6;},
    hurtImp(o,t){vox(o,t,420,760,0.26,0.4,1700,3000,'sawtooth');fm(o,t,1200,1.5,2,0.2,0.2);send(o,0.15);return t+0.4;},
    hurtManager(o,t){vox(o,t,125,98,0.35,0.7,650,1150);noise(o,t,0.12,0.25,'bandpass',1200,500,1);send(o,0.15);return t+0.5;},
    deathZombie(o,t){vox(o,t,92,48,0.85,0.7,550,950);noise(o,t+0.25,0.5,0.2,'bandpass',800,200,1.5,0.15,'pink');send(o,0.2);return t+0.95;},
    deathImp(o,t){vox(o,t,820,160,0.7,0.4,1900,3100);noise(o,t+0.5,0.25,0.5,'bandpass',2500,500,1);send(o,0.2);return t+0.95;},
    deathManager(o,t){vox(o,t,130,62,0.75,0.7,650,1100);tone(o,t+0.55,70,35,0.35,0.9);send(o,0.2);return t+0.95;},
    heroHurt(o,t){tone(o,t,130,70,0.18,0.7);vox(o,t,230,150,0.22,0.35,800,1300);send(o,0.12);return t+0.35;},
    heartbeat(o,t){tone(o,t,72,42,0.2,1);tone(o,t+0.28,64,38,0.22,0.8);noise(o,t,0.08,0.18,'lowpass',160,90,1);noise(o,t+0.28,0.08,0.14,'lowpass',160,90,1);send(o,0.12);return t+0.55;},
    potion(o,t){noise(o,t,0.36,0.35,'bandpass',300,1500,12,0.08,'pink');[0.06,0.2].forEach((d,i)=>tone(o,t+d,380+i*90,900+i*100,0.07,0.25));tone(o,t+0.4,300,100,0.14,0.7);send(o,0.1);return t+0.6;},
    coin(o,t){fm(o,t,2400,1.4,1.8,0.3,0.4);fm(o,t+0.075,3100,1.4,1.8,0.34,0.35);send(o,0.2);return t+0.5;},
    pickupItem(o,t){noise(o,t,0.12,0.35,'bandpass',1200,500,1.5,0.03);fm(o,t+0.05,1800,2.76,1.5,0.18,0.3);tone(o,t,200,120,0.1,0.4);send(o,0.15);return t+0.35;},
    pickupRare(o,t){bank(o,t,[[1319,0],[1760,0.07],[2217,0.14],[2637,0.21]],3.5,300,0.5,0.28);send(o,0.3);return t+0.8;},
    pickupUnique(o,t){bank(o,t,[[784,0],[1175,0.09],[1568,0.18],[2349,0.27]],3.5,350,0.6,0.28);send(o,0.35);return t+0.9;},
    levelUp(o,t){bank(o,t,[[523,0],[659,0.1],[784,0.2],[1047,0.3]],2,250,0.6,0.35);send(o,0.3);return t+0.95;},
    castStapler(o,t){fm(o,t,1500,1.9,2,0.04,0.35);noise(o,t,0.02,0.3,'highpass',3500,3500);noise(o,t+0.04,0.24,0.9,'bandpass',900,3000,1.2,0.06);send(o,0.1);return t+0.35;},
    castReplyAll(o,t){bank(o,t,[[1568,0],[1319,0.06],[1760,0.12],[1480,0.18]],1.5,150,0.14,0.3);send(o,0.1);return t+0.4;},
    castCoffee(o,t){noise(o,t,0.4,0.3,'bandpass',1200,900,6,0.05,'pink');[262,330,392].forEach((f,i)=>tone(o,t+0.12+i*0.07,f,f*1.01,0.55,0.25,0.08));send(o,0.15);return t+0.8;},
    castMute(o,t){noise(o,t,0.4,0.5,'lowpass',3000,90,1.5,0.02);tone(o,t,100,45,0.4,0.7);tone(o,t,300,80,0.25,0.15);send(o,0.1);return t+0.5;},
    uiClick(o,t){fm(o,t,1700,2.3,1.5,0.035,0.6);return t+0.1;},
    uiOpen(o,t){noise(o,t,0.28,0.5,'bandpass',300,800,6,0.08);tone(o,t+0.27,140,70,0.12,0.5);noise(o,t+0.27,0.08,0.4,'lowpass',900,300,1);send(o,0.12);return t+0.45;},
    uiEquip(o,t){fm(o,t,2200,2.76,1.2,0.2,0.5);noise(o,t,0.03,0.15,'highpass',3500,3500);tone(o,t,170,80,0.14,0.4);send(o,0.12);return t+0.35;},
    stairs(o,t){for(let i=0;i<3;i++)noise(o,t+i*0.2,0.18,0.9,'lowpass',700,180,1,0.01);send(o,0.25);return t+0.7;},
    ding(o,t){bank(o,t,[[988,0],[1480,0]],2.01,40,0.9,0.4);send(o,0.3);return t+0.95;}
  };
  /* ambients: subtle tonal beds ---------------------------- */
  function osc(A,f,gain,dest,type){const s=A.add(ctx.createOscillator());s.type=type||'sine';s.frequency.value=f;const g=ctx.createGain();g.gain.value=gain;s.connect(g);g.connect(dest||A.out);s.start(A.t0);return {s,g};}
  function lfo(A,hz,depth,param){const l=A.add(ctx.createOscillator()),g=ctx.createGain();l.frequency.value=hz;g.gain.value=depth;l.connect(g);g.connect(param);l.start(A.t0);}
  function nband(A,kind,ft,f,q,gain){const n=A.noise(kind),b=ctx.createBiquadFilter(),g=ctx.createGain();b.type=ft;b.frequency.value=f;b.Q.value=q;g.gain.value=gain;n.connect(b);b.connect(g);g.connect(A.out);return {b,g};}
  const AMB={
    'open-plan'(A){
      osc(A,100,0.08);osc(A,100.8,0.05);osc(A,200,0.03);osc(A,300,0.012);nband(A,'white','highpass',6500,0.5,0.01);
      const hv=nband(A,'pink','bandpass',500,0.6,0.5);lfo(A,0.09,0.15,hv.g.gain);
      osc(A,73.4,0.1);osc(A,110,0.05);
      A.every(t=>{for(let i=0;i<5;i++){const x=t+i*0.22,n=ctx.createBufferSource(),b=ctx.createBiquadFilter(),g=ctx.createGain();n.buffer=Bus.nz('pink');b.type='lowpass';b.frequency.value=700;
        g.gain.setValueAtTime(E,x);g.gain.linearRampToValueAtTime(0.14,x+0.03);g.gain.exponentialRampToValueAtTime(E,x+0.18);n.connect(b);b.connect(g);g.connect(A.out);n.start(x,A.rng()*2);n.stop(x+0.2);}},()=>8+A.rng()*6,2);
      A.send(0.2);},
    basement(A){
      const f=nband(A,'pink','bandpass',260,1.8,0.9);lfo(A,0.35,0.15,f.g.gain);nband(A,'white','bandpass',1100,3,0.06);
      const bp=osc(A,187,0.04);lfo(A,0.5,3,bp.s.frequency);osc(A,55,0.12);osc(A,82.9,0.07);
      A.every(t=>{const s=ctx.createOscillator(),g=ctx.createGain(),f=1100+A.rng()*500;s.frequency.setValueAtTime(f,t);s.frequency.exponentialRampToValueAtTime(f*0.55,t+0.07);
        g.gain.setValueAtTime(E,t);g.gain.linearRampToValueAtTime(0.28,t+0.003);g.gain.exponentialRampToValueAtTime(E,t+0.1);s.connect(g);g.connect(A.out);s.start(t);s.stop(t+0.12);},()=>1.4+A.rng()*3.5,0.6);
      A.send(0.5);},
    lobby(A){
      nband(A,'pink','lowpass',350,0.5,0.5);osc(A,65.4,0.2);
      const ch=[[261.6,329.6,392,493.9],[220,261.6,329.6,392],[174.6,261.6,349.2,440],[196,246.9,293.7,392]];let k=0;
      A.every(t=>{const c=ch[k++%4];c.forEach((f,i)=>{const x=t+i*0.04,m=ctx.createOscillator(),mg=ctx.createGain(),s=ctx.createOscillator(),g=ctx.createGain();s.frequency.value=f;m.frequency.value=f;
        mg.gain.setValueAtTime(f*0.6,x);mg.gain.exponentialRampToValueAtTime(1,x+1.5);m.connect(mg);mg.connect(s.frequency);
        g.gain.setValueAtTime(E,x);g.gain.linearRampToValueAtTime(0.1,x+0.01);g.gain.exponentialRampToValueAtTime(E,x+3.4);s.connect(g);g.connect(A.out);s.start(x);m.start(x);s.stop(x+3.5);m.stop(x+3.5);});},()=>3.2,0);
      A.send(0.4);}
  };
  const kit=makeKit(ctx,dest,cfg,S,AMB,opts);Bus=kit.bus;kit.name='Foley-synth';return kit;
}
export default createSoundKit;
