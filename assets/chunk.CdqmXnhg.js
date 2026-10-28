const Z="attribute vec2 a;varying vec2 v;void main(){v=a*.5+.5;v.y=1.-v.y;gl_Position=vec4(a,0.,1.);}",q=`#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
#endif
precision mediump float;varying vec2 v;uniform sampler2D img,dep;uniform vec2 off,cover,focus;uniform float zoom,t,zmax,far;
float S(float z){return 1.+t*(zmax-1.)*(far+(1.-far)*z*z);}
vec2 M(vec2 uv,float z){return focus+(uv-focus)/S(z)+off*(z-.45);}
void main(){
  vec2 uv=(v-.5)/zoom*cover+.5;
  float zHi=1.;float zLo=0.;
  for(int i=0;i<=48;i++){float z=1.-float(i)/48.;if(texture2D(dep,M(uv,z)).r>=z){zLo=z;break;}zHi=z;}
  for(int j=0;j<5;j++){float z=.5*(zHi+zLo);if(texture2D(dep,M(uv,z)).r>=z)zLo=z;else zHi=z;}
  vec2 st=M(uv,zLo);
  vec2 sp=focus+(uv-focus)/S(.55);
  float w=0.;
#ifdef GL_OES_standard_derivatives
  float r=length(fwidth(st))/(length(fwidth(uv))/S(zLo)+1e-5);
  w=smoothstep(.72,.32,r);
#else
  vec2 e=vec2(.004,0.);
  float g=abs(texture2D(dep,st+e).r-texture2D(dep,st-e).r)+abs(texture2D(dep,st+e.yx).r-texture2D(dep,st-e.yx).r);
  w=smoothstep(.05,.18,g)*step(.02,t);
#endif
  if(st.x<0.||st.x>1.||st.y<0.||st.y>1.)w=1.;
  float bot=smoothstep(.78,1.,v.y);
  w=max(w,bot*.85*min(t*4.,1.));
  vec3 c=mix(texture2D(img,clamp(st,.001,.999)).rgb,texture2D(img,clamp(sp,.001,.999)).rgb,w);
  c*=1.-.42*bot;
  gl_FragColor=vec4(c,1.);
}`,p=o=>Math.min(1,Math.max(0,o));function C(o){return new Promise((n,r)=>{const e=new Image;e.crossOrigin="anonymous",e.decoding="async",e.onload=()=>n(e),e.onerror=()=>r(new Error(`living-photo: could not load ${o}`)),e.src=o})}function K(o,n){const r=document.createElement("canvas");r.setAttribute("aria-hidden","true"),r.dataset.lpCanvas="";const e=r.getContext("webgl",{antialias:!1,alpha:!1,powerPreference:"low-power"});if(!e)return null;e.getExtension("OES_standard_derivatives");let v=!1,L=p(n.progress??0),x=0,_=0,h=0,E=0,u=!0,m=0,R=!0,g=null;const l=[],d=()=>{!m&&u&&g&&!v&&(m=requestAnimationFrame(()=>g&&g()))};return Promise.all([C(n.src),C(n.depth)]).then(([s,H])=>{if(v)return;const b=(t,i)=>{const a=e.createShader(t);if(e.shaderSource(a,i),e.compileShader(a),!e.getShaderParameter(a,e.COMPILE_STATUS))throw new Error(e.getShaderInfoLog(a)??"compile failed");return a},f=e.createProgram();if(e.attachShader(f,b(e.VERTEX_SHADER,Z)),e.attachShader(f,b(e.FRAGMENT_SHADER,q)),e.linkProgram(f),!e.getProgramParameter(f,e.LINK_STATUS))throw new Error(e.getProgramInfoLog(f)??"link failed");e.useProgram(f);const O=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,O),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),e.STATIC_DRAW);const A=e.getAttribLocation(f,"a");e.enableVertexAttribArray(A),e.vertexAttribPointer(A,2,e.FLOAT,!1,0,0);const S=(t,i)=>{const a=e.createTexture();e.activeTexture(e.TEXTURE0+t),e.bindTexture(e.TEXTURE_2D,a),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGB,e.RGB,e.UNSIGNED_BYTE,i)};S(0,s),S(1,H);const c=t=>e.getUniformLocation(f,t);e.uniform1i(c("img"),0),e.uniform1i(c("dep"),1);const W=c("off"),B=c("cover"),N=c("zoom"),V=c("t"),Y=c("zmax"),P=n.strength??.03,[j,k]=n.focus??[.5,.58];e.uniform2f(c("focus"),j,k),e.uniform1f(c("far"),n.far??.12);const D=()=>{const t=Math.min(window.devicePixelRatio||1,1.5),i=o.clientWidth||1,a=o.clientHeight||1;r.width=Math.round(i*t),r.height=Math.round(a*t),e.viewport(0,0,r.width,r.height);const w=s.width/s.height,T=i/a;e.uniform2f(B,T>w?1:T/w,T>w?w/T:1);const G=n.maxZoom??1.6;e.uniform1f(Y,i<700?Math.min(G,1.45):G)};g=()=>{if(m=0,v||e.isContextLost())return;h+=(x-h)*.06,E+=(_-E)*.06;const t=1-Math.pow(1-p((L-.02)/.9),2.2);e.uniform1f(N,1.03),e.uniform1f(V,t),e.uniform2f(W,h*.7*P,(E*.45-t*.35)*P),e.drawArrays(e.TRIANGLE_STRIP,0,4),R&&(R=!1,n.onLive?.(!0)),u&&(Math.abs(x-h)>.001||Math.abs(_-E)>.001)&&d()},o.appendChild(r),D(),d();let M=o.clientWidth,y=o.clientHeight,z=0;const I=()=>{window.clearTimeout(z),z=window.setTimeout(()=>{const t=o.clientWidth,i=o.clientHeight;Math.abs(t-M)<1&&Math.abs(i-y)<=160||(M=t,y=i,D(),d())},150)};if(window.addEventListener("resize",I),l.push(()=>{window.clearTimeout(z),window.removeEventListener("resize",I)}),window.matchMedia?.("(pointer: fine)").matches){const t=i=>{x=i.clientX/window.innerWidth-.5,_=i.clientY/window.innerHeight-.5,d()};window.addEventListener("pointermove",t,{passive:!0}),l.push(()=>window.removeEventListener("pointermove",t))}const U=t=>{t.preventDefault(),u=!1,n.onLive?.(!1)};r.addEventListener("webglcontextlost",U),l.push(()=>r.removeEventListener("webglcontextlost",U));const F=new IntersectionObserver(t=>{u=t[0]?.isIntersecting??!0,d()});F.observe(o),l.push(()=>F.disconnect());const X=()=>{u=!document.hidden,d()};document.addEventListener("visibilitychange",X),l.push(()=>document.removeEventListener("visibilitychange",X))}).catch(s=>{r.remove(),n.onLive?.(!1),n.onError?.(s)}),{setProgress(s){L=p(s),d()},destroy(){v=!0,m&&cancelAnimationFrame(m),l.forEach(s=>s()),r.remove(),e.getExtension("WEBGL_lose_context")?.loseContext()}}}export{K as startLivingPhoto};
