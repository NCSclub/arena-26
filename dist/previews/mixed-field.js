// Drift and Contour density functions adapted from asciify-engine 4.32.8 (MIT).
export function createMixedField(canvas, blend = .1) {
  const gl = canvas.getContext('webgl2', {alpha:false, antialias:false});
  if (!gl) throw new Error('WebGL2 is required for this preview.');
  const vertex = `#version 300 es
  void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}`;
  const density = `#version 300 es
  precision highp float;
  uniform vec2 grid,resolution,pointer;
  uniform float clock,blend;
  out vec4 color;
  float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
  float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
  void main(){
    vec2 uv=gl_FragCoord.xy/grid;
    vec2 p=(uv-.5)*vec2(resolution.x/resolution.y,1.);
    float t=clock*.045;
    vec2 delta=(uv-pointer)*vec2(resolution.x/resolution.y,1.);
    float influence=exp(-dot(delta,delta)/.018);
    p+=delta*influence*.12;
    vec2 q=p*3.1;
    vec2 warp=vec2(fbm(q*.7+vec2(t,-t*.7)),fbm(q*.7+vec2(4.3-t*.8,t+1.7)));
    float drift=fbm(q+warp*1.3+vec2(t*.9,t*.6));
    float tt=(clock+40.)*.02;
    vec2 terrain=p*2.6+warp*.4+vec2(tt,-tt*.6);
    float h=noise(terrain)*.62+noise(terrain*2.07+3.1)*.27+noise(terrain*4.3-tt+7.)*.11;
    h+=.08*sin(tt*2.+p.x*.8);
    float k=h*13.,w=max(fwidth(k),.0001),d=abs(fract(k+.5)-.5)/w;
    float major=mod(floor(k+.5),5.)<.5?1.:0.;
    float contour=(1.-smoothstep(.35,1.25-major*.25,d))*mix(.55,1.,major);
    vec2 a=(uv-vec2(.18+.035*sin(t),.13+.025*cos(t*.8)))/vec2(.31,.18);
    vec2 b=(uv-vec2(-.055+.03*cos(t*.7),.76+.055*sin(t*.9)))/vec2(.39,.29);
    vec2 c=(uv-vec2(1.025+.025*sin(t*.6),.38+.065*cos(t*.7)))/vec2(.29,.32);
    vec2 bottom=(uv-vec2(.91+.03*cos(t*.8),1.08+.035*sin(t)))/vec2(.34,.25);
    float edge=min(min(length(a),length(b)),min(length(c),length(bottom)));
    float organic=edge+(fbm(q*1.8+vec2(t,-t))-.5)*.55;
    float island=1.-smoothstep(.38,1.,organic);
    float detail=mix(.38+drift*.85,.38+drift*.42+contour*.35,blend);
    float tone=clamp(island*detail+influence*island*.12,0.,1.);
    tone=tone<.13?0.:tone;
    color=vec4(vec3(clamp(tone,0.,1.)),1.);
  }`;
  const glyphs = `#version 300 es
  precision highp float;
  uniform sampler2D tones,atlas;
  uniform vec2 resolution,grid,cell;
  uniform float count;
  out vec4 color;
  void main(){
    vec2 pos=vec2(gl_FragCoord.x,resolution.y-gl_FragCoord.y);
    vec2 index=min(floor(pos/cell),grid-1.);
    float tone=texelFetch(tones,ivec2(index),0).r;
    float glyph=floor(tone*(count-1.)+.5);
    vec2 local=fract(pos/cell);
    float ink=texture(atlas,vec2((glyph+local.x)/count,local.y)).a;
    color=vec4(vec3(.64,.68,.66)*ink*(.35+.65*tone),1.);
  }`;
  function program(fragment) {
    const shaders=[gl.VERTEX_SHADER,gl.FRAGMENT_SHADER].map((type,i)=>{
      const shader=gl.createShader(type);gl.shaderSource(shader,i?fragment:vertex);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    });
    const p=gl.createProgram();shaders.forEach(s=>gl.attachShader(p,s));gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
    shaders.forEach(s=>gl.deleteShader(s));return p;
  }
  const fieldProgram=program(density),glyphProgram=program(glyphs);
  const names=['grid','resolution','pointer','clock','blend','tones','atlas','cell','count'];
  const locations=p=>Object.fromEntries(names.map(name=>[name,gl.getUniformLocation(p,name)]));
  const fieldUniforms=locations(fieldProgram),glyphUniforms=locations(glyphProgram);
  gl.bindVertexArray(gl.createVertexArray());
  const texture=()=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;};
  const tones=texture(),framebuffer=gl.createFramebuffer(),atlas=texture();
  const characters=' .:+*#@';
  const sheet=document.createElement('canvas');sheet.width=characters.length*24;sheet.height=40;
  const ctx=sheet.getContext('2d');ctx.fillStyle='#fff';ctx.font='500 34px "IBM Plex Mono", monospace';ctx.textAlign='center';ctx.textBaseline='middle';
  [...characters].forEach((char,i)=>ctx.fillText(char,i*24+12,20));
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,sheet);
  let width=0,height=0,columns=0,rows=0,cellX=0,cellY=0,paused=false,elapsed=35,last=0,frame;
  const pointer={x:-10,y:-10};
  function resize(){
    const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,1.5);
    width=Math.round(rect.width*dpr);height=Math.round(rect.height*dpr);
    canvas.width=width;canvas.height=height;
    const size=rect.width<600?8:9;
    columns=Math.ceil(rect.width/(size*.65));rows=Math.ceil(rect.height/size);
    cellX=width/columns;cellY=height/rows;
    gl.bindTexture(gl.TEXTURE_2D,tones);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,columns,rows,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tones,0);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    draw();
  }
  function draw(){
    if(!width||!height)return;
    gl.useProgram(fieldProgram);gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.viewport(0,0,columns,rows);
    gl.uniform2f(fieldUniforms.grid,columns,rows);gl.uniform2f(fieldUniforms.resolution,width,height);
    gl.uniform2f(fieldUniforms.pointer,pointer.x,pointer.y);gl.uniform1f(fieldUniforms.clock,elapsed);gl.uniform1f(fieldUniforms.blend,blend);
    gl.drawArrays(gl.TRIANGLES,0,3);
    gl.useProgram(glyphProgram);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,width,height);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tones);gl.uniform1i(glyphUniforms.tones,0);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,atlas);gl.uniform1i(glyphUniforms.atlas,1);
    gl.uniform2f(glyphUniforms.resolution,width,height);gl.uniform2f(glyphUniforms.grid,columns,rows);gl.uniform2f(glyphUniforms.cell,cellX,cellY);gl.uniform1f(glyphUniforms.count,characters.length);
    gl.drawArrays(gl.TRIANGLES,0,3);canvas.dataset.frames=String(Number(canvas.dataset.frames||0)+1);
  }
  function tick(now){
    if(!paused&&!document.hidden){elapsed+=last?Math.min(.05,(now-last)/1000)*2.2:0;draw();}
    last=now;frame=requestAnimationFrame(tick);
  }
  const move=e=>{const r=canvas.getBoundingClientRect();pointer.x=(e.clientX-r.left)/r.width;pointer.y=(e.clientY-r.top)/r.height;};
  const leave=()=>{pointer.x=pointer.y=-10;};
  window.addEventListener('pointermove',move,{passive:true});document.documentElement.addEventListener('pointerleave',leave);
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();frame=requestAnimationFrame(tick);
  return {setBlend(value){blend=value;draw();},pause(){paused=true;},play(){paused=false;last=0;},destroy(){cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('pointermove',move);document.documentElement.removeEventListener('pointerleave',leave);gl.deleteTexture(tones);gl.deleteTexture(atlas);gl.deleteFramebuffer(framebuffer);gl.deleteProgram(fieldProgram);gl.deleteProgram(glyphProgram);}};
}
