// Fluid parameters and interaction behaviour follow shadcn.io/background.
export function createFluidWake(gl, compile) {
  if (!gl.getExtension('EXT_color_buffer_float')) {
    throw new Error('Floating-point render targets are required for the fluid cursor effect.');
  }
  const common = `#version 300 es
  precision highp float;
  uniform sampler2D state,curl,pressure;
  uniform vec2 size;
  uniform float dt,first;
  out vec4 result;
  const ivec2 X=ivec2(1,0),Y=ivec2(0,1);
  ivec2 position(){return ivec2(gl_FragCoord.xy);}
  bool boundary(ivec2 p){return p.x<1||p.y<1||p.x>int(size.x)-2||p.y>int(size.y)-2;}
  vec4 sampleState(ivec2 p){return texelFetch(state,p,0);}
  float sampleCurl(ivec2 p){return texelFetch(curl,p,0).r;}
  float samplePressure(ivec2 p){return first>.5?0.:texelFetch(pressure,p,0).r;}
  `;
  const fragments = {
    inject: `${common}
      uniform vec4 origin[8],shape[8];
      uniform int count;
      void main(){
        ivec2 cell=position();
        if(boundary(cell)){result=vec4(0.);return;}
        vec4 value=sampleState(cell);
        vec2 point=vec2(cell);
        for(int segment=0;segment<8;segment++){
          if(segment>=count)break;
          vec2 start=origin[segment].xy,path=origin[segment].zw;
          float distance=length(path),radius=shape[segment].x,ink=shape[segment].y;
          float force=shape[segment].z,samples=shape[segment].w;
          vec2 direction=path/distance,velocity=vec2(0.);
          float along=dot(point-start,direction),weight=0.;
          float reach=(3.*radius+1.)*1.415;
          float low=max(0.,floor((along-reach)/distance*samples-.5));
          float high=min(samples-1.,ceil((along+reach)/distance*samples-.5));
          for(float n=low;n<=high;n++){
            vec2 centre=start+path*((n+.5)/samples),offset=point-centre;
            if(any(lessThan(point,floor(centre-3.*radius)))||any(greaterThan(point,ceil(centre+3.*radius))))continue;
            float forward=dot(offset,direction)/radius;
            float side=(offset.y*direction.x-offset.x*direction.y)/radius;
            float falloff=exp(-forward*forward*.65-side*side*1.7);
            float wing=1.-side*side*.55,twist=forward*side*.7;
            velocity+=vec2(direction.x*wing-direction.y*twist,direction.y*wing+direction.x*twist)*falloff*force;
            weight+=falloff;
          }
          value.z=1.-(1.-value.z)*exp(-weight*ink);
          value.xy=clamp(value.xy+velocity,-80.,80.);
        }
        result=value;
      }`,
    advect: `${common}
      void main(){
        ivec2 cell=position();
        if(boundary(cell)){result=vec4(0.);return;}
        vec2 back=clamp(vec2(cell)-sampleState(cell).xy*dt,vec2(.5),size-1.5);
        ivec2 low=ivec2(back);vec2 fraction=back-vec2(low);
        vec4 value=mix(mix(sampleState(low),sampleState(low+X),fraction.x),mix(sampleState(low+Y),sampleState(low+X+Y),fraction.x),fraction.y);
        result=vec4(value.xy*exp(-1.9*dt),value.z*exp(-3.2*dt),0.);
      }`,
    curl: `${common}
      void main(){
        ivec2 cell=position();
        float rotation=boundary(cell)?0.:.5*(sampleState(cell+X).y-sampleState(cell-X).y-sampleState(cell+Y).x+sampleState(cell-Y).x);
        result=vec4(rotation,0.,0.,0.);
      }`,
    confine: `${common}
      void main(){
        ivec2 cell=position();
        if(boundary(cell)){result=vec4(0.);return;}
        vec4 value=sampleState(cell);
        vec2 gradient=vec2(abs(sampleCurl(cell+X))-abs(sampleCurl(cell-X)),abs(sampleCurl(cell+Y))-abs(sampleCurl(cell-Y)));
        float strength=sampleCurl(cell)*dt*10.;
        vec2 velocity=value.xy+vec2(gradient.y,-gradient.x)/(length(gradient)+.0001)*strength;
        velocity*=min(1.,length(value.xy)/(length(velocity)+.000001));
        result=vec4(velocity,value.z,0.);
      }`,
    pressure: `${common}
      void main(){
        ivec2 cell=position();
        if(boundary(cell)){result=vec4(0.);return;}
        float divergence=-.5*(sampleState(cell+X).x-sampleState(cell-X).x+sampleState(cell+Y).y-sampleState(cell-Y).y);
        result=vec4(.25*(divergence+samplePressure(cell-X)+samplePressure(cell+X)+samplePressure(cell-Y)+samplePressure(cell+Y)),0.,0.,0.);
      }`,
    project: `${common}
      void main(){
        ivec2 cell=position();
        if(boundary(cell)){result=vec4(0.);return;}
        vec4 value=sampleState(cell);
        vec2 velocity=clamp(value.xy-.5*vec2(samplePressure(cell+X)-samplePressure(cell-X),samplePressure(cell+Y)-samplePressure(cell-Y)),-80.,80.);
        result=vec4(velocity,value.z,1.-exp(-.06*length(velocity)-.16*value.z));
      }`
  };
  const programs=Object.fromEntries(Object.entries(fragments).map(([name,source])=>{
    const program=compile(source);
    const uniforms=Object.fromEntries(['state','curl','pressure','size','dt','first','origin[0]','shape[0]','count'].map(key=>[key,gl.getUniformLocation(program,key)]));
    gl.useProgram(program);gl.uniform1i(uniforms.state,0);gl.uniform1i(uniforms.curl,1);gl.uniform1i(uniforms.pressure,2);
    return [name,{program,uniforms}];
  }));
  let width=0,height=0,states=[],pressures=[],rotation=null,previous=null,queue=[],remaining=0,steps=0;
  function target(){
    const texture=gl.createTexture(),buffer=gl.createFramebuffer();
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA32F,width,height);
    gl.bindFramebuffer(gl.FRAMEBUFFER,buffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Fluid framebuffer is incomplete.');
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    return {texture,buffer};
  }
  function release(){
    for(const entry of [...states,...pressures,rotation])if(entry){gl.deleteTexture(entry.texture);gl.deleteFramebuffer(entry.buffer);}
  }
  function resize(aspect){
    const nextWidth=Math.round(aspect>=1?128:128*aspect),nextHeight=Math.round(aspect>=1?128/aspect:128);
    if(nextWidth===width&&nextHeight===height)return;
    release();width=nextWidth;height=nextHeight;states=[target(),target()];pressures=[target(),target()];rotation=target();
    queue=[];previous=null;remaining=0;gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  }
  function point(x,y,time){
    if(x<-.05||x>1.05||y<-.05||y>1.05){previous=null;return;}
    const current={x:Math.max(0,Math.min(1,x)),y:Math.max(0,Math.min(1,y)),time};
    const old=previous;previous=current;if(!old||!width)return;
    const dx=(current.x-old.x)*(width-1),dy=(current.y-old.y)*(height-1),distance=Math.hypot(dx,dy);
    if(distance<.001)return;
    const short=Math.min(width,height),seconds=time>old.time?Math.max(1/240,(time-old.time)/1000):1/60;
    const speed=1-Math.exp(-Math.min(12,distance/short/seconds)/2.2);
    const radius=.0445*short*(.65+.95*speed),samples=Math.min(128,Math.max(1,Math.ceil(distance/(.4*radius))));
    queue.push({origin:[old.x*(width-1),old.y*(height-1),dx,dy],shape:[radius,distance/radius*(.32+.22*speed)/samples,distance*(2+18*speed)/samples,samples]});
    remaining=6;
  }
  function pass(name,destination,dt,first=0,batch=[]){
    const {program,uniforms}=programs[name];
    gl.bindFramebuffer(gl.FRAMEBUFFER,destination.buffer);gl.useProgram(program);
    gl.uniform2f(uniforms.size,width,height);gl.uniform1f(uniforms.dt,dt);gl.uniform1f(uniforms.first,first);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,states[0].texture);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,name==='confine'?rotation.texture:null);
    gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,pressures[0].texture);
    if(batch.length){
      const origins=new Float32Array(32),shapes=new Float32Array(32);
      batch.forEach((segment,i)=>{origins.set(segment.origin,i*4);shapes.set(segment.shape,i*4);});
      gl.uniform4fv(uniforms['origin[0]'],origins);gl.uniform4fv(uniforms['shape[0]'],shapes);gl.uniform1i(uniforms.count,batch.length);
    }
    gl.drawArrays(gl.TRIANGLES,0,3);
  }
  function update(delta){
    if(remaining<=0)return;
    gl.viewport(0,0,width,height);
    while(queue.length){pass('inject',states[1],0,0,queue.splice(0,8));states.reverse();}
    let rest=Math.min(.05,delta);
    while(rest>.0000001){
      const dt=Math.min(1/60,rest);rest-=dt;
      pass('advect',states[1],dt);states.reverse();
      pass('curl',rotation,dt);
      pass('confine',states[1],dt);states.reverse();
      for(let i=0;i<4;i++){pass('pressure',pressures[1],dt,i===0?1:0);pressures.reverse();}
      pass('project',states[1],dt);states.reverse();steps++;
    }
    remaining-=delta;
    if(remaining<=0){
      gl.clearColor(0,0,0,0);
      for(const entry of states){gl.bindFramebuffer(gl.FRAMEBUFFER,entry.buffer);gl.clear(gl.COLOR_BUFFER_BIT);}
      previous=null;
    }
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,null);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,null);
  }
  return {resize,point,update,get texture(){return states[0].texture;},get active(){return remaining>0;},get steps(){return steps;},leave(){previous=null;},destroy(){release();Object.values(programs).forEach(({program})=>gl.deleteProgram(program));}};
}
