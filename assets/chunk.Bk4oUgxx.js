import{s as ge,b as he,r as Do,l as Oo,p as j,m as z,c as Ro,e as Fe,f as xe,h as ye,d as F}from"./chunk.BGKPjTnH.js";import{t as Se,a as we,l as Pe,n as Wo,b as Go,c as No,d as L,f as ke,s as no,g as Ae,i as Uo,p as Ce,h as _e}from"./chunk.c0sqycNy.js";const u=.62,c=2,ro=1,q=.04,v=.78,l=v+ro/2,Le=`attribute vec3 position;attribute vec3 normal;attribute vec2 uv;attribute float kind;uniform mat4 uMV,uP;uniform vec3 uOff;uniform float uSY,uFlip;
varying vec3 vW,vN;varying vec2 vU;varying float vK;varying float vD;
void main(){vec3 p=position*vec3(1.,uSY,1.);p.xz*=uFlip;vec3 n=normal;n.xz*=uFlip;vec3 w=p+uOff;vW=w;vN=n;vU=uv;vK=kind;
  vec4 mv=uMV*vec4(w,1.);vD=-mv.z;gl_Position=uP*mv;}`,Me=`uniform sampler2D uTex;uniform vec3 uEye,uSky,uSkyG,uKey,uKeyDir,uLightP,uLightC,uSide,uTop,uFront,uBack,uGround;uniform float uLightI,uFlat;
varying vec3 vW,vN;varying vec2 vU;varying float vK;varying float vD;
vec3 enc(vec3 c){return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c));}
// GGX (three's BRDF_GGX): Schlick Fresnel, height-correlated Smith visibility, Trowbridge-Reitz distribution
vec3 ggx(vec3 n,vec3 v,vec3 l,vec3 f0,float rou){
  float a=rou*rou,a2=a*a;vec3 h=normalize(l+v);
  float nl=clamp(dot(n,l),0.,1.),nv=clamp(abs(dot(n,v)),0.,1.),nh=clamp(dot(n,h),0.,1.),vh=clamp(dot(v,h),0.,1.);
  vec3 F=f0+(1.-f0)*pow(1.-vh,5.);
  float gv=nl*sqrt(a2+(1.-a2)*nv*nv),gl=nv*sqrt(a2+(1.-a2)*nl*nl);
  float V=.5/max(gv+gl,1e-4);
  float dd=nh*nh*(a2-1.)+1.;float D=a2/(3.14159*dd*dd);
  return F*V*D;}
void main(){
  vec3 n=normalize(vN);
  vec3 col;float met;float rou;vec3 emis=vec3(0.);
  if(uFlat>.5){col=uSide;met=.5;rou=.5;}
  else if(vK<.5){col=uSide;met=.6;rou=.5;}
  else if(vK<1.5){col=uTop;met=.5;rou=.5;}
  else if(vK<2.5){vec3 t=pow(texture2D(uTex,vU).rgb,vec3(2.2));col=uFront*t;met=.4;rou=.45;emis=t;}
  else{col=uBack;met=.5;rou=.6;}
  vec3 dif=col*(1.-met)/3.14159;vec3 f0=mix(vec3(.04),col,met);
  vec3 v=normalize(uEye-vW);
  vec3 c=mix(uSkyG,uSky,.5*n.y+.5)*1.5*dif;
  vec3 L=normalize(uKeyDir);float nl=max(dot(n,L),0.);
  c+=uKey*1.8*nl*(dif+ggx(n,v,L,f0,rou));
  vec3 d=uLightP-vW;float dist=length(d);vec3 Lp=d/dist;float att=pow(clamp(1.-pow(dist/6.,4.),0.,1.),2.)/pow(dist,1.6);
  float nlp=max(dot(n,Lp),0.);
  c+=uLightC*uLightI*att*nlp*(dif+ggx(n,v,Lp,f0,rou));
  c+=emis;
  vec3 o=enc(c);
  float f=smoothstep(11.,26.,vD);
  gl_FragColor=vec4(mix(o,uGround,f),1.);}`,Te="attribute vec3 position;uniform mat4 uMV,uP;varying vec3 vW;void main(){vW=position;gl_Position=uP*uMV*vec4(position,1.);}",Be=`uniform float uFlow,uZF;uniform vec3 uGround,uGrid,uPerf,uCold;varying vec3 vW;
void main(){vec2 g=abs(fract(vW.xz/.6)-.5);float grid=smoothstep(.46,.5,max(g.x,g.y));
  float cold=step(abs(vW.z),uZF-.02);
  vec2 h=abs(fract(vW.xz/.075)-.5);float perf=cold*smoothstep(.22,.12,length(h));
  vec3 c=vec3(.025,.04,.07)+grid*uGrid*.6+perf*uPerf*(.12+uFlow*.6)+cold*uCold*uFlow*.5;
  float fade=smoothstep(14.,4.,length(vW.xz));
  gl_FragColor=vec4(mix(uGround,c,fade),1.);}`,be="attribute vec3 position;uniform mat4 uMV,uP;uniform vec3 uOff;void main(){gl_Position=uP*uMV*vec4(position+uOff,1.);}",ze="uniform vec4 uCol;void main(){gl_FragColor=uCol;}",Ee=`attribute vec4 aSeed;uniform mat4 uMV,uP;uniform float uTime,uFlow,uPx,uZF,uRD;varying float vS;varying float vA;
void main(){
  float s=fract(uTime*.16+aSeed.z);float side=aSeed.y;float x=aSeed.x;float hy=aSeed.w;vec3 p;float zc=side*uZF*.55;
  if(s<.32){float k=s/.32;p=vec3(x,mix(.02,hy,k*k*(3.-2.*k)),zc*k);}
  else if(s<.56){float k=(s-.32)/.24;p=vec3(x,hy,mix(zc,side*(uZF+uRD+.15),k));}
  else{float k=(s-.56)/.44;p=vec3(x,mix(hy,3.4,k),side*(uZF+uRD+.15+k*.9));}
  vS=s;vA=uFlow*smoothstep(0.,.06,s)*smoothstep(1.,.7,s);
  vec4 mv=uMV*vec4(p,1.);gl_PointSize=9.*uPx/(-mv.z)*2.2;gl_Position=uP*mv;}`,De=`uniform vec3 uCold,uWarm;varying float vS;varying float vA;
void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;vec3 c=mix(uCold,uWarm,smoothstep(.42,.66,vS));gl_FragColor=vec4(c,vA*smoothstep(1.,0.,r)*.85);}`,Oe=`attribute vec3 aSeed;uniform mat4 uMV,uP;uniform float uTime,uPow,uPx,uUX,uBY,uZC,uRH;varying float vA;
void main(){float s=fract(uTime*.3+aSeed.z);vec3 p;float zz=aSeed.y*uZC;
  if(s<.15){float k=s/.15;p=vec3(uUX,mix(1.8,uBY,k),0.);}
  else if(s<.3){float k=(s-.15)/.15;p=vec3(uUX,uBY,mix(0.,zz,k));}
  else if(s<.85){float k=(s-.3)/.55;p=vec3(mix(uUX,aSeed.x,k),uBY,zz);}
  else{float k=(s-.85)/.15;p=vec3(aSeed.x,mix(uBY,uRH,k),zz);}
  vA=uPow*smoothstep(1.,.9,s);
  vec4 mv=uMV*vec4(p,1.);gl_PointSize=22.*uPx/(-mv.z)*2.;gl_Position=uP*mv;}`,Re=`uniform vec3 uPower,uCore;varying float vA;
void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(mix(uPower,uCore,smoothstep(.5,0.,r)),vA*smoothstep(1.,.0,r));}`,io=E=>E.flatMap((m,n)=>[...m,...E[(n+1)%4]]);function Ne(E,m){const n=m.params,Q=m.lite,xo=ge(E,!Q);if(!xo)return null;const{canvas:ao,gl:o}=xo;try{const D=n.palette,x=he(n.seed),$=window.innerWidth<761,so=Se(Q,$),J=n.racks[so],s=-(J*(u+q))/2+u/2,i=s+(J-1)*(u+q),Vo=i-s+u,y=(s+i)/2,d=s-u/2-1.4,S=c+.32,M=(e,a)=>Do(D[e],Do(a)),V=M("ground","#05070D"),O=M("accent","#22D3EE"),T=M("cold","#549EFF"),Io=M("warm","#FA7317"),fo=M("power","#FBBF24"),Ko=M("powerCore","#FFF8CC"),w=(e,a)=>Oo(M(e,a)),Xo=w("rackSide","#1A2840"),Zo=w("rackTop","#22324D"),Ho=w("rackFront","#0B1220"),Yo=w("rackBack","#111A2B"),jo=w("ups","#141B29"),qo=w("sky","#9EC9FF"),Qo=w("skyGround","#0B1220"),$o=w("key","#DBEAFE"),Jo=Oo(O),t=j(o,Le,Me),P=j(o,Te,Be),p=j(o,be,ze),g=j(o,Ee,De),f=j(o,Oe,Re),oe=we(o,Pe(128,256,x,D.accent??"#22D3EE",D.ledAlt??"#3B82F6",D.ledOk??"#34D399")),yo=Wo();Go(yo,u,c,ro);const ee=No(o,yo),So=Wo();Go(So,.9,1.8,2.4);const te=No(o,So),ue=z(o,{position:[new Float32Array([-20,0,-20,20,0,-20,20,0,20,-20,0,20]),3]},new Uint16Array([0,2,1,0,3,2])),wo=[[s-u/2,c+.02,-v],[i+u/2,c+.02,-v],[i+u/2,c+.02,v],[s-u/2,c+.02,v]],Po=[[i+u/2,0,-v],[i+u/2,0,v],[i+u/2,c,v],[i+u/2,c,-v]],ne=z(o,{position:[new Float32Array([...wo.flat(),...Po.flat()]),3]},new Uint16Array([0,1,2,0,2,3,4,5,6,4,6,7])),ie=z(o,{position:[new Float32Array([...io(wo),...io(Po)]),3]},void 0,o.LINES),k=.45,R=.9,A=1.2,ko=e=>[[-k,e*R,-A],[k,e*R,-A],[k,e*R,A],[-k,e*R,A]],Ao=[...io(ko(-1)),...io(ko(1))];for(const[e,a]of[[-k,-A],[k,-A],[k,A],[-k,A]])Ao.push(e,-R,a,e,R,a);const re=z(o,{position:[new Float32Array(Ao),3]},void 0,o.LINES),ae=z(o,{position:[new Float32Array([d,1.8,0,d,S,0,d,S,-l,d,S,l,d,S,-l,i+.2,S,-l,d,S,l,i+.2,S,l]),3]},void 0,o.LINES),co=n.air[so],I=new Float32Array(Math.max(1,co)*4);for(let e=0;e<co;e++)I[e*4]=L(s-u/2,i+u/2,x()),I[e*4+1]=x()<.5?-1:1,I[e*4+2]=x(),I[e*4+3]=.25+x()*1.6;const se=z(o,{aSeed:[I,4]},void 0,o.POINTS),lo=n.ups?n.power[so]:0,oo=new Float32Array(Math.max(1,lo)*3);for(let e=0;e<lo;e++)oo[e*3]=s+Math.floor(x()*J)*(u+q),oo[e*3+1]=x()<.5?-1:1,oo[e*3+2]=x();const fe=z(o,{aSeed:[oo,3]},void 0,o.POINTS),ce={rack:[i-2*(u+q),c+.1,-l],cold:[y+Vo*.22,.25,0],hot:[y,3,-(l+ro)],ups:[d,2,0]},le=[[y+2.5,9.5,8.5,y,.3,0],[i+4.6,5.4,4.6,y-.4,.7,0],[i+3.1,2.3,0,s-1.2,1,0]],ve=[[y+1.5,12,9.5,y,.2,0],[i+4.2,7.4,5.4,y-.3,.6,0],[i+3.6,2.5,0,s-1.2,.9,0]],eo=ke(E);let vo=m.progress,mo=m.progress,Co=1,_o=1,po=1,go=Ro(36,1,.1,60);const me=m.fixedTime!==void 0,C=n.phases,ho=Fe({host:E,canvas:ao,gl:o,dpr:Q?1.25:1.75,fps:Q?30:0,fixedTime:m.fixedTime,onLive:m.onLive,resize:(e,a,h)=>{Co=e,_o=a,po=h/e;const K=e>a*1.15?e*n.camera.offset:0;go=_e(Ro(e>a?n.camera.fov[0]:n.camera.fov[1],e/a,.1,60),K?2*K/e:0,0)},frame:(e,a)=>{mo=me?vo:L(mo,vo,1-Math.pow(8e-4,a));const h=mo,K=n.startBuilt+(1-n.startBuilt)*no(C.rise[0],C.rise[1],h),to=no(C.contain[0],C.contain[1],h),B=no(C.flow[0],C.flow[1],h),b=n.ups?no(C.power[0],C.power[1],h):0,Lo=$?ve:le,Fo=h<.55?0:1,W=Ae(Fo?(h-.55)/.45:h/.55),G=Lo[Fo],N=Lo[Fo+1],Mo=[L(G[0],N[0],W),L(G[1],N[1],W),L(G[2],N[2],W)],To=xe(Mo,[L(G[3],N[3],W),L(G[4],N[4],W),L(G[5],N[5],W)]),de=ye(go,To);o.clearColor(V[0],V[1],V[2],1),o.clear(o.COLOR_BUFFER_BIT|o.DEPTH_BUFFER_BIT),o.enable(o.DEPTH_TEST),o.depthFunc(o.LEQUAL),o.depthMask(!0),o.disable(o.BLEND),o.disable(o.CULL_FACE);const X=r=>{o.useProgram(r.p),o.uniformMatrix4fv(r.u("uMV"),!1,To),o.uniformMatrix4fv(r.u("uP"),!1,go)};X(P),o.uniform1f(P.u("uFlow"),B),o.uniform1f(P.u("uZF"),v),o.uniform3fv(P.u("uGround"),V),o.uniform3f(P.u("uGrid"),O[0]*.45,O[1]*.2417,O[2]*.2786),o.uniform3f(P.u("uPerf"),T[0]*.4545,T[1]*.645,T[2]),o.uniform3f(P.u("uCold"),T[0]*.1515,T[1]*.1935,T[2]*.3),F(o,P,ue),X(t),o.activeTexture(o.TEXTURE0),o.bindTexture(o.TEXTURE_2D,oe),o.uniform1i(t.u("uTex"),0),o.uniform3fv(t.u("uEye"),Mo),o.uniform3fv(t.u("uSky"),qo),o.uniform3fv(t.u("uSkyG"),Qo),o.uniform3fv(t.u("uKey"),$o),o.uniform3f(t.u("uKeyDir"),4,8,6),o.uniform3f(t.u("uLightP"),0,1.2,0),o.uniform3fv(t.u("uLightC"),Jo),o.uniform1f(t.u("uLightI"),1.8*B),o.uniform3fv(t.u("uSide"),Xo),o.uniform3fv(t.u("uTop"),Zo),o.uniform3fv(t.u("uFront"),Ho),o.uniform3fv(t.u("uBack"),Yo),o.uniform3fv(t.u("uGround"),V),o.uniform1f(t.u("uFlat"),0);for(let r=0;r<2;r++)for(let _=0;_<J;_++){const U=Uo(K*2.1-(_*.07+r*.12),0,1),Z=U<1?1-Math.pow(1-U,3):1,H=Math.max(.001,Z);o.uniform1f(t.u("uSY"),H),o.uniform1f(t.u("uFlip"),r?-1:1),o.uniform3f(t.u("uOff"),s+_*(u+q),c*H/2,r?l:-l),F(o,t,ee)}n.ups&&(o.uniform1f(t.u("uFlat"),1),o.uniform3fv(t.u("uSide"),jo),o.uniform1f(t.u("uSY"),1),o.uniform1f(t.u("uFlip"),1),o.uniform3f(t.u("uOff"),d,.9,0),F(o,t,te)),o.enable(o.BLEND),o.depthMask(!1),o.blendFuncSeparate(o.SRC_ALPHA,o.ONE_MINUS_SRC_ALPHA,o.ONE,o.ONE_MINUS_SRC_ALPHA),X(p);const uo=(r,_)=>o.uniform4f(p.u("uCol"),r[0],r[1],r[2],_);if(to>.001&&(o.uniform3f(p.u("uOff"),0,(1-to)*1.6,0),uo(O,.07*to),F(o,p,ne),uo(O,.8*to),F(o,p,ie)),n.ups&&(o.uniform3f(p.u("uOff"),d,.9,0),uo(fo,.2+.8*b),F(o,p,re),b>.001&&(o.uniform3f(p.u("uOff"),0,0,0),uo(fo,.55*b),F(o,p,ae))),o.blendFunc(o.SRC_ALPHA,o.ONE),B>.001&&co>0&&(X(g),o.uniform1f(g.u("uTime"),e),o.uniform1f(g.u("uFlow"),B),o.uniform1f(g.u("uPx"),po),o.uniform1f(g.u("uZF"),v),o.uniform1f(g.u("uRD"),ro),o.uniform3fv(g.u("uCold"),T),o.uniform3fv(g.u("uWarm"),Io),F(o,g,se)),b>.001&&lo>0&&(X(f),o.uniform1f(f.u("uTime"),e),o.uniform1f(f.u("uPow"),b),o.uniform1f(f.u("uPx"),po),o.uniform1f(f.u("uUX"),d),o.uniform1f(f.u("uBY"),S),o.uniform1f(f.u("uZC"),l),o.uniform1f(f.u("uRH"),c),o.uniform3fv(f.u("uPower"),fo),o.uniform3fv(f.u("uCore"),Ko),F(o,f,fe)),eo.has){const r=ao.getBoundingClientRect(),_={rack:K>.95&&B<.5,cold:B>.5,hot:B>.5&&b<.5,ups:b>.4};for(const U of eo.ids){const Z=eo.el(U),H=ce[U];if(!Z||!H)continue;const Y=Ce(de,H,Co,_o),Bo=Y[0]+r.left,bo=Y[1]+r.top,pe=window.innerWidth,zo=window.innerHeight,Eo=_[U]&&Y[2]<1&&Bo>90&&Bo<pe-100&&bo>($?zo*.32:70)&&bo<zo*($?.66:1)-40;Z.dataset.on=Eo?"true":"false",Eo&&(Z.style.transform=`translate3d(${Y[0].toFixed(0)}px,${Y[1].toFixed(0)}px,0) translate(-50%,-130%)`)}}return!0}});return{setProgress(e){vo=Uo(e,0,1),ho.wake()},frameTimes:()=>ho.frameTimes.slice(),destroy(){eo.reset(),ho.destroy()}}}catch(D){return ao.remove(),m.onLive?.(!1),typeof console<"u"&&console.warn("scene3d vtc-hall:",D),null}}export{Ne as default,Ne as start};
