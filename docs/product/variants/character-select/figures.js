/* ==================== FIGURES (exported, port to src/render/styles) ====================
   drawFacilitiesManager / drawSalesRep / drawITWizard (ctx, t, f, dim)
   ctx   : 2D context already translated to the FEET CENTRE and scaled (figure is ~97 units tall, y up = negative)
   t     : idle time in seconds (breathing, tricks)      f : "selected" flourish progress 0..1, or -1 for none
   dim   : 0 = full colour, 1 = near-silhouette (used for unselected / hidden classes)
   Style: C2 frozen look = flat fill + one shade, bold dark outline, 1 rim-light arc, oversized head. Palette in FIG_MATS.
   drawClassFigure(i,...) dispatches by class index 0 FM, 1 SR, 2 IT. No other globals are needed except the small helpers below. */
const FIG_OUTL='#0d0a1c';
const FIG_MATS={
 skin:'#f6c49c',ink:'#2a2547',white:'#ffffff',paper:'#ece4cf',steel:'#d3dcea',gold:'#ffb81f',
 fmSkin:'#c98a5e',fmBeard:'#2b1d17',fmPants:'#34456e',fmShirt:'#46618c',fmBoot:'#5a3a28',vest:'#ff8a1f',refl:'#e8eef5',hat:'#ffd23a',belt:'#6b4528',grip:'#d83a2c',steelD:'#8793ae',
 srSuit:'#e0457b',srTie:'#ffd23a',srHair:'#f2c14e',srShoe:'#f4ecd8',shirtW:'#fdf6e4',headset:'#232a58',mic:'#ff8a1f',stapler:'#d83a2c',card:'#fdf6e4',
 itHood:'#6a4cd0',itJeans:'#2c3a6a',itSkin:'#e8b48a',itHair:'#2a1a40',sneak:'#f4ecd8',sole:'#33e0ff',lapBody:'#8793ae',screenC:'#33e0ff',lens:'#c4ecff',cord2:'#ffe9b0',keyc:'#4c5280',cyan:'#33e0ff'};
const FIG_EMIS={screenC:1,cyan:1,sole:1};
function fmix(a,b,t){const h=s=>{s=s.replace('#','');const n=parseInt(s,16);return[(n>>16)&255,(n>>8)&255,n&255];},x=h(a),y=h(b);return'#'+((1<<24)+(Math.round(x[0]+(y[0]-x[0])*t)<<16)+(Math.round(x[1]+(y[1]-x[1])*t)<<8)+Math.round(x[2]+(y[2]-x[2])*t)).toString(16).slice(1);}
const FIG_C={};for(const k in FIG_MATS){const b=FIG_MATS[k];FIG_C[k]=[b,fmix(b,'#1b1038',.24),fmix(b,'#1b1038',.42),fmix(b,'#ffffff',.5)];}
let fc=null,fdim=0;const FOW=1.5,FTAU=Math.PI*2;
function fss(a,b,x){const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);}
function flr(a,b,t){return a+(b-a)*t;}
function fcol(m,sh){let v=FIG_C[m][sh|0];if(fdim>0&&!FIG_EMIS[m])v=fmix(v,'#171232',fdim*.88);else if(fdim>0)v=fmix(v,'#171232',fdim*.7);return v;}
function fE(x,y,rx,ry,m,sh,rot){fc.beginPath();fc.ellipse(x,y,Math.max(rx,.2),Math.max(ry,.2),rot||0,0,FTAU);fc.fillStyle=fcol(m,sh);fc.fill();fc.lineWidth=FOW;fc.lineJoin='round';fc.strokeStyle=FIG_OUTL;fc.stroke();
 if(!sh&&rx>3&&fdim<.3&&!FIG_EMIS[m]){fc.beginPath();fc.ellipse(x,y,rx*.8,ry*.8,rot||0,3.3,4.8);fc.strokeStyle=FIG_C[m][3];fc.lineWidth=.8;fc.lineCap='round';fc.stroke();fc.lineCap='butt';}}
function fP(a,m,sh){fc.beginPath();fc.moveTo(a[0],a[1]);for(let i=2;i<a.length;i+=2)fc.lineTo(a[i],a[i+1]);fc.closePath();fc.fillStyle=fcol(m,sh);fc.fill();fc.lineWidth=FOW;fc.lineJoin='round';fc.strokeStyle=FIG_OUTL;fc.stroke();}
function fL(x1,y1,x2,y2,w,m,sh){fc.lineCap='round';fc.beginPath();fc.moveTo(x1,y1);fc.lineTo(x2,y2);fc.strokeStyle=FIG_OUTL;fc.lineWidth=w+FOW*1.6;fc.stroke();fc.strokeStyle=fcol(m,sh);fc.lineWidth=w;fc.stroke();
 if(!sh&&w>4&&fdim<.3&&!FIG_EMIS[m]){fc.strokeStyle=FIG_C[m][3];fc.lineWidth=Math.max(.7,w*.16);fc.beginPath();fc.moveTo(x1-w*.25,y1-w*.25);fc.lineTo(x2-w*.25,y2-w*.25);fc.stroke();}fc.lineCap='butt';}
function fGlow(x,y,r,col,a){if(fdim>.5||a<=0)return;const g=fc.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');fc.save();fc.globalCompositeOperation='lighter';fc.globalAlpha=Math.min(1,a);fc.fillStyle=g;fc.fillRect(x-r,y-r,r*2,r*2);fc.restore();}
function fText(s,x,y,sz,col){fc.font='800 '+sz+'px "Trebuchet MS","Segoe UI",system-ui,sans-serif';fc.textAlign='center';fc.textBaseline='middle';fc.lineJoin='round';fc.lineWidth=sz*.3;fc.strokeStyle=FIG_OUTL;fc.strokeText(s,x,y);fc.fillStyle=col;fc.fillText(s,x,y);}
function fShadow(rx){fc.fillStyle='rgba(8,6,20,.42)';fc.beginPath();fc.ellipse(0,0,rx,rx*.28,0,0,FTAU);fc.fill();}
function fCard(x,y,ang,sc,al){fc.save();fc.translate(x,y);fc.rotate(ang);fc.scale(sc||1,sc||1);fc.globalAlpha=al==null?1:al;fP([-5,-3.2,5,-3.2,5,3.2,-5,3.2],'card',0);fc.fillStyle=fcol('srSuit',0);fc.fillRect(-3.4,-1.6,3.6,1);fc.fillRect(-3.4,.4,6.4,.8);fc.restore();}
function fKey(x,y,lab,sc,al){fc.save();fc.translate(x,y);fc.scale(sc,sc);fc.globalAlpha=al==null?1:al;fc.beginPath();fc.roundRect(-5.2,-4.6,10.4,9.2,2);fc.fillStyle=fcol('keyc',0);fc.fill();fc.lineWidth=1.3;fc.strokeStyle=FIG_OUTL;fc.stroke();fc.fillStyle=fdim>.3?'#171232':'#33e0ff';fc.font='800 4.6px "Trebuchet MS",system-ui,sans-serif';fc.textAlign='center';fc.textBaseline='middle';fc.fillText(lab,0,.4);fc.restore();}

/* ---- Facilities Manager: heavy, tanky; hi-vis vest, hard hat, toolbelt, big wrench. Flourish: wrench slam + shockwave ---- */
function drawFacilitiesManager(ctx,t,f,dim){
 fc=ctx;fdim=dim||0;const bob=Math.sin(t*2.4)*1.1,fl=f>=0;
 let hx=19,hy=-47+bob,th=-1.25+Math.sin(t*1.3)*.03,lean=0;
 if(fl){const a=fss(0,.28,f),b=fss(.28,.4,f),c=fss(.72,1,f),R=[19,-47+bob,-1.25],U=[12,-90,-2.15],S=[22,-34,.9];
  const m=(p,q,k)=>[flr(p[0],q[0],k),flr(p[1],q[1],k),flr(p[2],q[2],k)];let k=m(R,U,a);k=m(k,S,b);k=m(k,R,c);hx=k[0];hy=k[1];th=k[2];lean=b*(1-c)*3.2;}
 fShadow(24);
 fL(-7,-30,-8,-4,10,'fmPants',1);fE(-9,-2.5,8,4,'fmBoot',1);fL(7,-30,8,-4,10,'fmPants',0);fE(9.5,-2.5,8.5,4,'fmBoot',0);
 fc.save();fc.translate(lean,0);
 fP([-14,-64+bob,14,-64+bob,12.5,-28,-12.5,-28],'fmShirt',1);
 fP([-14,-64+bob,-4.5,-64+bob,-4,-28,-12.5,-28],'vest',0);fP([4.5,-64+bob,14,-64+bob,12.5,-28,4,-28],'vest',0);
 fP([-13.6,-53+bob*.5,-4.4,-53+bob*.5,-4.3,-48.5,-13.4,-48.5],'refl',0);fP([4.3,-53+bob*.5,13.6,-53+bob*.5,13.4,-48.5,4.2,-48.5],'refl',0);
 fP([-13.1,-43,-4.2,-43,-4.1,-38.8,-13,-38.8],'refl',0);fP([4.1,-43,13.1,-43,13,-38.8,4.1,-38.8],'refl',0);
 fP([-14,-64+bob,-9,-64+bob,-10,-55,-14,-56],'refl',0);fP([9,-64+bob,14,-64+bob,14,-56,10,-55],'refl',0);
 fP([-13,-33,13,-33,13,-27.5,-13,-27.5],'belt',0);fP([-2.6,-32.4,2.6,-32.4,2.6,-28.2,-2.6,-28.2],'gold',0);
 fP([-12.5,-27.5,-6,-27.5,-6.4,-18.5,-12,-18.5],'belt',1);fL(-9,-27,-9.4,-17.5,2.4,'steelD',1);
 fL(8.6,-27.5,9.4,-17,2.8,'steelD',1);fL(11.4,-27.5,12.6,-19,2.2,'grip',1);fE(12.8,-22.6,2.7,2.7,'gold',1);
 fL(1,-67+bob,1,-60+bob,8.5,'fmSkin',1);
 fL(-14,-61+bob,-19,-40+bob*.5,8.6,'fmShirt',1);fE(-19.5,-36.5,4.4,4.4,'fmSkin',1);
 const hy0=-77+bob*.8;
 fE(1,hy0+6,10.6,9.6,'fmBeard',0);fE(1,hy0-.6,10.6,10.4,'fmSkin',0);
 fE(1,hy0+4.2,5.6,2,'fmBeard',0);fL(-1.2,hy0+7.4,3.6,hy0+7.4,1.3,'ink',0);
 fE(-10,hy0+.5,2.3,3,'fmSkin',1);fE(12,hy0+.5,2.3,3,'fmSkin',1);
 fE(-3.5,hy0-1.5,1.5,1.9,'ink',0);fE(5.5,hy0-1.5,1.5,1.9,'ink',0);fL(-6.4,hy0-5.3,-1.4,hy0-4.4,1.5,'fmBeard',0);fL(3.4,hy0-4.4,8.4,hy0-5.3,1.5,'fmBeard',0);
 fE(1,hy0-7.6,12,8.2,'hat',0);fP([-12.8,hy0-6.6,14.8,hy0-6.6,15.4,hy0-3.8,-13.4,hy0-3.8],'hat',1);fE(1,hy0-14.4,2.6,1.7,'hat',2);
 fc.restore();
 fL(14+lean,-61+bob,hx,hy,8.6,'fmShirt',0);fE(hx,hy,4.7,4.7,'fmSkin',0);
 const cs=Math.cos(th),sn=Math.sin(th),pt=(d,w)=>[hx+cs*d-sn*w,hy+sn*d+cs*w];
 const q=(d0,d1,w,m,sh)=>{const a=pt(d0,-w),b=pt(d1,-w),c=pt(d1,w),e=pt(d0,w);fP([a[0],a[1],b[0],b[1],c[0],c[1],e[0],e[1]],m,sh);};
 q(-9,36,2.4,'steel',0);q(-9,9,3.1,'grip',0);
 const hd=pt(41,0);fE(hd[0],hd[1],7.4,7.4,'steel',0);const n1=pt(40,-2.8),n2=pt(52,-2.8),n3=pt(52,2.8),n4=pt(40,2.8);fP([n1[0],n1[1],n2[0],n2[1],n3[0],n3[1],n4[0],n4[1]],'ink',0);
 if(fl&&f>.38){const s=(f-.38)/.62,tx=hd[0]+2,al=1-s;
  fc.save();fc.globalAlpha=Math.max(0,al);fc.lineWidth=3.2;fc.strokeStyle=FIG_OUTL;fc.beginPath();fc.ellipse(47,-1,8+s*62,(8+s*62)*.28,0,0,FTAU);fc.stroke();fc.lineWidth=1.6;fc.strokeStyle='#ffd23a';fc.stroke();
  fc.lineWidth=2;fc.strokeStyle='#fff3a0';fc.beginPath();fc.ellipse(47,-1,4+s*44,(4+s*44)*.28,0,0,FTAU);fc.stroke();
  for(let k=0;k<8;k++){const an=k/8*FTAU+.4,r=10+s*52,x=47+Math.cos(an)*r,y=-2+Math.sin(an)*r*.3-s*(10+(k&1)*8)*(1-s)*2.6;fP([x,y-3,x+2,y,x,y+3,x-2,y],'gold',0);}
  fc.restore();fGlow(47,-4,40,'#ffb81f',.5*Math.max(0,1-s*2.5));}
}

/* ---- Sales Rep: ranged, agile; sharp pink suit, quiff, headset, throws cards and staplers. Flourish: fan-throw ---- */
function drawSalesRep(ctx,t,f,dim){
 fc=ctx;fdim=dim||0;const bob=Math.sin(t*2.8+1)*1,sw=Math.sin(t*1.5)*1.4,fl=f>=0;
 fShadow(19);
 const th=fl?fss(0,.22,f)*(1-fss(.22,.36,f)):0,sn=fl?fss(.22,.36,f):0; /* wind-up, throw */
 fL(-5,-30,-6,-4,7.6,'srSuit',1);fE(-7.5,-2.4,7.5,3.2,'srShoe',1);fL(5,-30,7+sw*.3,-4,7.6,'srSuit',0);fE(10+sw*.3,-2.4,8,3.2,'srShoe',0);
 fc.save();fc.translate(sw*.3-sn*1.5+th*1.5,0);
 fP([-11,-62+bob,11,-62+bob,8.4,-27,-8.4,-27],'srSuit',0);
 fP([-3.8,-62+bob,3.8,-62+bob,0,-40],'shirtW',0);fP([0,-60+bob,2.2,-57,1.5,-43,0,-39,-1.5,-43,-2.2,-57],'srTie',0);
 fP([-10.6,-61+bob,-3.6,-62+bob,-.4,-43,-4.8,-39],'srSuit',2);fP([10.6,-61+bob,3.6,-62+bob,.4,-43,4.8,-39],'srSuit',2);
 fP([5.2,-52,8.6,-52,8.6,-49.6,5.2,-49.6],'shirtW',0);fL(-5,-30,5,-30,1.4,'srSuit',2);
 fL(-11,-60+bob,-17.5,-44,6.2,'srSuit',1);fE(-19,-40.5,3.5,3.5,'skin',1);
 const u=(t*.8)%1;if(!fl||f>.5){fCard(-19,-44-Math.sin(u*Math.PI)*15,u*FTAU,1.1,fl?1:1);}
 fCard(-21,-44,-.5,1);fCard(-18,-44,.15,1);
 fL(0,-67+bob,0,-61+bob,6.5,'skin',1);
 const hy=-76+bob*.8;
 fE(-.5,hy-5,10.6,7.6,'srHair',1);fE(0,hy,9.9,10.6,'skin',0);
 fP([-10,hy-5.2,-6,hy-15.5,3,hy-18,11.5,hy-13,12.2,hy-6,6,hy-9,-2,hy-9.4],'srHair',0);
 fE(-3.4,hy-.6,1.4,1.8,'ink',0);
 const wink=fl&&f>.2&&f<.7;if(wink)fL(3,hy-.4,6.6,hy-.9,1.6,'ink',0);else fE(5.2,hy-.6,1.4,1.8,'ink',0);
 fL(-6,hy-4.2,-1.8,hy-4.6,1.4,'srHair',2);fL(2.8,hy-4.8,7.4,hy-4.2,1.4,'srHair',2);
 fc.beginPath();fc.moveTo(-2.5,hy+5);fc.quadraticCurveTo(1.4,hy+7.4,5.6,hy+4.2);fc.lineWidth=1.5;fc.strokeStyle=FIG_OUTL;fc.stroke();
 fc.beginPath();fc.arc(0,hy+.5,10.9,Math.PI*1.12,Math.PI*1.88);fc.lineWidth=4;fc.strokeStyle=FIG_OUTL;fc.stroke();fc.lineWidth=2.2;fc.strokeStyle=fcol('headset',0);fc.stroke();
 fE(-10,hy+1.4,3.2,4.2,'headset',0);fL(-10.2,hy+5,-4.4,hy+8.6,1.5,'headset',0);fE(-3.8,hy+8.8,2.2,1.7,'mic',0);
 fc.restore();
 /* right arm + stapler */
 let ax=17,ay=-44,sa=-.12;
 if(fl){const w=th,s=sn;ax=flr(17,24,w);ay=flr(-44,-62,w);ax=flr(ax,13,s);ay=flr(ay,-52,s);sa=flr(-.12,-1.2,w);}
 else{ay=-44-Math.sin((t*1.2)%1*Math.PI)*1.5;}
 fL(11,-60+bob,ax,ay,6.2,'srSuit',0);fE(ax+.5,ay+.5,3.5,3.5,'skin',0);
 if(!fl||f<.3){fc.save();fc.translate(ax+1,ay-1);fc.rotate(sa);fP([-2,-4,13,-6,14,-2,-1,1],'stapler',0);fP([-2,-4,13,-6,13.4,-4.4,-1.6,-2],'steelD',1);fL(-1,.4,13,-1.6,1.6,'steelD',1);fc.restore();}
 if(fl&&f>.28){const s=(f-.28)/.62,ke=fss(0,1,s);
  for(let k=0;k<5;k++){const an=(k-2)*.3,d=ke*(95+(k&1?10:0)),x=17+Math.cos(an)*d,y=-56+Math.sin(an)*d*.9+ke*10-ke*(1-ke)*-6,al=Math.max(0,1-fss(.55,1,s));
   fc.save();fc.globalAlpha=al*.5;fc.strokeStyle='#fff3a0';fc.lineWidth=1.2;fc.beginPath();fc.moveTo(17+Math.cos(an)*d*.55,-56+Math.sin(an)*d*.55*.9);fc.lineTo(x,y);fc.stroke();fc.restore();
   if(k===2){fc.save();fc.translate(x,y);fc.rotate(s*14);fc.globalAlpha=al;fP([-6,-3,6,-4,7,0,-5,2],'stapler',0);fP([-6,-3,6,-4,6.4,-2.4,-5.6,-1],'steelD',1);fc.restore();}
   else fCard(x,y,s*(10+k)+k,1.15,al);}
  const b=Math.max(0,1-s*3);fGlow(ax+4,ay-2,22,'#ffd23a',b*.9);
  if(b>0){fc.save();fc.globalAlpha=b;for(let k=0;k<4;k++){const an=k*1.57+.7,r=6+(1-b)*10;fP([ax+4+Math.cos(an)*r,ay-2+Math.sin(an)*r-3,ax+6+Math.cos(an)*r,ay-2+Math.sin(an)*r,ax+4+Math.cos(an)*r,ay-2+Math.sin(an)*r+3,ax+2+Math.cos(an)*r,ay-2+Math.sin(an)*r],'gold',0);}fc.restore();}}
}

/* ---- IT Wizard: caster; hoodie, round glasses, glowing laptop, floating keycaps. Flourish: "Reboot" spell circle + power glyph ---- */
function drawITWizard(ctx,t,f,dim){
 fc=ctx;fdim=dim||0;const bob=Math.sin(t*2.2+2)*1.2,fl=f>=0,pulse=.5+.5*Math.sin(t*3);
 const a=fl?fss(0,.25,f):0,out=fl?1-fss(.75,1,f):1;
 if(fl&&f<.95){const r=40*fss(0,.25,f)*(0.9+.1*Math.sin(f*30)),al=Math.max(0,1-fss(.7,.98,f));
  fc.save();fc.globalAlpha=al;fc.strokeStyle=FIG_OUTL;fc.lineWidth=4;fc.beginPath();fc.ellipse(0,-1,r,r*.3,0,0,FTAU);fc.stroke();fc.strokeStyle='#33e0ff';fc.lineWidth=1.8;fc.stroke();
  fc.beginPath();fc.ellipse(0,-1,r*.7,r*.21,0,0,FTAU);fc.lineWidth=1.2;fc.stroke();
  for(let k=0;k<10;k++){const an=k/10*FTAU+f*5,x=Math.cos(an)*r*.85,y=-1+Math.sin(an)*r*.85*.3;fc.fillStyle='#bff7ff';fc.fillRect(x-1.2,y-1.2,2.4,2.4);}
  const g=fc.createLinearGradient(0,-1,0,-100);g.addColorStop(0,'rgba(51,224,255,.5)');g.addColorStop(1,'rgba(51,224,255,0)');fc.fillStyle=g;fc.beginPath();fc.ellipse(0,-1,r*.8,r*.24,0,0,FTAU);fc.lineTo(r*.5,-100);fc.lineTo(-r*.5,-100);fc.closePath();fc.globalCompositeOperation='lighter';fc.globalAlpha=al*.5*Math.sin(Math.min(1,f*1.6)*Math.PI);fc.fill();fc.restore();}
 fShadow(21);
 fL(-6,-28,-7,-4,8.2,'itJeans',1);fE(-8,-2.5,7.5,3.6,'sneak',1);fE(-8,.2,7.6,1.5,'sole',1);fL(6,-28,7,-4,8.2,'itJeans',0);fE(9,-2.5,8,3.6,'sneak',0);fE(9,.2,8,1.5,'sole',1);
 fE(0,-65+bob,13.5,5.5,'itHood',1);
 fP([-13,-62+bob,13,-62+bob,13.8,-26,-13.8,-26],'itHood',0);fP([-13.8,-29,13.8,-29,13.8,-25.6,-13.8,-25.6],'itHood',2);
 fP([-8.5,-41,8.5,-41,10.5,-30,-10.5,-30],'itHood',2);fL(-3.2,-61+bob,-3.8,-49,1.8,'cord2',0);fL(3.2,-61+bob,3.8,-49,1.8,'cord2',0);
 fL(0,-69+bob,0,-62+bob,6.5,'itSkin',1);
 /* laptop in left hand, screen facing the viewer */
 fL(-13,-60+bob,-22,-42,8.2,'itHood',1);
 const lg=.38+pulse*.12+(fl?.5*Math.sin(Math.min(1,f*3)*Math.PI):0);
 fGlow(-27,-55,34,'#33e0ff',lg);
 fP([-40,-68,-14,-68,-14,-44,-40,-44],'lapBody',0);fP([-38,-66,-16,-66,-16,-46,-38,-46],'screenC',0);
 fc.fillStyle='#0d0a1c';fc.font='800 6px Consolas,monospace';fc.textAlign='left';fc.textBaseline='middle';
 if(fdim<.5){fc.fillStyle='#0b3d52';for(let k=0;k<4;k++)fc.fillRect(-35,-62+k*4.4,[10,16,7,13][k],1.8);fc.fillText('>_',-35,-48.6);fc.fillStyle='#0b3d52';fc.fillRect(-26,-50.5,2.2,3.4*(Math.sin(t*5)>0?1:0));}
 fP([-41,-44,-13,-44,-10,-40.2,-38,-40.2],'lapBody',1);fE(-22,-37.5,4.2,4.2,'itSkin',1);
 /* head */
 const hy=-77+bob*.8;
 fE(0,hy,10,10.8,'itSkin',0);
 fP([-10.6,hy-2,-9,hy-11,-4,hy-13.8,-2,hy-18,2,hy-13.8,7,hy-16,10,hy-9,10.8,hy-2,6,hy-7,0,hy-8,-6,hy-6.6],'itHair',0);
 fE(-4.4,hy+.2,4.1,4.1,'lens',0);fE(4.6,hy+.2,4.1,4.1,'lens',0);fL(-.4,hy-.2,.6,hy-.2,1.2,'ink',0);
 fE(-4.2,hy+.6,1.4,1.6,'ink',0);fE(4.4,hy+.6,1.4,1.6,'ink',0);fE(-5.6,hy-1.2,.9,.9,'white',0);fE(3.2,hy-1.2,.9,.9,'white',0);
 fc.beginPath();fc.moveTo(-3,hy+6.6);fc.quadraticCurveTo(0,hy+8.4,3.6,hy+6.2);fc.lineWidth=1.4;fc.strokeStyle=FIG_OUTL;fc.stroke();
 /* right arm conjuring */
 const rx=flr(23,19,a),ry=flr(-55+Math.sin(t*2)*1.6,-86,a);
 fL(13,-60+bob,rx,ry,8.2,'itHood',0);fE(rx,ry,4.4,4.4,'itSkin',0);
 for(let k=0;k<3;k++)fL(rx-2.4+k*2.4,ry-3,rx-2.8+k*2.8,ry-8.4,1.7,'itSkin',0);
 const labs=['F5','Esc','Alt','Ctrl'],orb=fl?f*7:0;
 for(let k=0;k<4;k++){const an=t*1.5+k*1.57+orb,cx0=rx+2,cy0=ry-18,rr=fl?13+f*26*(f>.5?1.5:1):13;
  const x=cx0+Math.cos(an)*rr,y=cy0+Math.sin(an)*rr*.38-(fl?fss(.3,.8,f)*20:0),dp=Math.sin(an);
  if(dp<0||fl)fKey(x,y,labs[k],.85+dp*.2,fl?out:1);}
 for(let k=0;k<4;k++){const an=t*1.5+k*1.57+orb;if(Math.sin(an)>=0&&!fl){const x=rx+2+Math.cos(an)*13,y=ry-18+Math.sin(an)*13*.38;fKey(x,y,labs[k],1.05,1);}}
 if(fl&&f>.2){const s=fss(.2,.45,f),al=out*Math.min(1,s*2),cx0=0,cy0=-118+(1-s)*10;
  fc.save();fc.globalAlpha=al;fc.translate(cx0,cy0);fc.scale(.6+s*.5,.6+s*.5);fc.lineCap='round';
  fc.beginPath();fc.arc(0,0,9,-Math.PI*.3,Math.PI*1.3,false);fc.moveTo(0,-11);fc.lineTo(0,-1);fc.lineWidth=7;fc.strokeStyle=FIG_OUTL;fc.stroke();fc.lineWidth=3.2;fc.strokeStyle='#bff7ff';fc.stroke();fc.restore();
  fGlow(0,-118,34,'#33e0ff',al*.6);}
}
function drawClassFigure(i,ctx,t,f,dim){(i===0?drawFacilitiesManager:i===1?drawSalesRep:drawITWizard)(ctx,t,f,dim);}
/* ==================== END FIGURES ==================== */
