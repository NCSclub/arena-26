import { createFluidWake } from './fluid-wake.js';

// Visual reference: https://www.shadcn.io/background
export function createAsciiField(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false });
  if (!gl) throw new Error('WebGL2 is required for this preview.');
  const vertex = `#version 300 es
  void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}`;
  const density = `#version 300 es
  precision highp float;
  uniform vec2 grid,resolution,cell;
  uniform vec4 clearArea;
  uniform sampler2D fluid;
  uniform float clock,scale;
  out vec4 color;
  const float BAYER[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
  float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.02+vec2(1.7,9.2);a*=.5;}return v;}
  void main(){
    vec2 index=floor(gl_FragCoord.xy),uv=(index+.5)*cell/resolution;
    float aspect=resolution.x/resolution.y,t=clock*.05;
    vec2 p=(uv-.5)*vec2(aspect,1.)*scale;
    vec2 warp=vec2(fbm(p*1.1+vec2(0.,t)),fbm(p*1.1+vec2(5.2,1.3-t)));
    float tone=smoothstep(.32,.68,fbm(p*1.4+warp*1.5+vec2(t*.7,-t*.4)));
    ivec2 size=textureSize(fluid,0),last=size-1;
    vec2 samplePoint=uv*vec2(size)-.5,fraction=fract(samplePoint);
    ivec2 low=ivec2(floor(samplePoint));
    float a=texelFetch(fluid,clamp(low,ivec2(0),last),0).a;
    float b=texelFetch(fluid,clamp(low+ivec2(1,0),ivec2(0),last),0).a;
    float c=texelFetch(fluid,clamp(low+ivec2(0,1),ivec2(0),last),0).a;
    float d=texelFetch(fluid,clamp(low+ivec2(1),ivec2(0),last),0).a;
    float signal=mix(mix(a,b,fraction.x),mix(c,d,fraction.x),fraction.y);
    float wake=clamp(signal*.9/.38,0.,1.);
    wake=wake*wake*(3.-2.*wake);
    tone+=(1.-tone)*wake*.92;
    float keep=smoothstep(0.,.16,uv.y)*smoothstep(0.,.16,1.-uv.y);
    vec2 halfSize=clearArea.zw*.5*vec2(aspect,1.);
    vec2 offset=(uv-clearArea.xy-clearArea.zw*.5)*vec2(aspect,1.);
    keep*=smoothstep(0.,.14,(length(offset/max(halfSize,vec2(.0001)))-1.)*min(halfSize.x,halfSize.y));
    tone*=keep;
    wake*=keep;
    ivec2 tile=ivec2(mod(index,4.));
    float level=tone*7.;
    float tier=level>=3.5?4.:clamp(floor(level+(BAYER[tile.x+tile.y*4]+.5)/16.),0.,3.);
    // The reference repeats the page name, with a different offset per row.
    int word[11]=int[11](4,5,6,7,8,9,10,11,12,13,14);
    int letter=int(mod(index.x+floor(hash(vec2(index.y,7.13))*11.),11.));
    float glyph=tier<4.?tier:float(word[letter]);
    if(tier>=4.&&hash(index+vec2(3.1,8.7))<max(wake*.9-.2,0.)){
      glyph=15.+floor(hash(index+floor(clock*10.)*vec2(.71,.37))*11.);
    }
    float strength=tier<4.?.32+tier*.07:.58+.32*tone;
    color=vec4(mix(strength,1.,wake),0.,0.,glyph/255.);
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
    vec4 data=texelFetch(tones,ivec2(index),0);
    float glyph=floor(data.a*255.+.5);
    if(glyph<.5){color=vec4(0.,0.,0.,1.);return;}
    vec2 local=fract(pos/cell);
    float ink=texture(atlas,vec2((glyph+local.x)/count,local.y)).a;
    color=vec4(vec3(.898)*ink*data.r*.92,1.);
  }`;
  function program(fragment) {
    const shaders=[gl.VERTEX_SHADER,gl.FRAGMENT_SHADER].map((type,i)=>{
      const shader=gl.createShader(type);gl.shaderSource(shader,i?fragment:vertex);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    });
    const result=gl.createProgram();shaders.forEach(shader=>gl.attachShader(result,shader));gl.linkProgram(result);
    if(!gl.getProgramParameter(result,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(result));
    shaders.forEach(shader=>gl.deleteShader(shader));return result;
  }
  const fieldProgram=program(density),glyphProgram=program(glyphs),vao=gl.createVertexArray();
  const names=['grid','resolution','clock','scale','clearArea','fluid','tones','atlas','cell','count'];
  const locations=program=>Object.fromEntries(names.map(name=>[name,gl.getUniformLocation(program,name)]));
  const fieldUniforms=locations(fieldProgram),glyphUniforms=locations(glyphProgram);
  gl.bindVertexArray(vao);
  function texture(){
    const result=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,result);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    return result;
  }
  const tones=texture(),framebuffer=gl.createFramebuffer(),atlas=texture();
  const characters=' ·:+BACKGROUNDS#%&*=/<>?$@';
  let width=0,height=0,columns=0,rows=0,cellX=0,cellY=0,paused=false,elapsed=0,last=0,frame;
  let clearArea=[0,0,0,0];
  const fluid=createFluidWake(gl,program);
  canvas.dataset.interaction="fluid";
  function resize(){
    const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,2);
    width=Math.max(1,Math.round(rect.width*dpr));height=Math.max(1,Math.round(rect.height*dpr));
    canvas.width=width;canvas.height=height;
    cellY=Math.max(2,Math.round(11*dpr));cellX=Math.max(2,Math.round(.62*cellY));
    columns=Math.ceil(width/cellX);rows=Math.ceil(height/cellY);
    const sheet=document.createElement('canvas');sheet.width=characters.length*cellX;sheet.height=cellY;
    const ctx=sheet.getContext('2d');ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='alphabetic';
    ctx.font=`500 ${.74*cellY}px ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace`;
    const metrics=ctx.measureText('M'),baseline=(cellY+metrics.actualBoundingBoxAscent-metrics.actualBoundingBoxDescent)/2;
    [...characters].forEach((character,i)=>{
      ctx.save();ctx.beginPath();ctx.rect(i*cellX,0,cellX,cellY);ctx.clip();
      ctx.translate((i+.5)*cellX,baseline);
      const advance=ctx.measureText(character).width;
      if(advance>cellX*.96)ctx.scale(cellX*.96/advance,1);
      ctx.fillText(character,0,0);ctx.restore();
    });
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,atlas);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,sheet);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tones);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,columns,rows,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tones,0);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    const bounds=[...document.querySelector('.hero-content').children].map(element=>element.getBoundingClientRect());
    const left=Math.min(...bounds.map(b=>b.left)),top=Math.min(...bounds.map(b=>b.top));
    const right=Math.max(...bounds.map(b=>b.right)),bottom=Math.max(...bounds.map(b=>b.bottom));
    clearArea=[(left-rect.left)/rect.width,(top-rect.top)/rect.height,(right-left)/rect.width,(bottom-top)/rect.height];
    fluid.resize(width/height);
    draw();
  }
  function draw(){
    if(!width||!height)return;
    gl.useProgram(fieldProgram);gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.viewport(0,0,columns,rows);
    gl.uniform2f(fieldUniforms.grid,columns,rows);gl.uniform2f(fieldUniforms.resolution,width,height);
    gl.uniform2f(fieldUniforms.cell,cellX,cellY);gl.uniform1f(fieldUniforms.clock,elapsed);gl.uniform1f(fieldUniforms.scale,innerWidth<760?1.6:1);
    gl.uniform4fv(fieldUniforms.clearArea,clearArea);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,fluid.texture);gl.uniform1i(fieldUniforms.fluid,0);
    gl.drawArrays(gl.TRIANGLES,0,3);
    gl.useProgram(glyphProgram);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,width,height);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tones);gl.uniform1i(glyphUniforms.tones,0);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,atlas);gl.uniform1i(glyphUniforms.atlas,1);
    gl.uniform2f(glyphUniforms.resolution,width,height);gl.uniform2f(glyphUniforms.grid,columns,rows);gl.uniform2f(glyphUniforms.cell,cellX,cellY);gl.uniform1f(glyphUniforms.count,characters.length);
    gl.drawArrays(gl.TRIANGLES,0,3);canvas.dataset.frames=String(Number(canvas.dataset.frames||0)+1);
  }
  function tick(now){
    const cadence=fluid.active?1000/60:1000/30;
    if(!paused&&!document.hidden&&now-last>=cadence-1){
      const delta=last?Math.min(.05,(now-last)/1000):0;
      elapsed+=delta;fluid.update(delta);draw();last=now;
      canvas.dataset.fluidSteps=String(fluid.steps);
    }
    if(paused||document.hidden)last=now;
    frame=requestAnimationFrame(tick);
  }
  function move(event){
    if(paused)return;
    const r=canvas.getBoundingClientRect();
    fluid.point((event.clientX-r.left)/r.width,(event.clientY-r.top)/r.height,performance.now());
  }
  const leave=()=>fluid.leave();
  window.addEventListener('pointermove',move,{passive:true});window.addEventListener('pointerdown',move,{passive:true});document.documentElement.addEventListener('pointerleave',leave);window.addEventListener('pointercancel',leave);
  const observer=new ResizeObserver(resize);observer.observe(canvas);observer.observe(document.querySelector('.hero-content'));resize();frame=requestAnimationFrame(tick);
  return {pause(){paused=true;},play(){paused=false;last=0;},destroy(){cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('pointermove',move);window.removeEventListener('pointerdown',move);document.documentElement.removeEventListener('pointerleave',leave);window.removeEventListener('pointercancel',leave);fluid.destroy();gl.deleteTexture(tones);gl.deleteTexture(atlas);gl.deleteFramebuffer(framebuffer);gl.deleteVertexArray(vao);gl.deleteProgram(fieldProgram);gl.deleteProgram(glyphProgram);}};
}
