// script.js - Interactivo cinematográfico: árbol, flores, corazón, sonidos y UI.
// Organización: init() orchestrates the sequence. Comments inline for easy edits.

(() => {
  // Config
  const relationshipStart = new Date('2025-04-04T21:49:00'); // UTC or local? treated as local
  const FLOWER_COLOR = '#ffd86b';
  const MAX_FLOWERS = 240; // adjust for density/performance

  // DOM refs
  const intro = document.getElementById('intro');
  const enterBtn = document.getElementById('enterBtn');
  const stage = document.getElementById('stage');
  const skyGradient = document.getElementById('skyGradient');
  const treeGroup = document.getElementById('treeGroup');
  const counterCard = document.getElementById('counterCard');
  const counterEls = {
    months: document.getElementById('months'),
    days: document.getElementById('days'),
    hours: document.getElementById('hours'),
    minutes: document.getElementById('minutes'),
    seconds: document.getElementById('seconds'),
  };
  const letterCard = document.getElementById('letterCard');
  const letterEl = document.getElementById('letter');
  const editLetterBtn = document.getElementById('editLetter');
  const finalPhrase = document.getElementById('finalPhrase');

  // Canvas elements
  const starCanvas = document.getElementById('starfield');
  const ambientCanvas = document.getElementById('ambientParticles');
  const butterfliesLayer = document.getElementById('butterflies');
  const petalsLayer = document.getElementById('petals');
  const sparklesLayer = document.getElementById('sparkles');

  // audio context and ambient sources
  let audioCtx = null;
  let ambientGain = null;
  let windNode, leavesNode, birdsNode;

  // state
  let flowers = [];
  let treePaths = []; // SVG path elements for branches
  let heartFormed = false;

  // Responsive canvas sizing
  function resizeCanvases() {
    starCanvas.width = window.innerWidth;
    starCanvas.height = window.innerHeight;
    ambientCanvas.width = window.innerWidth;
    ambientCanvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvases);

  // ----- STARFIELD -----
  function initStarfield() {
    resizeCanvases();
    const ctx = starCanvas.getContext('2d');
    const w = starCanvas.width, h = starCanvas.height;
    const stars = [];
    const count = Math.round((w*h)/50000); // density
    for (let i=0;i<count;i++){
      stars.push({
        x: Math.random()*w,
        y: Math.random()*h,
        r: Math.random()*1.4 + 0.4,
        a: Math.random()*0.9 + 0.1,
        tw: Math.random()*2 + 1.5
      });
    }
    // subtle twinkle
    function draw(t){
      ctx.clearRect(0,0,w,h);
      for (const s of stars){
        const a = s.a * (0.7 + 0.3 * Math.sin((t/1000) * s.tw + s.x));
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  // ----- AMBIENT PARTICLES (sparkles/pollen) -----
  function startAmbientParticles() {
    const ctx = ambientCanvas.getContext('2d');
    const w = ambientCanvas.width, h = ambientCanvas.height;
    const particles = [];
    for (let i=0;i<60;i++){
      particles.push({
        x: Math.random()*w,
        y: Math.random()*h,
        r: Math.random()*2 + 0.5,
        vx: (Math.random()-0.5)*0.2,
        vy: -0.05 - Math.random()*0.2,
        alpha: Math.random()*0.7 + 0.2,
        tw: Math.random()*3 + 1
      });
    }
    function loop(t){
      ctx.clearRect(0,0,w,h);
      for (const p of particles){
        p.x += p.vx;
        p.y += p.vy;
        p.alpha = 0.2 + 0.6 * (0.5 + 0.5*Math.sin((t/1000)*p.tw + p.x));
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,220,120,${p.alpha})`;
        ctx.arc(p.x, p.y, p.r,0,Math.PI*2);
        ctx.fill();
        if (p.y < -10 || p.x < -10 || p.x > w+10){
          p.x = Math.random()*w;
          p.y = h + 10 + Math.random()*40;
        }
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  // ----- WEB AUDIO: ambient synthesis (wind, leaves, birds) -----
  function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    ambientGain = audioCtx.createGain();
    ambientGain.gain.value = 0.0; // start silent, fade in
    ambientGain.connect(audioCtx.destination);

    // WIND: filtered noise
    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++){
      output[i] = Math.random()*2 - 1;
    }
    windNode = audioCtx.createBufferSource();
    windNode.buffer = noiseBuffer;
    windNode.loop = true;
    const windFilter = audioCtx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 800;
    const windGain = audioCtx.createGain();
    windGain.gain.value = 0.06;
    windNode.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ambientGain);

    // Leaves: gentle brush using noise + lowpass with slow LFO
    const leavesNodeBuff = audioCtx.createBuffer(1, 1 * audioCtx.sampleRate, audioCtx.sampleRate);
    const leavesOut = leavesNodeBuff.getChannelData(0);
    for (let i = 0; i < leavesOut.length; i++) leavesOut[i] = (Math.random()*2-1)*0.4;
    leavesNode = audioCtx.createBufferSource();
    leavesNode.buffer = leavesNodeBuff;
    leavesNode.loop = true;
    const leavesFilter = audioCtx.createBiquadFilter();
    leavesFilter.type = 'lowpass';
    leavesFilter.frequency.value = 1500;
    const leavesGain = audioCtx.createGain();
    leavesGain.gain.value = 0.03;
    leavesNode.connect(leavesFilter);
    leavesFilter.connect(leavesGain);
    leavesGain.connect(ambientGain);

    // Birds: periodic chirps synthesized using oscillators and envelope
    birdsNode = { timers: [] };

    windNode.start();
    leavesNode.start();
  }

  function fadeInAmbient() {
    if (!ambientGain) return;
    const now = audioCtx.currentTime;
    ambientGain.gain.cancelScheduledValues(now);
    ambientGain.gain.setValueAtTime(0, now);
    ambientGain.gain.linearRampToValueAtTime(1.0, now + 3.0);
    // schedule occasional bird chirps
    scheduleBirds();
  }

  function scheduleBirds(){
    if (!audioCtx) return;
    const interval = () => 4 + Math.random()*8;
    function chirp(){
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      const f = 900 + Math.random()*700;
      osc.frequency.setValueAtTime(f, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8 + Math.random()*0.6);
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 3000;
      osc.connect(filter); filter.connect(gain); gain.connect(ambientGain);
      osc.start(now);
      osc.stop(now + 1.4 + Math.random()*0.8);
    }
    (function loop(){
      chirp();
      const t = setTimeout(loop, (interval()*1000));
      birdsNode.timers.push(t);
    })();
  }

  // ----- Sky transition (amanecer) -----
  async function dawnSequence() {
    // animate gradient stops
    const top = document.getElementById('gradTop');
    const mid = document.getElementById('gradMid');
    const bottom = document.getElementById('gradBottom');

    // animate over ~9 seconds smoothly
    const duration = 9000;
    const start = performance.now();
    const startVals = {
      top: '#071128',
      mid: '#0b1830',
      bottom: '#05101a'
    };
    const endVals = {
      top: '#ffd9a8',
      mid: '#ffc9a0',
      bottom: '#ffe6cc'
    };

    function lerpColor(a,b,t){
      const pa = hexToRgb(a), pb = hexToRgb(b);
      const r = Math.round(pa.r + (pb.r - pa.r) * t);
      const g = Math.round(pa.g + (pb.g - pa.g) * t);
      const bl = Math.round(pa.b + (pb.b - pa.b) * t);
      return `rgb(${r},${g},${bl})`;
    }

    return new Promise(resolve => {
      function frame(now){
        const t = Math.min(1, (now - start) / duration);
        top.setAttribute('stop-color', lerpColor(startVals.top, endVals.top, easeInOutCubic(t)));
        mid.setAttribute('stop-color', lerpColor(startVals.mid, endVals.mid, easeInOutCubic(t)));
        bottom.setAttribute('stop-color', lerpColor(startVals.bottom, endVals.bottom, easeInOutCubic(t)));
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  // ----- Tree drawing algorithm (recursive branching) -----
  // We'll draw an organic tree with paths; each path grows (stroke-draw) and then spawns children.
  function createBranchPath(points, thickness=8) {
    const ns = 'http://www.w3.org/2000/svg';
    const path = document.createElementNS(ns, 'path');
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i=1;i<points.length;i++){
      const p = points[i];
      d += ` L ${p.x} ${p.y}`;
    }
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'rgba(60,40,20,0.98)');
    path.setAttribute('stroke-linecap','round');
    path.setAttribute('stroke-linejoin','round');
    path.setAttribute('stroke-width', thickness);
    path.style.strokeDasharray = path.getTotalLength();
    path.style.strokeDashoffset = path.getTotalLength();
    path.style.transition = 'stroke-dashoffset 900ms linear';
    return path;
  }

  // generate branching recursively with randomization
  function generateTreeSkeleton(maxDepth = 6) {
    const branches = [];
    const trunk = {
      start: {x: 0, y: 0},
      end: {x: 0, y: -260},
      thickness: 16,
      depth: 0,
      angle: -90
    };
    function branchFrom(segment, depth){
      const steps = 18;
      const points = [];
      for (let i=0;i<=steps;i++){
        const t = i/steps;
        // curve outward slightly using sin wave and randomness
        const x = segment.start.x + (segment.end.x - segment.start.x) * t + Math.sin(t*Math.PI)* (depth*2 + Math.random()*8) * (Math.random()-0.5);
        const y = segment.start.y + (segment.end.y - segment.start.y) * t;
        points.push({x,y});
      }
      branches.push({points,thickness: Math.max(1, segment.thickness - depth*2), depth: segment.depth});
      if (depth < maxDepth){
        // spawn 1-3 child branches from random points along this branch
        const childCount = 1 + (Math.random() < 0.7 ? 1 : 0);
        for (let c=0;c<childCount;c++){
          const spawnT = 0.35 + Math.random()*0.5;
          const spawnPoint = {
            x: segment.start.x + (segment.end.x - segment.start.x) * spawnT,
            y: segment.start.y + (segment.end.y - segment.start.y) * spawnT
          };
          // child end offset with angle and randomness
          const length = 60 * (1 - depth/maxDepth) * (0.6 + Math.random()*0.8);
          const angle = (-90 + (Math.random()*60 - 30)) + (depth*6 * (Math.random()-0.5));
          const rad = angle * Math.PI/180;
          const end = {
            x: spawnPoint.x + Math.cos(rad) * length,
            y: spawnPoint.y + Math.sin(rad) * length
          };
          branchFrom({start: spawnPoint, end, thickness: Math.max(1, segment.thickness - 2), depth: depth+1}, depth+1);
        }
      }
    }
    branchFrom(trunk, 0);
    return branches;
  }

  // draw and animate tree
  async function drawTree() {
    const skeleton = generateTreeSkeleton(6);
    treePaths = [];
    // draw trunk first (the first branch)
    for (let i=0;i<skeleton.length;i++){
      const node = skeleton[i];
      const path = createBranchPath(node.points, node.thickness);
      treeGroup.appendChild(path);
      treePaths.push(path);
      // animate with stagger based on depth
      const delay = Math.min(1600, node.depth * 350 + i*30);
      await wait(delay);
      path.style.transition = `stroke-dashoffset ${800 + node.depth*300}ms cubic-bezier(.2,.9,.2,1)`;
      path.style.strokeDashoffset = 0;
      // small pause so branches don't appear simultaneously
    }
  }

  // ---- Flowers: spawn on branches progressively -----
  function samplePointsOnPath(path, count) {
    const len = path.getTotalLength();
    const points = [];
    for (let i=0;i<count;i++){
      const t = Math.random() * 0.95; // avoid tips
      const p = path.getPointAtLength(len * t);
      points.push({x:p.x, y:p.y});
    }
    return points;
  }

  function createFlower(x,y,delay=0){
    const ns = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns,'g');
    g.setAttribute('class','flower');
    g.setAttribute('transform',`translate(${x},${y}) scale(0.0001)`);
    // center circle + petals (simpler for performance)
    const pet = document.createElementNS(ns,'circle');
    pet.setAttribute('r',6);
    pet.setAttribute('fill',FLOWER_COLOR);
    pet.setAttribute('fill-opacity',0.95);
    pet.style.filter = 'drop-shadow(0 6px 8px rgba(0,0,0,0.18))';
    g.appendChild(pet);
    // small inner highlight
    const inner = document.createElementNS(ns,'circle');
    inner.setAttribute('r',3);
    inner.setAttribute('fill','#fff6d6');
    inner.setAttribute('fill-opacity',0.5);
    inner.setAttribute('transform','translate(1,-1)');
    g.appendChild(inner);

    // interaction
    g.addEventListener('pointerdown', (e)=>{
      e.stopPropagation();
      bloomFlowerEffect(g);
    });

    treeGroup.appendChild(g);
    flowers.push({el:g, x, y, locked:false});
    // animate birth
    setTimeout(()=>{
      g.style.transition = 'transform 700ms cubic-bezier(.16,1,.3,1), opacity 500ms';
      g.setAttribute('transform',`translate(${x},${y}) scale(1)`);
      // small gentle float
      animateFloat(g);
    }, delay);
  }

  function animateFloat(el){
    let dir = (Math.random()>0.5)?1:-1;
    const amp = 6 + Math.random()*8;
    const speed = 3000 + Math.random()*3000;
    let start = performance.now();
    function f(t){
      const dt = (t - start);
      const off = Math.sin(dt / speed * Math.PI*2) * amp * dir;
      el.setAttribute('transform', `translate(${el.__x||0},${(el.__y||0)+off}) scale(1)`);
      requestAnimationFrame(f);
    }
    // store base coords
    const tr = el.getAttribute('transform');
    const m = tr.match(/translate\(([-\d.]+),([-
