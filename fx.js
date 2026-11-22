// fx.js - move effects (shaders, particles, glow). Visual only, reads BATTLE + events
(function () {
  'use strict';

  // --- GLSL helpers: 3D simplex noise (by Ashima Arts / Stefan Gustavson) and fbm ---
  const NOISE = `
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
  float fbm(vec3 p){ float f=0.0, a=0.5; for(int i=0;i<3;i++){ f+=a*snoise(p); p*=2.03; a*=0.5; } return f; }
  `;
  const UV_VERT = `
  varying vec2 vUv; varying vec3 vPos;
  void main(){ vUv=uv; vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
  const FRESNEL_VERT = `
  varying vec3 vN; varying vec3 vV; varying vec3 vPos;
  void main(){ vPos=position; vec4 mv=modelViewMatrix*vec4(position,1.0);
    vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`;

  const TAU = Math.PI * 2;
  const V3 = (x, y, h) => new THREE.Vector3(x, h, y);   // game coords (x, y, height) to 3D world coords
  const col = (c) => new THREE.Color(c);

  function shaderMat(frag, uniforms, opts) {
    opts = opts || {};
    return new THREE.ShaderMaterial({
      uniforms: Object.assign({ uTime: { value: 0 }, uI: { value: 0 } }, uniforms),
      vertexShader: opts.vert || UV_VERT,
      fragmentShader: NOISE + frag,
      transparent: true,
      depthWrite: false,
      side: opts.side == null ? THREE.DoubleSide : opts.side,
      blending: opts.normal ? THREE.NormalBlending : THREE.AdditiveBlending
    });
  }

  // --- Materials ---
  // fire on a cylinder or cone (uv.x goes around, uv.y goes up). The noise wraps, so no seam
  function fireMat(core, mid, edge, opts) {
    return shaderMat(`
      uniform float uTime, uI, uSpeed, uDark; uniform vec3 uCore, uMid, uEdge;
      varying vec2 vUv;
      void main(){
        float a = vUv.x * 6.2831853;
        vec3 p = vec3(cos(a) * 1.6, sin(a) * 1.6, vUv.y * 3.0 - uTime * uSpeed);
        float n = fbm(p) * 0.85 + 0.5 * fbm(p * 2.3 + vec3(3.1, 1.7, -uTime * 0.8));
        float shape = (1.0 - vUv.y) * 1.25 + n * 0.85 - 0.45;
        float flame = smoothstep(0.0, 0.42, shape);
        float hot = smoothstep(0.45, 0.95, shape);
        vec3 c = mix(uEdge, uMid, flame); c = mix(c, uCore, hot);
        float alpha = flame * uI * smoothstep(0.0, 0.08, vUv.y);
        gl_FragColor = vec4(c * (0.75 + 0.45 * hot * (1.0 - uDark)), alpha);
      }`, {
      uCore: { value: col(core) }, uMid: { value: col(mid) }, uEdge: { value: col(edge) },
      uSpeed: { value: (opts && opts.speed) || 2.4 }, uDark: { value: (opts && opts.dark) ? 1 : 0 }
    }, { normal: !!(opts && opts.dark) });
  }
  // spiral streaks for the tornado funnel
  function windMat(base, hi, opts) {
    return shaderMat(`
      uniform float uTime, uI, uTwist, uSpeed; uniform vec3 uBase, uHi;
      varying vec2 vUv;
      void main(){
        float s = vUv.x + vUv.y * uTwist - uTime * uSpeed;
        float a = s * 6.2831853;
        vec3 p = vec3(cos(a) * 1.4, sin(a) * 1.4, vUv.y * 5.0 - uTime * 1.5);
        float n = fbm(p);
        float bands = smoothstep(0.05, 0.55, n + 0.25 * sin(a * 3.0));
        float edge = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.72, vUv.y);
        vec3 c = mix(uBase, uHi, bands);
        gl_FragColor = vec4(c, (0.22 + 0.78 * bands) * edge * uI);
      }`, { uBase: { value: col(base) }, uHi: { value: col(hi) }, uTwist: { value: (opts && opts.twist) || 1.6 },
            uSpeed: { value: (opts && opts.speed) || 1.4 } }, { normal: !!(opts && opts.normal) });
  }
  // polar effects on a flat disc: whirlpool, ice sheet, ground glow
  function whirlpoolMat() {
    return shaderMat(`
      uniform float uTime, uI; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;
        float ang = atan(p.y, p.x);
        float swirl = ang + log(r + 0.03) * 2.4 + uTime * 3.2;
        vec3 q = vec3(cos(swirl) * 2.0, sin(swirl) * 2.0, r * 3.0 - uTime * 0.6);
        float n = fbm(q);
        float arms = 0.5 + 0.5 * sin(swirl * 3.0 + n * 2.5);
        float foam = smoothstep(0.72, 0.98, arms + n * 0.35) * smoothstep(0.15, 0.45, r);
        vec3 deep = vec3(0.01, 0.08, 0.18), mid = vec3(0.05, 0.38, 0.62), hi = vec3(0.85, 0.97, 1.0);
        vec3 c = mix(deep, mid, smoothstep(0.05, 0.9, r) * (0.6 + 0.4 * arms));
        c = mix(c, hi, foam);
        float rim = smoothstep(0.82, 0.97, r) * (1.0 - smoothstep(0.97, 1.0, r));
        c += vec3(0.6, 0.9, 1.0) * rim * 0.8;
        float alpha = (0.55 + 0.35 * arms) * smoothstep(1.0, 0.92, r) * uI;
        gl_FragColor = vec4(c, alpha);
      }`, {}, { normal: true });
  }
  function iceSheetMat() {
    return shaderMat(`
      uniform float uTime, uI, uSpread; uniform vec2 uOrigin; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;
        float reach = length(p - uOrigin);
        float mask = 1.0 - smoothstep(uSpread - 0.18, uSpread, reach);
        float n = fbm(vec3(p * 5.0, 0.0));
        float ridge = 1.0 - abs(snoise(vec3(p * 9.0, 1.7)));
        float cracks = smoothstep(0.9, 0.99, ridge);
        float glint = pow(max(0.0, snoise(vec3(p * 22.0, uTime * 0.6))), 8.0) * 3.0;
        vec3 c = mix(vec3(0.55, 0.78, 0.95), vec3(0.9, 0.98, 1.0), 0.5 + 0.5 * n);
        c += vec3(1.0) * (cracks * 0.4 + glint * 0.5);
        float edgeGlow = smoothstep(uSpread - 0.25, uSpread, reach) * mask;
        c += vec3(0.6, 0.9, 1.0) * edgeGlow;
        gl_FragColor = vec4(min(c, vec3(1.0)), (0.16 + cracks * 0.22 + edgeGlow * 0.3) * mask * uI);
      }`, { uSpread: { value: 0 }, uOrigin: { value: new THREE.Vector2() } }, { normal: true });
  }
  // A soft ring on a disc: shockwaves, reticles, timing rings, telegraph markers
  function ringMat(color, opts) {
    return shaderMat(`
      uniform float uTime, uI, uR, uW, uSeg, uFill; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;
        float ring = smoothstep(uR - uW, uR, r) * (1.0 - smoothstep(uR, uR + uW, r));
        float seg = 1.0;
        if (uSeg > 0.5) { float a = atan(p.y, p.x) + uTime * 1.5; seg = step(0.35, fract(a / 6.2831853 * uSeg)); }
        float fill = uFill * (1.0 - smoothstep(0.0, uR, r)) * 0.35;
        gl_FragColor = vec4(uColor, (ring * seg + fill) * uI);
      }`, { uColor: { value: col(color) }, uR: { value: 0.8 }, uW: { value: 0.06 }, uSeg: { value: (opts && opts.seg) || 0 },
            uFill: { value: (opts && opts.fill) || 0 } }, { normal: !!(opts && opts.normal) });
  }
  // energy shell with a bright edge and a tinted inside (dark domes, shells, ice crystals)
  function fresnelMat(inner, rim, opts) {
    opts = opts || {};
    return shaderMat(`
      uniform float uTime, uI, uInnerA, uPow, uHex; uniform vec3 uInner, uRim;
      varying vec3 vN; varying vec3 vV; varying vec3 vPos;
      void main(){
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPow);
        float n = fbm(vPos * 0.06 + vec3(0.0, -uTime * 0.5, uTime * 0.2));
        float hex = 0.0;
        if (uHex > 0.5) {
          vec2 q = vec2(atan(vPos.z, vPos.x) * 3.0, vPos.y * 0.35);
          vec2 hq = vec2(q.x + q.y * 0.5, q.y * 0.866);
          vec2 gq = abs(fract(hq) - 0.5);
          hex = smoothstep(0.42, 0.5, max(gq.x, gq.y));
        }
        vec3 c = mix(uInner, uRim, clamp(f + hex * 0.8, 0.0, 1.0));
        float a = (uInnerA * (0.7 + 0.6 * n) + f + hex * 0.6) * uI;
        gl_FragColor = vec4(c, clamp(a, 0.0, 1.0));
      }`, { uInner: { value: col(inner) }, uRim: { value: col(rim) }, uInnerA: { value: opts.innerA == null ? 0.2 : opts.innerA },
            uPow: { value: opts.pow || 2.2 }, uHex: { value: opts.hex ? 1 : 0 } },
      { vert: FRESNEL_VERT, normal: opts.normal, side: opts.side == null ? THREE.FrontSide : opts.side });
  }
  // energy flowing along a tube (tendrils, lightning glow, beams)
  function flowMat(color, opts) {
    return shaderMat(`
      uniform float uTime, uI; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        float n = snoise(vec3(vUv.x * 8.0 - uTime * 6.0, vUv.y * 2.0, uTime));
        float a = (0.55 + 0.45 * n) * uI * smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
        gl_FragColor = vec4(uColor * (1.2 + 0.8 * n), a);
      }`, { uColor: { value: col(color) } }, { normal: !!(opts && opts.normal) });
  }
  // ribbon of wind along a path (Dragoon's gale trail)
  function ribbonMat(color) {
    return shaderMat(`
      uniform float uTime, uI; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        float across = 1.0 - abs(vUv.y * 2.0 - 1.0);
        float n = fbm(vec3(vUv.x * 7.0 - uTime * 5.0, vUv.y * 3.0, uTime * 0.7));
        float streak = smoothstep(-0.1, 0.5, n);
        gl_FragColor = vec4(uColor, pow(across, 1.4) * streak * uI * smoothstep(0.0, 0.15, vUv.x));
      }`, { uColor: { value: col(color) } }, { normal: false });
  }

  // --- Fire bird (Phoenix Dive) ---
  const FEATHER_VERT = `
  attribute float aSeed; varying vec2 vUv; varying float vSeed;
  void main(){ vUv = uv; vSeed = aSeed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  // one flame feather: a pointed teardrop (uv.x goes root -> tip) with flames running out to the tip.
  // normal = a darker layer drawn underneath, so the fire stays orange on the light floor instead of washing out
  function featherMat(core, mid, edge, normal) {
    return shaderMat(`
      uniform float uTime, uI; uniform vec3 uCore, uMid, uEdge;
      varying vec2 vUv; varying float vSeed;
      void main(){
        float u = vUv.x, v = vUv.y * 2.0 - 1.0;
        vec3 q = vec3(u * 3.0 - uTime * 3.2, v * 1.3, vSeed * 9.0 + uTime * 0.7);
        float n = snoise(q) * 0.6 + snoise(q * 2.2 + 4.0) * 0.3;
        float w = pow(sin(u * 3.14159), 0.5) * (1.0 - 0.45 * u) + 0.05;
        float shape = 1.15 - abs(v) / w + n * 0.45 - u * 0.3;
        float flame = smoothstep(0.0, 0.3, shape);
        float hot = smoothstep(0.55, 1.05, shape);
        vec3 c = mix(uEdge, uMid, flame); c = mix(c, uCore, hot);
        gl_FragColor = vec4(c, flame * uI * smoothstep(0.0, 0.08, u));
      }`, { uCore: { value: col(core) }, uMid: { value: col(mid) }, uEdge: { value: col(edge) } }, { vert: FEATHER_VERT, normal: !!normal });
  }
  // lots of flat feathers baked into one mesh, so a whole wing is a single draw call.
  // each feather: root x,y,z, yaw (0 = pointing +x), len, wid, lift (tip curls up), seed
  function featherGeo(list, mirror) {
    const SX = 6, pos = [], uv = [], seed = [], idx = [];
    for (const fe of list) {
      const base = pos.length / 3, c = Math.cos(fe.yaw), s = Math.sin(fe.yaw);
      for (let j = 0; j <= 1; j++) {
        for (let i = 0; i <= SX; i++) {
          const a = i / SX, lx = a * fe.len, ly = (fe.lift || 0) * a * a * fe.len, lz = (0.5 - j) * fe.wid;
          const x = fe.x + lx * c + lz * s, z = fe.z - lx * s + lz * c;
          pos.push(x, fe.y + ly, mirror ? -z : z);
          uv.push(a, j); seed.push(fe.seed);
        }
      }
      for (let i = 0; i < SX; i++) { const a0 = base + i, b0 = base + SX + 1 + i; idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
    g.setIndex(idx);
    return g;
  }
  // the bird faces +x, wings spread along z. pose(lift, sweep) flaps and folds the wings.
  // each part is drawn twice: a dark-orange layer underneath and a glowing layer on top
  function makeFireBird(parent) {
    const under = featherMat(0xff8a24, 0xe0400c, 0x6a0802, true);
    const glow = featherMat(0xffa848, 0xff4a08, 0x4a0602);
    const hot = featherMat(0xffdc90, 0xff8a24, 0x8a1a04);
    const mats = [under, glow, hot];
    const bird = new THREE.Group(); bird.visible = false; parent.add(bird);
    const wing = [], coverts = [], tips = [];
    const N = 11;
    for (let i = 0; i < N; i++) {
      const s = i / (N - 1);
      const x = -10 * s, y = 4 * s, z = 3 + 58 * s;
      const yaw = -2.95 + 1.05 * Math.pow(s, 1.3);           // inner feathers point back, the outer ones out and back
      const len = 40 + 32 * Math.pow(s, 1.2);
      wing.push({ x, y, z, yaw, len, wid: 26 + 6 * s, lift: 0.05, seed: Math.random() });
      if (s > 0.3) tips.push(new THREE.Vector3(x + len * Math.cos(yaw), y + 0.05 * len, z - len * Math.sin(yaw)));
      if (i % 2 === 0) coverts.push({ x: x + 4, y: y + 1, z, yaw: yaw + 0.2, len: len * 0.48, wid: 22, lift: 0, seed: Math.random() });
    }
    // long flight feathers at the wing tip, pointing out
    for (let i = 0; i < 3; i++) {
      const yaw = -1.6 - i * 0.18, len = 54 - i * 6;
      wing.push({ x: -10, y: 4, z: 58, yaw, len, wid: 22, lift: 0.08, seed: Math.random() });
      tips.push(new THREE.Vector3(-10 + len * Math.cos(yaw), 4 + 0.08 * len, 58 - len * Math.sin(yaw)));
    }
    const part = (geo, top, group) => {
      const a = new THREE.Mesh(geo, under), b = new THREE.Mesh(geo, top);
      a.renderOrder = 17; b.renderOrder = 18; a.frustumCulled = b.frustumCulled = false;
      a.userData.noBloom = true;
      group.add(a); group.add(b);
    };
    const mkWing = (mirror) => {
      const w = new THREE.Group();
      part(featherGeo(wing, mirror), glow, w);
      const cv = new THREE.Mesh(featherGeo(coverts, mirror), hot); cv.renderOrder = 19; cv.frustumCulled = false; w.add(cv);
      bird.add(w);
      return w;
    };
    const wingL = mkWing(false), wingR = mkWing(true);
    wingL.position.set(2, 2, 3); wingR.position.set(2, 2, -3);
    const bodyGeo = featherGeo([
      { x: -2, y: 3, z: 0, yaw: 0, len: 34, wid: 20, lift: 0.1, seed: 0.11 },        // head
      { x: 16, y: 2, z: 0, yaw: Math.PI, len: 52, wid: 28, lift: 0, seed: 0.27 },    // body
      { x: 22, y: 6, z: 3, yaw: 0.4, len: 18, wid: 9, lift: 0.5, seed: 0.43 },       // crest
      { x: 22, y: 6, z: -3, yaw: -0.4, len: 18, wid: 9, lift: 0.5, seed: 0.61 }
    ]);
    const body = new THREE.Group(); bird.add(body);
    part(bodyGeo, hot, body);
    const plumes = [];
    for (let i = 0; i < 5; i++) {
      const k = i - 2;
      plumes.push({ x: 0, y: 0, z: k * 3, yaw: Math.PI + k * 0.2, len: 104 - Math.abs(k) * 16, wid: 18, lift: -0.04, seed: Math.random() });
    }
    const tail = new THREE.Group(); tail.position.set(-18, 1, 0); bird.add(tail);
    part(featherGeo(plumes), glow, tail);
    return {
      bird, wingL, wingR, tail, tips, mats,
      pose(lift, sweep) { wingL.rotation.set(-lift, -sweep, 0); wingR.rotation.set(lift, sweep, 0); },
      set(time, I) { for (const m of mats) m.uniforms.uTime.value = time; under.uniforms.uI.value = I * 0.85; glow.uniforms.uI.value = I * 0.4; hot.uniforms.uI.value = I * 0.38; }
    };
  }

  // a cone of flame that trails behind a dashing bey: wide and hot at the bey, flame tips at the back
  function makeComet(parent, mat, rFront, rBack) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rBack, rFront, 1, 28, 1, true), mat);
    m.visible = false; m.renderOrder = 17; m.frustumCulled = false; parent.add(m);
    const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
    return {
      m, mat,
      place(x, y, h, dx, dy, len) {
        const L = Math.hypot(dx, dy) || 1;
        dir.set(-dx / L, 0, -dy / L);
        m.quaternion.setFromUnitVectors(up, dir);
        m.position.set(x - dx / L * len * 0.5, h, y - dy / L * len * 0.5);
        m.scale.set(1, len, 1);
        m.visible = true;
      }
    };
  }

  // claw slash: a curved blade of light, thick in the middle and sharp at both ends, drawn on fast
  function slashMat(core, edge) {
    return shaderMat(`
      uniform float uTime, uI, uSweep; uniform vec3 uCore, uEdge; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p), t = (atan(p.y, p.x) + 1.3) / 2.6;
        if (t < 0.0 || t > 1.0) discard;
        float w = 0.14 * pow(sin(t * 3.14159), 0.8) + 0.002;
        float d = abs(r - 0.78);
        float band = 1.0 - smoothstep(w * 0.2, w, d);
        float drawn = 1.0 - smoothstep(uSweep - 0.25, uSweep, t);
        float hot = 1.0 - smoothstep(0.0, w * 0.5, d);
        gl_FragColor = vec4(mix(uEdge, uCore, hot), band * drawn * uI);
      }`, { uSweep: { value: 0 }, uCore: { value: col(core) }, uEdge: { value: col(edge) } });
  }

  // Frost Howl: a cone of freezing mist on the floor with a ragged, frosty front
  function frostMat() {
    return shaderMat(`
      uniform float uTime, uI, uFront, uHalf; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x);
        float side = 1.0 - smoothstep(uHalf * 0.7, uHalf, abs(a));
        float reach = 1.0 - smoothstep(uFront - 0.05, uFront, r);
        float m = side * reach * smoothstep(0.0, 0.1, r);
        if (m <= 0.001) discard;
        float n = fbm(vec3(r * 5.0 - uTime * 4.0, a * 4.0, uTime * 0.5));
        float front = smoothstep(uFront - 0.28, uFront - 0.03, r) * (0.45 + 0.9 * max(0.0, n + 0.3));
        float mist = smoothstep(-0.2, 0.6, n);
        float glint = pow(max(0.0, snoise(vec3(p * 28.0, uTime * 2.0))), 6.0) * 2.0;
        vec3 c = mix(vec3(0.2, 0.5, 0.95), vec3(0.85, 0.97, 1.0), clamp(front + mist * 0.3, 0.0, 1.0));
        gl_FragColor = vec4(c + glint * 0.5, (0.3 * mist + 0.8 * front + glint) * m * uI);
      }`, { uFront: { value: 0 }, uHalf: { value: 0.5 } });
  }

  // black sun for Eclipse Drain: crimson flames licking off the edge of a dark disc
  function coronaMat() {
    return shaderMat(`
      uniform float uTime, uI; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;
        float a = atan(p.y, p.x);
        float n = fbm(vec3(cos(a) * 2.5, sin(a) * 2.5, r * 4.0 - uTime * 1.8));
        float ring = exp(-abs(r - 0.42) * 28.0);
        float flames = smoothstep(0.4, 0.46, r) * exp(-(r - 0.42) * 4.0) * max(0.0, 0.45 + 0.9 * n);
        vec3 c = mix(vec3(0.5, 0.0, 0.03), vec3(1.0, 0.32, 0.18), clamp(n * 0.8 + ring, 0.0, 1.0));
        gl_FragColor = vec4(c, (flames + ring) * uI * (1.0 - smoothstep(0.8, 1.0, r)));
      }`, {});
  }

  // --- Particles: one additive pool (fire, sparks) and one normal (smoke, snow, debris) ---
  const P_VERT = `
    attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
    varying float vA; varying vec3 vC; uniform float uScale;
    void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * uScale / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; vA = aAlpha; vC = aColor; }`;
  const P_FRAG = `
    varying float vA; varying vec3 vC; uniform float uSoft;
    void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0; if (r > 1.0) discard;
      gl_FragColor = vec4(vC, vA * pow(1.0 - r, uSoft)); }`;
  class Pool {
    constructor(cap, additive, soft) {
      this.cap = cap; this.head = 0;
      const F = (n) => new Float32Array(cap * n);
      this.p = F(3); this.v = F(3); this.c0 = F(3); this.c1 = F(3);
      this.life = F(1); this.age = F(1); this.s0 = F(1); this.s1 = F(1); this.a0 = F(1);
      this.drag = F(1); this.grav = F(1);
      this.cOut = F(3); this.sOut = F(1); this.aOut = F(1);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
      g.setAttribute('aColor', new THREE.BufferAttribute(this.cOut, 3));
      g.setAttribute('aSize', new THREE.BufferAttribute(this.sOut, 1));
      g.setAttribute('aAlpha', new THREE.BufferAttribute(this.aOut, 1));
      this.mat = new THREE.ShaderMaterial({
        uniforms: { uScale: { value: 400 }, uSoft: { value: soft || 1.4 } },
        vertexShader: P_VERT, fragmentShader: P_FRAG, transparent: true, depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
      });
      this.points = new THREE.Points(g, this.mat);
      this.points.frustumCulled = false;
      this.points.renderOrder = additive ? 20 : 19;
      this.geo = g;
    }
    // o: {x,y,h, vx,vy,vh, life, size, size1, color, color1, alpha, drag, grav, boost}
    emit(o) {
      const i = this.head; this.head = (this.head + 1) % this.cap;
      const i3 = i * 3;
      this.p[i3] = o.x; this.p[i3 + 1] = o.h || 0; this.p[i3 + 2] = o.y;
      this.v[i3] = o.vx || 0; this.v[i3 + 1] = o.vh || 0; this.v[i3 + 2] = o.vy || 0;
      const c0 = o.color instanceof THREE.Color ? o.color : col(o.color || 0xffffff);
      const c1 = o.color1 ? (o.color1 instanceof THREE.Color ? o.color1 : col(o.color1)) : c0;
      const b = o.boost || 1;
      this.c0[i3] = c0.r * b; this.c0[i3 + 1] = c0.g * b; this.c0[i3 + 2] = c0.b * b;
      this.c1[i3] = c1.r * b; this.c1[i3 + 1] = c1.g * b; this.c1[i3 + 2] = c1.b * b;
      this.life[i] = o.life || 0.6; this.age[i] = 0;
      this.s0[i] = o.size || 8; this.s1[i] = o.size1 == null ? this.s0[i] : o.size1;
      this.a0[i] = o.alpha == null ? 1 : o.alpha;
      this.drag[i] = o.drag || 0; this.grav[i] = o.grav || 0;
    }
    update(dt) {
      for (let i = 0; i < this.cap; i++) {
        const L = this.life[i];
        if (this.age[i] >= L) { this.aOut[i] = 0; this.sOut[i] = 0; continue; }
        this.age[i] += dt;
        const t = Math.min(1, this.age[i] / L);
        const i3 = i * 3, k = Math.max(0, 1 - this.drag[i] * dt);
        this.v[i3] *= k; this.v[i3 + 1] = this.v[i3 + 1] * k + this.grav[i] * dt; this.v[i3 + 2] *= k;
        this.p[i3] += this.v[i3] * dt; this.p[i3 + 1] += this.v[i3 + 1] * dt; this.p[i3 + 2] += this.v[i3 + 2] * dt;
        if (this.p[i3 + 1] < 0.5 && this.grav[i] < 0) { this.p[i3 + 1] = 0.5; this.v[i3 + 1] *= -0.3; }
        this.sOut[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
        this.aOut[i] = this.a0[i] * Math.min(1, t / 0.08) * (1 - t);
        this.cOut[i3] = this.c0[i3] + (this.c1[i3] - this.c0[i3]) * t;
        this.cOut[i3 + 1] = this.c0[i3 + 1] + (this.c1[i3 + 1] - this.c0[i3 + 1]) * t;
        this.cOut[i3 + 2] = this.c0[i3 + 2] + (this.c1[i3 + 2] - this.c0[i3 + 2]) * t;
      }
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.aColor.needsUpdate = true;
      this.geo.attributes.aSize.needsUpdate = true;
      this.geo.attributes.aAlpha.needsUpdate = true;
    }
    clear() { this.age.fill(0); this.life.fill(0); }
  }

  // lightning: a jagged line turned into a tube, white in the middle with a colored glow
  function boltPoints(a, b, jitter, segs) {
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const p = a.clone().lerp(b, t);
      if (i > 0 && i < segs) {
        const j = jitter * Math.sin(t * Math.PI);
        p.x += (Math.random() - 0.5) * j; p.y += (Math.random() - 0.5) * j * 0.5; p.z += (Math.random() - 0.5) * j;
      }
      pts.push(p);
    }
    return pts;
  }
  class Bolt {
    constructor(parent, color, coreR, glowR) {
      this.core = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.glow = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.core.renderOrder = this.glow.renderOrder = 22;
      parent.add(this.glow); parent.add(this.core);
      this.coreR = coreR || 0.9; this.glowR = glowR || 2.6; this.a = 0;
    }
    strike(a, b, jitter, segs) {
      const pts = boltPoints(a, b, jitter, segs || 12);
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1);
      this.core.geometry.dispose(); this.glow.geometry.dispose();
      this.core.geometry = new THREE.TubeGeometry(curve, pts.length * 2, this.coreR, 4, false);
      this.glow.geometry = new THREE.TubeGeometry(curve, pts.length * 2, this.glowR, 5, false);
      this.a = 1;
    }
    fade(dt, rate) {
      this.a = Math.max(0, this.a - dt * (rate || 5));
      this.core.material.opacity = this.a;
      this.glow.material.opacity = this.a * 0.55;
      this.core.visible = this.glow.visible = this.a > 0.01;
    }
    dispose() { this.core.geometry.dispose(); this.glow.geometry.dispose(); }
  }

  // --- FX core ---
  const FX = { ready: false };
  let R, S, C, lights = {}, bloomComposer = null, finalComposer = null, bloom = null, mixPass = null, bloomLevel = 0;
  const BLOOM_LAYER = 1;
  // only the effects glow. They're on layer 0 (normal render) and also on layer 1 (glow)
  function markBloom(obj) { obj.traverse((n) => { if (!n.userData.noBloom) n.layers.enable(BLOOM_LAYER); }); return obj; }
  FX.markBloom = markBloom;
  let add, smoke, root, kits = [], shake = 0, flashLight, flashI = 0;
  let generic = null;
  let dimTarget = 0, dim = 0;
  // for weaker phones: if the game slows down while the glow is on, turn the glow off
  let slowT = 0, lowPower = false, dtAvg = 1 / 60;
  const tmpV = new THREE.Vector3();

  FX.init = function (renderer, scene, camera, lightRefs) {
    R = renderer; S = scene; C = camera; lights = lightRefs || {};
    S.background = new THREE.Color(0x0b0e13);     // same color with or without the glow
    root = new THREE.Group(); S.add(root);
    add = new Pool(2200, true, 1.3);
    smoke = new Pool(1400, false, 1.1);
    S.add(add.points); S.add(smoke.points);
    markBloom(add.points);                           // sparks and fire glow, smoke and snow don't
    flashLight = new THREE.PointLight(0xffaa55, 0, 220, 2);
    S.add(flashLight);
    if (THREE.EffectComposer && THREE.RenderPass && THREE.UnrealBloomPass && THREE.ShaderPass) {
      try {
        // selective bloom: layer 1 only -> blur -> add on top
        const size = R.getSize(new THREE.Vector2());
        bloomComposer = new THREE.EffectComposer(R);
        bloomComposer.renderToScreen = false;
        bloomComposer.addPass(new THREE.RenderPass(S, C));
        bloom = new THREE.UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.55, 0.4, 0.3);
        bloomComposer.addPass(bloom);
        finalComposer = new THREE.EffectComposer(R);
        finalComposer.addPass(new THREE.RenderPass(S, C));
        mixPass = new THREE.ShaderPass(new THREE.ShaderMaterial({
          uniforms: { baseTexture: { value: null }, bloomTexture: { value: bloomComposer.renderTarget2.texture }, uBloom: { value: 1 } },
          vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: 'uniform sampler2D baseTexture; uniform sampler2D bloomTexture; uniform float uBloom; varying vec2 vUv;' +
            'void main(){ gl_FragColor = texture2D(baseTexture, vUv) + uBloom * vec4(texture2D(bloomTexture, vUv).rgb, 0.0); }'
        }), 'baseTexture');
        mixPass.needsSwap = true;
        finalComposer.addPass(mixPass);
      } catch (e) { bloomComposer = finalComposer = bloom = mixPass = null; }
    }
    FX.resize();
    // run the glow passes once now, so their shaders are ready before the first special
    if (finalComposer) {
      try {
        C.layers.set(BLOOM_LAYER); bloomComposer.render(); C.layers.set(0); finalComposer.render();
      } catch (e) { C.layers.set(0); }
    }
    FX.ready = true;
  };
  FX.resize = function () {
    if (!R) return;
    const size = R.getSize(new THREE.Vector2());
    const pr = R.getPixelRatio();
    const scale = size.y * pr / (2 * Math.tan((C.fov * Math.PI / 180) / 2));
    if (add) { add.mat.uniforms.uScale.value = scale; smoke.mat.uniforms.uScale.value = scale; }
    if (finalComposer) {
      bloomComposer.setPixelRatio(pr); bloomComposer.setSize(size.x / 2, size.y / 2);
      finalComposer.setPixelRatio(pr); finalComposer.setSize(size.x, size.y);
      mixPass.uniforms.bloomTexture.value = bloomComposer.renderTarget2.texture;
    }
  };
  FX.render = function () {
    if (finalComposer && bloomLevel > 0.01 && !lowPower) {
      // 1) bloom buffer, effects only. Don't touch the shadow map here
      // (no beys in this pass -> stale shadows left on the floor)
      const bg = S.background;
      S.background = null;
      C.layers.set(BLOOM_LAYER);
      const au = R.shadowMap.autoUpdate;
      R.shadowMap.autoUpdate = false;
      bloomComposer.render();
      R.shadowMap.autoUpdate = au;
      C.layers.set(0);
      S.background = bg;
      // 2) The normal scene (shadows get updated here), with the glow on top.
      R.shadowMap.needsUpdate = true;
      mixPass.uniforms.uBloom.value = bloomLevel;
      finalComposer.render();
    } else {
      R.render(S, C);
    }
  };
  FX.shake = function (amount) { shake = Math.max(shake, amount); };
  function flash(x, y, h, color, power) {
    flashLight.position.copy(V3(x, y, h));
    flashLight.color.set(color);
    flashI = Math.max(flashI, Math.min(0.9, power * 0.25));
  }

  // disposable helper meshes
  function disc(radius, mat, h) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mat);
    m.rotation.x = -Math.PI / 2; m.position.y = h == null ? 0.6 : h;
    m.renderOrder = 15;
    return m;
  }
  // free geometry only. Disposing materials drops the compiled shaders and the
  // recompile was the lag spike when using a move
  function disposeTree(o) {
    o.traverse((n) => { if (n.geometry) n.geometry.dispose(); });
  }

  // --- Generic hits (every bey): sparks, shockwaves, wall dust ---
  function makeGeneric() {
    const g = new THREE.Group(); root.add(g);
    const waves = [];
    for (let i = 0; i < 6; i++) {
      const m = disc(1, ringMat(0xffffff), 1.2); m.visible = false; g.add(m);
      waves.push({ m, t: 1, dur: 0.35, size: 40 });
    }
    let wi = 0;
    function wave(x, y, size, color, dur, h) {
      const w = waves[wi]; wi = (wi + 1) % waves.length;
      w.m.position.set(x, h || 1.2, y); w.t = 0; w.dur = dur || 0.35; w.size = size;
      w.m.material.uniforms.uColor.value.set(color);
      w.m.visible = true;
    }
    function sparks(x, y, h, n, colors, speed, life, size) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, s = speed * (0.4 + Math.random() * 0.8);
        add.emit({ x, y, h: h + Math.random() * 4, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vh: 40 + Math.random() * 120,
          life: life * (0.6 + Math.random() * 0.6), size: size, size1: size * 0.3,
          color: colors[i % colors.length], color1: 0xff7a1a, drag: 3, grav: -260, boost: 1.0 });
      }
    }
    return {
      wave, sparks,
      update(dt) {
        for (const w of waves) {
          if (!w.m.visible) continue;
          w.t += dt / w.dur;
          if (w.t >= 1) { w.m.visible = false; continue; }
          const s = w.size * (0.3 + 0.7 * w.t);
          w.m.scale.set(s, s, 1);
          w.m.material.uniforms.uR.value = 0.82; w.m.material.uniforms.uW.value = 0.12 * (1 - w.t) + 0.03;
          w.m.material.uniforms.uI.value = (1 - w.t) * 0.9;
        }
      },
      onEvent(e) {
        if (e.type === 'impact') {
          const p = Math.min(1, e.power / 0.1);
          const n = Math.round(5 + p * 20 + (e.base ? 10 : 0));
          sparks(e.x, e.y, 10, n, [0xffe9b8, e.colorA, e.colorB, 0xffc860], 140 + p * 200, 0.4, 4 + p * 2);
          wave(e.x, e.y, 26 + p * 44, 0xffd890, 0.3);
          if (p > 0.45 || e.base) { FX.shake(2 + p * 5); flash(e.x, e.y, 20, 0xfff0d0, 1.2 + p * 2); }
        } else if (e.type === 'wall') {
          sparks(e.x, e.y, 6, 10, [0xcfd8ff, 0xffffff], 120, 0.35, 4);
          for (let i = 0; i < 6; i++) smoke.emit({ x: e.x, y: e.y, h: 4, vx: (Math.random() - 0.5) * 50, vy: (Math.random() - 0.5) * 50, vh: 20 + Math.random() * 20,
            life: 0.7, size: 14, size1: 30, color: 0x8a8f99, alpha: 0.35, drag: 2 });
        }
      },
      dispose() { disposeTree(g); root.remove(g); }
    };
  }

  // --- One kit per bey. Each returns { update(dt, t), onEvent(e), dispose() } ---
  function emitFire(x, y, h, n, spread, dark) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, r = Math.random() * spread;
      if (dark) {
        smoke.emit({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, h: h + Math.random() * 6, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30,
          vh: 50 + Math.random() * 60, life: 0.6 + Math.random() * 0.4, size: 16, size1: 34, color: 0x1a0a14, color1: 0x050307, alpha: 0.75, drag: 1.5 });
        if (Math.random() < 0.5) add.emit({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, h: h + Math.random() * 8, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40,
          vh: 60 + Math.random() * 80, life: 0.5, size: 6, size1: 2, color: 0xff3020, color1: 0x5a0000, drag: 1, boost: 1.1 });
      } else {
        add.emit({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, h: h + Math.random() * 6, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30,
          vh: 60 + Math.random() * 70, life: 0.45 + Math.random() * 0.3, size: 15, size1: 5, color: 0xffa040, color1: 0xb81a06, drag: 1.2, boost: 0.7 });
      }
    }
  }

  // Dragoon: Gale Trail and Sky Tornado
  function kitDragoon(f) {
    const g = new THREE.Group(); root.add(g);
    // the tornado: dusty outside, bright streaks inside, a white core, all spinning
    const prof = [];
    for (let i = 0; i <= 20; i++) { const t = i / 20; prof.push(new THREE.Vector2(12 + 92 * Math.pow(t, 1.6), t * 220)); }
    const funnelGeo = new THREE.LatheGeometry(prof, 48);
    const outerMat = windMat(0x6a7486, 0xe4eaf2, { normal: true, twist: 1.8, speed: 1.3 });
    const innerMat = windMat(0x2a5a8a, 0xbfe4ff, { twist: 2.8, speed: 2.4 });
    const coreMat = windMat(0x7fbfff, 0xffffff, { twist: 4, speed: 3.4 });
    const outer = new THREE.Mesh(funnelGeo, outerMat);
    const inner = new THREE.Mesh(funnelGeo, innerMat); inner.scale.set(0.74, 0.96, 0.74);
    const core = new THREE.Mesh(funnelGeo, coreMat); core.scale.set(0.36, 0.92, 0.36);
    outer.renderOrder = 16; inner.renderOrder = 17; core.renderOrder = 17;
    outer.userData.noBloom = true;
    const funnel = new THREE.Group(); funnel.add(outer); funnel.add(inner); funnel.add(core); funnel.visible = false; g.add(funnel);
    // wind bands whipping around the outside
    const bandG = new THREE.Group(); bandG.visible = false; g.add(bandG);
    const bands = [26, 75, 128, 180].map((hb, i) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 6, 72, Math.PI * (0.8 + 0.35 * (i % 2))),
        new THREE.MeshBasicMaterial({ color: 0xeef7ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.renderOrder = 18; bandG.add(m);
      const t = hb / 220;
      return { m, hb, r: (12 + 92 * Math.pow(t, 1.6)) * 1.12, spin: (5 + i) * (i % 2 ? -1 : 1) * 0.6 + 4 };
    });
    const dust = disc(1, ringMat(0xc9ced8, { normal: true }), 0.8); dust.visible = false; g.add(dust);
    // Gale trail ribbons
    const ribbons = [];
    function ribbonFor(tr) {
      const max = 40;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(max * 2 * 3), uv = new Float32Array(max * 2 * 2), idx = [];
      for (let i = 0; i < max - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setIndex(idx);
      const m = new THREE.Mesh(geo, ribbonMat(0xdcefff)); m.renderOrder = 16; m.frustumCulled = false;
      g.add(markBloom(m));
      return { tr, m, max };
    }
    // a hidden one so the trail shader gets compiled at battle start, not on the first dash
    const warm = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ribbonMat(0xdcefff)); warm.visible = false; g.add(warm);
    return {
      update(dt, t) {
        for (const tr of BATTLE.trails) if (tr.owner === f && !ribbons.find((r) => r.tr === tr)) ribbons.push(ribbonFor(tr));
        for (let k = ribbons.length - 1; k >= 0; k--) {
          const r = ribbons[k];
          if (!BATTLE.trails.includes(r.tr)) { g.remove(r.m); r.m.geometry.dispose(); ribbons.splice(k, 1); continue; }
          const pts = r.tr.pts, n = Math.min(pts.length, r.max);
          const pos = r.m.geometry.attributes.position.array, uv = r.m.geometry.attributes.uv.array;
          for (let i = 0; i < r.max; i++) {
            const p = pts[Math.min(i, n - 1)], q = pts[Math.min(i + 1, n - 1)], pp = pts[Math.min(Math.max(i - 1, 0), n - 1)];
            let dx = q.x - pp.x, dy = q.y - pp.y; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
            const w = 24 * (0.35 + 0.65 * Math.sin(Math.min(1, i / Math.max(1, n - 1)) * Math.PI));
            pos[i * 6] = p.x - dy * w; pos[i * 6 + 1] = 4; pos[i * 6 + 2] = p.y + dx * w;
            pos[i * 6 + 3] = p.x + dy * w; pos[i * 6 + 4] = 4; pos[i * 6 + 5] = p.y - dx * w;
            const u = i / Math.max(1, n - 1);
            uv[i * 4] = u; uv[i * 4 + 1] = 0; uv[i * 4 + 2] = u; uv[i * 4 + 3] = 1;
          }
          r.m.geometry.attributes.position.needsUpdate = true; r.m.geometry.attributes.uv.needsUpdate = true;
          r.m.material.uniforms.uTime.value = t;
          r.m.material.uniforms.uI.value = 1.8 * Math.max(0, 1 - r.tr.age / r.tr.life);
          if (n > 1) {
            // little swirls of air left along the trail
            const p = pts[Math.floor(Math.random() * n)], a = Math.random() * TAU;
            smoke.emit({ x: p.x, y: p.y, h: 5, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, vh: 30, life: 0.6, size: 10, size1: 26, color: 0xeef5ff, alpha: 0.35, drag: 2.5 });
            if (Math.random() < 0.5) add.emit({ x: p.x, y: p.y, h: 6, vx: -Math.sin(a) * 120, vy: Math.cos(a) * 120, vh: 20, life: 0.3, size: 4, size1: 1, color: 0xeaf6ff, boost: 1.1, drag: 3 });
          }
        }
        // tornado
        const s = f.special && f.special.kind === 'tornado' ? f.special : null;
        if (s) {
          const grow = Math.min(1, s.t / s.wind), shrink = s.t > s.dur ? Math.max(0, 1 - (s.t - s.dur) / 0.35) : 1;
          const k = grow * shrink;
          funnel.visible = dust.visible = bandG.visible = true;
          funnel.position.set(s.x, 0, s.y);
          funnel.scale.set(0.35 + 0.65 * k, 0.2 + 0.8 * k, 0.35 + 0.65 * k);
          funnel.rotation.y -= dt * 5;
          outerMat.uniforms.uTime.value = innerMat.uniforms.uTime.value = coreMat.uniforms.uTime.value = t;
          outerMat.uniforms.uI.value = 0.72 * k; innerMat.uniforms.uI.value = 0.6 * k; coreMat.uniforms.uI.value = 0.5 * k;
          bandG.position.set(s.x, 0, s.y);
          const sx = 0.35 + 0.65 * k, sy = 0.2 + 0.8 * k;
          for (const b of bands) {
            b.m.position.y = b.hb * sy;
            const r = b.r * sx; b.m.scale.set(r, r, r);
            b.m.rotation.z += dt * b.spin;
            b.m.material.opacity = 0.75 * k;
          }
          dust.position.set(s.x, 0.8, s.y);
          const ds = s.R * 1.25 * (0.5 + 0.5 * k); dust.scale.set(ds, ds, 1);
          dust.material.uniforms.uR.value = 0.7; dust.material.uniforms.uW.value = 0.28;
          dust.material.uniforms.uI.value = 0.3 * k; dust.material.uniforms.uFill.value = 1;
          // dust and debris sucked in and thrown up the vortex
          for (let i = 0; i < 5; i++) {
            const a = Math.random() * TAU, r = s.R * (0.6 + Math.random() * 0.6);
            const tang = 170 + Math.random() * 130;
            smoke.emit({ x: s.x + Math.cos(a) * r, y: s.y + Math.sin(a) * r, h: 2,
              vx: -Math.sin(a) * tang - Math.cos(a) * 70, vy: Math.cos(a) * tang - Math.sin(a) * 70, vh: 110 + Math.random() * 110,
              life: 1.0, size: 10 + Math.random() * 12, size1: 26, color: 0xb8bfcc, color1: 0x7d8594, alpha: 0.5 * k, drag: 0.8 });
          }
          if (Math.random() < 0.5) {
            const a = Math.random() * TAU, r = s.R * 0.8;
            smoke.emit({ x: s.x + Math.cos(a) * r, y: s.y + Math.sin(a) * r, h: 3, vx: -Math.sin(a) * 260, vy: Math.cos(a) * 260, vh: 200 + Math.random() * 100,
              life: 0.9, size: 4, size1: 4, color: 0x4a4f5a, alpha: 0.9 * k, drag: 0.6 });   // bits of rock
          }
          for (let i = 0; i < 2; i++) {
            const a = Math.random() * TAU, hh = 10 + Math.random() * 150, rr = 20 + hh * 0.3;
            add.emit({ x: s.x + Math.cos(a) * rr, y: s.y + Math.sin(a) * rr, h: hh, vx: -Math.sin(a) * 260, vy: Math.cos(a) * 260,
              vh: 120, life: 0.45, size: 5, size1: 2, color: 0xeaf6ff, boost: 1.2, drag: 1 });
          }
        } else { funnel.visible = dust.visible = bandG.visible = false; }
      },
      onEvent(e) {
        if (e.type === 'base' && e.f === f) generic.wave(f.x, f.y, 60, 0xdcefff, 0.3);
        if (e.type === 'gust') {
          for (let i = 0; i < 18; i++) smoke.emit({ x: e.x, y: e.y, h: 6, vx: e.dx * 220 + (Math.random() - 0.5) * 90, vy: e.dy * 220 + (Math.random() - 0.5) * 90, vh: 30,
            life: 0.6, size: 12, size1: 32, color: 0xf0f6ff, alpha: 0.5, drag: 3 });
        }
        if (e.type === 'fling') {
          FX.shake(6);
          generic.wave(e.x, e.y, 120, 0xdcefff, 0.4);
          for (let i = 0; i < 32; i++) smoke.emit({ x: e.x, y: e.y, h: 10, vx: e.dx * 260 + (Math.random() - 0.5) * 120, vy: e.dy * 260 + (Math.random() - 0.5) * 120, vh: 40 + Math.random() * 60,
            life: 0.8, size: 14, size1: 36, color: 0xe6ecf5, alpha: 0.5, drag: 2.5 });
        }
        if (e.type === 'special' && e.f === f) { generic.wave(f.x, f.y, 200, 0xdcefff, 0.5); FX.shake(3); }
      },
      dispose() { for (const r of ribbons) { g.remove(r.m); r.m.geometry.dispose(); } disposeTree(g); root.remove(g); }
    };
  }

  // turn angle a toward b by up to k (0..1), the short way round
  function turnTo(a, b, k) { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * k; }

  // Dranzer: Flame Arc and Phoenix Dive
  function kitDranzer(f) {
    const g = new THREE.Group(); root.add(g);
    // Flame Arc: a comet of fire behind Dranzer while it dashes
    const arcUnder = fireMat(0xff8a24, 0xd8340a, 0x4a0602, { speed: 4.5, dark: true });   // keeps it orange on the light floor
    const cometUnder = makeComet(g, arcUnder, 15, 3); cometUnder.m.renderOrder = 16; cometUnder.m.userData.noBloom = true;
    const arcMat = fireMat(0xffc060, 0xff5a10, 0x5a0802, { speed: 4.5 });
    const comet = makeComet(g, arcMat, 13, 2);
    let arcStart = 0;
    // the fire bird
    const P = makeFireBird(g);
    let yaw = 0, lift = 0, sweep = 0, pitch = 0;
    const tmp = new THREE.Vector3(), tv = new THREE.Vector3();
    // target on the ground: a segmented outer ring, an inner ring and a soft fill
    const ret = disc(1, ringMat(0xff8a1e, { seg: 8, fill: 1 }), 1.0); ret.visible = false; g.add(ret);
    const retIn = disc(1, ringMat(0xffe0a0), 1.1); retIn.visible = false; g.add(retIn);
    const shadow = disc(1, ringMat(0x000000, { normal: true, fill: 2.5 }), 0.7); shadow.visible = false; g.add(shadow);
    shadow.userData.noBloom = true;
    // thin beam of fire on the target once it locks
    const pillarMat = fireMat(0xffd27a, 0xff6a1a, 0x8a0f05, { speed: 4 });
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(5, 10, 140, 20, 1, true), pillarMat);
    pillar.visible = false; pillar.renderOrder = 18; g.add(pillar);
    // impact: a column of flame, a wall of fire racing outward, a scorch mark left behind
    const eruptMat = fireMat(0xffe0a0, 0xff6a1a, 0x9a1206, { speed: 5 });
    const erupt = new THREE.Mesh(new THREE.CylinderGeometry(20, 44, 120, 32, 1, true), eruptMat);
    erupt.visible = false; erupt.renderOrder = 18; g.add(erupt);
    const ringFireMat = fireMat(0xffd890, 0xff5a10, 0x7a0a02, { speed: 3.5 });
    const ringFire = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 56, 1, true), ringFireMat);
    ringFire.visible = false; ringFire.renderOrder = 18; g.add(ringFire);
    const scorch = disc(1, ringMat(0x0a0503, { normal: true, fill: 2.6 }), 0.55); scorch.visible = false; g.add(scorch);
    scorch.userData.noBloom = true;
    const embersRing = disc(1, ringMat(0xff6a1a), 0.6); embersRing.visible = false; g.add(embersRing);
    let eruptT = 1, scorchT = 1, ix = 0, iy = 0, big = 1;
    let lastPhase = null;
    const emitTip = (w, v, sz, life, c0, c1, vh, boost) => {
      tmp.copy(v); w.localToWorld(tmp);
      add.emit({ x: tmp.x, y: tmp.z, h: tmp.y, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, vh: vh,
        life, size: sz, size1: 1, color: c0, color1: c1, boost, drag: 1.5, grav: -40 });
    };
    return {
      update(dt, t) {
        // Flame Arc
        if (f.boostTimer > 0 && f.boostSource === 'base') {
          if (!comet.m.visible) arcStart = f.boostTimer;
          const into = arcStart - f.boostTimer;
          const k = Math.min(1, into / 0.08) * Math.min(1, f.boostTimer / 0.2);
          const sp = Math.hypot(f.vx, f.vy);
          if (sp > 20) { cometUnder.place(f.x, f.y, 10, f.vx, f.vy, 34 + 74 * k); comet.place(f.x, f.y, 10, f.vx, f.vy, 28 + 60 * k); }
          arcMat.uniforms.uTime.value = arcUnder.uniforms.uTime.value = t;
          arcMat.uniforms.uI.value = 0.5 * k; arcUnder.uniforms.uI.value = 0.9 * k;
          if (Math.random() < 0.7) emitFire(f.x, f.y, 8, 1, 8, false);
        } else comet.m.visible = cometUnder.m.visible = false;

        const s = f.special && f.special.kind === 'dive' ? f.special : null;
        const flying = s && s.phase !== 'land';
        P.bird.visible = !!flying;
        if (!s) { ret.visible = retIn.visible = shadow.visible = pillar.visible = false; lastPhase = null; return; }
        const h = f.height || 0;
        if (flying) {
          // rise and hover facing the camera with the wings spread, then turn to the target,
          // fold the wings back and dive
          const dx = s.tx - f.x, dy = s.ty - f.y, dist = Math.hypot(dx, dy);
          const toTarget = dist > 6 ? Math.atan2(-dy, dx) : yaw;
          const toCam = -Math.PI / 2;
          const hover = s.phase === 'rise' || s.phase === 'aim';
          const want = hover ? turnTo(toCam, toTarget, 0.3) : toTarget;
          if (lastPhase === null) { yaw = want; lift = 1.3; sweep = 0.5; pitch = 0.4; }
          yaw = turnTo(yaw, want, Math.min(1, dt * (s.phase === 'dive' ? 20 : hover ? 5 : 9)));
          let L = lift, W = sweep, Pt = pitch, scale = 1, stretch = 1;
          if (s.phase === 'rise') {
            const k = Math.min(1, s.pt / 0.45), e = 1 - Math.pow(1 - k, 3);
            scale = 0.25 + 0.75 * e + 0.12 * Math.sin(k * Math.PI);
            L = 1.3 - 1.15 * e; W = 0.5 * (1 - e); Pt = 0.4 - 0.9 * e;
          } else if (s.phase === 'aim') {
            const beat = Math.sin(t * 8);
            L = 0.15 + 0.42 * beat; W = 0.08 * Math.sin(t * 8 + 1.2); Pt = -0.5 + 0.06 * beat;   // tipped toward the camera so the wings show
          } else if (s.phase === 'lock') {
            const k = Math.min(1, dt * 10);
            L = lift + (0.5 - lift) * k; W = sweep + (0.45 - sweep) * k; Pt = pitch + (0.3 - pitch) * k;
          } else if (s.phase === 'dive') {
            const k = Math.min(1, dt * 18);
            L = lift + (0.1 - lift) * k; W = sweep + (1.2 - sweep) * k;
            Pt = -Math.min(1.15, Math.atan2(h + 10, Math.max(4, dist)));
            stretch = 1.3;
          }
          lift = L; sweep = W; pitch = Pt;
          P.pose(lift, sweep);
          P.tail.rotation.y = Math.sin(t * 5) * 0.14;
          P.bird.position.set(f.x, h + 10, f.y);
          P.bird.rotation.set(0, yaw, pitch);
          const S = 0.85 * scale;
          P.bird.scale.set(S * stretch, S, S);
          P.set(t, s.phase === 'dive' ? 1.1 : 1);
          P.bird.updateMatrixWorld(true);
          // embers off the wing tips and flames off the tail
          for (let i = 0; i < 2; i++) {
            const w = Math.random() < 0.5 ? P.wingL : P.wingR, v = P.tips[Math.floor(Math.random() * P.tips.length)];
            tv.set(v.x, v.y, w === P.wingR ? -v.z : v.z);
            emitTip(w, tv, 5, 0.6, 0xffb050, 0xff2a00, -10, 0.7);
          }
          if (Math.random() < 0.5) emitTip(P.tail, tv.set(-30 - Math.random() * 70, 0, (Math.random() - 0.5) * 24), 9, 0.35, 0xff9a30, 0x8a0a02, 10, 0.5);
          if (s.phase === 'dive') {
            // a trail of fire behind it like a comet
            for (let i = 0; i < 6; i++) {
              const k = Math.random();
              add.emit({ x: f.x + (s.fx - f.x) * k * 0.7 + (Math.random() - 0.5) * 14, y: f.y + (s.fy - f.y) * k * 0.7 + (Math.random() - 0.5) * 14,
                h: h + 10 + (62 - h) * k * 0.7, vx: 0, vy: 0, vh: 20, life: 0.35, size: 16 - k * 8, size1: 4,
                color: 0xff9a40, color1: 0x8a0a02, boost: 0.45, drag: 2 });
            }
          }
        }
        // beam on the target while it's locked or Dranzer is diving
        const showPillar = s.phase === 'lock' || s.phase === 'dive';
        pillar.visible = showPillar;
        if (showPillar) {
          pillar.position.set(s.tx, 70, s.ty);
          pillarMat.uniforms.uTime.value = t;
          pillarMat.uniforms.uI.value = 0.3 + 0.15 * Math.sin(t * 30);
        }
        // reticle on the ground
        const showRet = s.phase === 'aim' || s.phase === 'lock' || s.phase === 'dive';
        ret.visible = retIn.visible = shadow.visible = showRet;
        if (showRet) {
          const lock = s.phase !== 'aim';
          const pulse = lock ? 0.75 + 0.25 * Math.sin(t * 40) : 0.85 + 0.15 * Math.sin(t * 8);
          const size = 74 * (lock ? 1 - 0.1 * Math.min(1, s.pt / 0.4) : 1);
          ret.position.set(s.tx, 1.0, s.ty); ret.scale.set(size, size, 1);
          ret.material.uniforms.uColor.value.set(lock ? 0xff2a10 : 0xff8a1e);
          ret.material.uniforms.uR.value = 0.9; ret.material.uniforms.uW.value = 0.05;
          ret.material.uniforms.uTime.value = t; ret.material.uniforms.uI.value = 1.0 * pulse;
          retIn.position.set(s.tx, 1.1, s.ty); retIn.scale.set(size * 0.35, size * 0.35, 1);
          retIn.material.uniforms.uR.value = 0.8; retIn.material.uniforms.uW.value = 0.12; retIn.material.uniforms.uI.value = 0.9 * pulse;
          // the bird's shadow growing as it falls
          const k = s.phase === 'dive' ? Math.min(1, s.pt / 0.22) : 0;
          shadow.position.set(s.tx, 0.7, s.ty); const ss = 16 + 26 * k; shadow.scale.set(ss, ss, 1);
          shadow.material.uniforms.uR.value = 0.5; shadow.material.uniforms.uI.value = 0.3 + 0.3 * k;
        }
        lastPhase = s.phase;
      },
      tick(dt, t) {
        if (eruptT < 1) {
          eruptT += dt / 0.7;
          erupt.visible = ringFire.visible = eruptT < 1;
          const k = Math.min(1, eruptT / 0.2), fade = 1 - eruptT;
          erupt.position.set(ix, 60 * k * big, iy);
          erupt.scale.set(1 - 0.3 * eruptT, k * big, 1 - 0.3 * eruptT);
          eruptMat.uniforms.uTime.value = t; eruptMat.uniforms.uI.value = 0.7 * fade;
          const rr = (24 + 150 * (1 - Math.pow(1 - eruptT, 2))) * big, hh = 34 * fade * big + 4;
          ringFire.position.set(ix, hh / 2, iy); ringFire.scale.set(rr, hh, rr);
          ringFireMat.uniforms.uTime.value = t; ringFireMat.uniforms.uI.value = 0.75 * fade;
        }
        if (scorchT < 1) {
          scorchT += dt / 2.6;
          scorch.visible = embersRing.visible = scorchT < 1;
          scorch.position.set(ix, 0.55, iy); scorch.scale.set(46 * big, 46 * big, 1);
          scorch.material.uniforms.uR.value = 0.55; scorch.material.uniforms.uI.value = 0.55 * (1 - scorchT);
          embersRing.position.set(ix, 0.6, iy); embersRing.scale.set(40 * big, 40 * big, 1);
          embersRing.material.uniforms.uR.value = 0.75; embersRing.material.uniforms.uW.value = 0.2;
          embersRing.material.uniforms.uI.value = 0.6 * Math.max(0, 1 - scorchT * 2.5) * (0.8 + 0.2 * Math.sin(t * 20));
          if (Math.random() < 0.4 * (1 - scorchT)) {
            const a = Math.random() * TAU, r = Math.random() * 36 * big;
            add.emit({ x: ix + Math.cos(a) * r, y: iy + Math.sin(a) * r, h: 2, vx: 0, vy: 0, vh: 30, life: 0.7, size: 4, size1: 1, color: 0xffa040, color1: 0xff2000, boost: 1 });
          }
        }
        if (f.stun > 0) {
          const a = t * 9;
          for (let i = 0; i < 3; i++) {
            const aa = a + i * TAU / 3;
            add.emit({ x: f.x + Math.cos(aa) * 16, y: f.y + Math.sin(aa) * 16, h: 34, life: 0.12, size: 6, size1: 3, color: 0xffe08a, boost: 0.7 });
          }
        }
      },
      onEvent(e) {
        if (e.type === 'special' && e.f === f) {
          // the bird bursts out of a ring of fire
          for (let i = 0; i < 26; i++) {
            const a = Math.random() * TAU;
            add.emit({ x: f.x, y: f.y, h: 4, vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, vh: 150 + Math.random() * 120, life: 0.55, size: 14, size1: 3,
              color: 0xffd890, color1: 0xff3a0a, drag: 2, boost: 0.8 });
          }
          generic.wave(f.x, f.y, 100, 0xff8a1e, 0.45);
          ix = f.x; iy = f.y; big = 0.5; eruptT = 0.35;
        }
        if (e.type === 'diveHit') {
          FX.shake(10);
          flash(e.x, e.y, 30, 0xffa040, 3);
          generic.wave(e.x, e.y, 150, 0xff8a30, 0.6);
          generic.wave(e.x, e.y, 70, 0xffd080, 0.35);
          eruptT = 0; scorchT = 0; ix = e.x; iy = e.y; big = 1;
          // the bird breaks apart into burning feathers
          for (let i = 0; i < 22; i++) {
            const a = (i / 22) * TAU + Math.random() * 0.2, sp = 170 + Math.random() * 150;
            add.emit({ x: e.x, y: e.y, h: 14, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vh: 60 + Math.random() * 90, life: 0.7 + Math.random() * 0.3,
              size: 20, size1: 5, color: 0xffb050, color1: 0x8a0a02, drag: 2.4, grav: -80, boost: 0.55 });
          }
          for (let i = 0; i < 30; i++) {
            const a = Math.random() * TAU, sp = 120 + Math.random() * 260;
            add.emit({ x: e.x, y: e.y, h: 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vh: 100 + Math.random() * 220, life: 0.5 + Math.random() * 0.4,
              size: 6, size1: 1, color: 0xffe0a0, color1: 0xff3000, drag: 2.2, grav: -260, boost: 0.9 });
          }
          for (let i = 0; i < 22; i++) {
            const a = Math.random() * TAU, sp = 60 + Math.random() * 90;
            smoke.emit({ x: e.x, y: e.y, h: 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vh: 50 + Math.random() * 50, life: 1.3, size: 26, size1: 64,
              color: 0x3a2a26, color1: 0x141010, alpha: 0.45, drag: 1.8 });
          }
        }
        if (e.type === 'diveMiss') {
          FX.shake(5);
          generic.wave(e.x, e.y, 100, 0xff8a1e, 0.4);
          eruptT = 0.3; scorchT = 0.4; ix = e.x; iy = e.y; big = 0.6;
          for (let i = 0; i < 14; i++) {
            const a = Math.random() * TAU, sp = 120 + Math.random() * 100;
            add.emit({ x: e.x, y: e.y, h: 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vh: 60, life: 0.5, size: 14, size1: 3, color: 0xffa040, color1: 0x8a0a02, drag: 2.5, boost: 0.5 });
          }
          for (let i = 0; i < 18; i++) {
            const a = Math.random() * TAU;
            smoke.emit({ x: e.x, y: e.y, h: 4, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, vh: 30, life: 0.9, size: 18, size1: 40, color: 0x8b8178, alpha: 0.45, drag: 2 });
          }
        }
      },
      dispose() { disposeTree(g); root.remove(g); }
    };
  }

  // Black Dranzer: Dark Claw and Eclipse Drain
  function kitBlackDranzer(f) {
    const g = new THREE.Group(); root.add(g);
    // Dark Claw: a comet of black flame with a red-hot core
    const darkMat = fireMat(0x3a0610, 0x14030a, 0x000000, { speed: 4.5, dark: true });
    const darkComet = makeComet(g, darkMat, 17, 4); darkComet.m.userData.noBloom = true; darkComet.m.renderOrder = 16;
    const redMat = fireMat(0xff7a5a, 0xd01020, 0x3a0004, { speed: 5 });
    const redComet = makeComet(g, redMat, 9, 2);
    let clawStart = 0;
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), fresnelMat(0x12020a, 0xff2a2a, { normal: true, innerA: 0.45, pow: 2.6 }));
    sphere.visible = false; sphere.renderOrder = 14; g.add(sphere);
    const core = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), fresnelMat(0x000000, 0xb3100a, { innerA: 0.0, pow: 1.8 }));
    core.visible = false; core.renderOrder = 18; g.add(core);
    // the black sun hanging over Black Dranzer
    const sun = new THREE.Group(); sun.visible = false; g.add(sun);
    const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(0.43, 48), new THREE.MeshBasicMaterial({ color: 0x050002, transparent: true, opacity: 0, depthWrite: false }));
    sunDisc.renderOrder = 20; sunDisc.userData.noBloom = true; sun.add(sunDisc);
    const coronaM = coronaMat();
    const corona = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), coronaM); corona.renderOrder = 21; sun.add(corona);
    const tendrilMat = flowMat(0xff2414);
    const tendril = new THREE.Mesh(new THREE.BufferGeometry(), tendrilMat); tendril.visible = false; tendril.renderOrder = 21; g.add(tendril);
    let tendrilT = 0;
    return {
      update(dt, t) {
        if (f.boostTimer > 0 && f.boostSource === 'base') {
          if (!darkComet.m.visible) clawStart = f.boostTimer;
          const into = clawStart - f.boostTimer;
          const k = Math.min(1, into / 0.08) * Math.min(1, f.boostTimer / 0.15);
          if (Math.hypot(f.vx, f.vy) > 20) {
            darkComet.place(f.x, f.y, 10, f.vx, f.vy, 34 + 70 * k);
            redComet.place(f.x, f.y, 10, f.vx, f.vy, 24 + 46 * k);
          }
          darkMat.uniforms.uTime.value = redMat.uniforms.uTime.value = t;
          darkMat.uniforms.uI.value = 0.9 * k; redMat.uniforms.uI.value = 0.7 * k;
          if (Math.random() < 0.6) emitFire(f.x, f.y, 8, 1, 8, true);
        } else darkComet.m.visible = redComet.m.visible = false;
        const s = f.special && f.special.kind === 'eclipse' ? f.special : null;
        if (!s) { sphere.visible = core.visible = tendril.visible = sun.visible = false; return; }
        const k = Math.min(1, s.t / 0.3) * Math.min(1, (s.dur - s.t) / 0.3 + 0.01);
        dimTarget = Math.max(dimTarget, 0.5 * k);
        sphere.visible = core.visible = sun.visible = true;
        sphere.position.set(f.x, 6, f.y); const sr = s.R * (0.85 + 0.15 * k); sphere.scale.set(sr, sr * 0.55, sr);
        sphere.material.uniforms.uTime.value = t; sphere.material.uniforms.uI.value = 0.9 * k;
        core.position.set(f.x, 22, f.y); const cr = 20 + Math.sin(t * 12) * 2; core.scale.set(cr, cr, cr);
        core.material.uniforms.uTime.value = t; core.material.uniforms.uI.value = 0.75 * k;
        // black sun: rises out of Black Dranzer and always faces the camera
        const rise = Math.min(1, s.t / 0.45);
        sun.position.set(f.x, 30 + 50 * (1 - Math.pow(1 - rise, 3)), f.y);
        sun.quaternion.copy(C.quaternion);
        const ss = 62 * (0.4 + 0.6 * rise) * (1 + 0.04 * Math.sin(t * 7)); sun.scale.set(ss, ss, ss);
        corona.rotation.z = t * 0.4;
        coronaM.uniforms.uTime.value = t; coronaM.uniforms.uI.value = 1.1 * k;
        sunDisc.material.opacity = 0.95 * k;
        // black flames rising around Black Dranzer
        emitFire(f.x, f.y, 4, 3, s.R * 0.6, true);
        // drain tendril to the rival
        tendrilT -= dt;
        const o = s.foe;
        if (s.linked) {
          if (tendrilT <= 0) {
            tendrilT = 0.05;
            const a = V3(o.x, o.y, 16), b = V3(f.x, f.y, 22);
            const mid = a.clone().lerp(b, 0.5); mid.y += 28;
            const pts = boltPoints(a, mid, 10, 4).concat(boltPoints(mid, b, 10, 4).slice(1));
            tendril.geometry.dispose();
            tendril.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 2.4, 5, false);
          }
          tendril.visible = true; tendrilMat.uniforms.uTime.value = t; tendrilMat.uniforms.uI.value = 1.4 * k;
          // the drained spin flows from the rival into Black Dranzer, and up into the black sun
          const dx = f.x - o.x, dy = f.y - o.y;
          add.emit({ x: o.x, y: o.y, h: 14, vx: dx * 2.2, vy: dy * 2.2, vh: 20, life: 0.45, size: 7, size1: 3, color: 0xff4a3a, color1: 0x7a0000, boost: 1.1 });
          if (Math.random() < 0.5) add.emit({ x: f.x, y: f.y, h: 20, vx: 0, vy: 0, vh: (sun.position.y - 20) * 2, life: 0.5, size: 5, size1: 2, color: 0xff5040, color1: 0x5a0000, boost: 1 });
        } else tendril.visible = false;
      },
      onEvent(e) {
        if (e.type === 'clawMiss' && e.x != null) emitFire(e.x, e.y, 6, 10, 10, true);
        if (e.type === 'drain') generic.sparks(e.x, e.y, 14, 12, [0xff3020, 0x2a0000], 120, 0.4, 5);
        if (e.type === 'special' && e.f === f) { generic.wave(f.x, f.y, 180, 0xff2020, 0.5); FX.shake(3); }
      },
      dispose() { tendril.geometry.dispose(); disposeTree(g); root.remove(g); }
    };
  }

  // Driger: Twin Pounce and Thunder Claw
  function kitDriger(f) {
    const g = new THREE.Group(); root.add(g);
    const bolts = [0, 1, 2, 3].map(() => new Bolt(g, 0x3dff5a, 1.2, 4));
    const sky = new Bolt(g, 0x7dff8a, 2.2, 7);
    const timing = disc(1, ringMat(0x7dff8a), 1.3); timing.visible = false; g.add(timing);
    const target = disc(1, ringMat(0xeaffc8), 1.2); target.visible = false; g.add(target);
    // three claw marks, drawn across the rival one after the other
    const slashG = new THREE.Group(); g.add(slashG);
    const slashes = [0, 1, 2].map((i) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), slashMat(0xffffff, 0x3dff5a));
      m.rotation.x = -Math.PI / 2 + 0.55; m.position.set((i - 1) * 12, i * 2, 0);
      m.renderOrder = 22; m.visible = false; slashG.add(m);
      return m;
    });
    let slashT = 1, boltT = 0, perfect = false;
    return {
      update(dt, t) {
        const s = f.special && f.special.kind === 'claw' ? f.special : null;
        const charged = (f.boostTimer > 0 && (f.boostSource === 'base' || f.boostSource === 'claw')) || !!s;
        boltT -= dt;
        if (charged && boltT <= 0) {
          boltT = 0.06;
          for (const b of bolts) {
            const a0 = Math.random() * TAU, a1 = a0 + (Math.random() - 0.5) * 2.6;
            b.strike(V3(f.x + Math.cos(a0) * 16, f.y + Math.sin(a0) * 16, 10 + Math.random() * 24),
                     V3(f.x + Math.cos(a1) * (30 + Math.random() * 30), f.y + Math.sin(a1) * (30 + Math.random() * 30), 1 + Math.random() * 6), 14, 8);
          }
        }
        for (const b of bolts) b.fade(dt, charged ? 8 : 12);
        sky.fade(dt, 3.5);
        // electric trail while it pounces
        if (f.boostTimer > 0 && f.boostSource !== 'release') {
          for (let i = 0; i < 2; i++) add.emit({ x: f.x + (Math.random() - 0.5) * 14, y: f.y + (Math.random() - 0.5) * 14, h: 6 + Math.random() * 12,
            vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, vh: 10, life: 0.3, size: 7, size1: 2, color: 0xeaffd0, color1: 0x2acc40, boost: 1.2, drag: 3 });
        }
        if (s && s.count < 3) {
          const beatStart = s.next - s.beat, p = Math.min(1.2, (s.t - beatStart) / s.beat);
          timing.visible = target.visible = true;
          const big = 46 + (1 - Math.min(1, p)) * 120;
          timing.position.set(f.x, 1.3, f.y); timing.scale.set(big, big, 1);
          timing.material.uniforms.uR.value = 0.92; timing.material.uniforms.uW.value = 0.045; timing.material.uniforms.uI.value = 1.4;
          const close = 1 - Math.min(1, Math.abs(s.t - s.next) / 0.11);
          target.position.set(f.x, 1.2, f.y); target.scale.set(46, 46, 1);
          target.material.uniforms.uR.value = 0.92; target.material.uniforms.uW.value = 0.06; target.material.uniforms.uI.value = 0.7 + 1.6 * close;
        } else { timing.visible = target.visible = false; }
        if (slashT < 1) {
          slashT += dt / 0.4;
          slashes.forEach((m, i) => {
            const lt = slashT * 0.4 - i * 0.04;        // each mark starts a moment after the last
            m.visible = slashT < 1 && lt > 0;
            const u = m.material.uniforms;
            u.uSweep.value = Math.min(1.3, lt / 0.09 * 1.3);
            u.uI.value = (perfect ? 1.5 : 1.15) * Math.max(0, 1 - Math.max(0, lt - 0.12) / 0.24);
            const sc = (perfect ? 50 : 42) * (1 + lt * 0.4); m.scale.set(sc, sc, 1);
          });
        }
      },
      onEvent(e) {
        if (e.type === 'special' && e.f === f) {
          sky.strike(V3(f.x + 20, f.y - 30, 260), V3(f.x, f.y, 20), 40, 14);
          flash(f.x, f.y, 40, 0x7dff8a, 3); FX.shake(4);
          generic.wave(f.x, f.y, 150, 0x7dff8a, 0.45);
        }
        if (e.type === 'base' && e.f === f) generic.wave(f.x, f.y, 55, 0x9dff8a, 0.25);
        if (e.type === 'claw' && e.f === f) {
          const o = foeOfF(f);
          if (e.q === 'miss') { generic.sparks(f.x, f.y, 10, 6, [0x8a948a], 80, 0.3, 4); return; }
          perfect = e.q === 'perfect';
          const ang = Math.atan2(o.y - f.y, o.x - f.x);
          slashG.position.set(o.x, 16, o.y); slashG.rotation.set(0, -ang, 0);
          slashes.forEach((m) => { m.material.uniforms.uCore.value.set(perfect ? 0xffffff : 0xeaffd8); m.material.uniforms.uEdge.value.set(perfect ? 0xffe060 : 0x3dff5a); });
          slashT = 0;
          generic.wave(o.x, o.y, perfect ? 130 : 80, perfect ? 0xfff2a0 : 0x7dff8a, 0.3);
          generic.sparks(o.x, o.y, 14, perfect ? 26 : 12, [0xffffff, 0xc8ffb0, 0x3dff5a], 220, 0.35, 5);
          if (perfect) {
            flash(o.x, o.y, 20, 0xeaff9a, 2.5); FX.shake(5);
            sky.strike(V3(o.x - 30, o.y - 40, 260), V3(o.x, o.y, 10), 40, 14);   // a perfect hit calls down lightning
          }
        }
      },
      dispose() { bolts.forEach((b) => b.dispose()); sky.dispose(); disposeTree(g); root.remove(g); }
    };
  }

  // Draciel: Iron Shell and Maelstrom
  function kitDraciel(f) {
    const g = new THREE.Group(); root.add(g);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 18, 0, TAU, 0, Math.PI * 0.55), fresnelMat(0x0b3a1a, 0x9dffb0, { innerA: 0.25, pow: 1.6, hex: true }));
    shell.visible = false; shell.renderOrder = 18; g.add(shell);
    const ripple = disc(1, ringMat(0x9dffb0), 1.2); ripple.visible = false; g.add(ripple);
    const pool = disc(1, whirlpoolMat(), 0.5); pool.visible = false; pool.renderOrder = 12; g.add(pool);
    const wallGeo = new THREE.CylinderGeometry(1, 1, 1, 48, 1, true);
    const wallMat = windMat(0x1a6aa8, 0xe8f8ff, { twist: 0.6, speed: 2.2 });
    const wall = new THREE.Mesh(wallGeo, wallMat); wall.visible = false; wall.renderOrder = 17; g.add(wall);
    // a second, lower and faster ring of water inside the first
    const wall2Mat = windMat(0x0f4f8a, 0xbfe8ff, { twist: 1.2, speed: 3.4 });
    const wall2 = new THREE.Mesh(wallGeo, wall2Mat); wall2.visible = false; wall2.renderOrder = 17; g.add(wall2);
    return {
      update(dt, t) {
        // the shell is gold while a parry is still possible, then turns green
        if (f.guardTimer > 0) {
          const parry = f.guardAge <= PARRY_WINDOW;
          shell.visible = ripple.visible = true;
          shell.position.set(f.x, 0, f.y);
          const pop = Math.min(1, f.guardAge / 0.08);
          const r = (24 + 8 * pop) + (parry ? 3 * Math.sin(t * 30) : 0); shell.scale.set(r, r * 1.05, r);
          shell.material.uniforms.uRim.value.set(parry ? 0xffe27a : 0x9dffb0);
          shell.material.uniforms.uTime.value = t;
          shell.material.uniforms.uI.value = parry ? 1.5 : 0.95 * Math.min(1, f.guardTimer / 0.2);
          // a ring pulsing out along the floor from the shell
          const rp = (t * 1.6) % 1;
          ripple.position.set(f.x, 1.2, f.y); ripple.scale.set(30 + 40 * rp, 30 + 40 * rp, 1);
          ripple.material.uniforms.uColor.value.set(parry ? 0xffe27a : 0x9dffb0);
          ripple.material.uniforms.uR.value = 0.9; ripple.material.uniforms.uW.value = 0.05;
          ripple.material.uniforms.uI.value = 0.8 * (1 - rp) * Math.min(1, f.guardTimer / 0.2);
        } else shell.visible = ripple.visible = false;
        const s = f.special && f.special.kind === 'maelstrom' ? f.special : null;
        if (s) {
          const k = Math.min(1, s.t / s.wind) * Math.min(1, (s.dur - s.t) / 0.35 + 0.01);
          pool.visible = wall.visible = wall2.visible = true;
          pool.position.set(f.x, 0.5, f.y); const pr = s.R * 1.05; pool.scale.set(pr, pr, 1);
          pool.material.uniforms.uTime.value = t; pool.material.uniforms.uI.value = k;
          wall.position.set(f.x, 13 * k, f.y); wall.scale.set(s.R * 1.03, 26 * k, s.R * 1.03);
          wallMat.uniforms.uTime.value = t; wallMat.uniforms.uI.value = 0.85 * k;
          wall2.position.set(f.x, 7 * k, f.y); wall2.scale.set(s.R * 0.6, 14 * k, s.R * 0.6);
          wall2Mat.uniforms.uTime.value = t; wall2Mat.uniforms.uI.value = 0.6 * k;
          // spray thrown off the top of the wave
          for (let i = 0; i < 4; i++) {
            const a = Math.random() * TAU;
            smoke.emit({ x: f.x + Math.cos(a) * s.R, y: f.y + Math.sin(a) * s.R, h: 20 * k, vx: -Math.sin(a) * 130, vy: Math.cos(a) * 130, vh: 80 + Math.random() * 70,
              life: 0.6, size: 8, size1: 18, color: 0xf0fbff, color1: 0x7ac8ff, alpha: 0.75 * k, grav: -240, drag: 1 });
          }
          if (Math.random() < 0.5) {
            const a = Math.random() * TAU, r = s.R * Math.random();
            add.emit({ x: f.x + Math.cos(a) * r, y: f.y + Math.sin(a) * r, h: 2, vx: -Math.sin(a) * 90, vy: Math.cos(a) * 90, vh: 10,
              life: 0.5, size: 5, size1: 2, color: 0xcff0ff, boost: 1.1 });   // glints on the water
          }
          const o = s.foe;
          if (o.inMaelstrom && Math.random() < 0.7) smoke.emit({ x: o.x, y: o.y, h: 3, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, vh: 70,
            life: 0.5, size: 7, size1: 14, color: 0xffffff, color1: 0x9ad8ff, alpha: 0.8, grav: -260 });
        } else pool.visible = wall.visible = wall2.visible = false;
      },
      onEvent(e) {
        if (e.type === 'parry') {
          FX.shake(6); flash(e.x, e.y, 20, 0xffe27a, 3.5);
          generic.wave(e.x, e.y, 160, 0xffe27a, 0.4);
          generic.sparks(e.x, e.y, 14, 40, [0xffffff, 0xffe27a, 0xffc040], 260, 0.5, 6);
        }
        if (e.type === 'block') { generic.wave(e.x, e.y, 80, 0x9dffb0, 0.3); generic.sparks(e.x, e.y, 12, 14, [0x9dffb0, 0xffffff], 150, 0.35, 4); }
        if (e.type === 'special' && e.f === f) {
          generic.wave(f.x, f.y, 230, 0x7ac8ff, 0.6);
          for (let i = 0; i < 24; i++) {
            const a = Math.random() * TAU, sp = 60 + Math.random() * 80;
            smoke.emit({ x: f.x, y: f.y, h: 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vh: 160 + Math.random() * 80, life: 0.8, size: 9, size1: 16,
              color: 0xf0fbff, color1: 0x7ac8ff, alpha: 0.8, grav: -320 });   // splash
          }
        }
      },
      dispose() { disposeTree(g); root.remove(g); }
    };
  }

  // Wolborg: Frost Howl and White Blizzard
  function kitWolborg(f) {
    const g = new THREE.Group(); root.add(g);
    const sheet = disc(1, iceSheetMat(), 0.45); sheet.visible = false; sheet.renderOrder = 11; g.add(sheet);
    sheet.userData.noBloom = true;
    const crystalMat = fresnelMat(0x9fd8ff, 0xffffff, { innerA: 0.35, pow: 1.8, normal: true });
    const crystal = new THREE.Group();
    const big = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), crystalMat); big.scale.set(26, 34, 26); big.position.y = 22; crystal.add(big);
    for (let i = 0; i < 5; i++) {
      const sh = new THREE.Mesh(new THREE.ConeGeometry(5, 26 + (i % 2) * 10, 5), crystalMat);
      const a = (i / 5) * TAU; sh.position.set(Math.cos(a) * 22, 10, Math.sin(a) * 22);
      sh.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); crystal.add(sh);
    }
    crystal.visible = false; crystal.children.forEach((c) => { c.renderOrder = 19; }); g.add(crystal);
    // White Blizzard: a ring of ice spikes bursting out of the floor around Wolborg
    const spikeMat = fresnelMat(0x7fc4ff, 0xf4fbff, { innerA: 0.45, pow: 1.5, normal: true });
    const spikes = new THREE.Group(); spikes.visible = false; g.add(spikes);
    const spikeList = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + (i % 2) * 0.12, r = 48 + (i % 3) * 7, hgt = 30 + ((i * 7) % 4) * 9;
      const m = new THREE.Mesh(new THREE.ConeGeometry(6 + (i % 2) * 2, 1, 5), spikeMat);
      m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      m.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
      m.renderOrder = 19; spikes.add(m);
      spikeList.push({ m, hgt, delay: (i % 5) * 0.04 });
    }
    // Frost Howl: a few cone meshes reused for each howl in flight
    const cones = [0, 1, 2].map(() => {
      const m = disc(1, frostMat(), 2.0); m.visible = false; m.renderOrder = 21; g.add(m);
      return { m, w: null };
    });
    return {
      update(dt, t) {
        for (const c of cones) if (c.w && !BATTLE.waves.includes(c.w)) { c.w = null; c.m.visible = false; }
        for (const w of BATTLE.waves) {
          if (w.owner !== f || cones.find((c) => c.w === w)) continue;
          const free = cones.find((c) => !c.w);
          if (free) free.w = w;
        }
        for (const c of cones) {
          if (!c.w) continue;
          const w = c.w, p = Math.min(1, w.t / w.dur), front = w.len * p;
          c.m.visible = true;
          c.m.position.set(w.x, 2, w.y); c.m.rotation.z = -w.ang;
          c.m.scale.set(w.len * 1.08, w.len * 1.08, 1);
          const u = c.m.material.uniforms;
          u.uTime.value = t; u.uHalf.value = w.half * 1.1; u.uFront.value = Math.max(0.02, p / 1.08);
          u.uI.value = 1.1 * (1 - Math.max(0, w.t - w.dur) / 0.3);
          // ice shards and freezing mist blown along the cone
          for (let i = 0; i < 3; i++) {
            const ang = w.ang + (Math.random() - 0.5) * w.half * 1.8, r = front * (0.3 + Math.random() * 0.7);
            add.emit({ x: w.x + Math.cos(ang) * r, y: w.y + Math.sin(ang) * r, h: 3 + Math.random() * 10, vx: Math.cos(ang) * 200, vy: Math.sin(ang) * 200, vh: 20 + Math.random() * 30,
              life: 0.35, size: 4 + Math.random() * 3, size1: 1, color: 0xffffff, color1: 0x7fc4ff, boost: 1.2, drag: 3, grav: -100 });
          }
          if (Math.random() < 0.9) {
            const ang = w.ang + (Math.random() - 0.5) * w.half * 2;
            smoke.emit({ x: w.x + Math.cos(ang) * front, y: w.y + Math.sin(ang) * front, h: 4 + Math.random() * 6, vx: Math.cos(ang) * 60, vy: Math.sin(ang) * 60, vh: 12,
              life: 0.6, size: 10, size1: 26, color: 0xffffff, color1: 0xbfe6ff, alpha: 0.5, drag: 2 });
          }
        }
        const o = foeOfF(f);
        if (o.slow > 0 && Math.random() < 0.6) add.emit({ x: o.x + (Math.random() - 0.5) * 20, y: o.y + (Math.random() - 0.5) * 20, h: 8 + Math.random() * 10, vx: 0, vy: 0, vh: 15,
          life: 0.5, size: 5, size1: 2, color: 0xd8f4ff, boost: 1.3 });
        const s = f.special && f.special.kind === 'blizzard' ? f.special : null;
        if (s) {
          const k = Math.min(1, s.t / 0.4) * Math.min(1, (s.dur - s.t) / 0.4 + 0.01);
          sheet.visible = spikes.visible = true;
          sheet.scale.set(ARENA.r * 1.02, ARENA.r * 1.02, 1); sheet.position.set(0, 0.45, 0);
          const u = sheet.material.uniforms;
          u.uTime.value = t; u.uI.value = k; u.uSpread.value = Math.min(2.2, s.t * 2.6);
          if (s.t < 0.05) u.uOrigin.value.set(f.x / ARENA.r, -f.y / ARENA.r);
          // ice spikes shoot up, then sink back into the floor at the end
          spikes.position.set(f.x, 0, f.y);
          spikeMat.uniforms.uTime.value = t; spikeMat.uniforms.uI.value = 1.1 * k;
          for (const sp of spikeList) {
            const up = Math.max(0, Math.min(1, (s.t - sp.delay) / 0.16));
            const e = up < 1 ? 1 - Math.pow(1 - up, 3) * Math.cos(up * 4) : 1;
            const hh = Math.max(0.01, sp.hgt * e * Math.min(1, (s.dur - s.t) / 0.4 + 0.01));
            sp.m.scale.set(1, hh, 1); sp.m.position.y = hh * 0.45;
          }
          // snowfall across the whole stadium, blown by the wind
          for (let i = 0; i < 9; i++) {
            const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * ARENA.r * 1.1;
            smoke.emit({ x: Math.cos(a) * r - 60, y: Math.sin(a) * r, h: 120 + Math.random() * 80, vx: 70 + Math.random() * 40, vy: (Math.random() - 0.5) * 20, vh: -110 - Math.random() * 60,
              life: 1.4, size: 4 + Math.random() * 4, color: 0xffffff, alpha: 0.9 * k });
          }
          // a whirl of snow around Wolborg
          for (let i = 0; i < 3; i++) {
            const a = Math.random() * TAU, r = 30 + Math.random() * 40;
            smoke.emit({ x: f.x + Math.cos(a) * r, y: f.y + Math.sin(a) * r, h: 4 + Math.random() * 30, vx: -Math.sin(a) * 180, vy: Math.cos(a) * 180, vh: 30,
              life: 0.6, size: 5, size1: 3, color: 0xffffff, alpha: 0.9 * k, drag: 0.5 });
          }
          if (Math.random() < 0.3) smoke.emit({ x: (Math.random() - 0.5) * ARENA.r * 2, y: (Math.random() - 0.5) * ARENA.r * 2, h: 10, vx: 80, vy: 0, vh: 5,
            life: 1.6, size: 60, size1: 110, color: 0xe8f6ff, alpha: 0.12 * k, drag: 0.5 });
        } else sheet.visible = spikes.visible = false;
        // frozen rival: ice crystal around it
        if (o.frozen > 0) {
          crystal.visible = true; crystal.position.set(o.x, 0, o.y);
          crystalMat.uniforms.uTime.value = t; crystalMat.uniforms.uI.value = Math.min(1, o.frozen / 0.15) * 1.2;
          if (Math.random() < 0.4) smoke.emit({ x: o.x + (Math.random() - 0.5) * 40, y: o.y + (Math.random() - 0.5) * 40, h: 4, vx: 0, vy: 0, vh: 12, life: 0.9, size: 14, size1: 30, color: 0xeaf8ff, alpha: 0.3 });
        } else crystal.visible = false;
      },
      onEvent(e) {
        if (e.type === 'freeze') {
          FX.shake(5); flash(e.x, e.y, 20, 0xbfe6ff, 3);
          generic.wave(e.x, e.y, 130, 0xdff6ff, 0.4);
          for (let i = 0; i < 40; i++) {
            const a = Math.random() * TAU, sp = 80 + Math.random() * 180;
            add.emit({ x: e.x, y: e.y, h: 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vh: 60 + Math.random() * 140, life: 0.6, size: 6, size1: 2,
              color: 0xffffff, color1: 0x8fd0ff, drag: 2, grav: -200, boost: 1.4 });
          }
        }
        if (e.type === 'howlHit') generic.sparks(e.x, e.y, 10, 16, [0xffffff, 0xbfe6ff], 120, 0.4, 5);
        if (e.type === 'base' && e.f === f) generic.wave(f.x, f.y, 50, 0xbfe6ff, 0.25);
        if (e.type === 'special' && e.f === f) {
          generic.wave(f.x, f.y, 260, 0x9fdcff, 0.7); FX.shake(3); flash(f.x, f.y, 30, 0xbfe6ff, 2);
          for (let i = 0; i < 30; i++) {
            const a = Math.random() * TAU, sp = 100 + Math.random() * 160;
            add.emit({ x: f.x, y: f.y, h: 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vh: 80 + Math.random() * 120, life: 0.6, size: 6, size1: 2,
              color: 0xffffff, color1: 0x8fd0ff, drag: 2, grav: -200, boost: 1.2 });
          }
        }
      },
      dispose() { disposeTree(g); root.remove(g); }
    };
  }

  // Zeus: Mirror Guard and Dark Dimension
  function kitZeus(f) {
    const g = new THREE.Group(); root.add(g);
    const shards = [];
    const shardMat = fresnelMat(0x3a1d6e, 0xe2d4ff, { innerA: 0.35, pow: 1.2 });
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(17, 30), shardMat); m.renderOrder = 19; m.visible = false; g.add(m); shards.push(m);
    }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), fresnelMat(0x06010f, 0xb06bff, { normal: true, innerA: 0.6, pow: 2.4, side: THREE.BackSide }));
    dome.visible = false; dome.renderOrder = 13; g.add(dome);
    const domeFront = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), fresnelMat(0x000000, 0xc88cff, { innerA: 0.0, pow: 3.0 }));
    domeFront.visible = false; domeFront.renderOrder = 23; g.add(domeFront);
    const winds = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 6, 64, Math.PI * 1.2), new THREE.MeshBasicMaterial({ color: 0xd0b8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.renderOrder = 22; m.visible = false; g.add(m); winds.push(m);
    }
    const markers = [], boltsPool = [], branches = [];
    for (let i = 0; i < 5; i++) {
      const m = disc(1, ringMat(0xc070ff, { fill: 1.5, seg: 6 }), 1.3); m.visible = false; g.add(m); markers.push(m);
      boltsPool.push(new Bolt(g, 0xa060ff, 2.0, 6.5));
      branches.push(new Bolt(g, 0xa060ff, 1.0, 3.5));
    }
    const scorches = [0, 1, 2].map(() => { const m = disc(1, ringMat(0x1a0630, { normal: true, fill: 2.6 }), 0.55); m.visible = false; m.userData.noBloom = true; g.add(m); return { m, t: 1 }; });
    let bi = 0, si = 0;
    return {
      update(dt, t) {
        // mirror shards circle Zeus while the mirror is up, and glow once a hit is stored
        const showShards = f.mirror > 0 || f.mirrorStore > 0.005;
        shards.forEach((m, i) => {
          m.visible = showShards;
          if (!showShards) return;
          const a = t * 3 + (i / 6) * TAU, r = f.mirror > 0 ? 38 : 30;
          m.position.set(f.x + Math.cos(a) * r, 18 + Math.sin(t * 4 + i) * 3, f.y + Math.sin(a) * r);
          m.lookAt(f.x, 18, f.y);
        });
        shardMat.uniforms.uTime.value = t;
        shardMat.uniforms.uI.value = f.mirror > 0 ? 1.4 : 0.9;
        if (f.boostTimer > 0 && f.boostSource === 'release') {
          for (let i = 0; i < 3; i++) add.emit({ x: f.x + (Math.random() - 0.5) * 16, y: f.y + (Math.random() - 0.5) * 16, h: 10 + Math.random() * 10, vx: 0, vy: 0, vh: 10,
            life: 0.35, size: 9, size1: 2, color: 0xe2d4ff, color1: 0x7a30ff, boost: 1.0 });
        }
        for (const sc of scorches) {
          if (sc.t >= 1) continue;
          sc.t += dt / 1.8; sc.m.visible = sc.t < 1;
          sc.m.material.uniforms.uR.value = 0.5; sc.m.material.uniforms.uI.value = 0.5 * (1 - sc.t);
        }
        const s = f.special && f.special.kind === 'dimension' ? f.special : null;
        for (const b of boltsPool) b.fade(dt, 4);
        for (const b of branches) b.fade(dt, 6);
        if (s) {
          const k = Math.min(1, s.t / 0.3) * Math.min(1, (s.dur - s.t) / 0.3 + 0.01);
          dimTarget = Math.max(dimTarget, 0.7 * k);
          dome.visible = domeFront.visible = true;
          const r = 150 * (0.6 + 0.4 * k);
          dome.position.set(f.x, 0, f.y); dome.scale.set(r, r * 0.6, r);
          domeFront.position.copy(dome.position); domeFront.scale.copy(dome.scale);
          dome.material.uniforms.uTime.value = domeFront.material.uniforms.uTime.value = t;
          dome.material.uniforms.uI.value = 0.85 * k; domeFront.material.uniforms.uI.value = 0.7 * k;
          winds.forEach((m, i) => {
            m.visible = true; m.position.set(f.x, 8 + i * 10, f.y);
            const wr = 36 + i * 16; m.scale.set(wr, wr, wr);
            m.rotation.z = t * (4 + i) * (i % 2 ? -1 : 1);
            m.material.opacity = 0.75 * k;
          });
          // warning markers on the ground before each bolt
          markers.forEach((m, i) => {
            const b = s.bolts[i];
            if (!b || b.struck) { m.visible = false; return; }
            m.visible = true;
            const p = Math.min(1, b.t / 0.55);
            m.position.set(b.x, 1.3, b.y); const ms = 32 * (1.5 - 0.5 * p); m.scale.set(ms, ms, 1);
            m.material.uniforms.uR.value = 0.85; m.material.uniforms.uW.value = 0.06;
            m.material.uniforms.uTime.value = t * 2; m.material.uniforms.uI.value = 0.6 + 1.2 * p + 0.4 * Math.sin(t * 30) * p;
            // static crackling over the marker as it charges
            if (Math.random() < 0.3 * p) add.emit({ x: b.x + (Math.random() - 0.5) * 24, y: b.y + (Math.random() - 0.5) * 24, h: 2, vx: 0, vy: 0, vh: 60 + 80 * p,
              life: 0.3, size: 4, size1: 1, color: 0xe2d4ff, boost: 1.3 });
          });
          if (Math.random() < 0.5) add.emit({ x: f.x + (Math.random() - 0.5) * 200, y: f.y + (Math.random() - 0.5) * 200, h: 5, vx: 0, vy: 0, vh: 40, life: 1, size: 4, size1: 1, color: 0xb070ff, boost: 1.5 });
        } else {
          dome.visible = domeFront.visible = false;
          winds.forEach((m) => { m.visible = false; });
          markers.forEach((m) => { m.visible = false; });
        }
      },
      onEvent(e) {
        if (e.type === 'bolt') {
          const b = boltsPool[bi], br = branches[bi]; bi = (bi + 1) % boltsPool.length;
          const top = V3(e.x + (Math.random() - 0.5) * 60, e.y - 40, 300), end = V3(e.x, e.y, 0);
          b.strike(top, end, 46, 16);
          // a thinner fork splitting off halfway down
          const mid = top.clone().lerp(end, 0.45 + Math.random() * 0.2), a = Math.random() * TAU;
          br.strike(mid, V3(e.x + Math.cos(a) * 50, e.y + Math.sin(a) * 50, 0), 24, 8);
          flash(e.x, e.y, 30, 0xb080ff, e.hit ? 4 : 2.5);
          FX.shake(e.hit ? 6 : 3);
          generic.wave(e.x, e.y, e.hit ? 150 : 100, 0xd8c0ff, 0.4);
          generic.sparks(e.x, e.y, 4, e.hit ? 36 : 18, [0xffffff, 0xc8a0ff, 0x8040ff], 240, 0.45, 5);
          const sc = scorches[si]; si = (si + 1) % scorches.length;
          sc.t = 0; sc.m.visible = true; sc.m.position.set(e.x, 0.55, e.y); sc.m.scale.set(30, 30, 1);
        }
        if (e.type === 'absorb') { flash(e.x, e.y, 20, 0xc8a0ff, 2.5); generic.wave(e.x, e.y, 100, 0xe2d4ff, 0.35); generic.sparks(e.x, e.y, 14, 14, [0xffffff, 0xe2d4ff], 140, 0.35, 4); }
        if (e.type === 'release') { FX.shake(5); flash(e.x, e.y, 20, 0xc8a0ff, 3); generic.wave(e.x, e.y, 150, 0xb080ff, 0.4); generic.sparks(e.x, e.y, 12, 30, [0xffffff, 0xb080ff], 220, 0.45, 6); }
        if (e.type === 'reflect') { generic.wave(e.x, e.y, 80, 0xc070ff, 0.3); }
        if (e.type === 'special' && e.f === f) { FX.shake(4); flash(f.x, f.y, 60, 0x9050ff, 3); generic.wave(f.x, f.y, 170, 0xb080ff, 0.5); }
      },
      dispose() { boltsPool.forEach((b) => b.dispose()); branches.forEach((b) => b.dispose()); disposeTree(g); root.remove(g); }
    };
  }

  function foeOfF(f) { return f === BATTLE.a ? BATTLE.b : BATTLE.a; }
  const KITS = { dragoon: kitDragoon, dranzer: kitDranzer, blackdranzer: kitBlackDranzer, driger: kitDriger,
                 draciel: kitDraciel, wolborg: kitWolborg, zeus: kitZeus };

  FX.setupBattle = function (battle) {
    if (!FX.ready) return;
    for (const k of kits) k.dispose();
    kits = [];
    if (generic) generic.dispose();
    generic = makeGeneric();
    add.clear(); smoke.clear();
    shake = 0; flashI = 0; dim = 0; dimTarget = 0;
    for (const f of [battle.a, battle.b]) {
      const make = KITS[f.bey.id];
      if (make) kits.push(make(f));
    }
    markBloom(root);
    // the bit's halo and beam on each bey glow too
    [meshA, meshB].forEach((m) => { const gl = m && m.userData.glow; if (gl) { gl.halo.layers.enable(BLOOM_LAYER); gl.beam.layers.enable(BLOOM_LAYER); } });
    warmUp();
  };

  // precompile all shaders at battle start, compiling mid-fight = stutter
  function warmUp() {
    try {
      R.compile(S, C);
      // bloom renders into render targets (normal + glow-only with no lights),
      // each needs its own shader variant
      if (bloomComposer) {
        const prev = R.getRenderTarget();
        R.setRenderTarget(bloomComposer.renderTarget1);
        R.compile(S, C);
        C.layers.set(BLOOM_LAYER); R.compile(S, C); C.layers.set(0);
        R.setRenderTarget(prev);
      }
    } catch (e) { C.layers.set(0); /* not fatal: shaders will compile on first use */ }
  }

  FX.update = function (battle, dt, t) {
    dimTarget = 0;
    for (const e of battle.events) {
      generic.onEvent(e);
      for (const k of kits) k.onEvent(e);
    }
    for (const k of kits) { k.update(dt, t); if (k.tick) k.tick(dt, t); }
    generic.update(dt);
    add.update(dt); smoke.update(dt);
    // the lights dim during Eclipse Drain and Dark Dimension
    dim += (dimTarget - dim) * Math.min(1, dt * 6);
    if (lights.ambient) lights.ambient.intensity = lights.ambientBase * (1 - dim);
    if (lights.dir) lights.dir.intensity = lights.dirBase * (1 - dim * 0.85);
    // flash of light on big hits
    flashI = Math.max(0, flashI - dt * 9);
    flashLight.intensity = flashI;
    // camera shake, on top of the normal camera movement
    if (shake > 0.05) {
      C.position.x += (Math.random() - 0.5) * shake;
      C.position.y += (Math.random() - 0.5) * shake;
      C.position.z += (Math.random() - 0.5) * shake;
      shake *= Math.max(0, 1 - dt * 9);
    }
    // only run the glow pass when something is glowing, to save battery
    const anyFx = battle.a.special || battle.b.special || battle.a.glow > 0.02 || battle.b.glow > 0.02 ||
      flashI > 0.05 || battle.a.guardTimer > 0 || battle.b.guardTimer > 0 || battle.a.mirror > 0 || battle.b.mirror > 0 ||
      (battle.a.boostTimer > 0) || (battle.b.boostTimer > 0) || battle.waves.length || battle.trails.length;
    bloomLevel += ((anyFx ? 1 : 0) - bloomLevel) * Math.min(1, dt * (anyFx ? 10 : 3));
    dtAvg += (dt - dtAvg) * 0.1;
    if (!lowPower && bloomLevel > 0.5 && dtAvg > 1 / 30) {
      slowT += dt;
      if (slowT > 2.5) { lowPower = true; console.info('FX: glow turned off to keep the game smooth on this device.'); }
    } else slowT = Math.max(0, slowT - dt);
  };
  FX.isLowPower = function () { return lowPower; };

  window.FX = FX;
})();
